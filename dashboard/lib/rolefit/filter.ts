import type { JobRow } from "@/lib/types";

export interface BoardFilterState {
  search: string;
  cats: string[];
  locs: string[];
  sources: string[];
  // Company-classification facets (companies.industry/size/hq_country). Each holds the
  // raw stored values the viewer selected, with "unknown" standing in for a NULL field.
  industries: string[];
  sizes: string[];
  countries: string[];
  remote: "all" | "remote" | "hybrid" | "onsite";
  minFit: number;
  payMin: number;              // $k, 0 = no floor
  payMax: number | null;       // $k, null = "+" (no upper limit)
  payIncludeUndisclosed: boolean;
  sort: "match" | "pay" | "newest" | "az";
}

export const DEFAULT_FILTERS: BoardFilterState = {
  search: "",
  cats: [],
  locs: [],
  sources: [],
  industries: [],
  sizes: [],
  countries: [],
  remote: "all",
  minFit: 0,
  payMin: 0,
  payMax: null,
  payIncludeUndisclosed: false,
  sort: "match",
};

// $k bounds for the Pay range slider — shared with the filter-state parser so the slider's
// reachable values and the parser's clamp window can never drift.
export const PAY_FLOOR = 0;
export const PAY_CEIL = 400;
export const PAY_STEP = 10;

// The pay filter does something only once a bound is narrowed from the full unbounded span.
export function payRangeActive(st: BoardFilterState): boolean {
  return st.payMin > 0 || st.payMax !== null;
}

// The Pay pill's badge label for the current range; null when the filter is inactive.
export function fmtPayRange(payMin: number, payMax: number | null): string | null {
  if (payMin <= 0 && payMax == null) return null;
  if (payMax == null) return `$${payMin}k+`;
  if (payMin <= 0) return `Up to $${payMax}k`;
  return `$${payMin}–${payMax}k`;
}

function arrangementOf(j: JobRow): string {
  if (j.work_arrangement) return j.work_arrangement;
  if (j.remote === true) return "remote";
  return "unknown";
}

// A job's filterable location values: stamped canonicals, else the raw string —
// mirroring SQL's COALESCE(j.location_canonicals, ARRAY[j.location]).
function locationsOf(j: JobRow): string[] {
  if (j.location_canonicals?.length) return j.location_canonicals;
  return j.location ? [j.location] : [];
}

// Keep a job under the pay range filter. Window = [payMin, payMax] in $k (payMax null =
// unbounded top). A job contributes an annual band [pay_min ?? 0, pay_max ?? ∞] only when it
// discloses annual pay; jobs without one (hourly, or no pay listed) pass only when the user
// opted to include undisclosed pay. Band-overlaps-window: the two intervals intersect.
function passesPayRange(j: JobRow, st: BoardFilterState): boolean {
  if (!payRangeActive(st)) return true;
  const hasBand = j.pay_period === "year" && (j.pay_min != null || j.pay_max != null);
  if (!hasBand) return st.payIncludeUndisclosed;
  const winLo = st.payMin * 1000;
  const winHi = st.payMax == null ? Infinity : st.payMax * 1000;
  const jobLo = j.pay_min ?? 0;
  const jobHi = j.pay_max ?? Infinity;
  return jobLo <= winHi && winLo <= jobHi;
}

