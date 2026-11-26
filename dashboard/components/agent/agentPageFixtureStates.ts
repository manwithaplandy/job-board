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
] as const;

export type AgentPageFixtureState = (typeof AGENT_PAGE_FIXTURE_STATES)[number];

export function isAgentPageFixtureState(state: string): state is AgentPageFixtureState {
  return (AGENT_PAGE_FIXTURE_STATES as readonly string[]).includes(state);
}
