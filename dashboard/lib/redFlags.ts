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
