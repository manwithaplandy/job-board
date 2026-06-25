import { VERDICT_OPTIONS } from "@/lib/config";

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
}

const FILTER_KEYS = [
  "company", "include", "exclude", "remote", "status",
  "verdict", "experience", "industry", "subcategory",
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
  };
}
