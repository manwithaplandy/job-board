// What one golden-scenario run leaves behind (plan Task 1.22, spec section 11): the tool
// calls the model made, the approvals and host presses the user sent, every surface it
// rendered, the database before and after, and what it cost. Hand-written recordings
// (recordings/v1/*.handwritten.json), live runs (eval:agent) and the phase 1 gate's
// scripted runs all have this one shape, and asserts.ts judges them the same way.
//
// Pure: no database import, so the CI tests read recordings without a database. A file
// on disk is untrusted JSON, so it is parsed in full (parseRecording) before any assert
// reads it.
import { z } from "zod";
import type { StoredSurface } from "@/lib/agent/surfaces/store";
import { parseOrNull } from "@/lib/zodParse";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";

export const RECORDING_FORMAT = 1;

/** hand-written: committed by a person; live: eval:agent with a real model; scripted: the phase 1 gate. */
export const RECORDING_SOURCES = ["hand-written", "live", "scripted"] as const;

/**
 * How a tool call ended, from its stored part: executed (output-available), error
 * (output-error), denied (output-denied), pending (approval-requested or
 * approval-responded) and incomplete (input-streaming or input-available, the turn
 * stopped before it ran).
 */
export const TOOL_CALL_STATES = ["executed", "error", "denied", "pending", "incomplete"] as const;
export type ToolCallState = (typeof TOOL_CALL_STATES)[number];

const ToolCallSchema = z
  .object({
    toolCallId: z.string(),
    name: z.string(),
    input: z.unknown(),
    state: z.enum(TOOL_CALL_STATES),
    /** The tool part's approval, when the tool asked for one; approved is null while it waits. */
    approval: z.object({ id: z.string(), approved: z.boolean().nullable() }).strict().nullable(),
    /** sha256 of the stored output (JSON) in hex, or null when there is none. */
    outputDigest: z.string().nullable(),
  })
  .strict();
export type RecordedToolCall = z.infer<typeof ToolCallSchema>;

/** An approval the user sent (POST /api/agent kind "approval"). */
const ApprovalDecisionSchema = z.object({ approvalId: z.string(), approved: z.boolean() }).strict();
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

/** A press on a surface, as sent to the host (the raw intent) and the outcome's kind. */
const IntentPressSchema = z
  .object({ surfaceId: z.string().nullable(), intent: z.unknown(), outcome: z.string() })
  .strict();
export type IntentPress = z.infer<typeof IntentPressSchema>;

const nullableNumber = z.number().nullable();

/** The rows the asserts compare against, read with the owner connection (record.ts). */
const DbSnapshotSchema = z
  .object({
    jobs: z.array(z.object({ jobId: z.string(), title: z.string(), company: z.string(), url: z.string() }).strict()),
    /** Reviews as the user sees them: COALESCE(correction, review) for every field. */
    reviews: z.array(
      z
        .object({
          jobId: z.string(),
          fitScore: nullableNumber,
          payMin: nullableNumber,
          payMax: nullableNumber,
          payCurrency: z.string().nullable(),
          payPeriod: z.string().nullable(),
        })
        .strict(),
    ),
    shortlist: z.array(z.object({ jobId: z.string(), state: z.string(), setBy: z.string() }).strict()),
    memoVersion: z.number().int().nullable(),
    memoVersions: z.array(
      z.object({ version: z.number().int(), changedBy: z.string(), proposalId: z.string().nullable() }).strict(),
    ),
    memoProposals: z.array(z.object({ id: z.string(), status: z.string() }).strict()),
    packages: z.array(z.object({ jobId: z.string(), status: z.string(), resume: z.unknown() }).strict()),
    resumeText: z.string().nullable(),
    applications: z.array(z.object({ jobId: z.string(), stage: z.string() }).strict()),
  })
  .strict();
export type DbSnapshot = z.infer<typeof DbSnapshotSchema>;

const StoredSurfaceSchema = z
  .object({
    id: z.string(),
    threadId: z.string(),
    runId: z.string().nullable(),
    variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    payload: z.record(z.string(), z.unknown()),
    fallbackPayload: z.record(z.string(), z.unknown()).nullable(),
    gathered: z.record(z.string(), z.unknown()),
    outcome: z.enum(["valid", "repaired", "fallback"]),
    failure: z.string().nullable(),
    supersedes: z.string().nullable(),
    rerenderOf: z.string().nullable(),
    model: z.string().nullable(),
    latencyMs: z.number().nullable(),
    createdAt: z.string(),
  })
  .strict() satisfies z.ZodType<StoredSurface>;

export const RecordingSchema = z
  .object({
    format: z.literal(RECORDING_FORMAT),
    source: z.enum(RECORDING_SOURCES),
    scenario: z.enum(SCENARIO_IDS),
    persona: z.enum(PERSONA_IDS),
    variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    model: z.string(),
    seed: z.number().int(),
    toolCalls: z.array(ToolCallSchema),
    approvals: z.array(ApprovalDecisionSchema),
    intents: z.array(IntentPressSchema),
    surfaces: z.array(StoredSurfaceSchema),
    dbBefore: DbSnapshotSchema,
    dbAfter: DbSnapshotSchema,
    usage: z
      .object({ costMicros: z.number().int().min(0), inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
      .strict(),
    timings: z.object({ firstRenderMs: z.number().min(0).nullable(), completeMs: z.number().min(0) }).strict(),
  })
  .strict();
export type Recording = z.infer<typeof RecordingSchema>;

/** A total parse of a recording (a committed file or a run's output); null when it does not match. */
export function parseRecording(raw: unknown): Recording | null {
  return parseOrNull(RecordingSchema, raw);
}

/** An empty snapshot (a user with nothing yet), for tests and as a base. */
export function emptySnapshot(): DbSnapshot {
  return {
    jobs: [],
    reviews: [],
    shortlist: [],
    memoVersion: null,
    memoVersions: [],
    memoProposals: [],
    packages: [],
    resumeText: null,
    applications: [],
  };
}

/** The file name of a recording: hand-written ones end .handwritten.json, live ones name the model. */
export function recordingFileName(r: Pick<Recording, "scenario" | "persona" | "source" | "model">): string {
  const tail = r.source === "hand-written" ? "handwritten" : r.model.replace(/[^A-Za-z0-9.-]+/g, "-");
  return `${r.scenario}.${r.persona}.${tail}.json`;
}
