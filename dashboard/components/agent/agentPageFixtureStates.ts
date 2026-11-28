// The gallery's agent page fixture states (AgentPageFixture). A plain module, so the
// server-side gallery route can check a state name; the fixture itself is a client module.

export const AGENT_PAGE_FIXTURE_STATES = [
  "agent-page-empty",
  "agent-page-conversation",
  "agent-page-surface",
  "agent-page-failed",
  "agent-page-blocks",
  "agent-page-layout",
  "agent-page-code",
  "agent-page-steps-working",
  "agent-page-steps-done",
  "agent-page-steps-open",
  "agent-page-view-building",
  "agent-page-view-updated",
  "agent-page-view-degraded",
  "agent-page-view-expanded",
  "agent-page-code-expanded",
  "agent-page-views-multi",
  "agent-page-ask-pending",
  "agent-page-code-chart",
] as const;

export type AgentPageFixtureState = (typeof AGENT_PAGE_FIXTURE_STATES)[number];

export function isAgentPageFixtureState(state: string): state is AgentPageFixtureState {
  return (AGENT_PAGE_FIXTURE_STATES as readonly string[]).includes(state);
}

/**
 * agent-page-ask-pending (PR 6, spec 08 S10.2): what the code view asks, at the 280-character
 * cap. The second half has no space, so at 375 px the pending message has to wrap inside a
 * word (overflow-wrap: anywhere) and still show every character. Here, in the plain module,
 * so the browser specs can import it.
 */
const ASK_PENDING_WORDS =
  "Compare the two developer tooling matches side by side and tell me which one fits me better, what I would need to show and who to ask about ";
export const ASK_PENDING_TEXT = (ASK_PENDING_WORDS + "SeniorProductEngineerAtAcmeSystemsRemote".repeat(4)).slice(0, 280);

/**
 * agent-page-code-chart (polish wave, item A): the six application stages the code view's kit
 * bar chart draws. At 1000px the old chart scaled these labels to about 2.5 times the body
 * text, and at 500px "Applied" and "Interviewing" touched. Here, in the plain module, so the
 * browser specs can import it.
 */
export const CODE_CHART_STAGES = [
  { label: "Preparing", value: 3 },
  { label: "Ready", value: 5 },
  { label: "Applied", value: 12 },
  { label: "Interviewing", value: 4 },
  { label: "Offer", value: 1 },
  { label: "Closed", value: 7 },
] as const;
