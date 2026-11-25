// Fixed display text for the closed metric catalog (lib/workspaces/metrics/catalog.ts),
// used by the StatRow and MetricChart blocks. Pure.
import type { MetricId, MetricResult, MetricSpec } from "@/lib/workspaces/types";

export const METRIC_LABELS: Record<MetricId, string> = {
  applications_by_stage: "Applications by stage",
  applications_over_time: "Applications sent per week",
  response_rate: "Response rate",
  time_in_stage: "Median days in each stage",
  shortlist_funnel: "From shortlist to offer",
  skip_reasons: "Why jobs were skipped",
  fit_shortlisted_vs_applied: "Fit of shortlisted and applied jobs",
  weekly_activity: "Your activity per week",
  stale_applications: "Applications with no news for 10+ days",
  memo_changes: "Changes to what you're looking for",
};

export const WINDOW_LABELS: Record<MetricSpec["window"], string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

/** Metrics whose value is a share from 0 to 1. */
const RATES: ReadonlySet<MetricId> = new Set(["response_rate"]);

export const NOT_ENOUGH_DATA = "Not enough data yet";
/** A metric reference that no longer indexes the surface's gathered metrics. */
export const METRIC_GONE_TEXT = "This figure is no longer available.";

/** "n = 12": how many records a figure rests on. Every rate shows it. */
export function sampleLabel(n: number): string {
  return `n = ${n.toLocaleString("en-US")}`;
}

/** The headline figure of a metric, as text. */
export function metricValue(m: MetricResult): string {
  if (m.kind === "value") {
    if (m.value === null || !Number.isFinite(m.value)) return NOT_ENOUGH_DATA;
    return RATES.has(m.spec.metric) ? `${Math.round(m.value * 100)}%` : m.value.toLocaleString("en-US");
  }
  if (m.kind === "series") return m.points.reduce((sum, p) => sum + p.y, 0).toLocaleString("en-US");
  return m.n.toLocaleString("en-US");
}
