import { parseFilters } from "@/lib/filters";
import { getCompanies, getJobs, getLatestPollRun } from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

// Always render fresh data (read-only DB query per request).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun] = await Promise.all([
    getJobs(filters),
    getCompanies(),
    getLatestPollRun(),
  ]);

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} />
      <FilterBar companies={companies} filters={filters} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS} />
    </main>
  );
}
