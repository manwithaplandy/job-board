// The closed action enum (plan Task 1.14, spec section 10 "Closed action enum"). A
// generated surface never runs anything itself: a press on it sends one of these
// intents, the host parses it with ActionIntentSchema (strict, so an unknown name or an
// extra key fails) and maps it to the one handler registered for its name
// (lib/agent/actions/handlers.ts). Anything that fails the parse is dropped and logged.
//
// Intents carry ids and enum values only. The few free-text fields (a skip's reason
// text, an answer) are the user's own words typed into a fixed control; nothing here is
// ever rendered as a link or used as a confirm card's text.
import { z } from "zod";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { SHORTLIST_STATES, REASON_TEXT_MAX } from "@/lib/workspaces/shortlist";
import { CLOSED_REASONS, STAGES } from "@/lib/workspaces/applications";
import { TileSpecSchema } from "@/lib/workspaces/analyticsTiles";

export const ANSWER_MAX = 2000;
export const OPEN_TARGETS = ["posting", "shortlist", "applications", "looking-for", "documents", "analytics"] as const;
export type OpenTarget = (typeof OPEN_TARGETS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jobId = z.string().regex(JOB_ID_RE).max(300);
const QUESTION_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function answerLength(value: string | string[]): number {
  return Array.isArray(value) ? value.reduce((n, v) => n + v.length, 0) : value.length;
}

export const ActionIntentSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("shortlist.set"),
      jobId,
      state: z.enum(SHORTLIST_STATES),
      reasonCode: z.string().min(1).max(40).optional(),
      reasonText: z.string().max(REASON_TEXT_MAX).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal("application.set_stage"),
      jobId,
      stage: z.enum(STAGES),
      closedReason: z.enum(CLOSED_REASONS).optional(),
    })
    .strict(),
  z.object({ name: z.literal("application.prepare"), jobId }).strict(),
  z.object({ name: z.literal("analytics.pin"), tile: TileSpecSchema }).strict(),
  z
    .object({ name: z.literal("compare"), jobIds: z.tuple([jobId, jobId]) })
    .strict()
    .refine((i) => i.jobIds[0] !== i.jobIds[1], { message: "two different jobs" }),
  z
    .object({
      name: z.literal("answer"),
      questionId: z.string().regex(QUESTION_ID_RE),
      value: z.union([z.string().max(ANSWER_MAX), z.array(z.string().max(ANSWER_MAX)).max(20)]),
    })
    .strict()
    .refine((i) => answerLength(i.value) <= ANSWER_MAX, { message: `at most ${ANSWER_MAX} characters` }),
  z
    .object({ name: z.literal("open"), target: z.enum(OPEN_TARGETS), jobId: jobId.optional() })
    .strict()
    .refine((i) => i.target !== "posting" || i.jobId !== undefined, { message: "posting needs a job" }),
  z.object({ name: z.literal("memo.review"), proposalId: z.string().regex(UUID_RE) }).strict(),
  // Approve or decline a pending memo proposal in place (spec 5(a) step 5). No confirm:
  // a memo change is versioned and restorable. Edit stays memo.review.
  z
    .object({ name: z.literal("memo.resolve"), proposalId: z.string().regex(UUID_RE), decision: z.enum(["approve", "decline"]) })
    .strict(),
]);
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type IntentName = ActionIntent["name"];
export type IntentOf<N extends IntentName> = Extract<ActionIntent, { name: N }>;

/** Every intent name, in schema order (the handler table's completeness test reads it). */
export const INTENT_NAMES: readonly IntentName[] = ActionIntentSchema.options.map((o) => o.shape.name.value);

/**
 * A fixed confirm card (confirm.ts). title, lines and confirmLabel are built from database
 * values and fixed strings only. `proposed` holds the values the user is approving, taken
 * from the tool input under fixed labels, trimmed and capped: the card renders them as
 * plain text in their own section, labelled as proposed. Absent when there are none.
 */
export interface ConfirmDescriptor {
  title: string;
  lines: string[];
  proposed?: string[];
  confirmLabel: string;
  danger: boolean;
}

export type IntentOutcome =
  | { kind: "done"; actionId?: number; toast: string }
  | { kind: "confirm"; confirm: ConfirmDescriptor; token: string }
  | { kind: "send"; text: string }
  | { kind: "navigate"; href: string }
  | { kind: "dropped" };
