import { parseFilters } from "@/lib/filters";
import {
  getBoardOwnerId, getCompanies, getJobs, getLatestPollRun,
  getLatestReviewRun, getReviewStats,
} from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, ownerId] = await Promise.all([getUserId(), getBoardOwnerId()]);
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun] = await Promise.all([
    getJobs(filters, ownerId),
    getCompanies(),
    getLatestPollRun(),
  ]);
  // Operator-only run telemetry; hidden from anonymous visitors.
  const [lastReview, reviewStats] = viewerId
    ? await Promise.all([getLatestReviewRun(), getReviewStats(viewerId)])
    : [null, null];

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} lastReview={lastReview}
        reviewStats={reviewStats} isAuthed={!!viewerId} />
      <FilterBar companies={companies} filters={filters} showReviewFilters={!!ownerId} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS}
        showMatch={!!ownerId} />
    </main>
  );
}
