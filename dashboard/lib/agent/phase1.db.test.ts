// Phase 1 exit check (plan Task 1.24). As in the phase 0 gate there is no Supabase Auth
// locally, so the session claims, the plan lookup and the model are mocked; everything
// else is real: POST /api/agent, the loop and its approvals, the tools under RLS, the
// surface store, the host's intent handler, the workspace server actions and Postgres.
//
// The model is a MockLanguageModelV4 playing the golden scenario's script
// (lib/agent/evals/gateScripts.ts, checked in the default lane by gateScripts.test.ts),
// one scripted turn per POST. Application prep is stood in: it writes the persona's fixed
// tailored résumé (writeStandInPackage) instead of fetching a posting and generating
// documents. Each scenario's run is read back as a Recording and must pass the same
// deterministic asserts as the live golden runs (lib/agent/evals/asserts.ts).
//
// Runs only under `npm run test:db` (CI's db lane).
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import type { ScriptTurn } from "@/lib/agent/evals/gateScripts";

const h = vi.hoisted(() => ({
  userId: "",
  email: null as string | null,
  afterTasks: [] as Promise<unknown>[],
  /** The scripted turns still to play, one per POST that reaches the model. */
  turns: [] as ScriptTurn[],
  /** Model calls a turn's script had no step for. */
  overruns: [] as string[],
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
// No request scope to revalidate in.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getUserClaims: vi.fn(async () => ({ id: h.userId, email: h.email })),
  requireUserId: vi.fn(async () => h.userId),
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: vi.fn(async () => "standard") }));
vi.mock("@/lib/agent/provider", () => ({ agentModel: () => scriptedTurn(h.turns.shift() ?? []) }));
vi.mock("@/lib/applicationPrep", () => ({ startApplicationPrep: vi.fn() }));

