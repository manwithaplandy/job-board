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
//
// All below-the-route dependencies are vi.fn mocks hoisted onto `state` so the tests
// can inspect their calls (e.g. that per-leg instructions thread correctly). The
// flag fields (resume/cover/upsertRejects) drive the failure-path tests, and the
// refund/settle arrays capture the allowance/settlement bookkeeping.

const LETTER = { body: "cover" };
const JOB = {
  ats: "lever", // not greenhouse → prefill leg short-circuits by default
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
};

const state = vi.hoisted(() => ({
  resumeRejects: false,
  coverRejects: false,
  upsertRejects: false,
  refundCalls: [] as string[][],
  settleCalls: [] as { id: string; status: string; error?: string | null }[],
  afterCallbacks: [] as (() => Promise<void>)[],
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForPackage: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
  createGenerationJob: vi.fn(),
  settleGenerationJob: vi.fn(),
  applicationAnswersFromProfile: vi.fn(),
  applyUrl: vi.fn(),
  generateResume: vi.fn(),
  generateCoverLetter: vi.fn(),
  generatePrefilledAnswers: vi.fn(),
  fetchGreenhouseQuestions: vi.fn(),
  toPrefillQuestions: vi.fn(),
  getResumeSource: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { state.afterCallbacks.push(fn); },
}));

vi.mock("@/lib/auth", () => ({
  getUserClaims: state.getUserClaims,
}));

vi.mock("@/lib/queries", () => ({
  getProfile: state.getProfile,
  getJobForPackage: state.getJobForPackage,
  upsertApplicationPackage: state.upsertApplicationPackage,
}));

vi.mock("@/lib/usage", () => ({
  reserveGenerations: state.reserveGenerations,
  refundGenerations: state.refundGenerations,
}));

vi.mock("@/lib/generationJobs", () => ({
  createGenerationJob: state.createGenerationJob,
  settleGenerationJob: state.settleGenerationJob,
}));

vi.mock("@/lib/applicationAnswers", () => ({
  applicationAnswersFromProfile: state.applicationAnswersFromProfile,
}));

vi.mock("@/lib/rolefit/applyUrl", () => ({
  applyUrl: state.applyUrl,
}));

vi.mock("@/lib/rolefit/resumeClient", () => ({
  DEFAULT_RESUME_MODEL: "cheap/model",
  generateResume: state.generateResume,
}));

vi.mock("@/lib/rolefit/coverLetterClient", () => ({
  DEFAULT_COVER_MODEL: "cheap/model",
  generateCoverLetter: state.generateCoverLetter,
}));

vi.mock("@/lib/rolefit/prefillClient", () => ({
  DEFAULT_PREFILL_MODEL: "cheap/model",
  generatePrefilledAnswers: state.generatePrefilledAnswers,
}));

vi.mock("@/lib/rolefit/greenhouseQuestions", () => ({
  fetchGreenhouseQuestions: state.fetchGreenhouseQuestions,
}));

vi.mock("@/lib/rolefit/prefillSchema", () => ({
  toPrefillQuestions: state.toPrefillQuestions,
}));

