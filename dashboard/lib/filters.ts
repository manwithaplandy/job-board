import { VERDICT_OPTIONS, PUBLIC_BOARD_INCLUDE_KEYWORDS } from "@/lib/config";

export type Status = "open" | "closed" | "all";
export type Verdict = (typeof VERDICT_OPTIONS)[number];

export interface Filters {
  companies: number[];
  include: string[];
  exclude: string[];
  remoteOnly: boolean;
  status: Status;
  verdict: Verdict;
  experience: string;
  industry: string;
  subcategory: string;
  location: string;
}

const FILTER_KEYS = [
  "company", "include", "exclude", "remote", "status",
  "verdict", "experience", "industry", "subcategory", "location",
] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function csv(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  defaults: { include: string[] },
): Filters {
  const hasAnyFilter = FILTER_KEYS.some((k) => first(params[k]) !== undefined);
  const status = first(params.status);
  const validStatus: Status =
    status === "closed" || status === "all" ? status : "open";
  const verdictRaw = first(params.verdict);
  const verdict: Verdict =
    verdictRaw && (VERDICT_OPTIONS as readonly string[]).includes(verdictRaw)
      ? (verdictRaw as Verdict)
      : "approve";

  return {
    companies: csv(first(params.company)).map(Number).filter((n) => Number.isInteger(n)),
    include: hasAnyFilter ? csv(first(params.include)) : defaults.include,
    exclude: csv(first(params.exclude)),
    remoteOnly: first(params.remote) === "1",
    status: validStatus,
    verdict,
    experience: first(params.experience) ?? "",
    industry: first(params.industry) ?? "",
    subcategory: first(params.subcategory) ?? "",
    location: first(params.location) ?? "",
  };
}

// The board's server-side Filters, one object per viewer class. All client filters now
// apply client-side (app/page.tsx passes {} to parseFilters), so the ONLY server-side
// decision left is the title-keyword prefilter's default:
//   - "authed" -> include: []  The reviewer's verdict='approve' join already curates the
//     viewer's board, so a title prefilter on top only drops correctly-approved matches
//     and empties non-engineer tenants' boards (bug 2026-07-19). include: [] also makes
//     the authed board agree with getReviewFeed / getRejectedJobs (both include: []),
//     so matches streamed during a review run survive the settle-time router.refresh().
//   - "anon" -> include: PUBLIC_BOARD_INCLUDE_KEYWORDS  Deliberate public-board curation;
//     the public board has no per-user reviews.
// Named serverBoardFilters (not boardFilters) to disambiguate from the client-side
// lib/rolefit/boardFilters.ts.
export function serverBoardFilters(audience: "authed" | "anon"): Filters {
  return parseFilters({}, {
    include: audience === "authed" ? [] : PUBLIC_BOARD_INCLUDE_KEYWORDS,
  });
}
