import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

// Route-level test for /api/application/prepare under the "Prefill application" contract
// (the user-facing label; kind stays 'prepare' internally). The route is GREENHOUSE-ONLY
// (a non-Greenhouse job 400s before charging), loads the posting's question schema from
// job_questions (falling back to an on-demand fetch), and reserves CONDITIONALLY: always
// résumé, plus cover ONLY when the posting asks for a cover letter. In the background it
// runs the résumé leg → (chained on success) a bounded prefill fed the GENERATED résumé,
// with a conditional cover leg in parallel; it persists whatever succeeded and REFUNDS
// only the charged kinds whose leg rejected. Prefill is best-effort — a prefill failure is
// swallowed and the résumé still persists. Everything below the route is mocked; tracing
// is off so run() executes inline. composeResumeText / hasCoverLetterQuestion /
// stripCoverLetterQuestions / toPrefillQuestions are PURE and deliberately NOT mocked, so
// the "prefill fed the GENERATED résumé" and cover-detection assertions are meaningful.

const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForPackage: vi.fn(),
  getJobQuestion: vi.fn(),
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
  getResumeSource: vi.fn(),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

// Capture after() callbacks instead of scheduling them (the real one needs the Next
// request scope); tests drain them explicitly via flushBackground().
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { mocks.afterCallbacks.push(fn); },
}));
vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_a: unknown, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/observability", () => ({ tracingEnabled: () => false, flushLangfuseTraces: async () => {} }));
vi.mock("@/lib/auth", () => ({ getUserClaims: mocks.getUserClaims }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  getJobForPackage: mocks.getJobForPackage,
  getJobQuestion: mocks.getJobQuestion,
  upsertApplicationPackage: mocks.upsertApplicationPackage,
}));
vi.mock("@/lib/usage", () => ({
  reserveGenerations: mocks.reserveGenerations,
  refundGenerations: mocks.refundGenerations,
}));
vi.mock("@/lib/generationJobs", () => ({
  createGenerationJob: mocks.createGenerationJob,
  settleGenerationJob: mocks.settleGenerationJob,
}));
vi.mock("@/lib/applicationAnswers", () => ({
  applicationAnswersFromProfile: mocks.applicationAnswersFromProfile,
}));
vi.mock("@/lib/rolefit/applyUrl", () => ({ applyUrl: mocks.applyUrl }));
vi.mock("@/lib/rolefit/resumeClient", () => ({
  DEFAULT_RESUME_MODEL: "default-resume-model",
  generateResume: mocks.generateResume,
}));
vi.mock("@/lib/rolefit/coverLetterClient", () => ({
  DEFAULT_COVER_MODEL: "default-cover-model",
  generateCoverLetter: mocks.generateCoverLetter,
}));
vi.mock("@/lib/rolefit/prefillClient", () => ({
  DEFAULT_PREFILL_MODEL: "default-prefill-model",
  generatePrefilledAnswers: mocks.generatePrefilledAnswers,
}));
vi.mock("@/lib/rolefit/greenhouseQuestions", () => ({
  fetchGreenhouseQuestions: mocks.fetchGreenhouseQuestions,
}));
vi.mock("@/lib/rolefit/resumeSource", () => ({ getResumeSource: mocks.getResumeSource }));
// NOTE: composeResumeText, hasCoverLetterQuestion, stripCoverLetterQuestions,
// toPrefillQuestions, normalizeInstructions, gateRejectionBody are PURE — NOT mocked.

import { POST } from "@/app/api/application/prepare/route";
import { composeResumeText } from "@/lib/rolefit/resumeText";

const USER = "22222222-2222-2222-2222-222222222222";
const EMAIL = "u@x.com";

// A full TailoredResume so composeResumeText produces distinctive text (NOT the profile's).
const RESUME: TailoredResume = {
  name: "Ada Lovelace",
  contact: "ada@x.com",
  headline: "Staff Engineer",
  summary: "Generated summary.",
  skills: ["Rust", "Distributed Systems"],
  experience: [{ role: "Eng", company: "Acme", dates: "2020-2024", bullets: ["Shipped things"] }],
  education: ["BS CS"],
  certifications: [],
};
const COVER: TailoredCoverLetter = {
  greeting: "Dear Hiring Manager,",
  paragraphs: ["I am excited to apply."],
  closing: "Sincerely,",
  signature: "Ada Lovelace",
};

