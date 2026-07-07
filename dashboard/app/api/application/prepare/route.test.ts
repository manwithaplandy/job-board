import { beforeEach, describe, expect, test, vi } from "vitest";

// Route-level test for /api/application/prepare's allowance discipline (T9, minor 4)
// under the async contract: the route RESERVES (charges) both kinds atomically up
// front, tracks ONE 'pending' generation_jobs row of kind='prepare', returns 202, and
// runs its résumé + cover-letter LLM legs under Promise.allSettled in a captured
// after() callback. It persists whatever succeeded and REFUNDS only the kinds whose
// leg rejected — a rejected leg (e.g. OpenRouter outage) never burns its allowance.
// The row settles 'ready' when legs settle (with a user-safe partial note if one LLM
// leg failed), 'failed' when BOTH LLM legs fail or the whole prepare throws.
// Everything below the route is mocked; tracing is off so run() executes inline.

const state = vi.hoisted(() => ({
  resumeRejects: false,
  coverRejects: false,
  upsertRejects: false,
  refundCalls: [] as string[][],
  settleCalls: [] as { id: string; status: string; error?: string | null }[],
  afterCallbacks: [] as (() => Promise<void>)[],
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { state.afterCallbacks.push(fn); },
}));

vi.mock("@/lib/auth", () => ({
  getUserClaims: vi.fn(async () => ({ id: "user-a", email: "a@x.com" })),
}));

vi.mock("@/lib/queries", () => ({
  getProfile: vi.fn(async () => ({
    resume_text: "résumé body",
    full_name: "A Candidate",
    instructions: null,
    model_resume: null,
    model_cover: null,
    profile_version: 1,
  })),
  getJobForPackage: vi.fn(async () => ({
    ats: "lever", // not greenhouse → prefill leg short-circuits, no prefill mock needed
    url: "https://jobs.example/x",
    title: "Engineer",
    company_name: "Acme",
    description: "desc",
    about: null,
    requirements: null,
    skill_gaps: null,
    red_flags: null,
    company_token: null,
    external_id: null,
  })),
  upsertApplicationPackage: vi.fn(async () => {
    if (state.upsertRejects) throw new Error("insert failed");
    return { id: 1 };
  }),
}));

vi.mock("@/lib/usage", () => ({
  reserveGenerations: vi.fn(async () => ({ ok: true, plan: "pro" })),
  refundGenerations: vi.fn(async (_userId: string, kinds: string[]) => {
    state.refundCalls.push(kinds);
  }),
}));

vi.mock("@/lib/generationJobs", () => ({
  createGenerationJob: vi.fn(async () => ({
    created: true,
    job: {
      id: "gen-prepare-1", jobId: "job-1", kind: "prepare", status: "pending",
      error: null, jobTitle: null, company: null,
      createdAt: "2026-07-05T00:00:00.000Z", updatedAt: "2026-07-05T00:00:00.000Z",
    },
  })),
  settleGenerationJob: vi.fn(async (_userId: string, id: string, outcome: { status: string; error?: string | null }) => {
    state.settleCalls.push({ id, ...outcome });
  }),
}));

vi.mock("@/lib/applicationAnswers", () => ({
  applicationAnswersFromProfile: vi.fn(() => ({})),
}));

vi.mock("@/lib/rolefit/applyUrl", () => ({
  applyUrl: vi.fn(() => "https://apply.example/x"),
}));

vi.mock("@/lib/rolefit/resumeClient", () => ({
  DEFAULT_RESUME_MODEL: "cheap/model",
  generateResume: vi.fn(async () => {
    if (state.resumeRejects) throw new Error("resume LLM outage");
    return { resume: { sections: [] }, checks: {}, traceId: null };
  }),
}));

vi.mock("@/lib/rolefit/coverLetterClient", () => ({
  DEFAULT_COVER_MODEL: "cheap/model",
  generateCoverLetter: vi.fn(async () => {
    if (state.coverRejects) throw new Error("cover LLM outage");
    return { body: "cover" };
  }),
}));

