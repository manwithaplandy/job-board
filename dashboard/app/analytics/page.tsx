import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { getPipelineSnapshot, getRunSeries } from "@/lib/metrics";
import { PipelineDashboard } from "@/components/analytics/PipelineDashboard";
import { SlimHeader } from "@/components/rolefit/SlimHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics · Rolefit" };

// This dashboard fans out ~29 aggregate queries (incl. full/large scans of the large
// jobs table) per render. Recomputing that on every request overwhelmed the DB and the
// page hit the Postgres statement timeout / Vercel function timeout. Operator analytics
// does not need per-request freshness, so cache the heavy reads for a short window: the
// fan-out now runs at most once per REVALIDATE_SECONDS instead of on every load, and the
// many other loads serve the cached snapshot instantly. `nowIso` stays per-request so
// relative-time labels remain current even when the data is served from cache.
// Operator analytics changes slowly (the poller runs every ~2h), so a longer
// window is fine and means a real user hits the cold ~30-query fan-out far less
// often. The fan-out itself is also much cheaper now that functions are
// co-located with the DB (sfo1 / us-west-1), so the rare cold render is ~1.5s
// rather than the ~5.7s it was cross-region.
const REVALIDATE_SECONDS = 600;

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
  // Sequential, not Promise.all: the metrics queries run one at a time (see lib/metrics
  // `seq`) to avoid overwhelming the DB connection pool, so there's no benefit to racing
  // the two cached groups — and keeping them sequential guarantees no concurrent fan-out.
  const snapshot = await cachedSnapshot(userId);
  const series = await cachedRunSeries();
  return (
    <>
      <SlimHeader current="analytics" />
      <PipelineDashboard snapshot={snapshot} series={series} nowIso={new Date().toISOString()} />
    </>
  );
}
