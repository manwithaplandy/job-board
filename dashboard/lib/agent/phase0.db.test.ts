// Phase 0 exit check (plan Task 0.15, D14). There is no Supabase Auth locally, so the
// check is scripted: it calls the real POST /api/agent against the test database, with
// only the session claims, the plan lookup and the model mocked. Everything else is
// real: the tombstone check, app_settings, the budget pre-check, the thread store, the
// run ledger, the read tools under RLS and the persistence in after().
//
// The model is a MockLanguageModelV4 (Spike A, the live OpenRouter call, never ran):
// step 1 calls search_jobs, step 2 answers with the title it finds in the tool result,
// so the reply names a seeded job only if the tool really read it from the database.
// Each step carries providerMetadata.openrouter.usage.cost, the shape the budget code
// reads; that shape is still [Unverified] against the live provider.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { USAGE_KIND_AGENT } from "@/lib/agent/config";
import { serviceSql } from "@/lib/db";

const h = vi.hoisted(() => ({
  userId: "",
  afterTasks: [] as Promise<unknown>[],
}));

vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  // after() needs a Next request scope; the test captures the work and awaits it.
  return {
    ...real,
    after: (task: Promise<unknown> | (() => unknown)) => {
      h.afterTasks.push(typeof task === "function" ? Promise.resolve().then(task) : task);
    },
  };
});
vi.mock("@/lib/auth", () => ({
  getUserClaims: vi.fn(async () => ({ id: h.userId, email: null })),
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: vi.fn(async () => "standard") }));
vi.mock("@/lib/agent/provider", () => ({ agentModel: () => scriptedModel() }));

import { POST } from "@/app/api/agent/route";

const JOB_TOP = "lever:fixture-co:phase0-top";
const JOB_LOW = "lever:fixture-co:phase0-low";
const TOP_TITLE = "Staff Machine Learning Engineer";

const usage = {
  inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 8, text: 8, reasoning: undefined },
};
const billed = (dollars: number) => ({ openrouter: { usage: { cost: dollars } } });

/** search_jobs, then a reply naming the first title found in the tool result. */
function scriptedModel() {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      step += 1;
      let chunks: LanguageModelV4StreamPart[];
      if (step === 1) {
        chunks = [
          { type: "stream-start", warnings: [] },
          { type: "tool-call", toolCallId: "c1", toolName: "search_jobs", input: JSON.stringify({ sort: "fit", limit: 5 }) },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, providerMetadata: billed(0.0012) },
        ];
      } else {
        const found = /"title":"([^"]+)"/.exec(JSON.stringify(prompt))?.[1] ?? "nothing";
        chunks = [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: `Your best match is ${found}.` },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata: billed(0.0008) },
        ];
      }
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

let db: TestDb;
let threadA: string;

beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

async function setSettings(daily: number, monthly = 10_000_000) {
  for (const [key, value] of [
    ["agent_enabled", true],
    ["agent_daily_ceiling_micros", daily],
    ["agent_monthly_ceiling_micros", monthly],
  ] as const) {
    await db.sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::text::jsonb)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}

beforeEach(async () => {
  h.afterTasks.length = 0;
  h.userId = USER_A;
  await db.sql`TRUNCATE agent_runs, agent_messages, agent_settings, agent_surfaces, agent_threads, usage_counters, app_settings`;
  await db.sql`DELETE FROM job_reviews WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB_TOP}, ${JOB_LOW})`;
  await seedJob(db.sql, JOB_TOP, { title: TOP_TITLE });
  await seedJob(db.sql, JOB_LOW);
  await seedProfile(db.sql, USER_A);
  await seedReview(db.sql, USER_A, JOB_TOP, { fit_score: 92 });
  await seedReview(db.sql, USER_A, JOB_LOW, { fit_score: 55 });
  await setSettings(1_000_000);
  const [row] = await db.sql`INSERT INTO agent_threads (user_id) VALUES (${USER_A}) RETURNING id`;
  threadA = String(row?.id);
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ask = (id = "m-phase0-1") => post({ threadId: threadA, kind: "message", id, text: "Which reviewed job fits me best?" });

/** Posts, reads the whole stream as a client would, then waits for persistence. */
async function turn(req: Request): Promise<{ status: number; text: string }> {
  const res = await POST(req);
  const text = await res.text();
  await Promise.all(h.afterTasks);
  return { status: res.status, text };
}

describe("phase 0 gate", () => {
  test("a signed-in user asks about reviewed jobs and gets streamed text naming a seeded job", async () => {
    const res = await turn(ask());
    expect(res.status).toBe(200);
    expect(res.text).toContain(`Your best match is ${TOP_TITLE}.`);

    const stored = await db.sql`SELECT id, role, status, parts FROM agent_messages WHERE thread_id = ${threadA} ORDER BY seq`;
    expect(stored.map((m) => [m.role, m.status])).toEqual([
      ["user", "complete"],
      ["assistant", "complete"],
    ]);
    expect(JSON.stringify(stored[1]?.parts)).toContain("tool-search_jobs");
    expect(JSON.stringify(stored[1]?.parts)).toContain(`Your best match is ${TOP_TITLE}.`);
  });

  test("the run row is done with cost_micros > 0 and usage_counters has one agent_micros row of the same amount", async () => {
    expect((await turn(ask())).status).toBe(200);
    const runs = await db.sql`SELECT user_id, thread_id, kind, status, error, steps::int AS steps, cost_micros::int AS cost
                              FROM agent_runs`;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ user_id: USER_A, thread_id: threadA, kind: "interactive", status: "done", error: null, steps: 2 });
    expect(runs[0]?.cost).toBe(2000);
    const counters = await db.sql`SELECT user_id, kind, n::int AS n FROM usage_counters WHERE kind = ${USAGE_KIND_AGENT}`;
    expect(counters).toEqual([{ user_id: USER_A, kind: USAGE_KIND_AGENT, n: runs[0]?.cost }]);
  });

  test("with the daily ceiling at 1 micro the next request is 429 agent_budget_exhausted", async () => {
    expect((await turn(ask("m-phase0-1"))).status).toBe(200);
    await setSettings(1);
    const res = await POST(ask("m-phase0-2"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "agent_budget_exhausted", reason: "daily_ceiling" });
    const runs = await db.sql`SELECT count(*)::int AS n FROM agent_runs`;
    expect(runs[0]?.n).toBe(1);
  });

  test("user B posting to user A's thread gets 404", async () => {
    h.userId = USER_B;
    const res = await POST(ask());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    const written = await db.sql`SELECT (SELECT count(*) FROM agent_runs)::int AS runs, (SELECT count(*) FROM agent_messages)::int AS msgs`;
    expect(written[0]).toEqual({ runs: 0, msgs: 0 });
  });
});
