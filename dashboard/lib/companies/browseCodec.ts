import type { CompanyBrowseRow } from "@/lib/types";
import { parseRedFlags } from "@/lib/redFlags";

// Total parser for a jsonb tech_tags column (string[]). Never `as`-cast a jsonb read
// (dashboard/CLAUDE.md): tolerate a double-encoded string scalar, drop non-string members,
// and return null for a non-array (the card degrades to "no tags").
export function parseTechTags(raw: unknown): string[] | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === "string");
}

// Normalize a raw companies-browse DB row into the typed shape at the boundary: jsonb
// columns through their total parsers, classified_at (timestamptz → Date) to ISO or null,
// nullable facts null-coalesced. Mirrors toJobRow / toApplicationPackage in queries.ts.
export function toCompanyBrowseRow(row: Record<string, unknown>): CompanyBrowseRow {
  return {
    id: row.id as number,
    name: row.name as string,
    ats: row.ats as string,
    token: row.token as string,
    industry: (row.industry as string | null) ?? null,
    industry_subcategory: (row.industry_subcategory as string | null) ?? null,
    size: (row.size as string | null) ?? null,
    hq_country: (row.hq_country as string | null) ?? null,
    red_flags: parseRedFlags(row.red_flags),
    tech_tags: parseTechTags(row.tech_tags),
    about: (row.about as string | null) ?? null,
    classified_at:
      row.classified_at instanceof Date
        ? row.classified_at.toISOString()
        : row.classified_at != null
          ? String(row.classified_at)
          : null,
    override_verdict: (row.override_verdict as string | null) ?? null,
  };
}