const JOB = {
  ats: "greenhouse",
  url: "https://jobs.example/x",
  title: "Engineer",
  company_name: "Acme",
  description: "desc",
  about: null,
  requirements: null,
  skill_gaps: null,
  red_flags: null,
  company_token: "tok",
  external_id: "ext-1",
};

// A schema WITH a cover-letter ask (drives wantsCover=true, kinds=['resume','cover']).
const COVER_Q = {
  questions: [{ label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] }],
};
// A schema with a free-text ask only (no cover; drives a real prefill question list).
const TEXT_Q = {
  questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }],
};

const GEN_ROW = {
  id: "gen-prepare-1", jobId: "job-1", kind: "prepare", status: "pending",
  error: null, jobTitle: null, company: null,
  createdAt: "2026-07-05T00:00:00.000Z", updatedAt: "2026-07-05T00:00:00.000Z",
};

function req(body: Record<string, unknown> = { jobId: "job-1" }) {
  return new Request("http://localhost/api/application/prepare", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
/** Drain the captured after() callbacks — the background legs + status write. */
async function flushBackground() {
  while (mocks.afterCallbacks.length) await mocks.afterCallbacks.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: EMAIL });
  mocks.getProfile.mockResolvedValue({
    resume_text: "PROFILE résumé body",
    full_name: "Ada Lovelace",
    instructions: "REVIEWER-ONLY", // reviewer-only sentinel; a leak into a leg is detectable
    model_resume: null, model_cover: null, profile_version: "pv-9",
  });
  mocks.getJobForPackage.mockResolvedValue({ ...JOB });
  mocks.getJobQuestion.mockResolvedValue(COVER_Q); // default: posting asks for a cover letter
  mocks.upsertApplicationPackage.mockResolvedValue({ id: 1 });
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.createGenerationJob.mockResolvedValue({ created: true, job: GEN_ROW });
  mocks.settleGenerationJob.mockResolvedValue(undefined);
  mocks.applicationAnswersFromProfile.mockReturnValue({});
  mocks.applyUrl.mockReturnValue("https://apply.example/x");
  mocks.generateResume.mockResolvedValue({ resume: RESUME, checks: {}, traceId: "rt" });
  mocks.generateCoverLetter.mockResolvedValue({ letter: COVER, traceId: "ct" });
  mocks.generatePrefilledAnswers.mockResolvedValue([]);
  mocks.fetchGreenhouseQuestions.mockResolvedValue(null);
  mocks.getResumeSource.mockReturnValue({ resumeText: "PROFILE résumé body" });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/application/prepare — Greenhouse guard + conditional reserve", () => {
  test("non-Greenhouse job → 400, no charge, no tracking", async () => {
    mocks.getJobForPackage.mockResolvedValue({ ...JOB, ats: "lever" });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  test("Greenhouse without a cover-letter question → reserves ['resume'] only", async () => {
    mocks.getJobQuestion.mockResolvedValue(TEXT_Q);
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
  });

  test("Greenhouse WITH a cover-letter question → reserves ['resume','cover']", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q);
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume", "cover"]);
  });

  test("on-demand fetch fallback when no stored job_questions row", async () => {
    mocks.getJobQuestion.mockResolvedValue(null);
    mocks.fetchGreenhouseQuestions.mockResolvedValue(TEXT_Q);
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    // Passes the token/id plus an 8s-bounded fetchImpl (the synchronous-prologue fetch
    // must not stall the click on a hung Greenhouse API).
    expect(mocks.fetchGreenhouseQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok", externalId: "ext-1", fetchImpl: expect.any(Function) }),
    );
    // No cover-letter question in the fetched schema → résumé-only reserve.
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
  });
});