import { POST } from "@/app/api/agent/route";
import { startApplicationPrep } from "@/lib/applicationPrep";
import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import type { TurnInput } from "@/lib/agent/loop";
import { assertRecording } from "@/lib/agent/evals/asserts";
import { GATE_PERSONAS, gateScript, say, toolCalls } from "@/lib/agent/evals/gateScripts";
import { PERSONAS, personaByUserId, seedPersona, writeStandInPackage } from "@/lib/agent/evals/personas";
import { pendingApprovalId, playScenario, readStream, type TurnRunner } from "@/lib/agent/evals/play";
import { collectRecording, snapshotDb } from "@/lib/agent/evals/record";
import { SCENARIOS, SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import { setShortlistStateAction } from "@/app/actions/shortlist";
import { setStageAction } from "@/app/actions/tracker";
import { saveMemoAction } from "@/app/actions/memo";
import { useAsResumeAction } from "@/app/actions/documents";
import { listShortlist } from "@/lib/workspaces/shortlist";
import { listApplications } from "@/lib/workspaces/applications";
import { getMemo } from "@/lib/workspaces/memo";
import { listDocuments } from "@/lib/workspaces/documents";

/** A model that plays one scripted turn: step k answers the k-th model call of the POST. */
function scriptedTurn(steps: ScriptTurn) {
  let i = 0;
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const step = steps[i];
      i += 1;
      let chunks: LanguageModelV4StreamPart[];
      if (step) {
        chunks = step(prompt);
      } else {
        h.overruns.push(`model call ${i} of a turn with ${steps.length} scripted step(s)`);
        chunks = say("Done.");
      }
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

let db: TestDb;

beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

async function setSettings(enabled: boolean) {
  for (const [key, value] of [
    ["agent_enabled", enabled],
    ["agent_daily_ceiling_micros", 50_000_000],
    ["agent_monthly_ceiling_micros", 500_000_000],
  ] as const) {
    await db.sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::text::jsonb)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}

beforeEach(async () => {
  h.afterTasks.length = 0;
  h.turns.length = 0;
  h.overruns.length = 0;
  h.userId = "";
  h.email = null;
  // A test-only signing key: long enough to count, never a real secret.
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "t".repeat(40)); // low-entropy fixture
  resetApprovalSecretWarning();
  // The prep stand-in: the persona's fixed tailored résumé, written as the owner.
  vi.mocked(startApplicationPrep)
    .mockReset()
    .mockImplementation(async (userId: string, _email: string | null, jobId: string) => {
      const persona = personaByUserId(userId);
      if (!persona) throw new Error(`no persona for ${userId}`);
      await writeStandInPackage(db.sql, persona, jobId);
      return { status: "started", generationId: "gate-stand-in", generation: {} as never };
    });
  await db.sql`TRUNCATE agent_runs, agent_messages, agent_settings, agent_surfaces, agent_threads, agent_actions,
                        usage_counters, app_settings`;
  await setSettings(true);
});

async function newThread(userId: string): Promise<string> {
  const [row] = await db.sql`INSERT INTO agent_threads (user_id) VALUES (${userId}) RETURNING id`;
  return String(row?.id);
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** One POST read to its end as a client would, then its persistence awaited. */
async function send(threadId: string, input: TurnInput): Promise<{ status: number; text: string; ms: number; firstRenderMs: number | null }> {
  const startedAt = Date.now();
  const res = await POST(post({ threadId, ...input }));
  const { text, firstRenderMs } = await readStream(res, startedAt);
  await Promise.all(h.afterTasks.splice(0));
  return { status: res.status, text, ms: Date.now() - startedAt, firstRenderMs };
}

const runner = (threadId: string): TurnRunner => async (input) => {
  const { status, ms, firstRenderMs } = await send(threadId, input);
  return { status, ms, firstRenderMs };
};

describe("phase 1 gate", () => {
  test.each(SCENARIO_IDS)("scenario %s runs through POST /api/agent and passes assertRecording", async (id) => {
    const persona = PERSONAS[GATE_PERSONAS[id]];
    const scenario = SCENARIOS[id];
    const userId = await seedPersona(db.sql, persona, scenario.setup);
    h.userId = userId;
    h.email = persona.email;
    const threadId = await newThread(userId);
    const dbBefore = await snapshotDb(db.sql, userId);
    const script = gateScript(id, persona);
    h.turns.push(...script.turns);

    const played = await playScenario({ scenario, persona, userId, email: persona.email, threadId, runTurn: runner(threadId) });

    expect(script.errors).toEqual([]);
    expect(h.overruns).toEqual([]);
    expect(h.turns).toEqual([]);
    expect(played.skipped).toEqual([]);
    expect(played.turns.map((t) => t.status)).toEqual(played.turns.map(() => 200));
    expect(played.intents.map((p) => p.outcome)).toEqual(played.intents.map(() => "done"));
    const runs = await db.sql`SELECT status, error FROM agent_runs WHERE thread_id = ${threadId}`;
    expect(runs.map((r) => [r.status, r.error])).toEqual(played.turns.map(() => ["done", null]));

    const recording = await collectRecording({
      sql: db.sql,
      source: "scripted",
      scenario: id,
      persona: persona.id,
      userId,
      threadId,
      variant: 1,
      model: "scripted",
      seed: 0,
      approvals: played.approvals,
      intents: played.intents,
      dbBefore,
      timings: played.timings,
    });
    // Every scripted surface binds to data its turn read, so none falls back.
    expect(recording.surfaces.length).toBeGreaterThan(0);
    expect(recording.surfaces.map((s) => [s.outcome, s.failure])).toEqual(recording.surfaces.map(() => ["valid", null]));
    expect(assertRecording(recording)).toEqual([]);

    // What each scenario is for, beyond the generic asserts.
    const after = recording.dbAfter;
    if (id === "a_resume_upload") {
      expect(after.resumeText).toBe(persona.resumeText.trim());
      expect(after.memoVersion).toBe(1);
      expect(after.memoVersions.map((v) => v.changedBy)).toEqual(["proposal"]);
      expect(after.shortlist).toHaveLength(3);
      expect(after.shortlist.every((s) => s.state === "suggested" && s.setBy === "agent")).toBe(true);
    } else if (id === "b_compare") {
      expect(after.memoVersion).toBe(dbBefore.memoVersion);
      expect(after.memoProposals.map((p) => p.status)).toEqual(["pending"]);
    } else if (id === "c_prep") {
      expect(startApplicationPrep).toHaveBeenCalledTimes(1);
      expect(after.packages.map((p) => [p.jobId, p.status])).toEqual([[persona.jobs[0].jobId, "prepared"]]);
    } else {
      expect(recording.toolCalls.filter((c) => c.name === "query_metrics")).toHaveLength(3);
    }
  });

  test("with agent_enabled false, POST /api/agent is 503 and every workspace action still reads and writes", async () => {
    const persona = PERSONAS["new-grad"];
    const userId = await seedPersona(db.sql, persona, { resume: "uploaded", memo: true, applications: true });
    h.userId = userId;
    h.email = persona.email;
    const threadId = await newThread(userId);
    await setSettings(false);

    const res = await POST(post({ threadId, kind: "message", id: "m-off-1", text: "Are you there?" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "agent_disabled" });
    const written = await db.sql`SELECT (SELECT count(*) FROM agent_runs)::int AS runs, (SELECT count(*) FROM agent_messages)::int AS msgs`;
    expect(written[0]).toEqual({ runs: 0, msgs: 0 });

    // Shortlist page.
    const jobId = persona.jobs[0].jobId;
    expect((await listShortlist(userId)).find((r) => r.jobId === jobId)).toBeUndefined();
    await setShortlistStateAction(jobId, "shortlisted");
    expect((await listShortlist(userId)).find((r) => r.jobId === jobId)).toMatchObject({ state: "shortlisted", setBy: "user" });

    // Applications page.
    const applied = (await listApplications(userId)).find((a) => a.stage === "applied");
    if (!applied) throw new Error("the persona has no application at applied");
    await setStageAction(applied.jobId, "interviewing");
    expect((await listApplications(userId)).find((a) => a.jobId === applied.jobId)?.stage).toBe("interviewing");

    // What I'm looking for page.
    expect((await getMemo(userId))?.version).toBe(1);
    const doc = { ...persona.memo, other: "Small teams suit me best." };
    expect(await saveMemoAction(doc)).toEqual({ ok: true, version: 2 });
    const memo = await getMemo(userId);
    expect(memo?.version).toBe(2);
    expect(memo?.doc.other).toBe("Small teams suit me best.");

    // Documents page.
    expect((await listDocuments(userId)).map((d) => d.id)).toContain(persona.documentId);
    expect(await useAsResumeAction(persona.documentId)).toEqual({ ok: true });
    const [profile] = await db.sql`SELECT resume_text FROM profiles WHERE user_id = ${userId}`;
    expect(profile?.resume_text).toBe(persona.resumeText.trim());

    // Still off: the actions turned nothing on.
    expect((await POST(post({ threadId, kind: "message", id: "m-off-2", text: "Still there?" }))).status).toBe(503);
  });

  test("an approval posted by user B for user A's pending tool is rejected", async () => {
    const userA = PERSONAS["career-switcher"];
    const userB = PERSONAS["senior-backend"];
    await seedPersona(db.sql, userA);
    await seedPersona(db.sql, userB);
    const threadA = await newThread(userA.userId);
    const threadB = await newThread(userB.userId);
    const jobId = userA.jobs[0].jobId;
    let seq = 0;
    const nextId = () => `call-approval-${++seq}`;

    // User A's turn ends waiting on the approval of start_application_prep.
    h.userId = userA.userId;
    h.email = userA.email;
    h.turns.push([() => toolCalls(nextId, [["get_review", { jobId }]]), () => toolCalls(nextId, [["start_application_prep", { jobId }]])]);
    expect((await send(threadA, { kind: "message", id: "m-a-1", text: "Prepare my best fit, please.", documentIds: [] })).status).toBe(200);
    const approvalId = await pendingApprovalId(userA.userId, threadA, "start_application_prep");
    if (approvalId === null) throw new Error("user A's turn left no pending approval");

    // User B, on A's thread: the thread is not B's.
    h.userId = userB.userId;
    h.email = userB.email;
    const onA = await POST(post({ threadId: threadA, kind: "approval", approvalId, approved: true }));
    expect(onA.status).toBe(404);
    expect(await onA.json()).toEqual({ error: "not_found" });

    // User B, on B's own thread with A's approval id: no such pending part there.
    const onB = await POST(post({ threadId: threadB, kind: "approval", approvalId, approved: true }));
    expect(onB.status).toBe(400);
    expect(await onB.json()).toEqual({ error: "bad_request" });
    await Promise.all(h.afterTasks.splice(0));

    // Nothing ran, nothing reached B's thread, and A's approval still waits.
    expect(startApplicationPrep).not.toHaveBeenCalled();
    const packages = await db.sql`SELECT count(*)::int AS n FROM application_packages WHERE user_id IN (${userA.userId}, ${userB.userId})`;
    expect(packages[0]?.n).toBe(0);
    const onThreadB = await db.sql`SELECT count(*)::int AS n FROM agent_messages WHERE thread_id = ${threadB}`;
    expect(onThreadB[0]?.n).toBe(0);
    const doneOnB = await db.sql`SELECT count(*)::int AS n FROM agent_runs WHERE thread_id = ${threadB} AND status = 'done'`;
    expect(doneOnB[0]?.n).toBe(0);
    expect(await pendingApprovalId(userA.userId, threadA, "start_application_prep")).toBe(approvalId);

    // User A can still approve it, and it runs once, for A.
    h.userId = userA.userId;
    h.email = userA.email;
    h.turns.length = 0;
    h.turns.push([() => say("Preparing it now.")]);
    expect((await send(threadA, { kind: "approval", approvalId, approved: true })).status).toBe(200);
    expect(startApplicationPrep).toHaveBeenCalledTimes(1);
    expect(startApplicationPrep).toHaveBeenCalledWith(userA.userId, userA.email, jobId);
    expect(h.overruns).toEqual([]);
  });
});
