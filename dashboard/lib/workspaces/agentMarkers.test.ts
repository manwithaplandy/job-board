import { expect, test } from "vitest";
import type { StoredAction } from "@/lib/agent/actions/audit";
import { agentMarkersByJob } from "@/lib/workspaces/agentMarkers";

function action(id: number, over: Partial<StoredAction>): StoredAction {
  return {
    id,
    kind: "shortlist.set",
    actor: "agent",
    targetKey: { jobId: "gh:acme:1" },
    before: null,
    after: null,
    undoneAt: null,
    createdAt: "2026-11-20T00:00:00.000Z",
    ...over,
  };
}

test("only the newest action per job counts, and only when it is the agent's and not undone", () => {
  const actions = [
    action(9, { targetKey: { jobId: "gh:acme:1" } }),
    action(8, { targetKey: { jobId: "gh:acme:1" }, actor: "agent_unattended" }),
    action(7, { targetKey: { jobId: "gh:acme:2" }, actor: "user_via_surface" }),
    action(6, { targetKey: { jobId: "gh:acme:2" } }),
    action(5, { targetKey: { jobId: "gh:acme:3" }, undoneAt: "2026-11-21T00:00:00.000Z" }),
    action(4, { targetKey: { jobId: "gh:acme:4" }, actor: "agent_unattended" }),
    action(3, { targetKey: { jobId: "gh:acme:5" }, kind: "application.set_stage" }),
    action(2, { targetKey: "not an object" }),
  ];
  expect(agentMarkersByJob(actions, "shortlist.set")).toEqual({ "gh:acme:1": 9, "gh:acme:4": 4 });
  expect(agentMarkersByJob(actions, "application.set_stage")).toEqual({ "gh:acme:5": 3 });
});
