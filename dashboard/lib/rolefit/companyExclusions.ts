import { COMPANY_SIZES, isCountryCode } from "@/lib/companyMeta";

// Total parser for profiles.company_exclusions (jsonb). House style: never `as`-cast a
// jsonb column (dashboard/CLAUDE.md) — unwrap + validate here, returning a valid typed
// value. Mirrors lib/rolefit/boardFilters.ts, including the string-tolerance branch.
//
// CONTRACT: the reviewer (reviewer/db.py::select_candidates) and the board
// (lib/jobsQuery.ts) read these SAME jsonb keys in SQL — `industries`, `countries`,
// `sizes`, `redFlagCategories` (exact spelling). Renaming a key here is a cross-language
// break; update both SQL sides in lockstep.
export interface CompanyExclusions {
  industries: string[];
  countries: string[];
  sizes: string[];
  redFlagCategories: string[];
}

// Canon lives in Python and is hardcoded here (no Python import at the TS boundary):
//   industries      → reviewer/schemas.py TAXONOMY keys (7 top-level industries)
//   redFlagCategories → company_discovery/schemas.py RED_FLAG_CATEGORIES (7)
// Sizes reuse COMPANY_SIZES from lib/companyMeta.ts (parity-guarded by
// tests/test_company_meta_parity.py). If these two lists ever need the same cross-
// language guarantee, extend that parity test.
export const EXCLUDABLE_INDUSTRIES = [
  "software_internet",
  "fintech_finance",
  "healthcare_life_sciences",
  "commerce_consumer",
  "industrial_hardware",
  "public_education",
  "services_other",
] as const;

export const EXCLUDABLE_RED_FLAGS = [
  "consulting_agency",
  "defense_military",
  "non_tech",
  "unknown_unverified",
  "early_stage_risk",
  "values_mismatch",
  "other",
] as const;

// Shared per-facet cap. Exported so the write-path action (saveCompanyFilters) can
// reject an over-long list up-front instead of letting this total parser SILENTLY
// truncate it — a shorter stored list than the user typed while "Changes saved" shows
// is the same silent-drop class the 'unknown'-sentinel / bad-token fixes closed. The
// codec and the action must reference this one constant so they can't drift.
export const MAX_EXCLUSION_ITEMS = 50;

// industry='unknown'/NULL is a first-class, filterable value (the classifier can leave a
// company unclassified), so "unknown" joins the taxonomy set. Sizes already include
// "unknown" via COMPANY_SIZES. Countries accept "unknown" alongside ISO-2 codes.
const INDUSTRY_SET = new Set<string>([...EXCLUDABLE_INDUSTRIES, "unknown"]);
const SIZE_SET = new Set<string>(COMPANY_SIZES);
const RED_FLAG_SET = new Set<string>(EXCLUDABLE_RED_FLAGS);

function empty(): CompanyExclusions {
  return { industries: [], countries: [], sizes: [], redFlagCategories: [] };
}

/** Shared empty value for callers that need a stable default reference. */
export const EMPTY_EXCLUSIONS: CompanyExclusions = empty();

// Keep only valid string members, deduped and capped at MAX_EXCLUSION_ITEMS. Non-arrays
// and non-strings / invalid members are dropped (never fail the whole parse — mirrors
// boardFilters). Dedup normalizes legacy/manual rows and stops duplicate write-path
// tokens (e.g. "IN, in" both uppercased) inflating the count toward the cap.
function facet(v: unknown, valid: (x: string) => boolean): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x === "string" && valid(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
    if (out.length >= MAX_EXCLUSION_ITEMS) break;
  }
  return out;
}

export function parseCompanyExclusions(raw: unknown): CompanyExclusions {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    // String-tolerance branch (mirrors parseBoardFilters): a jsonb column can arrive as a
    // double-encoded string scalar from a legacy or manual write. Legit JSON string → parse.
    try {
      obj = JSON.parse(raw);
    } catch {
      return empty();
    }
  }
  if (obj == null || typeof obj !== "object") return empty();
  const o = obj as Record<string, unknown>;
  return {
    industries: facet(o.industries, (x) => INDUSTRY_SET.has(x)),
    countries: facet(o.countries, (x) => x === "unknown" || isCountryCode(x)),
    sizes: facet(o.sizes, (x) => SIZE_SET.has(x)),
    redFlagCategories: facet(o.redFlagCategories, (x) => RED_FLAG_SET.has(x)),
  };
}