export function applyFilters(jobs: JobRow[], st: BoardFilterState): JobRow[] {
  const q = st.search.trim().toLowerCase();
  return jobs.filter((j) => {
    if (q) {
      const hay = `${j.title} ${j.company_name} ${j.location ?? ""} ${j.role_category ?? ""} ${(j.skill_gaps ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (st.cats.length && !(j.role_category && st.cats.includes(j.role_category))) return false;
    if (st.locs.length) {
      const locs = locationsOf(j);
      const hit = st.locs.some((l) => locs.includes(l)) ||
        (st.locs.includes("Remote") && j.remote === true);
      if (!hit) return false;
    }
    if (st.sources.length && !st.sources.includes(j.ats)) return false;
    if (st.industries.length && !st.industries.includes(j.industry ?? "unknown")) return false;
    if (st.sizes.length && !st.sizes.includes(j.size ?? "unknown")) return false;
    if (st.countries.length && !st.countries.includes(j.hq_country ?? "unknown")) return false;
    if (st.remote !== "all" && arrangementOf(j) !== st.remote) return false;
    if (st.minFit && (j.fit_score ?? 0) < st.minFit) return false;
    if (!passesPayRange(j, st)) return false;
    return true;
  });
}

export function sortJobs(jobs: JobRow[], sort: BoardFilterState["sort"]): JobRow[] {
  const nullLast = (n: number | null) => (n == null ? -Infinity : n);
  const copy = [...jobs];
  switch (sort) {
    case "pay": return copy.sort((a, b) => nullLast(b.pay_max) - nullLast(a.pay_max));
    case "newest": return copy.sort((a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at));
    case "az": return copy.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "match":
    default: return copy.sort((a, b) => nullLast(b.fit_score) - nullLast(a.fit_score));
  }
}

export function facetCounts(jobs: JobRow[]): {
  categories: Record<string, number>;
  locations: Record<string, number>;
  sources: Record<string, number>;
  industries: Record<string, number>;
  sizes: Record<string, number>;
  countries: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  const locations: Record<string, number> = {};
  const sources: Record<string, number> = {};
  // Company-classification facets: a NULL/absent field is bucketed under "unknown" so the
  // facet is a complete partition of the board (mirrors applyFilters' `?? "unknown"`).
  const industries: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  const countries: Record<string, number> = {};
  for (const j of jobs) {
    if (j.role_category) categories[j.role_category] = (categories[j.role_category] ?? 0) + 1;
    for (const l of locationsOf(j)) {
      if (l !== "Remote") locations[l] = (locations[l] ?? 0) + 1;
    }
    if (j.remote === true) locations["Remote"] = (locations["Remote"] ?? 0) + 1;
    if (j.ats) sources[j.ats] = (sources[j.ats] ?? 0) + 1;
    const ind = j.industry ?? "unknown";
    industries[ind] = (industries[ind] ?? 0) + 1;
    const sz = j.size ?? "unknown";
    sizes[sz] = (sizes[sz] ?? 0) + 1;
    const ctry = j.hq_country ?? "unknown";
    countries[ctry] = (countries[ctry] ?? 0) + 1;
  }
  return { categories, locations, sources, industries, sizes, countries };
}

// Partition the board by application status. `applied` holds the ids of jobs the
// viewer has marked applied. The default board hides them (like a reject); the
// Applied view shows only them. Applied state lives in the loaded packages (client
// side), mirroring the rejectedIds hide in RolefitBoard — not the SQL query.
export function filterByApplied(
  jobs: JobRow[],
  applied: ReadonlySet<string>,
  appliedView: boolean,
): JobRow[] {
  return jobs.filter((j) => (appliedView ? applied.has(j.id) : !applied.has(j.id)));
}

// The Rejected view's candidate pool: the approve-loaded board rows PLUS the operator's
// server-loaded rejects (verdict='deny' + human_override), deduped by id (the board row
// wins on a collision). The server rejects aren't in the approve list, so folding them
// in is what makes a mis-clicked reject recoverable across reloads, not just in-session.
// A no-op (returns `jobs` as-is) when there are no server rejects — the common case.
export function mergeRejectedPool(jobs: JobRow[], serverRejected: JobRow[]): JobRow[] {
  if (!serverRejected.length) return jobs;
  const byId = new Map(jobs.map((j) => [j.id, j]));
  for (const j of serverRejected) if (!byId.has(j.id)) byId.set(j.id, j);
  return [...byId.values()];
}

// Three-way view partition: "all" hides both rejected and applied; "applied" shows only
// applied; "rejected" shows only rejected — seeded from the server rejects union the
// in-session rejects (see RolefitBoard), so both a reload and a live reject show up.
export function filterByView(
  jobs: JobRow[],
  view: "all" | "applied" | "rejected",
  rejectedIds: ReadonlySet<string>,
  appliedIds: ReadonlySet<string>,
): JobRow[] {
  if (view === "rejected") return jobs.filter((j) => rejectedIds.has(j.id));
  if (view === "applied") return jobs.filter((j) => appliedIds.has(j.id));
  // "all" — hide both rejected and applied
  return jobs.filter((j) => !rejectedIds.has(j.id) && !appliedIds.has(j.id));
}
