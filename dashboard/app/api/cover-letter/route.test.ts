import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Same async-generation drift as /api/resume: auth/validation/gate stay synchronous
// (402/429 pass-through unchanged), then a 'pending' generation_jobs row + 202; the
// LLM work runs in a captured after() callback that tests drain explicitly. The
// cover-specific contract (profileVersion:null, review-context forwarding) is unchanged.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForCoverLetter: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  generateCoverLetter: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
  createGenerationJob: vi.fn(),
  settleGenerationJob: vi.fn(),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

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
  getJobForCoverLetter: mocks.getJobForCoverLetter,
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
vi.mock("@/lib/rolefit/coverLetterClient", () => ({
  DEFAULT_COVER_MODEL: "default-cover-model",
  generateCoverLetter: mocks.generateCoverLetter,
}));

import { POST } from "@/app/api/cover-letter/route";

const USER = "33333333-3333-3333-3333-333333333333";
const EMAIL = "u@x.com";
const LETTER = { greeting: "Dear", body: ["para"], signoff: "Best" };
const GEN_ROW = {
  id: "44444444-4444-4444-4444-444444444444",
  jobId: "job-1",
  kind: "cover",
  status: "pending",
  error: null,
  jobTitle: null,
  company: null,
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

function req(body?: unknown, raw?: string) {
  return new Request("http://localhost/api/cover-letter", {
    method: "POST",
    body: raw !== undefined ? raw : JSON.stringify(body ?? {}),
  });
}
/** Drain the captured after() callbacks — the background LLM work + status write. */
async function flushBackground() {
  while (mocks.afterCallbacks.length) await mocks.afterCallbacks.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: EMAIL });
  mocks.getProfile.mockResolvedValue({
    resume_text: "resume", full_name: "Ada",
    instructions: "REVIEWER-ONLY — must never reach generation", model_cover: null,
  });
  mocks.getJobForCoverLetter.mockResolvedValue({
    title: "Eng", company_name: "Acme", description: "jd", about: "about",
    requirements: [{ text: "5y", met: true }], skill_gaps: ["rust"], red_flags: ["hours"],
  });
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.generateCoverLetter.mockResolvedValue({ letter: LETTER, traceId: "cl-tr-1" });
  mocks.upsertApplicationPackage.mockResolvedValue({ jobId: "job-1", status: "prepared" });
  mocks.createGenerationJob.mockResolvedValue({ created: true, job: GEN_ROW });
  mocks.settleGenerationJob.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/cover-letter — validation ladder (charge only after validation)", () => {
  test("401 anon", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    expect((await POST(req({ jobId: "j" }))).status).toBe(401);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("400 missing jobId", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("422 no resume_text", async () => {
    mocks.getProfile.mockResolvedValue({ resume_text: null });
    expect((await POST(req({ jobId: "j" }))).status).toBe(422);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("404 no job", async () => {
    mocks.getJobForCoverLetter.mockResolvedValue(null);
    expect((await POST(req({ jobId: "j" }))).status).toBe(404);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("500 no api key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await POST(req({ jobId: "j" }))).status).toBe(500);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});

describe("POST /api/cover-letter — subscription/allowance gate (synchronous, before the 202)", () => {
  test("no plan → 402 pass-through (status + error), nothing tracked/generated/persisted", async () => {
    mocks.reserveGenerations.mockResolvedValue({
      ok: false, status: 402, code: "subscription_required", error: "Subscribe first.",
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Subscribe first.");
    // Machine-readable code the client's /billing upsell keys off (lib/rolefit/tierGate.ts).
    expect(body.code).toBe("subscription_required");
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
    expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("exhausted → 429 pass-through", async () => {
    mocks.reserveGenerations.mockResolvedValue({
      ok: false, status: 429, code: "allowance_exhausted", plan: "standard",
      error: "Monthly cover letter allowance used (3/3).",
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Monthly cover letter allowance used (3/3).");
    // code + plan let the client distinguish this from an upstream 429 and pitch Pro.
    expect(body.code).toBe("allowance_exhausted");
    expect(body.plan).toBe("standard");
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
  });
});

describe("POST /api/cover-letter — cover-specific contract", () => {
  test("202 with the tracked pending generation; reserves the cover kind; persists cover-only with profileVersion:null in the background", async () => {
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.generation).toMatchObject({
      id: GEN_ROW.id, kind: "cover", status: "pending", jobTitle: "Eng", company: "Acme",
    });
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["cover"]);
    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "cover");

    await flushBackground();
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.coverLetter).toBe(LETTER);
    expect(pkg.coverLetterTraceId).toBe("cl-tr-1");
    expect(pkg.coverLetterInstructions).toBeNull();
    expect(pkg.resume).toBeNull();
    // A cover-only regen must NOT stamp or clear the stored résumé's profile_version
    // (ON CONFLICT preserves it).
    expect(pkg.profileVersion).toBeNull();
    expect(mocks.settleGenerationJob).toHaveBeenCalledWith(USER, GEN_ROW.id, { status: "ready" });
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("forwards the review context (about/requirements/skillGaps/redFlags) to the generator", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    const arg = mocks.generateCoverLetter.mock.calls[0][0];
    expect(arg.job.about).toBe("about");
    expect(arg.job.skillGaps).toEqual(["rust"]);
    expect(arg.job.redFlags).toEqual(["hours"]);
    expect(arg.job.requirements).toEqual([{ text: "5y", met: true }]);
  });

  test("duplicate pending row → 202 with existing row, extra reservation refunded, no second run", async () => {
    mocks.createGenerationJob.mockResolvedValue({ created: false, job: GEN_ROW });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["cover"]);
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});

describe("POST /api/cover-letter — per-job instructions", () => {
  test("body instructions thread into generation and persist; profile.instructions never does", async () => {
    await POST(req({ jobId: "job-1", instructions: "  Mention the SRE rotation.  " }));
    await flushBackground();
    const arg = mocks.generateCoverLetter.mock.calls[0][0];
    expect(arg.instructions).toBe("Mention the SRE rotation.");
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.coverLetterInstructions).toBe("Mention the SRE rotation.");
  });

  test("no body instructions → generation gets null (NOT the reviewer-only profile.instructions)", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBeNull();
  });

  test("over-cap instructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", instructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});

describe("POST /api/cover-letter — profile-level generation instructions (column binding)", () => {
  // Cross-wiring guard: the cover route must feed the COVER profile column into
  // generateCoverLetter. Distinct sentinels on BOTH columns prove it isn't reading the
  // résumé column by mistake — a swap that would still typecheck and pass every other test.
  test("passes profile.cover_letter_generation_instructions (never the résumé column) as profileInstructions", async () => {
    mocks.getProfile.mockResolvedValue({
      resume_text: "resume", full_name: "Ada",
      instructions: "REVIEWER-ONLY — must never reach generation", model_cover: null,
      resume_generation_instructions: "RESUME-GEN-SENTINEL",
      cover_letter_generation_instructions: "COVER-GEN-SENTINEL",
    });
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateCoverLetter.mock.calls[0][0].profileInstructions).toBe("COVER-GEN-SENTINEL");
  });
});

describe("POST /api/cover-letter — background failure → refund + user-safe settled error", () => {
  const cases: [string, string][] = [
    ["response truncated", "cut off"],
    ["429 too many", "Rate limited"],
    ["402 no credits", "Insufficient credits."],
    ["generic boom", "Generation failed"],
  ];
  for (const [message, copy] of cases) {
    test(`Error("${message}") → settles failed containing "${copy}", refunds the cover slot`, async () => {
      mocks.generateCoverLetter.mockRejectedValue(new Error(message));
      const res = await POST(req({ jobId: "job-1" }));
      expect(res.status).toBe(202); // acceptance already happened — failure is async
      await flushBackground();
      expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["cover"]);
      const [, gid, outcome] = mocks.settleGenerationJob.mock.calls[0];
      expect(gid).toBe(GEN_ROW.id);
      expect(outcome.status).toBe("failed");
      expect(outcome.error).toContain(copy);
    });
  }
});
