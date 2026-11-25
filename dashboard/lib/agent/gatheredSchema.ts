// The zod schema for GatheredData (lib/agent/gathered.ts). A stored surface's
// `gathered` column is jsonb written by an earlier turn, so the agent page parses it in
// full before a block binds to it (PR #52 review M6): a row that does not match reads
// as "no gathered data" and the page shows the fallback surface instead of crashing.
// Pure: no database import, so it is safe in tests and on either side.
import { z } from "zod";
import type { GatheredData } from "@/lib/agent/gathered";
import type {
  ApplicationRow,
  DocumentMeta,
  JobFacts,
  MemoDoc,
  MetricResult,
  MetricSpec,
  ProfileSummary,
  ReviewFacts,
  ShortlistRow,
} from "@/lib/workspaces/types";
import { METRIC_GROUP_BYS, METRIC_IDS, METRIC_WINDOWS, STAGES } from "@/lib/workspaces/metrics/catalog";
import { parseOrNull } from "@/lib/zodParse";

const SHORTLIST_STATES = ["suggested", "shortlisted", "later", "skipped"] as const;
const CLOSED_REASONS = ["rejected", "withdrawn", "no_response"] as const;

const profileSchema = z.object({
  name: z.string().nullable(),
  titles: z.array(z.string()),
  yearsOfExperience: z.number().nullable(),
  education: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  workAuthorized: z.boolean().nullable(),
  needsSponsorship: z.boolean().nullable(),
}) satisfies z.ZodType<ProfileSummary>;

const jobFactsSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  remote: z.boolean(),
  url: z.string(),
  firstSeenAt: z.string(),
  ageDays: z.number(),
  closed: z.boolean(),
}) satisfies z.ZodType<JobFacts>;

const reviewFactsSchema = z.object({
  jobId: z.string(),
  verdict: z.enum(["approve", "deny"]).nullable(),
  fitScore: z.number().nullable(),
  skillsScore: z.number().nullable(),
  experienceScore: z.number().nullable(),
  compScore: z.number().nullable(),
  payMin: z.number().nullable(),
  payMax: z.number().nullable(),
  payCurrency: z.string().nullable(),
  payPeriod: z.string().nullable(),
  workArrangement: z.string().nullable(),
  seniority: z.string().nullable(),
  redFlags: z.array(z.string()),
  skillGaps: z.array(z.string()),
  requirements: z.array(z.object({ text: z.string(), met: z.boolean() })),
  reasoning: z.string().nullable(),
  stale: z.boolean(),
}) satisfies z.ZodType<ReviewFacts>;

const memoDocSchema = z.object({
  role: z.string(),
  locations: z.string(),
  compensation: z.string(),
  mustHaves: z.string(),
  dealBreakers: z.string(),
  companies: z.string(),
  other: z.string(),
}) satisfies z.ZodType<MemoDoc>;

const shortlistRowSchema = z.object({
  jobId: z.string(),
  state: z.enum(SHORTLIST_STATES),
  reasonCode: z.string().nullable(),
  reasonText: z.string().nullable(),
  briefWhy: z.string().nullable(),
  briefRisk: z.string().nullable(),
  setBy: z.enum(["user", "agent", "system"]),
  updatedAt: z.string(),
  job: jobFactsSchema,
  fitScore: z.number().nullable(),
}) satisfies z.ZodType<ShortlistRow>;

const applicationRowSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  stage: z.enum(STAGES),
  closedReason: z.enum(CLOSED_REASONS).nullable(),
  nextStepOn: z.string().nullable(),
  updatedAt: z.string(),
  job: jobFactsSchema,
  events: z.array(
    z.object({
      id: z.number(),
      kind: z.enum(["stage", "note"]),
      fromStage: z.enum(STAGES).nullable(),
      toStage: z.enum(STAGES).nullable(),
      note: z.string().nullable(),
      actor: z.enum(["user", "agent"]),
      createdAt: z.string(),
    }),
  ),
  documents: z.object({ resume: z.boolean(), cover: z.boolean(), outdated: z.boolean() }),
}) satisfies z.ZodType<ApplicationRow>;

const documentMetaSchema = z.object({
  id: z.string(),
  kind: z.enum(["resume", "photo", "other"]),
  filename: z.string(),
  mime: z.string(),
  bytes: z.number(),
  extraction: z.enum(["ok", "empty", "failed"]),
  createdAt: z.string(),
}) satisfies z.ZodType<DocumentMeta>;

// Structural only: which specs the catalog allows is decided when a metric is computed,
// not when a stored result is shown again.
const metricSpecSchema = z.object({
  metric: z.enum(METRIC_IDS),
  groupBy: z.enum(METRIC_GROUP_BYS).optional(),
  filter: z.object({ stage: z.array(z.enum(STAGES)).optional() }).optional(),
  window: z.enum(METRIC_WINDOWS),
}) satisfies z.ZodType<MetricSpec>;

const metricResultSchema = z.union([
  z.object({ spec: metricSpecSchema, n: z.number(), kind: z.literal("value"), value: z.number().nullable(), delta: z.number().optional() }),
  z.object({ spec: metricSpecSchema, n: z.number(), kind: z.literal("series"), points: z.array(z.object({ x: z.string(), y: z.number() })) }),
  z.object({
    spec: metricSpecSchema,
    n: z.number(),
    kind: z.literal("rows"),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
]) satisfies z.ZodType<MetricResult>;

export const GatheredDataSchema = z.object({
  profile: profileSchema.nullable(),
  jobs: z.record(z.string(), jobFactsSchema),
  reviews: z.record(z.string(), reviewFactsSchema),
  memo: memoDocSchema.nullable(),
  shortlist: z.array(shortlistRowSchema),
  applications: z.array(applicationRowSchema),
  documents: z.array(documentMetaSchema),
  metrics: z.array(metricResultSchema),
}) satisfies z.ZodType<GatheredData>;

/** A total parse of stored gathered data; anything that does not match is null. */
export function parseGathered(raw: unknown): GatheredData | null {
  return parseOrNull(GatheredDataSchema, raw);
}
