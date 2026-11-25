// The run ledger against real Postgres (Task 0.8). This is the money path (plan Review
// Focus 1 and 6): every charge is one service-role transaction under a per-user lock,
// and a signed-in user cannot write a run, a message or a counter. Runs only under
// `npm run test:db`.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { TransactionSql } from "postgres";
import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { chargeFlat, chargeStep, finishRun, saveMessages, startRun, TurnInProgressError } from "@/lib/agent/runs";
import type { AgentUIMessage } from "@/lib/agent/messageCodec";
import { loadMessages } from "@/lib/agent/threads";
import { AGENT_LIMITS, USAGE_KIND_AGENT } from "@/lib/agent/config";
import { serviceSql } from "@/lib/db";

const THREAD_A = "11111111-1111-4111-8111-111111111111";
const THREAD_B = "22222222-2222-4222-8222-222222222222";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

async function setCeilings(daily: number, monthly: number) {
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
  await db.sql`TRUNCATE agent_runs, agent_messages, agent_settings, agent_threads, usage_counters, app_settings`;
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD_A}, ${USER_A}), (${THREAD_B}, ${USER_B})`;
  await setCeilings(1_000_000, 10_000_000);
});

async function counter(userId: string): Promise<number> {
  const rows = await db.sql`SELECT COALESCE(SUM(n), 0)::int AS n FROM usage_counters
                            WHERE user_id = ${userId} AND kind = ${USAGE_KIND_AGENT}`;
  return Number(rows[0]?.n);
}

async function run(id: string) {
  const rows = await db.sql`SELECT status, steps::int AS steps, cost_micros::int AS cost, input_tokens::int AS input,
                                   output_tokens::int AS output, error, finished_at
                            FROM agent_runs WHERE id = ${id}`;
  return rows[0];
}

const interactive = { threadId: THREAD_A, kind: "interactive" as const, model: "m", variant: 1 as const };

describe("chargeStep", () => {
  test("chargeStep adds to usage_counters and to the run in one transaction", async () => {
    const id = await startRun(USER_A, interactive);
    expect(await chargeStep(USER_A, id, { costMicros: 1200, inputTokens: 10, outputTokens: 20 })).toEqual({ ok: true });
    expect(await chargeStep(USER_A, id, { costMicros: 800, inputTokens: 1, outputTokens: 2 })).toEqual({ ok: true });
    expect(await counter(USER_A)).toBe(2000);
    expect(await run(id)).toMatchObject({ status: "running", steps: 2, cost: 2000, input: 11, output: 22 });
  });

  test("chargeStep returns ok:false once the daily ceiling is reached and still records the step", async () => {
    await setCeilings(1000, 10_000_000);
    const id = await startRun(USER_A, interactive);
    expect(await chargeStep(USER_A, id, { costMicros: 999, inputTokens: 1, outputTokens: 1 })).toEqual({ ok: true });
    expect(await chargeStep(USER_A, id, { costMicros: 1, inputTokens: 1, outputTokens: 1 })).toEqual({
      ok: false,
      reason: "daily_ceiling",
    });
    expect(await counter(USER_A)).toBe(1000);
    expect(await run(id)).toMatchObject({ steps: 2, cost: 1000 });
  });

  test("the monthly ceiling stops a run too", async () => {
    await setCeilings(1_000_000, 500);
    const id = await startRun(USER_A, interactive);
    expect(await chargeStep(USER_A, id, { costMicros: 500, inputTokens: 0, outputTokens: 0 })).toEqual({
      ok: false,
      reason: "monthly_ceiling",
    });
  });

  test("eight parallel chargeStep calls of 300 against a 1000 ceiling leave the counter at 2400 and at most three ok:true", async () => {
    await setCeilings(1000, 10_000_000);
    const ids = await Promise.all(
      Array.from({ length: 8 }, () => startRun(USER_A, { threadId: null, kind: "background", model: "m", variant: null })),
    );
    const results = await Promise.all(
      ids.map((id) => chargeStep(USER_A, id, { costMicros: 300, inputTokens: 1, outputTokens: 1 })),
    );
    expect(await counter(USER_A)).toBe(2400);
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(3);
    expect(results.filter((r) => r.ok).length).toBe(3); // serialized: 300, 600, 900 pass; 1200 and up fail
    // This proves the outcome, not the per-user lock: the global lifecycle gate that
    // chargeStep takes first already serializes every charge. The two-user test below
    // shows the counters are kept per user.
  });

  test("parallel charges for two users keep each user's counter and ceiling separate", async () => {
    await setCeilings(1000, 10_000_000);
    const start = (userId: string) => startRun(userId, { threadId: null, kind: "background", model: "m", variant: null });
    const ids = await Promise.all([start(USER_A), start(USER_A), start(USER_B), start(USER_B)]);
    const users = [USER_A, USER_A, USER_B, USER_B];
    const results = await Promise.all(
      ids.map((id, i) => chargeStep(users[i]!, id, { costMicros: 400, inputTokens: 1, outputTokens: 1 })),
    );
    expect(await counter(USER_A)).toBe(800);
    expect(await counter(USER_B)).toBe(800);
    // 800 is under the 1000 ceiling for each user, so all four pass.
    expect(results.every((r) => r.ok)).toBe(true);
  });

  test("ceilings of 0 (a failed settings read) refuse every step and still record it", async () => {
    await setCeilings(0, 0);
    const id = await startRun(USER_A, interactive);
    expect(await chargeStep(USER_A, id, { costMicros: 0, inputTokens: 0, outputTokens: 0 })).toEqual({
      ok: false,
      reason: "daily_ceiling",
    });
    expect(await chargeStep(USER_A, id, { costMicros: 5, inputTokens: 1, outputTokens: 1 })).toMatchObject({ ok: false });
    expect(await counter(USER_A)).toBe(5);
    expect(await run(id)).toMatchObject({ steps: 2, cost: 5 });
  });

  test("a charge that waits past the lifecycle gate's lock timeout is retried once and recorded", async () => {
    const id = await startRun(USER_A, interactive);
    // Hold the global lifecycle gate for longer than its 2 s lock_timeout.
    const holder = db.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(20916294442894917)`;
      await new Promise((r) => setTimeout(r, 2_600));
    });
    await new Promise((r) => setTimeout(r, 100));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await chargeStep(USER_A, id, { costMicros: 25, inputTokens: 1, outputTokens: 1 })).toEqual({ ok: true });
    await holder;
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(await counter(USER_A)).toBe(25);
    expect(await run(id)).toMatchObject({ steps: 1, cost: 25 });
  }, 15_000);

  test("a negative, fractional or non-finite cost is rejected before any write", async () => {
    const id = await startRun(USER_A, interactive);
    for (const costMicros of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(chargeStep(USER_A, id, { costMicros, inputTokens: 0, outputTokens: 0 })).rejects.toThrow();
    }
    expect(await counter(USER_A)).toBe(0);
    expect(await run(id)).toMatchObject({ steps: 0, cost: 0 });
  });

  test("a step on a run that is no longer running is still charged to the counter, not the run", async () => {
    const id = await startRun(USER_A, interactive);
    await finishRun(USER_A, id, { status: "done" });
    await chargeStep(USER_A, id, { costMicros: 50, inputTokens: 1, outputTokens: 1 });
    expect(await counter(USER_A)).toBe(50);
    expect(await run(id)).toMatchObject({ steps: 0, cost: 0 });
  });

  test("a charge against another user's run id never touches that run", async () => {
    const theirs = await startRun(USER_B, { ...interactive, threadId: THREAD_B });
    await chargeStep(USER_A, theirs, { costMicros: 70, inputTokens: 1, outputTokens: 1 });
    expect(await run(theirs)).toMatchObject({ steps: 0, cost: 0 });
    expect(await counter(USER_B)).toBe(0);
  });
});

