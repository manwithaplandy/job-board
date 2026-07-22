export type RedFlagCategory =
  | "consulting_agency"
  | "defense_military"
  | "non_tech"
  | "unknown_unverified"
  | "early_stage_risk"
  | "values_mismatch"
  | "other";

export interface RedFlag {
  category: RedFlagCategory;
  note: string | null;
}

export const RED_FLAG_LABELS: Record<RedFlagCategory, string> = {
  consulting_agency: "Consulting / agency",
  defense_military: "Defense / military",
  non_tech: "Not a tech company",
  unknown_unverified: "Unknown / unverified",
  early_stage_risk: "Early-stage risk",
  values_mismatch: "Values mismatch",
  other: "Other",
};

// Human-readable text for one red flag. For `other`, prefer the free-text note.
// Tolerant of legacy bare-string flags (rows not yet backfilled).
export function redFlagLabel(flag: RedFlag | string): string {
  if (typeof flag === "string") return flag;
  if (flag.category === "other") return flag.note ?? "Other";
  return RED_FLAG_LABELS[flag.category] ?? flag.category;
}

// Label for a raw category key (as returned by the metrics aggregation query).
// Unknown keys pass through so a not-yet-labeled category is still visible.
export function redFlagCategoryLabel(key: string): string {
  return RED_FLAG_LABELS[key as RedFlagCategory] ?? key;
}

// Total parser for a jsonb red_flags column ([{category, note}]) — colocated with the
// RedFlag type per the house rule (dashboard/CLAUDE.md: never `as`-cast a jsonb read).
// Tolerates a double-encoded string scalar; drops malformed members; returns null for a
// non-array (the UI degrades to "no flags"). `category` is kept as any non-empty string —
// forward-compatible with categories added Python-side before RedFlagCategory catches up
// (redFlagLabel/redFlagCategoryLabel already pass unknown keys through), so a real flag is
// never silently dropped. `note` coerces to null when absent or non-string.
export function parseRedFlags(raw: unknown): RedFlag[] | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  const out: RedFlag[] = [];
  for (const el of v) {
    if (el == null || typeof el !== "object" || Array.isArray(el)) continue;
    const o = el as Record<string, unknown>;
    if (typeof o.category !== "string" || o.category === "") continue;
    out.push({
      category: o.category as RedFlagCategory,
      note: typeof o.note === "string" ? o.note : null,
    });
  }
  return out;
}