vi.mock("@/lib/rolefit/prefillClient", () => ({
  DEFAULT_PREFILL_MODEL: "cheap/model",
  generatePrefilledAnswers: vi.fn(async () => []),
}));

vi.mock("@/lib/rolefit/greenhouseQuestions", () => ({
  fetchGreenhouseQuestions: vi.fn(async () => null),
}));

vi.mock("@/lib/rolefit/prefillSchema", () => ({
  toPrefillQuestions: vi.fn(() => []),
}));

vi.mock("@/lib/rolefit/resumeSource", () => ({
  getResumeSource: vi.fn(() => ({ resumeText: "résumé body" })),
}));

vi.mock("@/lib/rolefit/resumeText", () => ({
  composeResumeText: vi.fn(() => "composed"),
}));

vi.mock("@/lib/observability", () => ({
  tracingEnabled: vi.fn(() => false),
  flushLangfuseTraces: vi.fn(async () => {}),
}));

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: vi.fn((_attrs: unknown, fn: () => unknown) => fn()),
  startActiveObservation: vi.fn(),
}));

import { POST } from "./route";

const req = () =>
  new Request("http://localhost/api/application/prepare", {
    method: "POST",
    body: JSON.stringify({ jobId: "job-1" }),
  });

/** Drain the captured after() callbacks — the background legs + status write. */
async function flushBackground() {
  while (state.afterCallbacks.length) await state.afterCallbacks.shift()!();
}

beforeEach(() => {
  state.resumeRejects = false;
  state.coverRejects = false;
  state.upsertRejects = false;
  state.refundCalls.length = 0;
  state.settleCalls.length = 0;
  state.afterCallbacks.length = 0;
  process.env.OPENROUTER_API_KEY = "test-key"; // route 500s without it, before any leg runs
});

describe("prepare allowance reserve/refund + settle", () => {
  test("both legs succeed → 202, refunds nothing, settles a clean ready", async () => {
    const res = await POST(req());
    expect(res.status).toBe(202);
    expect((await res.json()).generation).toMatchObject({
      id: "gen-prepare-1", kind: "prepare", status: "pending",
      jobTitle: "Engineer", company: "Acme",
    });
    await flushBackground();
    expect(state.refundCalls).toEqual([]);
    expect(state.settleCalls).toEqual([{ id: "gen-prepare-1", status: "ready", error: null }]);
  });

  test("résumé leg fails → refunds only résumé; ready with a user-safe partial note", async () => {
    state.resumeRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(202);
    await flushBackground();
    expect(state.refundCalls).toEqual([["resume"]]);
    expect(state.settleCalls).toHaveLength(1);
    expect(state.settleCalls[0].status).toBe("ready");
    expect(state.settleCalls[0].error).toContain("résumé");
  });

  test("cover leg fails → refunds only cover; ready with a user-safe partial note", async () => {
    state.coverRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(202);
    await flushBackground();
    expect(state.refundCalls).toEqual([["cover"]]);
    expect(state.settleCalls[0].status).toBe("ready");
    expect(state.settleCalls[0].error).toContain("cover letter");
  });

  test("both LLM legs fail → refunds both and settles failed (nothing new was generated)", async () => {
    state.resumeRejects = true;
    state.coverRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(202);
    await flushBackground();
    expect(state.refundCalls).toEqual([["resume", "cover"]]);
    expect(state.settleCalls[0].status).toBe("failed");
  });

  test("whole-prepare throw (upsert fails, nothing persisted) → refunds BOTH and settles failed", async () => {
    state.upsertRejects = true;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await POST(req());
      expect(res.status).toBe(202);
      await flushBackground();
      // Per-leg refunds never ran (upsert threw first) — the outer catch refunds both.
      expect(state.refundCalls).toEqual([["resume", "cover"]]);
      expect(state.settleCalls).toEqual([
        { id: "gen-prepare-1", status: "failed", error: "Preparation failed — try again." },
      ]);
    } finally {
      errSpy.mockRestore();
    }
  });
});
