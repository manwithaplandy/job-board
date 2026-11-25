// startApplicationPrep (plan Task 1.16): the prep path shared by the prepare route, the
// confirm card and the approval tools. Everything below it is mocked, as in the route's
// own test (app/api/application/prepare/route.test.ts, which pins the route's responses);
// this file covers what the route never exercises: the outcome union and refine mode.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestJobPayload: vi.fn(),
  getProfile: vi.fn(),
  getJobForPackage: vi.fn(),
  getJobQuestion: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  upsertInstructionDraft: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
  createGenerationJob: vi.fn(),
  settleGenerationJob: vi.fn(),
  generateResume: vi.fn(),
  generateCoverLetter: vi.fn(),
  generatePrefilledAnswers: vi.fn(),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    mocks.afterCallbacks.push(fn);
  },
}));
vi.mock("@langfuse/tracing", () => ({ propagateAttributes: (_a: unknown, fn: () => unknown) => fn() }));
vi.mock("@/lib/observability", () => ({ tracingEnabled: () => false, flushLangfuseTraces: async () => {} }));
vi.mock("@/lib/jobLifecycle", () => ({ requestJobPayload: mocks.requestJobPayload }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  getJobForPackage: mocks.getJobForPackage,
  getJobQuestion: mocks.getJobQuestion,
  upsertApplicationPackage: mocks.upsertApplicationPackage,
  upsertInstructionDraft: mocks.upsertInstructionDraft,
}));
vi.mock("@/lib/usage", () => ({ reserveGenerations: mocks.reserveGenerations, refundGenerations: mocks.refundGenerations }));
vi.mock("@/lib/generationJobs", () => ({
  createGenerationJob: mocks.createGenerationJob,
  settleGenerationJob: mocks.settleGenerationJob,
}));
vi.mock("@/lib/applicationAnswers", () => ({ applicationAnswersFromProfile: () => ({}) }));
vi.mock("@/lib/rolefit/applyUrl", () => ({ applyUrl: () => "https://apply.example/x" }));
vi.mock("@/lib/rolefit/resumeClient", () => ({ DEFAULT_RESUME_MODEL: "r-model", generateResume: mocks.generateResume }));
vi.mock("@/lib/rolefit/coverLetterClient", () => ({ DEFAULT_COVER_MODEL: "c-model", generateCoverLetter: mocks.generateCoverLetter }));
vi.mock("@/lib/rolefit/prefillClient", () => ({ DEFAULT_PREFILL_MODEL: "p-model", generatePrefilledAnswers: mocks.generatePrefilledAnswers }));
vi.mock("@/lib/rolefit/resumeSource", () => ({ getResumeSource: () => ({ resumeText: "PROFILE résumé" }) }));
vi.mock("@/lib/openrouter", () => ({ getStructuredModels: async () => [] }));

import { startApplicationPrep } from "@/lib/applicationPrep";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMAIL = "pat@example.com";
const JOB_ID = "greenhouse:acme:101";
const JOB = {
  ats: "greenhouse", url: "https://jobs.example/x", title: "Engineer", company_name: "Acme", description: "desc",
  about: null, requirements: null, skill_gaps: null, red_flags: null,
};
const TEXT_Q = { questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }] };
const RESUME = {
  name: "Ada", contact: "", headline: "", summary: "s", skills: [], experience: [], education: [], certifications: [],
};
const COVER = { greeting: "Dear Hiring Manager,", paragraphs: ["Hi."], closing: "Sincerely,", signature: "Ada" };
const GEN_ROW = { id: "gen-1", jobId: JOB_ID, kind: "prepare", status: "pending", error: null, createdAt: "x", updatedAt: "x" };
const EXHAUSTED = {
  ok: false, status: 429, code: "allowance_exhausted", plan: "standard", kind: "cover",
  error: "Monthly cover letter allowance used (5/5 on Standard).",
};

