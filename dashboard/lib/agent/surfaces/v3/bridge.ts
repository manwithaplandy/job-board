// The postMessage bridge between the host page and the variant 3 frame (plan Task 2.5,
// spec 10 "Variant 3 sandbox" item 2). Host to frame: init { data, theme }. Frame to host:
// ready, resize { height }, action { name, args }, error { message }.
//
// Nothing from the frame is trusted. SandboxFrame accepts a message only from its own
// frame's window with origin "null", and only when parseFrameMessage returns it: strict
// objects (an unknown type or an extra key fails), bounded fields, and action args that
// serialise to at most ACTION_ARGS_MAX characters of JSON. An action is still only a
// request: frameIntent parses it with ActionIntentSchema, the same closed enum every other
// variant uses, and the host turns it into a chip the user must press (D13).
import { z } from "zod";
import { ActionIntentSchema, type ActionIntent } from "@/lib/agent/actions/intents";

export const RESIZE_HEIGHT_MAX = 20_000;
export const ACTION_NAME_MAX = 64;
export const ACTION_ARGS_MAX = 4_000;
export const FRAME_ERROR_MAX = 500;

export const HostToFrameSchema = z
  .object({ type: z.literal("init"), data: z.unknown(), theme: z.enum(["light", "dark"]) })
  .strict();
export type HostToFrame = z.infer<typeof HostToFrameSchema>;

/** The JSON length of a value, or null when it has none (cyclic, a BigInt, undefined). */
function jsonLength(value: unknown): number | null {
  try {
    const s = JSON.stringify(value);
    return typeof s === "string" ? s.length : null;
  } catch {
    return null;
  }
}

const actionArgs = z.unknown().superRefine((v, ctx) => {
  const n = jsonLength(v);
  if (n === null) ctx.addIssue({ code: "custom", message: "args must be JSON" });
  else if (n > ACTION_ARGS_MAX) ctx.addIssue({ code: "custom", message: `args over ${ACTION_ARGS_MAX} characters` });
});

export const FrameToHostSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }).strict(),
  z.object({ type: z.literal("resize"), height: z.number().finite().min(0).max(RESIZE_HEIGHT_MAX) }).strict(),
  z.object({ type: z.literal("action"), name: z.string().min(1).max(ACTION_NAME_MAX), args: actionArgs }).strict(),
  z.object({ type: z.literal("error"), message: z.string().max(FRAME_ERROR_MAX) }).strict(),
]);
export type FrameToHost = z.infer<typeof FrameToHostSchema>;
export type FrameAction = Extract<FrameToHost, { type: "action" }>;

/** A message from the frame, or null when it is not exactly one of the four kinds. */
export function parseFrameMessage(raw: unknown): FrameToHost | null {
  const r = FrameToHostSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * The intent an action message asks for, or null. Its args must be a plain object; the
 * message's name wins over any `name` inside args. The result is a request only.
 */
export function frameIntent(msg: FrameAction): ActionIntent | null {
  const args = msg.args;
  if (args === null || typeof args !== "object" || Array.isArray(args)) return null;
  const r = ActionIntentSchema.safeParse({ ...args, name: msg.name });
  return r.success ? r.data : null;
}