describe("finishRun", () => {
  test("finishRun changes status only and a second call is a no-op", async () => {
    const id = await startRun(USER_A, interactive);
    await chargeStep(USER_A, id, { costMicros: 100, inputTokens: 1, outputTokens: 1 });
    await finishRun(USER_A, id, { status: "failed", error: "model_error" });
    const first = await run(id);
    expect(first).toMatchObject({ status: "failed", error: "model_error", steps: 1, cost: 100 });
    expect(first?.finished_at).not.toBeNull();
    await finishRun(USER_A, id, { status: "done" });
    expect(await run(id)).toEqual(first);
    expect(await counter(USER_A)).toBe(100);
  });

  test("finishRun on a run that is not running changes nothing", async () => {
    const [{ id }] = await db.sql`INSERT INTO agent_runs (user_id, kind, status) VALUES (${USER_A}, 'background', 'pending')
                                  RETURNING id`;
    await finishRun(USER_A, String(id), { status: "done" });
    expect(await run(String(id))).toMatchObject({ status: "pending", finished_at: null });
  });

  test("finishRun by another user changes nothing", async () => {
    const id = await startRun(USER_A, interactive);
    await finishRun(USER_B, id, { status: "aborted" });
    expect(await run(id)).toMatchObject({ status: "running" });
  });

  test("an error that is not a short code is stored as a generic code, never as free text", async () => {
    const id = await startRun(USER_A, interactive);
    await finishRun(USER_A, id, { status: "failed", error: "Provider said: 401 Unauthorized at /v1/chat (stack...)" });
    expect(await run(id)).toMatchObject({ status: "failed", error: "unknown_error" });
  });
});