async function flushBackground() {
  while (mocks.afterCallbacks.length) await mocks.afterCallbacks.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  mocks.requestJobPayload.mockResolvedValue({ status: "legacy", id: null });
  mocks.getProfile.mockResolvedValue({ resume_text: "PROFILE résumé", full_name: "Ada", model_resume: null, model_cover: null, profile_version: "pv" });
  mocks.getJobForPackage.mockResolvedValue({ ...JOB });
  mocks.getJobQuestion.mockResolvedValue(TEXT_Q); // no cover-letter question
  mocks.upsertApplicationPackage.mockResolvedValue({});
  mocks.upsertInstructionDraft.mockResolvedValue(undefined);
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.createGenerationJob.mockResolvedValue({ created: true, job: GEN_ROW });
  mocks.settleGenerationJob.mockResolvedValue(undefined);
  mocks.generateResume.mockResolvedValue({ resume: RESUME, traceId: "rt" });
  mocks.generateCoverLetter.mockResolvedValue({ letter: COVER, traceId: "ct" });
  mocks.generatePrefilledAnswers.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("startApplicationPrep", () => {
  test("a full prep starts once and reports the generation", async () => {
    const out = await startApplicationPrep(USER, EMAIL, JOB_ID);
    expect(out).toMatchObject({ status: "started", generationId: "gen-1", generation: { jobTitle: "Engineer", company: "Acme" } });
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
    expect(mocks.upsertInstructionDraft).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
    mocks.createGenerationJob.mockResolvedValueOnce({ created: false, job: GEN_ROW });
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toMatchObject({ status: "already_running", generationId: "gen-1" });
    expect(mocks.refundGenerations).toHaveBeenLastCalledWith(USER, ["resume"]);
  });

  test("start_application_prep with exhausted allowance returns allowance_exhausted and reserves nothing", async () => {
    mocks.reserveGenerations.mockResolvedValue(EXHAUSTED);
    const out = await startApplicationPrep(USER, EMAIL, JOB_ID);
    expect(out).toMatchObject({ status: "allowance_exhausted", kind: "cover" });
    // reserveGenerations is all-or-nothing: a refused gate charged nothing, so there is
    // nothing to refund, no tracking row and no background work.
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  test("the validation outcomes come before any charge", async () => {
    mocks.getProfile.mockResolvedValueOnce({ resume_text: null });
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toEqual({ status: "no_resume" });
    mocks.getJobForPackage.mockResolvedValueOnce(null);
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toEqual({ status: "unknown_job" });
    mocks.getJobForPackage.mockResolvedValueOnce({ ...JOB, ats: "lever" });
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toEqual({ status: "not_greenhouse" });
    mocks.requestJobPayload.mockResolvedValueOnce({ status: "pending", id: null });
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toMatchObject({ status: "pending_payload" });
    mocks.reserveGenerations.mockResolvedValueOnce({ ok: false, status: 402, code: "subscription_required", error: "Subscribe." });
    expect(await startApplicationPrep(USER, EMAIL, JOB_ID)).toMatchObject({ status: "no_plan" });
    expect(mocks.reserveGenerations).toHaveBeenCalledTimes(1);
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
  });

  test("after() outside a request scope: the prep still runs, without it", async () => {
    vi.resetModules();
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("`after` was called outside a request scope");
      },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startApplicationPrep: fresh } = await import("@/lib/applicationPrep");
    expect(await fresh(USER, EMAIL, JOB_ID)).toMatchObject({ status: "started" });
    await vi.waitFor(() => expect(mocks.settleGenerationJob).toHaveBeenCalledWith(USER, "gen-1", { status: "ready", error: null }));
    expect(warn).toHaveBeenCalledWith("application prepare: after() unavailable; running without it", "Error");
    warn.mockRestore();
    vi.doUnmock("next/server");
  });
});

describe("refine (refine_documents)", () => {
  test("refine_documents stops for approval, then saves the instructions and reserves one generation per target", async () => {
    // The approval stop itself is in lib/agent/tools/approval.test.ts; this is what runs
    // once the user approves.
    const out = await startApplicationPrep(USER, EMAIL, JOB_ID, {
      refine: { target: "both" },
      resumeInstructions: "Lead with platform work.",
      coverLetterInstructions: "Lead with platform work.",
    });
    expect(out).toMatchObject({ status: "started" });
    // Both targets are charged, even though the posting asks for no cover letter.
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume", "cover"]);
    expect(mocks.upsertInstructionDraft.mock.calls).toEqual([
      [USER, JOB_ID, "resume", "Lead with platform work."],
      [USER, JOB_ID, "cover", "Lead with platform work."],
    ]);
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBe("Lead with platform work.");
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBe("Lead with platform work.");
    // The regenerated documents store the instructions in lockstep with themselves.
    expect(mocks.upsertApplicationPackage.mock.calls[0][2]).toMatchObject({
      resume: RESUME, coverLetter: COVER,
      resumeInstructions: "Lead with platform work.", coverLetterInstructions: "Lead with platform work.",
    });
    expect(mocks.settleGenerationJob).toHaveBeenCalledWith(USER, "gen-1", { status: "ready", error: null });

    // One target: one reservation, one instructions box, one leg.
    vi.clearAllMocks();
    await startApplicationPrep(USER, EMAIL, JOB_ID, { refine: { target: "cover" }, coverLetterInstructions: "Shorter." });
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["cover"]);
    expect(mocks.upsertInstructionDraft.mock.calls).toEqual([[USER, JOB_ID, "cover", "Shorter."]]);
    await flushBackground();
    expect(mocks.generateResume).not.toHaveBeenCalled();
    expect(mocks.generateCoverLetter).toHaveBeenCalledTimes(1);
    expect(mocks.upsertApplicationPackage.mock.calls[0][2]).toMatchObject({ resume: null, coverLetter: COVER });
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("refine_documents with exhausted allowance changes no instructions", async () => {
    mocks.reserveGenerations.mockResolvedValue(EXHAUSTED);
    const out = await startApplicationPrep(USER, EMAIL, JOB_ID, { refine: { target: "both" }, resumeInstructions: "x", coverLetterInstructions: "x" });
    expect(out).toMatchObject({ status: "allowance_exhausted" });
    expect(mocks.upsertInstructionDraft).not.toHaveBeenCalled();
    expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
  });

  test("a failed instructions write refunds the reservation and starts nothing", async () => {
    mocks.upsertInstructionDraft.mockRejectedValueOnce(new Error("Job details are being prepared. Try again shortly."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await startApplicationPrep(USER, EMAIL, JOB_ID, { refine: { target: "resume" }, resumeInstructions: "x" });
    expect(out).toEqual({ status: "tracking_failed" });
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
  });
});
