import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";

// Async-generation contract: the route does auth/validation/config/gate
// SYNCHRONOUSLY (so 401/400/422/404/500/402/429 still reach the caller), records
// a 'pending' generation_jobs row, and returns 202. The LLM work + persist +
// status write run in `after()` — mocked here so tests trigger the background
// callback deterministically. reserveGenerations(userId, email, ["resume"]) still
// charges the slot UP FRONT and a failed background generation refunds it.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForResume: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  generateResume: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
  createGenerationJob: vi.fn(),
  settleGenerationJob: vi.fn(),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

// Capture after() callbacks instead of scheduling them (the real one needs the
// Next request scope); tests drain them explicitly via flushBackground().
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => { mocks.afterCallbacks.push(fn); },
}));
vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_a: unknown, fn: () => unknown) => fn(),
  startActiveObservation: (_n: string, fn: (s: unknown) => unknown) =>
    fn({ traceId: "t", update: () => {} }),
}));
vi.mock("@/lib/observability", () => ({ tracingEnabled: () => false, flushLangfuseTraces: async () => {} }));
vi.mock("@/lib/auth", () => ({ getUserClaims: mocks.getUserClaims }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  getJobForResume: mocks.getJobForResume,
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
vi.mock("@/lib/rolefit/resumeClient", () => ({
  DEFAULT_RESUME_MODEL: "default-resume-model",
  generateResume: mocks.generateResume,
}));
// Empty catalog = fail-open attach. The reasoning setting resolves from the gate's
// returned plan (reserveGenerations mocked "pro" = no clamp) and rides into
// generateResume in the background callback.
vi.mock("@/lib/openrouter", () => ({ getStructuredModels: async () => [] }));
// NOTE: @/lib/rolefit/resumeSource and @/lib/rolefit/generationFailureMessage are
// intentionally NOT mocked — both are pure functions.

import { POST } from "@/app/api/resume/route";

const USER = "22222222-2222-2222-2222-222222222222";
const EMAIL = "u@x.com";
const RESUME = { name: "Ada", contact: "", headline: "", summary: "", skills: [], experience: [], education: [], certifications: [] };
const GEN_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  jobId: "job-1",
  kind: "resume",
  status: "pending",
  error: null,
  jobTitle: null,
  company: null,
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

function profileFixture(): Partial<ProfileRow> {
  return { resume_text: "resume text", model_resume: null, profile_version: "pv-9" };
}
function req(body?: unknown, raw?: string) {
  return new Request("http://localhost/api/resume", {
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
  mocks.getProfile.mockResolvedValue(profileFixture());
  mocks.getJobForResume.mockResolvedValue({ title: "Eng", company_name: "Acme", description: "jd" });
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.generateResume.mockResolvedValue({ resume: RESUME, checks: {}, traceId: null });
  mocks.upsertApplicationPackage.mockResolvedValue({ jobId: "job-1", status: "prepared" });
  mocks.createGenerationJob.mockResolvedValue({ created: true, job: GEN_ROW });
  mocks.settleGenerationJob.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/resume — validation ladder (never charge an unchargeable request)", () => {
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
    mocks.getProfile.mockResolvedValue({ ...profileFixture(), resume_text: null });
    expect((await POST(req({ jobId: "j" }))).status).toBe(422);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("404 no job", async () => {
    mocks.getJobForResume.mockResolvedValue(null);
    expect((await POST(req({ jobId: "j" }))).status).toBe(404);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
  test("500 no api key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await POST(req({ jobId: "j" }))).status).toBe(500);
    // The gate runs AFTER the config check — a broken config must not charge.
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume — subscription/allowance gate (synchronous, before the 202)", () => {
  test("no plan → 402 with the gate's error body; no row tracked, nothing scheduled", async () => {
    mocks.reserveGenerations.mockResolvedValue({
      ok: false, status: 402, code: "subscription_required", error: "Subscribe to generate.",
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Subscribe to generate.");
    // Machine-readable code the client's /billing upsell keys off (lib/rolefit/tierGate.ts).
    expect(body.code).toBe("subscription_required");
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.generateResume).not.toHaveBeenCalled();
    expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
    // A gate rejection charged nothing, so there is nothing to refund.
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("allowance exhausted → 429 with the gate's error body", async () => {
    mocks.reserveGenerations.mockResolvedValue({
      ok: false, status: 429, code: "allowance_exhausted", plan: "standard",
      error: "Monthly résumé allowance used (5/5).",
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Monthly résumé allowance used (5/5).");
    // code + plan let the client distinguish this from an upstream 429 and pitch Pro.
    expect(body.code).toBe("allowance_exhausted");
    expect(body.plan).toBe("standard");
    expect(mocks.createGenerationJob).not.toHaveBeenCalled();
    expect(mocks.generateResume).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume — 202 accept + background completion", () => {
  test("202 immediately with the tracked pending generation (title/company for the toast)", async () => {
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.generation).toMatchObject({
      id: GEN_ROW.id, jobId: "job-1", kind: "resume", status: "pending",
      jobTitle: "Eng", company: "Acme",
    });
    // Charged exactly once, for THIS user+email, BEFORE the row was tracked.
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "resume");
    // Nothing generated yet — the LLM work lives in the captured after() callback.
    expect(mocks.generateResume).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
  });

  test("background success: generates from resume_text, persists stamped package, settles ready, keeps the slot", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    // The REAL getResumeSource fed the generator the profile's resume_text.
    expect(mocks.generateResume.mock.calls[0][0].resumeText).toBe("resume text");

    const [uid, jid, pkg] = mocks.upsertApplicationPackage.mock.calls[0];
    expect(uid).toBe(USER);
    expect(jid).toBe("job-1");
    expect(pkg.resume).toBe(RESUME);
    expect(pkg.coverLetter).toBeNull();
    expect(pkg.applyUrl).toBeNull();
    // The profileVersion stamp drives the "Outdated — regenerate" badge.
    expect(pkg.profileVersion).toBe("pv-9");
    expect(mocks.settleGenerationJob).toHaveBeenCalledWith(USER, GEN_ROW.id, { status: "ready" });
    // A success keeps the reserved slot — never refunded.
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("passes the resolved reasoning effort to generateResume", async () => {
    mocks.getProfile.mockResolvedValue({
      ...profileFixture(),
      reasoning_effort_resume: "high",
      reasoning_effort_cover: null,
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    await flushBackground();
    expect(mocks.generateResume).toHaveBeenCalledWith(
      expect.objectContaining({ reasoningEffort: "high" }),
    );
  });

  test("duplicate pending row → 202 with the existing row, extra reservation refunded, NO second background run", async () => {
    mocks.createGenerationJob.mockResolvedValue({ created: false, job: GEN_ROW });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(202);
    expect((await res.json()).generation.id).toBe(GEN_ROW.id);
    // This request charged a slot the ALREADY-RUNNING generation also charged — refund it.
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.generateResume).not.toHaveBeenCalled();
  });

  test("tracking row failed → 502 and the reservation is refunded (no orphaned charge)", async () => {
    mocks.createGenerationJob.mockRejectedValue(new Error("db down"));
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(502);
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});

describe("POST /api/resume — background failure → refund + user-safe settled error", () => {
  // Each failure must NOT persist a package (a broken generation must not clobber a
  // previously-saved good one), must REFUND the reserved slot, and must settle the
  // row 'failed' with mapped user-safe copy (the poll toast is the only user signal
  // now — there's no HTTP status to carry it).
  const cases: [string, string][] = [
    ["response truncated mid-stream", "cut off"],
    ["OpenRouter returned non-JSON résumé content", "cut off"],
    ["The operation was aborted due to timeout", "timed out"],
    ["429 rate limited", "Rate limited"],
    ["rate limit exceeded", "Rate limited"],
    ["402 payment required", "Insufficient credits."],
    ["some generic boom", "Generation failed"],
  ];
  for (const [message, copy] of cases) {
    test(`Error("${message}") → settles failed containing "${copy}", refunds the résumé slot`, async () => {
      mocks.generateResume.mockRejectedValue(new Error(message));
      const res = await POST(req({ jobId: "job-1" }));
      expect(res.status).toBe(202); // acceptance already happened — failure is async
      await flushBackground();
      expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
      const [uid, gid, outcome] = mocks.settleGenerationJob.mock.calls[0];
      expect(uid).toBe(USER);
      expect(gid).toBe(GEN_ROW.id);
      expect(outcome.status).toBe("failed");
      expect(outcome.error).toContain(copy);
    });
  }

  test("non-Error throw (string) → generic copy and still refunds", async () => {
    mocks.generateResume.mockRejectedValue("plain string failure");
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    expect(mocks.settleGenerationJob.mock.calls[0][2].error).toContain("Generation failed");
  });

  test("status-write failure after a SUCCESSFUL generation never refunds the kept slot", async () => {
    mocks.settleGenerationJob.mockRejectedValue(new Error("db blip"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await POST(req({ jobId: "job-1" }));
      await flushBackground();
      expect(mocks.upsertApplicationPackage).toHaveBeenCalled();
      // The generation succeeded and persisted — a failed settle is logged, not refunded.
      expect(mocks.refundGenerations).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe("POST /api/resume — per-job instructions", () => {
  test("body instructions thread into generateResume and persist", async () => {
    await POST(req({ jobId: "job-1", instructions: " Focus on infra. " }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBe("Focus on infra.");
    expect(mocks.upsertApplicationPackage.mock.calls[0][2].resumeInstructions).toBe("Focus on infra.");
  });

  test("absent instructions → null through to generation and persistence", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBeNull();
    expect(mocks.upsertApplicationPackage.mock.calls[0][2].resumeInstructions).toBeNull();
  });

  test("over-cap instructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", instructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});
