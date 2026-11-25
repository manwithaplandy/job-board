// The tool-approval secret (plan Tasks 1.14 and 1.16, gate A2). AGENT_TOOL_APPROVAL_SECRET
// signs two things: the AI SDK's tool-approval parts (experimental_toolApprovalSecret)
// and the host's confirm tokens for intents that need a confirm card.
//
// It fails closed (PR I2 ruling): read at call time, never cached, so tests can stub it
// and a deploy without it is safe. Missing or shorter than 32 characters reads as
// "no secret": no approval tool is offered, no toolApproval entry and no secret are
// passed to the model call, and every intent that needs a confirm answers with
// CONFIRMATIONS_UNAVAILABLE without writing anything.
//
// The value is never logged, returned to a client or stored. The one log line says only
// that it is missing, once per process.

export const APPROVAL_SECRET_MIN_LENGTH = 32;

/** The fixed toast for an intent that would need a confirm while the secret is missing. */
export const CONFIRMATIONS_UNAVAILABLE = "Confirmations aren't available yet.";

let warned = false;

/** The secret when it is set and long enough, else null (logged once per process). */
export function approvalSecret(): string | null {
  const raw = process.env.AGENT_TOOL_APPROVAL_SECRET;
  if (typeof raw === "string" && raw.length >= APPROVAL_SECRET_MIN_LENGTH) return raw;
  if (!warned) {
    warned = true;
    console.warn("agent: AGENT_TOOL_APPROVAL_SECRET is missing or too short; confirmations are off");
  }
  return null;
}

/** For tests: lets the next missing-secret read log again. */
export function resetApprovalSecretWarning(): void {
  warned = false;
}
