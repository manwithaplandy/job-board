import { beforeEach, expect, test, vi } from "vitest";
import type { StoredAction } from "@/lib/agent/actions/audit";

const db = vi.hoisted(() => ({
  calls: [] as { userId: string; text: string; values: unknown[] }[],
  rows: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (userId: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      db.calls.push({ userId, text: strings.join("?"), values });
      return Promise.resolve(db.rows);
    })),
}));

import { agentMarkersByJob, listAgentMarkers } from "@/lib/workspaces/agentMarkers";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  db.calls = [];
  db.rows = [];
});

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

test("listAgentMarkers reads one kind with DISTINCT ON the job, filters outside it, and parses the rows", async () => {
  db.rows = [{ id: "12", job_id: "gh:acme:1" }, { id: "x", job_id: "gh:acme:2" }, { id: "3", job_id: "" }];
  expect(await listAgentMarkers(USER, "shortlist.set")).toEqual({ "gh:acme:1": 12 });
  expect(db.calls).toHaveLength(1);
  const [call] = db.calls;
  expect(call.userId).toBe(USER);
  expect(call.values).toEqual([USER, "shortlist.set"]);
  expect(call.text).toMatch(/DISTINCT ON \(target_key ->> 'jobId'\)/);
  // The actor and undone filters apply to the newest row per job, after DISTINCT ON.
  expect(call.text.indexOf("actor IN")).toBeGreaterThan(call.text.indexOf(") newest"));
});

test("listAgentMarkers refuses an unknown kind without a query", async () => {
  expect(await listAgentMarkers(USER, "bogus" as never)).toEqual({});
  expect(db.calls).toHaveLength(0);
});
