import { unstable_cache } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { getPipelineSnapshot, getRunSeries } from "@/lib/metrics";
import { PipelineDashboard } from "@/components/analytics/PipelineDashboard";

export const dynamic = "force-dynamic";

// This dashboard fans out ~29 aggregate queries (incl. full/large scans of the large
// jobs table) per render. Recomputing that on every request overwhelmed the DB and the
// page hit the Postgres statement timeout / Vercel function timeout. Operator analytics
// does not need per-request freshness, so cache the heavy reads for a short window: the
// fan-out now runs at most once per REVALIDATE_SECONDS instead of on every load, and the
// many other loads serve the cached snapshot instantly. `nowIso` stays per-request so
// relative-time labels remain current even when the data is served from cache.
const REVALIDATE_SECONDS = 120;

// Keyed by userId (passed as the cache-fn argument), so each operator caches separately.
const cachedSnapshot = unstable_cache(
  (userId: string) => getPipelineSnapshot(userId),
  ["analytics-pipeline-snapshot"],
  { revalidate: REVALIDATE_SECONDS },
);
const cachedRunSeries = unstable_cache(
  () => getRunSeries(),
  ["analytics-run-series"],
  { revalidate: REVALIDATE_SECONDS },
);

export default async function AnalyticsPage() {
  const userId = await requireUserId(); // redirects to /login when anonymous
  const [snapshot, series] = await Promise.all([
    cachedSnapshot(userId),
    cachedRunSeries(),
  ]);
  return <PipelineDashboard snapshot={snapshot} series={series} nowIso={new Date().toISOString()} />;
}