describe("POST /api/application/prepare — validation ladder (never charge an unchargeable request)", () => {
  test("401 anon", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("400 missing jobId", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("422 no resume_text", async () => {
    mocks.getProfile.mockResolvedValue({ resume_text: null });
    expect((await POST(req())).status).toBe(422);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("404 no job", async () => {
    mocks.getJobForPackage.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(404);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("500 no api key (config check runs before the gate)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await POST(req())).status).toBe(500);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("over-cap resumeInstructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", resumeInstructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});

describe("POST /api/application/prepare — sequential résumé → prefill from the GENERATED résumé", () => {
  test("prefill is fed the GENERATED résumé text, not the profile text", async () => {
    mocks.getJobQuestion.mockResolvedValue(TEXT_Q); // real prefill question, no cover
    mocks.generateResume.mockResolvedValue({ resume: RESUME, checks: {}, traceId: "rt" });
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generatePrefilledAnswers).toHaveBeenCalledTimes(1);
    const prefillArg = mocks.generatePrefilledAnswers.mock.calls[0][0];
    expect(prefillArg.resumeText).toBe(composeResumeText(RESUME)); // the tailored résumé
    expect(prefillArg.resumeText).not.toBe("PROFILE résumé body"); // NOT profile.resume_text
    expect(prefillArg.instructions).toBeNull(); // prefill is instruction-less (spec)
    // The prefill fetchImpl is a bounded wrapper (shared AbortSignal deadline).
    expect(typeof prefillArg.fetchImpl).toBe("function");
  });

  test("no answerable questions (cover-only schema) → prefill NOT called", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q); // stripped → empty prefill list
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generatePrefilledAnswers).not.toHaveBeenCalled();
  });

  test("prefill failure is swallowed — the résumé still persists (best-effort)", async () => {
    mocks.getJobQuestion.mockResolvedValue(TEXT_Q);
    mocks.generatePrefilledAnswers.mockRejectedValue(new Error("prefill timed out"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req({ jobId: "job-1" }));
      await flushBackground();
    } finally {
      errSpy.mockRestore();
    }
    const upserted = mocks.upsertApplicationPackage.mock.calls.at(-1)![2];
    expect(upserted.resume).toEqual(RESUME);
    expect(upserted.prefilledAnswers).toBeNull();
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
    expect(mocks.settleGenerationJob.mock.calls[0][2].status).toBe("ready");
  });
});

describe("POST /api/application/prepare — conditional refund + settle", () => {
  test("both legs succeed → 202, refunds nothing, settles a clean ready", async () => {
    const res = await POST(req());
    expect(res.status).toBe(202);
    expect((await res.json()).generation).toMatchObject({
      id: GEN_ROW.id, kind: "prepare", status: "pending", jobTitle: "Engineer", company: "Acme",
    });
    await flushBackground();
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
    expect(mocks.settleGenerationJob).toHaveBeenCalledWith(USER, GEN_ROW.id, { status: "ready", error: null });
  });

  test("résumé failure → prefill skipped, résumé refunded, cover leg still persists", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q); // wantsCover → cover leg runs
    mocks.generateResume.mockRejectedValue(new Error("502"));
    mocks.generateCoverLetter.mockResolvedValue({ letter: COVER, traceId: "ct" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req({ jobId: "job-1" }));
      await flushBackground();
    } finally {
      errSpy.mockRestore();
    }
    expect(mocks.generatePrefilledAnswers).not.toHaveBeenCalled();
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    const upserted = mocks.upsertApplicationPackage.mock.calls.at(-1)![2];
    expect(upserted.resume).toBeNull();
    expect(upserted.coverLetter).toEqual(COVER);
    expect(mocks.settleGenerationJob.mock.calls[0][2].status).toBe("ready");
    expect(mocks.settleGenerationJob.mock.calls[0][2].error).toContain("résumé");
  });

  test("cover leg fails → refunds only cover; ready with a user-safe partial note", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q);
    mocks.generateCoverLetter.mockRejectedValue(new Error("cover LLM outage"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req());
      await flushBackground();
    } finally {
      errSpy.mockRestore();
    }
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["cover"]);
    expect(mocks.settleGenerationJob.mock.calls[0][2].status).toBe("ready");
    expect(mocks.settleGenerationJob.mock.calls[0][2].error).toContain("cover letter");
  });

  test("résumé-only posting: résumé failure → refunds only résumé and settles failed", async () => {
    mocks.getJobQuestion.mockResolvedValue(TEXT_Q); // no cover reserved
    mocks.generateResume.mockRejectedValue(new Error("502"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req());
      await flushBackground();
    } finally {
      errSpy.mockRestore();
    }
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.settleGenerationJob.mock.calls[0][2].status).toBe("failed");
  });

  test("both LLM legs fail → refunds both and settles failed (nothing new was generated)", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q);
    mocks.generateResume.mockRejectedValue(new Error("resume LLM outage"));
    mocks.generateCoverLetter.mockRejectedValue(new Error("cover LLM outage"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req());
      await flushBackground();
    } finally {
      errSpy.mockRestore();
    }
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume", "cover"]);
    expect(mocks.settleGenerationJob.mock.calls[0][2].status).toBe("failed");
  });

  test("duplicate pending row → 202, extra reservation refunded with computed kinds, no second run", async () => {
    mocks.getJobQuestion.mockResolvedValue(TEXT_Q); // kinds = ['resume']
    mocks.createGenerationJob.mockResolvedValue({ created: false, job: GEN_ROW });
    const res = await POST(req());
    expect(res.status).toBe(202);
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.generateResume).not.toHaveBeenCalled();
  });

  test("tracking row failed → 502 and the reservation is refunded with computed kinds", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q); // kinds = ['resume','cover']
    mocks.createGenerationJob.mockRejectedValue(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await POST(req());
      expect(res.status).toBe(502);
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume", "cover"]);
    } finally {
      errSpy.mockRestore();
    }
  });

  test("whole-prepare throw (upsert fails) → refunds the computed kinds and settles failed", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q);
    mocks.upsertApplicationPackage.mockRejectedValue(new Error("insert failed"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await POST(req());
      expect(res.status).toBe(202);
      await flushBackground();
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume", "cover"]);
      expect(mocks.settleGenerationJob.mock.calls.at(-1)![2]).toEqual({
        status: "failed", error: "Prefill failed — try again.",
      });
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe("POST /api/application/prepare — persistence contract", () => {
  test("upsert never writes answersSnapshot/greenhouseQuestions", async () => {
    mocks.getJobQuestion.mockResolvedValue({ questions: [] });
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    const upserted = mocks.upsertApplicationPackage.mock.calls.at(-1)![2];
    expect(upserted).not.toHaveProperty("answersSnapshot");
    expect(upserted).not.toHaveProperty("greenhouseQuestions");
  });

  test("instructions thread to their legs and persist; cover trace id captured", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q);
    await POST(req({ jobId: "job-1", resumeInstructions: "R focus", coverLetterInstructions: "C focus" }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBe("R focus");
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBe("C focus");
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.resumeInstructions).toBe("R focus");
    expect(pkg.coverLetterInstructions).toBe("C focus");
    expect(pkg.coverLetterTraceId).toBe("ct");
    expect(pkg.profileVersion).toBe("pv-9");
  });
});

describe("POST /api/application/prepare — profile-level generation instructions (per-leg column binding)", () => {
  // Cross-wiring guard for the route that runs BOTH legs: the résumé leg must be fed the
  // RÉSUMÉ profile column and the cover leg the COVER column. Distinct sentinels on BOTH
  // columns catch a swap (cover leg fed the résumé column, or vice-versa) that would still
  // typecheck and pass every other test.
  test("résumé leg gets the RÉSUMÉ column and the cover leg gets the COVER column (not swapped)", async () => {
    mocks.getJobQuestion.mockResolvedValue(COVER_Q); // wantsCover → both legs run
    mocks.getProfile.mockResolvedValue({
      resume_text: "PROFILE résumé body",
      full_name: "Ada Lovelace",
      instructions: "REVIEWER-ONLY",
      model_resume: null, model_cover: null, profile_version: "pv-9",
      resume_generation_instructions: "RESUME-GEN-SENTINEL",
      cover_letter_generation_instructions: "COVER-GEN-SENTINEL",
    });
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].profileInstructions).toBe("RESUME-GEN-SENTINEL");
    expect(mocks.generateCoverLetter.mock.calls[0][0].profileInstructions).toBe("COVER-GEN-SENTINEL");
  });
});
