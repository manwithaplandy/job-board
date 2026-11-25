// Fixed display text for the closed metric catalog (lib/workspaces/metrics/catalog.ts),
// used by the StatRow and MetricChart blocks. Pure.
import { RATE_METRICS } from "@/lib/workspaces/metrics/catalog";
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

export const NOT_ENOUGH_DATA = "Not enough data yet";
/** A metric reference that no longer indexes the surface's gathered metrics. */
export const METRIC_GONE_TEXT = "This figure is no longer available.";

/** The headline of a metric with no single figure (stage medians, average fit by group). */
export const NO_SINGLE_FIGURE = "Shown per group";

/** "n = 12": the denominator of a rate. Only rates show it. */
export function sampleLabel(n: number): string {
  return `n = ${n.toLocaleString("en-US")}`;
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * What each metric's n counts (lib/workspaces/metrics/queries.ts), worded so the line
 * names the quantity; null where the figure is itself that count and nothing else. Only
 * a rate's n is a denominator, and only a rate reads "n = X".
 */
const COUNT_LABELS: Record<MetricId, ((n: number) => string) | null> = {
  response_rate: sampleLabel,
  stale_applications: (n) => `of ${count(n, "application", "applications")} at Applied`,
  time_in_stage: (n) => `from ${count(n, "stage move", "stage moves")}`,
  fit_shortlisted_vs_applied: (n) => `from ${count(n, "fit score", "fit scores")}`,
  applications_by_stage: (n) => `${count(n, "application", "applications")} in all`,
  applications_over_time: (n) => `${count(n, "application", "applications")} sent in all`,
  shortlist_funnel: (n) => `${count(n, "job", "jobs")} shortlisted`,
  skip_reasons: (n) => `${count(n, "skip", "skips")} with a reason`,
  weekly_activity: (n) => `${count(n, "action", "actions")} in all`,
  memo_changes: null,
};

/** Metrics with no single figure: their n is not what the label names (medians, averages). */
const NO_HEADLINE: ReadonlySet<MetricId> = new Set(["time_in_stage", "fit_shortlisted_vs_applied"]);

/** The line saying exactly what a figure's count is, or null when there is nothing to add. */
export function countLabel(m: MetricResult): string | null {
  return COUNT_LABELS[m.spec.metric]?.(m.n) ?? null;
}

/** The headline figure of a metric, as text. */
export function metricValue(m: MetricResult): string {
  if (m.kind === "value") {
    if (m.value === null || !Number.isFinite(m.value)) return NOT_ENOUGH_DATA;
    return RATE_METRICS.has(m.spec.metric) ? `${Math.round(m.value * 100)}%` : m.value.toLocaleString("en-US");
  }
  if (NO_HEADLINE.has(m.spec.metric)) return NO_SINGLE_FIGURE;
  if (m.kind === "series") return m.points.reduce((sum, p) => sum + p.y, 0).toLocaleString("en-US");
  return m.n.toLocaleString("en-US");
}
