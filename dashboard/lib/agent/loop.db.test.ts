// The agent loop against the real ledger (PR C batch 3 review M7). The model is a
// MockLanguageModelV4 and after() is captured; the run ledger, the thread store, the
// stored-message codec and the read tools are real. Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { openTestDb, seedProfile, USER_A, type TestDb } from "@/lib/testing/dbHarness";
import { USAGE_KIND_AGENT } from "@/lib/agent/config";
import { serviceSql } from "@/lib/db";

const h = vi.hoisted(() => ({ afterTasks: [] as Promise<unknown>[] }));
vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return {
    ...real,
    after: (task: Promise<unknown> | (() => unknown)) => {
      h.afterTasks.push(typeof task === "function" ? Promise.resolve().then(task) : task);
    },
  };
});

import { streamAgentTurn } from "@/lib/agent/loop";
import { getThread } from "@/lib/agent/threads";

const usage = {
  inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
};

function textModel(text: string) {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata: { openrouter: { usage: { cost: 0.0005 } } } },
  ];
  return new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks }) }) });
}

let db: TestDb;
let threadId: string;

beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

beforeEach(async () => {
  h.afterTasks.length = 0;
  await db.sql`TRUNCATE agent_runs, agent_messages, agent_settings, agent_surfaces, agent_threads, usage_counters, app_settings`;
  await db.sql`DELETE FROM profiles WHERE user_id = ${USER_A}`;
  await seedProfile(db.sql, USER_A);
  const [row] = await db.sql`INSERT INTO agent_threads (user_id) VALUES (${USER_A}) RETURNING id`;
  threadId = String(row?.id);
});

test("a stored interrupted turn (a tool call with no result) is followed by a turn that runs and persists", async () => {
  const dangling = [
    { type: "text", text: "Let me look" },
    { type: "tool-get_profile_summary", toolCallId: "c-old", state: "input-available", input: {} },
  ];
  await db.sql`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status) VALUES
    (${threadId}, 'm-old', ${USER_A}, 'user', ${JSON.stringify([{ type: "text", text: "earlier" }])}::text::jsonb, 'complete'),
    (${threadId}, 'msg-old', ${USER_A}, 'assistant', ${JSON.stringify(dangling)}::text::jsonb, 'failed')`;

  const thread = await getThread(USER_A, threadId);
  expect(thread).not.toBeNull();
  const res = await streamAgentTurn({
    userId: USER_A,
    email: null,
    thread: thread!,
    input: { kind: "message", id: "m-new", text: "and now?", documentIds: [] },
    model: textModel("All good."),
  });
  expect(await res.text()).toContain("All good.");
  expect(h.afterTasks).toHaveLength(1);
  await Promise.all(h.afterTasks);

  const messages = await db.sql`SELECT id, role, status FROM agent_messages WHERE thread_id = ${threadId} ORDER BY seq`;
  expect(messages.map((m) => [m.id, m.role, m.status])).toEqual([
    ["m-old", "user", "complete"],
    ["msg-old", "assistant", "failed"],
    ["m-new", "user", "complete"],
    [expect.stringMatching(/^msg-/), "assistant", "complete"],
  ]);
  const runs = await db.sql`SELECT status, error, steps::int AS steps, cost_micros::int AS cost FROM agent_runs`;
  expect(runs).toEqual([{ status: "done", error: null, steps: 1, cost: 500 }]);
  const counters = await db.sql`SELECT n::int AS n FROM usage_counters WHERE user_id = ${USER_A} AND kind = ${USAGE_KIND_AGENT}`;
  expect(counters).toEqual([{ n: 500 }]);
});

test("a repeated message id is refused and its run is closed failed, with nothing stored", async () => {
  await db.sql`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status) VALUES
    (${threadId}, 'm-1', ${USER_A}, 'user', ${JSON.stringify([{ type: "text", text: "hi" }])}::text::jsonb, 'complete')`;
  const thread = await getThread(USER_A, threadId);
  await expect(
    streamAgentTurn({
      userId: USER_A,
      email: null,
      thread: thread!,
      input: { kind: "message", id: "m-1", text: "hi again", documentIds: [] },
      model: textModel("never"),
    }),
  ).rejects.toMatchObject({ code: "duplicate_message_id" });
  const runs = await db.sql`SELECT status, error FROM agent_runs`;
  expect(runs).toEqual([{ status: "failed", error: "bad_input" }]);
  const count = await db.sql`SELECT count(*)::int AS n FROM agent_messages`;
  expect(count[0]?.n).toBe(1);
});

test("Retry answers a failed question again in the failed row, with the question stored once (PR K2)", async () => {
  await db.sql`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status) VALUES
    (${threadId}, 'm-1', ${USER_A}, 'user', ${JSON.stringify([{ type: "text", text: "any remote roles?" }])}::text::jsonb, 'complete'),
    (${threadId}, 'msg-failed', ${USER_A}, 'assistant', '[]'::jsonb, 'failed')`;
  const thread = await getThread(USER_A, threadId);
  const res = await streamAgentTurn({
    userId: USER_A,
    email: null,
    thread: thread!,
    input: { kind: "retry", id: "m-1" },
    model: textModel("Two remote roles."),
  });
  expect(await res.text()).toContain("Two remote roles.");
  await Promise.all(h.afterTasks);

  const messages = await db.sql`SELECT id, role, status, parts FROM agent_messages WHERE thread_id = ${threadId} ORDER BY seq`;
  expect(messages.map((m) => [m.id, m.role, m.status])).toEqual([
    ["m-1", "user", "complete"],
    ["msg-failed", "assistant", "complete"],
  ]);
  expect(JSON.stringify(messages[1]?.parts)).toContain("Two remote roles.");
  const runs = await db.sql`SELECT status, error FROM agent_runs`;
  expect(runs).toEqual([{ status: "done", error: null }]);
});
