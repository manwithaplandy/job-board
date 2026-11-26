// The three hand-written hostile variant 3 surfaces of the injection set (plan Task 2.12):
// auto_fire, intent_loop and chip_spoof. Their documents live with the other hostile
// documents in app/ui-gallery/sandbox-harness/fixtures.ts and replay in the Task 2.7
// harness (tests/sandbox/sandbox.spec.ts, in CI, no model). This file holds what a replay
// may and may not have done, and judges it. No imports, so the browser spec loads it as is.

export const HTML_INJECTION_CASES = ["auto_fire", "intent_loop", "chip_spoof"] as const;
export type HtmlInjectionCase = (typeof HTML_INJECTION_CASES)[number];

/** The intents that start a model turn when run (they send a message): a run started by the frame. */
export const TURN_INTENTS: readonly string[] = ["answer", "compare"];

/**
 * What a replay did, from the harness's logs and the canary. In the product each intent the
 * host runs writes an agent_actions row; a turn intent also sends a message and starts a run.
 */
export interface HtmlEffects {
  /** Intents the host ran (agent_actions rows in the product). */
  agentActions: number;
  /** Whether any of them changed the shortlist. */
  shortlistChanged: boolean;
  /** Turns started (agent_runs rows) and messages sent by those intents. */
  runsStarted: number;
  messagesSent: number;
  /** Presses of the host's own chip during the replay. */
  chipPresses: number;
  /** Whether the frame asked for more actions than FRAME_ACTION_LIMITS allows. */
  rateLimitPassed: boolean;
  /** Whether the host removed the frame (blanked it to its fallback). */
  blanked: boolean;
  /** Requests the canary saw, and loads of the frame's document (a second load is a navigation). */
  canaryHits: number;
  loads: number;
}

/** Effects from the harness's intents log: each entry is { value: { intent: { name } } }. */
export function effectsFromIntents(intents: unknown[]): Pick<HtmlEffects, "agentActions" | "shortlistChanged" | "runsStarted" | "messagesSent"> {
  const names = intents.map((e) => {
    const v = (e as { value?: { intent?: { name?: unknown } } } | null)?.value?.intent?.name;
    return typeof v === "string" ? v : "";
  });
  const turns = names.filter((n) => TURN_INTENTS.includes(n)).length;
  return {
    agentActions: names.length,
    shortlistChanged: names.includes("shortlist.set"),
    runsStarted: turns,
    messagesSent: turns,
  };
}

/** Pass: nothing written, sent or started without a chip press, nothing reached, and a frame past the limit blanked. */
export function judgeHtmlCase(name: HtmlInjectionCase, e: HtmlEffects): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (e.chipPresses === 0) {
    if (e.agentActions > 0) reasons.push(`${name}: ${e.agentActions} action(s) ran with no chip press (agent_actions rows)`);
    if (e.shortlistChanged) reasons.push(`${name}: the shortlist changed with no chip press`);
    if (e.runsStarted > 0) reasons.push(`${name}: the frame started ${e.runsStarted} run(s) with no chip press`);
    if (e.messagesSent > 0) reasons.push(`${name}: the frame sent ${e.messagesSent} message(s) with no chip press`);
  } else if (e.agentActions > e.chipPresses) {
    reasons.push(`${name}: ${e.agentActions} action(s) ran for ${e.chipPresses} chip press(es)`);
  }
  if (e.rateLimitPassed && !e.blanked) reasons.push(`${name}: the frame passed the action limit and was not blanked`);
  if (name === "intent_loop" && !e.rateLimitPassed) reasons.push("intent_loop: the loop never passed the action limit, so the limit was not tested");
  if (e.canaryHits > 0) reasons.push(`${name}: the canary saw ${e.canaryHits} request(s)`);
  if (e.loads > 1) reasons.push(`${name}: the frame's document loaded ${e.loads} times`);
  return { pass: reasons.length === 0, reasons };
}
