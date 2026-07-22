// Type-only import (erased at compile → NO runtime import cycle with companyExclusions,
// which imports COMPANY_SIZES/isCountryCode from here). Keeps INDUSTRY_LABELS exhaustive
// over the codec's industry taxonomy: adding a key to EXCLUDABLE_INDUSTRIES without a
// label here becomes a typecheck error.
import type { EXCLUDABLE_INDUSTRIES } from "@/lib/rolefit/companyExclusions";

// Company size buckets. MUST match company_discovery/schemas.py COMPANY_SIZES
// (tests/test_company_meta_parity.py regex-extracts this literal).
export const COMPANY_SIZES = [
  "1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+", "unknown",
] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export function isCountryCode(v: string): boolean {
  return /^[A-Z]{2}$/.test(v);
}

// "US" -> "United States"; falls back to the code (or "Unknown") when Intl lacks it.
export function countryLabel(code: string): string {
  if (code === "unknown") return "Unknown";
  if (!isCountryCode(code)) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Humanized labels for the industry taxonomy (canon: reviewer/schemas.py TAXONOMY
// top-level keys, mirrored by EXCLUDABLE_INDUSTRIES in lib/rolefit/companyExclusions.ts)
// plus the synthetic "unknown" bucket (industry NULL / unclassified is a first-class,
// filterable value). This is the ONE label source shared by the settings exclusions form
// (CompanyFiltersForm) and the board Industry facet (FilterBar) so the two can't drift.
export const INDUSTRY_LABELS: Record<
  (typeof EXCLUDABLE_INDUSTRIES)[number] | "unknown",
  string
> = {
  software_internet: "Software & Internet",
  fintech_finance: "Fintech & Finance",
  healthcare_life_sciences: "Healthcare & Life Sciences",
  commerce_consumer: "Commerce & Consumer",
  industrial_hardware: "Industrial & Hardware",
  public_education: "Public Sector & Education",
  services_other: "Services & Other",
  unknown: "Unknown",
};