vi.mock("@/lib/rolefit/resumeSource", () => ({
  getResumeSource: state.getResumeSource,
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

const req = (body: Record<string, unknown> = { jobId: "job-1" }) =>
  new Request("http://localhost/api/application/prepare", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Drain the captured after() callbacks — the background legs + status write. */
async function flushBackground() {
  while (state.afterCallbacks.length) await state.afterCallbacks.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.resumeRejects = false;
  state.coverRejects = false;
  state.upsertRejects = false;
  state.refundCalls.length = 0;
  state.settleCalls.length = 0;
  state.afterCallbacks.length = 0;
  process.env.OPENROUTER_API_KEY = "test-key"; // route 500s without it, before any leg runs

  state.getUserClaims.mockResolvedValue({ id: "user-a", email: "a@x.com" });
  state.getProfile.mockResolvedValue({
    resume_text: "résumé body",
    full_name: "A Candidate",
    // Reviewer-only sentinel — a leak into any generation leg is detectable.
    instructions: "REVIEWER-ONLY",
    model_resume: null,
    model_cover: null,
    profile_version: 1,
  });
  state.getJobForPackage.mockResolvedValue({ ...JOB });
  state.upsertApplicationPackage.mockImplementation(async () => {
    if (state.upsertRejects) throw new Error("insert failed");
    return { id: 1 };
  });
  state.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  state.refundGenerations.mockImplementation(async (_userId: string, kinds: string[]) => {
    state.refundCalls.push(kinds);
  });
  state.createGenerationJob.mockResolvedValue({
    created: true,
    job: {
      id: "gen-prepare-1", jobId: "job-1", kind: "prepare", status: "pending",
      error: null, jobTitle: null, company: null,
      createdAt: "2026-07-05T00:00:00.000Z", updatedAt: "2026-07-05T00:00:00.000Z",
    },
  });
  state.settleGenerationJob.mockImplementation(
    async (_userId: string, id: string, outcome: { status: string; error?: string | null }) => {
      state.settleCalls.push({ id, ...outcome });
    },
  );
  state.applicationAnswersFromProfile.mockReturnValue({});
  state.applyUrl.mockReturnValue("https://apply.example/x");
  state.generateResume.mockImplementation(async () => {
    if (state.resumeRejects) throw new Error("resume LLM outage");
    return { resume: { sections: [] }, checks: {}, traceId: null };
  });
  state.generateCoverLetter.mockImplementation(async () => {
    if (state.coverRejects) throw new Error("cover LLM outage");
    return { letter: LETTER, traceId: "cl-tr-9" };
  });
  state.generatePrefilledAnswers.mockResolvedValue([]);
  state.fetchGreenhouseQuestions.mockResolvedValue(null);
  state.toPrefillQuestions.mockReturnValue([]);
  state.getResumeSource.mockReturnValue({ resumeText: "résumé body" });
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

describe("POST /api/application/prepare — instructions + cover trace id", () => {
  test("both instruction kinds thread to their legs and persist; cover trace id captured", async () => {
    await POST(req({ jobId: "job-1", resumeInstructions: "R focus", coverLetterInstructions: "C focus" }));
    await flushBackground();
    expect(state.generateResume.mock.calls[0][0].instructions).toBe("R focus");
    expect(state.generateCoverLetter.mock.calls[0][0].instructions).toBe("C focus");
    const pkg = state.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.resumeInstructions).toBe("R focus");
    expect(pkg.coverLetterInstructions).toBe("C focus");
    expect(pkg.coverLetterTraceId).toBe("cl-tr-9");
  });

  test("prefill RUNS but is instruction-less, even with profile.instructions set (Greenhouse leg)", async () => {
    // Force the Greenhouse path so generatePrefilledAnswers actually runs (default fixture is
    // ats:"lever", which short-circuits the leg). Match the shapes route.ts:106-123 consumes:
    // a non-null GreenhouseQuestions schema + a non-empty toPrefillQuestions array.
    state.getJobForPackage.mockResolvedValueOnce({
      ...JOB,
      ats: "greenhouse", company_token: "tok", external_id: "ext-1",
    });
    state.fetchGreenhouseQuestions.mockResolvedValueOnce({
      questions: [
        { label: "Why here?", required: false, fields: [{ name: "why", type: "textarea", options: [] }] },
      ],
    });
    state.toPrefillQuestions.mockReturnValueOnce([
      { label: "Why here?", type: "textarea", required: false, options: [] },
    ]);
    await POST(req());
    await flushBackground();
    expect(state.generatePrefilledAnswers).toHaveBeenCalled(); // the leg RAN
    expect(state.generatePrefilledAnswers.mock.calls[0][0].instructions).toBeNull();
    expect(state.generateCoverLetter.mock.calls[0][0].instructions).toBeNull();
  });

  test("over-cap resumeInstructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", resumeInstructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(state.reserveGenerations).not.toHaveBeenCalled();
  });
});