describe("startRun", () => {
  test("startRun rejects another user's thread", async () => {
    await expect(startRun(USER_A, { ...interactive, threadId: THREAD_B })).rejects.toThrow();
    await expect(startRun(USER_A, { ...interactive, threadId: "not-a-uuid" })).rejects.toThrow();
    const rows = await db.sql`SELECT count(*)::int AS n FROM agent_runs`;
    expect(rows[0]?.n).toBe(0);
  });

  test("an interactive run needs a thread", async () => {
    await expect(startRun(USER_A, { ...interactive, threadId: null })).rejects.toThrow();
  });

  test("two parallel interactive starts on one thread: exactly one wins, one is TurnInProgressError", async () => {
    const results = await Promise.allSettled([startRun(USER_A, interactive), startRun(USER_A, interactive)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(TurnInProgressError);
    const rows = await db.sql`SELECT count(*)::int AS n FROM agent_runs WHERE status = 'running'`;
    expect(rows[0]?.n).toBe(1);
  });

  test("a second interactive run on a busy thread throws TurnInProgressError", async () => {
    await startRun(USER_A, interactive);
    await expect(startRun(USER_A, interactive)).rejects.toBeInstanceOf(TurnInProgressError);
    // A background run on the same thread is not a turn and is allowed.
    await expect(startRun(USER_A, { ...interactive, kind: "background" })).resolves.toEqual(expect.any(String));
  });

  test("a running turn older than staleTurnMs is aborted and replaced", async () => {
    const old = await startRun(USER_A, interactive);
    await db.sql`UPDATE agent_runs SET started_at = now() - ${`${AGENT_LIMITS.staleTurnMs + 1000} milliseconds`}::interval
                 WHERE id = ${old}`;
    const next = await startRun(USER_A, interactive);
    expect(next).not.toBe(old);
    expect(await run(old)).toMatchObject({ status: "aborted", error: "stale_turn" });
    expect(await run(next)).toMatchObject({ status: "running" });
  });

  test("a turn that is not yet stale is left running", async () => {
    const recent = await startRun(USER_A, interactive);
    await db.sql`UPDATE agent_runs SET started_at = now() - ${`${AGENT_LIMITS.staleTurnMs - 60_000} milliseconds`}::interval
                 WHERE id = ${recent}`;
    await expect(startRun(USER_A, interactive)).rejects.toBeInstanceOf(TurnInProgressError);
    expect(await run(recent)).toMatchObject({ status: "running" });
  });
});

describe("chargeFlat", () => {
  test("records a finished run with no thread and charges the counter", async () => {
    expect(await chargeFlat(USER_A, { kind: "vision", model: "m", costMicros: 400 })).toEqual({ ok: true });
    const rows = await db.sql`SELECT kind, status, thread_id, cost_micros::int AS cost, steps::int AS steps FROM agent_runs`;
    expect(Array.from(rows)).toEqual([{ kind: "vision", status: "done", thread_id: null, cost: 400, steps: 1 }]);
    expect(await counter(USER_A)).toBe(400);
  });

  test("a flat charge past the ceiling reports ok:false and is still recorded", async () => {
    await setCeilings(300, 10_000_000);
    expect(await chargeFlat(USER_A, { kind: "transcription", model: "m", costMicros: 400 })).toEqual({ ok: false });
    expect(await counter(USER_A)).toBe(400);
  });
});

describe("the service-write-only boundary", () => {
  async function attempt(fn: (tx: TransactionSql) => Promise<unknown>) {
    return db.asUser(USER_A, fn).then(
      () => ({ code: "ok" }),
      (e: { code?: string }) => ({ code: e.code }),
    );
  }

  test("as role authenticated, UPDATE agent_runs, INSERT agent_messages and UPDATE usage_counters all fail", async () => {
    const id = await startRun(USER_A, interactive);
    await chargeStep(USER_A, id, { costMicros: 100, inputTokens: 1, outputTokens: 1 });
    expect(await attempt((tx) => tx`UPDATE agent_runs SET cost_micros = 0, status = 'done' WHERE id = ${id}`)).toEqual({
      code: "42501",
    });
    expect(
      await attempt(
        (tx) => tx`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status)
                   VALUES (${THREAD_A}, 'forged', ${USER_A}, 'assistant', '[]'::jsonb, 'complete')`,
      ),
    ).toEqual({ code: "42501" });
    expect(await attempt((tx) => tx`UPDATE usage_counters SET n = 0 WHERE user_id = ${USER_A}`)).toEqual({ code: "42501" });
    expect(await counter(USER_A)).toBe(100);
    expect(await run(id)).toMatchObject({ status: "running", cost: 100 });
  });
});

describe("saveMessages", () => {
  const SECRET = "SECRET-POSTING-TEXT the full job description";
  const messages: AgentUIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Tell me about this job" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-get_job",
          toolCallId: "call-1",
          state: "output-available",
          input: { jobId: "lever:x" },
          output: { jobId: "lever:x", title: "Engineer", description: SECRET, descriptionOmitted: false },
        },
        { type: "text", text: "It is an engineering role." },
      ],
    },
  ];

  test("saveMessages never stores a job description", async () => {
    await saveMessages(USER_A, THREAD_A, messages, "complete");
    const rows = await db.sql`SELECT id, role, status, parts::text AS raw, parts, jsonb_typeof(parts) AS kind
                              FROM agent_messages ORDER BY seq`;
    expect(rows.map((r) => r.id)).toEqual(["u1", "a1"]);
    expect(rows.map((r) => r.kind)).toEqual(["array", "array"]); // a jsonb array, not a double-encoded string
    for (const r of rows) expect(String(r.raw)).not.toContain("SECRET-POSTING-TEXT");
    const tool = (rows[1]?.parts as Array<Record<string, unknown>>)[1];
    expect(tool?.output).toMatchObject({ description: null, omitted: true, title: "Engineer" });
  });

  test("what saveMessages stores, loadMessages reads back as the owner only (RLS)", async () => {
    await saveMessages(USER_A, THREAD_A, messages, "pending");
    const back = await loadMessages(USER_A, THREAD_A);
    const createdAt = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
    expect(back.map((m) => [m.id, m.role, m.metadata])).toEqual([
      ["u1", "user", { status: "pending", createdAt }],
      ["a1", "assistant", { status: "pending", createdAt }],
    ]);
    expect(back[1]?.parts[2]).toEqual({ type: "text", text: "It is an engineering role." });
    expect(await loadMessages(USER_B, THREAD_A)).toEqual([]);
  });

  test("upserts by (thread_id, id), changes status and bumps the thread's updated_at", async () => {
    await db.sql`UPDATE agent_threads SET updated_at = now() - interval '1 day' WHERE id = ${THREAD_A}`;
    await saveMessages(USER_A, THREAD_A, [messages[1]!], "pending");
    await saveMessages(USER_A, THREAD_A, [messages[1]!], "complete");
    const rows = await db.sql`SELECT id, status FROM agent_messages`;
    expect(Array.from(rows)).toEqual([{ id: "a1", status: "complete" }]);
    const [t] = await db.sql`SELECT updated_at > now() - interval '1 minute' AS fresh FROM agent_threads WHERE id = ${THREAD_A}`;
    expect(t?.fresh).toBe(true);
  });

  test("a late pending write never turns a complete message back to pending", async () => {
    await saveMessages(USER_A, THREAD_A, [messages[1]!], "complete");
    const late: AgentUIMessage = { id: "a1", role: "assistant", parts: [{ type: "text", text: "placeholder" }] };
    await saveMessages(USER_A, THREAD_A, [late], "pending");
    const rows = await db.sql`SELECT status, parts FROM agent_messages WHERE id = 'a1'`;
    expect(rows[0]?.status).toBe("complete");
    // The parts stay the complete ones too.
    expect(JSON.stringify(rows[0]?.parts)).toContain("It is an engineering role.");
    // complete -> failed and pending -> complete still apply.
    await saveMessages(USER_A, THREAD_A, [messages[1]!], "failed");
    expect((await db.sql`SELECT status FROM agent_messages WHERE id = 'a1'`)[0]?.status).toBe("failed");
  });

  test("refuses another user's thread, more than 50 messages, or more than 1 MB", async () => {
    await expect(saveMessages(USER_A, THREAD_B, messages, "complete")).rejects.toThrow();
    const many = Array.from({ length: 51 }, (_, i): AgentUIMessage => ({
      id: `m${i}`,
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    }));
    await expect(saveMessages(USER_A, THREAD_A, many, "complete")).rejects.toThrow();
    const big: AgentUIMessage = { id: "big", role: "user", parts: [{ type: "text", text: "x".repeat(1_100_000) }] };
    await expect(saveMessages(USER_A, THREAD_A, [big], "complete")).rejects.toThrow();
    const rows = await db.sql`SELECT count(*)::int AS n FROM agent_messages`;
    expect(rows[0]?.n).toBe(0);
  });
});
