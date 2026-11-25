// The stored-message codec (Task 0.8). agent_messages.parts is jsonb that is fed back to
// the model as trusted history, so every read is a total zod parse to a typed
// UIMessage or null (plan Global Constraints), and every write is redacted first: no
// job description or document body is stored in an agent table.
//
// Known part types are the ones phase 0 produces: text, reasoning, step-start, file,
// source-url, source-document, static tool parts (`tool-<name>`) and dynamic-tool.
// Anything else (custom, reasoning-file, data-*, steering-message) is unknown and makes
// the message unparseable; a later task that needs one adds it here.
//
// Tool-part fields are kept, not stripped, where the SDK needs them on a round trip:
// approval ids and signatures (Spike B: a signed approval part is patched and replayed)
// and provider metadata.
import type { UIMessage } from "ai";
import { z } from "zod";
import { parseOrNull } from "@/lib/zodParse";

export type AgentUIMessage = UIMessage;

const providerMetadata = z.record(z.string(), z.record(z.string(), z.json())).optional();

const textPart = z.object({
  type: z.literal("text"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
  providerMetadata,
});
const reasoningPart = z.object({
  type: z.literal("reasoning"),
  id: z.string().optional(),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
  providerMetadata,
});
const stepStartPart = z.object({ type: z.literal("step-start") });
const filePart = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  filename: z.string().optional(),
  url: z.string(),
  providerMetadata,
});
const sourceUrlPart = z.object({
  type: z.literal("source-url"),
  sourceId: z.string(),
  url: z.string(),
  title: z.string().optional(),
  providerMetadata,
});
const sourceDocumentPart = z.object({
  type: z.literal("source-document"),
  sourceId: z.string(),
  mediaType: z.string(),
  title: z.string(),
  filename: z.string().optional(),
  providerMetadata,
});

// UIToolInvocation's states (ai@7.0.163). The approval object keeps its signature.
const approvalBase = {
  id: z.string(),
  descriptor: z.unknown().optional(),
  requestReason: z.string().optional(),
  isAutomatic: z.boolean().optional(),
  signature: z.string().optional(),
  inputSchemaInput: z.unknown().optional(),
};
const invocationCommon = {
  toolCallId: z.string().min(1),
  title: z.string().optional(),
  toolMetadata: z.record(z.string(), z.json()).optional(),
  providerExecuted: z.boolean().optional(),
  callProviderMetadata: providerMetadata,
};
const invocationStates = [
  z.object({
    state: z.literal("input-streaming"),
    input: z.unknown().optional(),
    rawInput: z.string().optional(),
    inputEncoding: z.enum(["json", "text"]).optional(),
  }),
  z.object({ state: z.literal("input-available"), input: z.unknown() }),
  z.object({
    state: z.literal("approval-requested"),
    input: z.unknown(),
    approval: z.object(approvalBase),
  }),
  z.object({
    state: z.literal("approval-responded"),
    input: z.unknown(),
    approval: z.object({ ...approvalBase, approved: z.boolean(), reason: z.string().optional() }),
  }),
  z.object({
    state: z.literal("output-available"),
    input: z.unknown(),
    output: z.unknown(),
    resultProviderMetadata: providerMetadata,
    preliminary: z.boolean().optional(),
    approval: z.object({ ...approvalBase, approved: z.literal(true), reason: z.string().optional() }).optional(),
  }),
  z.object({
    state: z.literal("output-error"),
    input: z.unknown(),
    errorText: z.string(),
    resultProviderMetadata: providerMetadata,
    approval: z.object({ ...approvalBase, approved: z.literal(true), reason: z.string().optional() }).optional(),
  }),
  z.object({
    state: z.literal("output-denied"),
    input: z.unknown(),
    approval: z.object({ ...approvalBase, approved: z.literal(false), reason: z.string().optional() }),
  }),
] as const;

const toolType = z.templateLiteral(["tool-", z.string().regex(/^[A-Za-z0-9_-]+$/)]);
const toolPart = z.intersection(
  z.object({ type: toolType, ...invocationCommon }),
  z.discriminatedUnion("state", invocationStates),
);
const dynamicToolPart = z.intersection(
  z.object({
    type: z.literal("dynamic-tool"),
    dynamic: z.literal(false).optional(),
    toolName: z.string().min(1),
    ...invocationCommon,
  }),
  z.discriminatedUnion("state", invocationStates),
);

const partSchema = z.union([
  textPart,
  reasoningPart,
  stepStartPart,
  filePart,
  sourceUrlPart,
  sourceDocumentPart,
  toolPart,
  dynamicToolPart,
]);

export const MESSAGE_STATUSES = ["complete", "pending", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** One agent_messages row as stored: the UIMessage plus its persistence status. */
export const StoredMessageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  parts: z.array(partSchema),
  status: z.enum(MESSAGE_STATUSES),
});

/**
 * A stored row (or any raw value) as a typed UIMessage, or null when it does not parse.
 * The row's status travels in `metadata.status`, so a reader can show a pending turn as
 * interrupted.
 */
export function parseStoredMessage(raw: unknown): AgentUIMessage | null {
  const row = parseOrNull(StoredMessageSchema, raw);
  if (!row) return null;
  const parts: AgentUIMessage["parts"] = row.parts;
  return { id: row.id, role: row.role, parts, metadata: { status: row.status } };
}

// Tool outputs whose bulk text must never be stored: the field is replaced with null
// and the output is marked omitted. The model sees the redacted output on the next
// turn and can call the tool again if it needs the text.
const REDACTED_FIELDS: ReadonlyMap<string, string> = new Map([
  ["tool-get_job", "description"],
  ["tool-read_document", "text"],
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Part = AgentUIMessage["parts"][number];

function redactPart(part: Part): Part {
  const field = REDACTED_FIELDS.get(part.type);
  if (!field || !("state" in part) || part.state !== "output-available") return part;
  if (!("output" in part) || !isRecord(part.output) || !(field in part.output)) return part;
  return { ...part, output: { ...part.output, [field]: null, omitted: true } };
}

/** A copy of `m` safe to store: get_job descriptions and read_document text removed. */
export function redactForStorage(m: AgentUIMessage): AgentUIMessage {
  return { ...m, parts: m.parts.map(redactPart) };
}
