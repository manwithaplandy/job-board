// The postMessage bridge between the host page and the variant 3 frame (plan Task 2.5,
// spec 10 "Variant 3 sandbox" item 2). Host to frame: init { data, theme }, ping { n }.
// Frame to host: ready, inited (the ack of init), pong { n }, resize { height },
// action { name, args }, error { message }. ping, pong and inited are fix round 1 (I2)
// additions: the host's handshake timer ends only on inited, and a ping without its pong
// means the document stopped answering (it navigated, hung, or was replaced).
//
// Transport (stricter than the plan, PR J2): the frame's kit posts ready on the window with
// one end of a MessageChannel; init and every later message travel on that port (kit.ts
// says why). SandboxFrame accepts the ready only from its own frame's window with origin
// "null", once, and ignores every later window message.
//
// Nothing from the frame is trusted. Every message, on the window or the port, is used
// only when parseFrameMessage returns it: strict
// objects (an unknown type or an extra key fails), bounded fields, and action args that
// serialise to at most ACTION_ARGS_MAX characters of JSON. An action is still only a
// request: the server parses it with ActionIntentSchema, the same closed enum every other
// variant uses (frameIntent in lib/agent/actions/describe.ts), and the host turns it into
// a chip the user must press (D13).
//
// Client-safe: SandboxFrame imports this file, so it imports nothing but zod (a value
// import of lib/agent/actions/intents.ts would pull the database module into the bundle).
import { z } from "zod";

export const RESIZE_HEIGHT_MAX = 20_000;
export const ACTION_NAME_MAX = 64;
export const ACTION_ARGS_MAX = 4_000;
export const FRAME_ERROR_MAX = 500;

const pingNumber = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const HostToFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("init"), data: z.unknown(), theme: z.enum(["light", "dark"]) }).strict(),
  z.object({ type: z.literal("ping"), n: pingNumber }).strict(),
]);
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
  z.object({ type: z.literal("inited") }).strict(),
  z.object({ type: z.literal("pong"), n: pingNumber }).strict(),
  z.object({ type: z.literal("resize"), height: z.number().finite().min(0).max(RESIZE_HEIGHT_MAX) }).strict(),
  z.object({ type: z.literal("action"), name: z.string().min(1).max(ACTION_NAME_MAX), args: actionArgs }).strict(),
  z.object({ type: z.literal("error"), message: z.string().max(FRAME_ERROR_MAX) }).strict(),
]);
export type FrameToHost = z.infer<typeof FrameToHostSchema>;
export type FrameAction = Extract<FrameToHost, { type: "action" }>;

/** A message from the frame, or null when it is not exactly one of the six kinds. */
export function parseFrameMessage(raw: unknown): FrameToHost | null {
  const r = FrameToHostSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * D13's limits on action messages; past either the frame is blanked and falls back. Both
 * count per mount of SandboxFrame: the counters live in the mounted component, so a
 * remount (after a page reload, for example) starts them at zero again. A remount also means a new document, and a frame that hit a limit has
 * already stored its fallback, which canMountSandbox then refuses to mount again.
 */
export const FRAME_ACTION_LIMITS = { perMinute: 10, windowMs: 60_000, total: 30 } as const;

/**
 * Handshake and liveness timing (fix round 1, I2). The host waits handshakeMs (in
 * document.ts V3_LIMITS) for the kit's inited ack; after it, it pings over the port every
 * pingEveryMs and on every load event, and falls back when a ping gets no pong within
 * pongWithinMs.
 */
export const FRAME_LIVENESS = { pingEveryMs: 1_000, pongWithinMs: 2_500 } as const;

/** The failure codes a frame's fallback stores (reportSurfaceFailure accepts these only). */
export const FRAME_FAILURES = [
  "no_handshake",
  "no_heartbeat",
  "frame_error",
  "self_navigation",
  "action_rate_limit",
  "action_total_limit",
] as const;
export type FrameFailure = (typeof FRAME_FAILURES)[number];

export function isFrameFailure(value: unknown): value is FrameFailure {
  return typeof value === "string" && (FRAME_FAILURES as readonly string[]).includes(value);
}
