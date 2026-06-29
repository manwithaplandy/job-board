import { requireUserId } from "@/lib/auth";
import { getPipelineSnapshot, getRunSeries } from "@/lib/metrics";
import { PipelineDashboard } from "@/components/analytics/PipelineDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await requireUserId(); // redirects to /login when anonymous
  const [snapshot, series] = await Promise.all([
    getPipelineSnapshot(userId),
    getRunSeries(),
  ]);
  return <PipelineDashboard snapshot={snapshot} series={series} nowIso={new Date().toISOString()} />;
}
