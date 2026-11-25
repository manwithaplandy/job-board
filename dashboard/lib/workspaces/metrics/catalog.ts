// The closed metric catalog (plan Task 1.12, spec 6.6). The agent and the analytics
// tiles can only ask for these metrics, each with the groupings, windows and filters it
// allows; new metrics are added here in code only. Pure: safe to import anywhere.
import { z } from "zod";
import type { MetricId, MetricSpec, Stage } from "@/lib/workspaces/types";

export const METRIC_IDS = [
  "applications_by_stage",
  "applications_over_time",
  "response_rate",
  "time_in_stage",
  "shortlist_funnel",
  "skip_reasons",
  "fit_shortlisted_vs_applied",
  "weekly_activity",
  "stale_applications",
  "memo_changes",
] as const satisfies readonly MetricId[];

export const STAGES = ["preparing", "ready", "applied", "interviewing", "offer", "closed"] as const satisfies readonly Stage[];
export const METRIC_WINDOWS = ["7d", "30d", "90d", "all"] as const;
export const METRIC_GROUP_BYS = ["stage", "week", "reason"] as const;
export type MetricWindow = (typeof METRIC_WINDOWS)[number];
export type MetricKind = "value" | "series" | "rows";

/** Days back from now for each window; null is all time. */
export const WINDOW_DAYS: Record<MetricWindow, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

/** Applications with no event for this many days, by the catalog clock, are stale. */
export const STALE_AFTER_DAYS = 10;
/** response_rate has no value below this many applications. */
export const RESPONSE_RATE_MIN_N = 5;

export interface MetricCatalogEntry {
  kind: MetricKind;
  groupBy: ReadonlyArray<MetricSpec["groupBy"] & string>;
  windows: readonly MetricWindow[];
  /** Whether filter.stage applies. */
  stageFilter: boolean;
  /** One line shown to the model. */
  description: string;
}

const ALL_WINDOWS = METRIC_WINDOWS;

export const METRIC_CATALOG: Record<MetricId, MetricCatalogEntry> = {
  applications_by_stage: {
    kind: "rows",
    groupBy: ["stage"],
    windows: ALL_WINDOWS,
    stageFilter: true,
    description: "Tracked applications per stage (columns stage, count), counted by when they were added.",
  },
  applications_over_time: {
    kind: "series",
    groupBy: ["week"],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description: "Applications moved to applied per week (x is the week's Monday, y the count).",
  },
  response_rate: {
    kind: "value",
    groupBy: [],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description:
      "Share (0 to 1) of applications applied in the window that got a response: an interview, an offer or a rejection. Null below 5 applications.",
  },
  time_in_stage: {
    kind: "rows",
    groupBy: ["stage"],
    windows: ALL_WINDOWS,
    stageFilter: true,
    description: "Median days spent in each stage before the next move (columns stage, median_days, moves).",
  },
  shortlist_funnel: {
    kind: "rows",
    groupBy: [],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description:
      "Jobs added to the shortlist in the window and how far they got: in shortlist, kept, applied, interviewing, offer (columns step, count).",
  },
  skip_reasons: {
    kind: "rows",
    groupBy: ["reason"],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description: "Skipped jobs per skip reason, most common first (columns reason, count).",
  },
  fit_shortlisted_vs_applied: {
    kind: "rows",
    groupBy: [],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description: "Average fit score of shortlisted jobs against applied jobs (columns group, avg_fit, jobs).",
  },
  weekly_activity: {
    kind: "series",
    groupBy: ["week"],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description: "The user's own actions per week: tracker moves and notes, and shortlist rows they set.",
  },
  stale_applications: {
    kind: "value",
    groupBy: [],
    windows: ["all"],
    stageFilter: false,
    description: "Applications still at applied with nothing new for 10 or more days.",
  },
  memo_changes: {
    kind: "value",
    groupBy: [],
    windows: ALL_WINDOWS,
    stageFilter: false,
    description: "How many times 'What I'm looking for' changed in the window.",
  },
};

/** A metric request. groupBy, window and filter must be ones the metric allows. */
export const MetricSpecSchema = z
  .object({
    metric: z.enum(METRIC_IDS),
    groupBy: z.enum(METRIC_GROUP_BYS).optional(),
    filter: z.object({ stage: z.array(z.enum(STAGES)).min(1).max(STAGES.length).optional() }).strict().optional(),
    window: z.enum(METRIC_WINDOWS),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const entry = METRIC_CATALOG[spec.metric];
    if (spec.groupBy !== undefined && !entry.groupBy.includes(spec.groupBy)) {
      ctx.addIssue({ code: "custom", path: ["groupBy"], message: `${spec.metric} cannot be grouped by ${spec.groupBy}` });
    }
    if (!entry.windows.includes(spec.window)) {
      ctx.addIssue({ code: "custom", path: ["window"], message: `${spec.metric} has no ${spec.window} window` });
    }
    if (spec.filter?.stage !== undefined && !entry.stageFilter) {
      ctx.addIssue({ code: "custom", path: ["filter"], message: `${spec.metric} takes no stage filter` });
    }
  }) satisfies z.ZodType<MetricSpec>;
