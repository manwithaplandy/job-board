import type { JobRow } from "@/lib/types";

export interface BoardFilterState {
  search: string;
  cats: string[];
  locs: string[];
  remote: "all" | "remote" | "hybrid" | "onsite";
  minFit: number;
  payMin: number; // in $k
  sort: "match" | "pay" | "newest" | "az";
}

export const DEFAULT_FILTERS: BoardFilterState = {
  search: "",
  cats: [],
  locs: [],
  remote: "all",
  minFit: 0,
  payMin: 0,
  sort: "match",
};

function arrangementOf(j: JobRow): string {
  if (j.work_arrangement) return j.work_arrangement;
  if (j.remote === true) return "remote";
  return "unknown";
}

export function applyFilters(jobs: JobRow[], st: BoardFilterState): JobRow[] {
  const q = st.search.trim().toLowerCase();
  return jobs.filter((j) => {
    if (q) {
      const hay = `${j.title} ${j.company_name} ${j.role_category ?? ""} ${(j.skill_gaps ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (st.cats.length && !(j.role_category && st.cats.includes(j.role_category))) return false;
    if (st.locs.length && !(j.location && st.locs.includes(j.location))) return false;
    if (st.remote !== "all" && arrangementOf(j) !== st.remote) return false;
    if (st.minFit && (j.fit_score ?? 0) < st.minFit) return false;
    if (st.payMin) {
      if (j.pay_period !== "year" || j.pay_max == null || j.pay_max < st.payMin * 1000) return false;
    }
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
} {
  const categories: Record<string, number> = {};
  const locations: Record<string, number> = {};
  for (const j of jobs) {
    if (j.role_category) categories[j.role_category] = (categories[j.role_category] ?? 0) + 1;
    if (j.location) locations[j.location] = (locations[j.location] ?? 0) + 1;
  }
  return { categories, locations };
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

// Three-way view partition: "all" hides both rejected and applied; "applied" shows only
// applied; "rejected" shows only session-rejected (optimistic, cleared on reload).
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
