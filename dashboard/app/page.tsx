import { parseFilters } from "@/lib/filters";
import { getCompanies, getJobs, getLatestPollRun, getLatestReviewRun, getReviewStats } from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { requireUserId } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun, lastReview, reviewStats] = await Promise.all([
    getJobs(filters, userId),
    getCompanies(),
    getLatestPollRun(),
    getLatestReviewRun(),
    getReviewStats(userId),
  ]);

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} lastReview={lastReview} reviewStats={reviewStats} />
      <FilterBar companies={companies} filters={filters} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS} />
    </main>
  );
}
