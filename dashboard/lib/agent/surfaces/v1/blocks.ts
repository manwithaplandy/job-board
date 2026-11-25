// The variant 1 block grammar (plan Task 1.17, spec 7.1 "Domain blocks"): the model emits
// an ordered list of blocks from this fixed job-domain catalog, with ids and short text
// props. Text props are plain strings with caps. Data comes from ids that the host
// resolves (and validateSurface checks were gathered this turn), never from values the
// model supplies, so a bound field cannot misstate the data. No block has a url, href,
// src or html field: posting links are rendered by the host from the database.
//
// Every object is strict, so an unknown key fails; the union is closed over exactly the
// 13 block types below.
import { z } from "zod";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { VIZ } from "@/lib/workspaces/analyticsTiles";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The answer intent's question id (lib/agent/actions/intents.ts), so an answer always
// names a question this block asked.
const QUESTION_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export const V1_TITLE_MAX = 80;
export const V1_BLOCKS_MAX = 8;

const jobId = z.string().regex(JOB_ID_RE).max(300);
/** Plain text, 1 to `max` characters, not only whitespace. */
const text = (max: number) =>
  z.string().min(1).max(max).refine((s) => s.trim().length > 0, { message: "must not be blank" });
const metricRef = z.number().int().min(0).max(49);

export const COMPARISON_ROWS = ["requirements", "pay", "arrangement", "red_flags", "age", "unknowns"] as const;
export const QUESTION_KINDS = ["text", "choice", "multi", "locations"] as const;

const JobCard = z.object({ type: z.literal("JobCard"), jobId, note: text(200).optional() }).strict();

const JobComparison = z
  .object({
    type: z.literal("JobComparison"),
    jobIds: z.tuple([jobId, jobId]),
    rowOrder: z
      .array(z.enum(COMPARISON_ROWS))
      .min(1)
      .max(COMPARISON_ROWS.length)
      .refine((rows) => new Set(rows).size === rows.length, { message: "each row at most once" }),
    verdict: text(400),
  })
  .strict()
  .refine((b) => b.jobIds[0] !== b.jobIds[1], { message: "two different jobs", path: ["jobIds"] });

const ShortlistQueue = z
  .object({
    type: z.literal("ShortlistQueue"),
    jobIds: z.array(jobId).min(1).max(10).refine((ids) => new Set(ids).size === ids.length, { message: "each job once" }),
  })
  .strict();

const MemoDiff = z.object({ type: z.literal("MemoDiff"), proposalId: z.string().regex(UUID_RE) }).strict();

const PrepChecklist = z.object({ type: z.literal("PrepChecklist"), jobId }).strict();

const EvidenceMap = z
  .object({
    type: z.literal("EvidenceMap"),
    jobId,
    rows: z
      .array(z.object({ requirementIndex: z.number().int().min(0).max(99), evidence: text(300), gap: z.boolean() }).strict())
      .min(1)
      .max(20),
  })
  .strict();

const DocumentPreview = z.object({ type: z.literal("DocumentPreview"), jobId, doc: z.enum(["resume", "cover"]) }).strict();

const StatRow = z.object({ type: z.literal("StatRow"), metricRefs: z.array(metricRef).min(1).max(4) }).strict();

const MetricChart = z.object({ type: z.literal("MetricChart"), metricRef, viz: z.enum(VIZ), title: text(60) }).strict();

const IntakeQuestion = z
  .object({
    id: z.string().regex(QUESTION_ID_RE),
    label: text(120),
    kind: z.enum(QUESTION_KINDS),
    // Options are selected by their text, so two equal options (after trimming) would
    // toggle together: refused, and validateSurface then renders the fallback.
    options: z
      .array(text(60))
      .min(2)
      .max(10)
      .refine((opts) => new Set(opts.map((o) => o.trim())).size === opts.length, { message: "options must be unique" })
      .optional(),
  })
  .strict()
  .refine((q) => (q.kind === "choice" || q.kind === "multi") === (q.options !== undefined), {
    message: "choice and multi questions need options; text and locations take none",
    path: ["options"],
  });

export const IntakeQuestionsShape = {
  questions: z
    .array(IntakeQuestion)
    .min(1)
    .max(6)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, { message: "question ids must be unique" }),
};

const IntakeQuestions = z.object({ type: z.literal("IntakeQuestions"), ...IntakeQuestionsShape }).strict();

const ProfileReadback = z.object({ type: z.literal("ProfileReadback"), note: text(200).optional() }).strict();

const StaleList = z.object({ type: z.literal("StaleList"), limit: z.number().int().min(1).max(10) }).strict();

const Callout = z.object({ type: z.literal("Callout"), tone: z.enum(["info", "warning"]), text: text(400) }).strict();

export const V1BlockSchema = z.discriminatedUnion("type", [
  JobCard,
  JobComparison,
  ShortlistQueue,
  MemoDiff,
  PrepChecklist,
  EvidenceMap,
  DocumentPreview,
  StatRow,
  MetricChart,
  IntakeQuestions,
  ProfileReadback,
  StaleList,
  Callout,
]);
export type V1Block = z.infer<typeof V1BlockSchema>;
export type V1BlockType = V1Block["type"];

/** The 13 block types, in schema order. */
export const V1_BLOCK_TYPES: readonly V1BlockType[] = V1BlockSchema.options.map((o) => o.shape.type.value);

export const SurfacePayloadV1Schema = z
  .object({
    variant: z.literal(1),
    title: text(V1_TITLE_MAX).optional(),
    blocks: z.array(V1BlockSchema).min(1).max(V1_BLOCKS_MAX),
  })
  .strict();
export type SurfacePayloadV1 = z.infer<typeof SurfacePayloadV1Schema>;
