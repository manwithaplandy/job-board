export type Status = "open" | "closed" | "all";

export interface Filters {
  companies: number[];
  include: string[];
  exclude: string[];
  remoteOnly: boolean;
  status: Status;
}

const FILTER_KEYS = ["company", "include", "exclude", "remote", "status"] as const;

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

  return {
    companies: csv(first(params.company))
      .map(Number)
      .filter((n) => Number.isInteger(n)),
    include: hasAnyFilter ? csv(first(params.include)) : defaults.include,
    exclude: csv(first(params.exclude)),
    remoteOnly: first(params.remote) === "1",
    status: validStatus,
  };
}
