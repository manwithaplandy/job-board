import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";

// SaaS cutover: auth is getUserClaims() ({id,email}); the route gained an atomic
// subscription/allowance gate — reserveGenerations(userId, email, ["resume"]) charges the
// slot UP FRONT (after validation, so an unchargeable request never pays) and can return
// {ok:false, status:402|429}; a failed generation refundGenerations(userId, ["resume"]).
// getResumeSource is now a trivial pure function, so we let the REAL one run off
// profile.resume_text (no over-mocking) and assert the generator gets that text.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForResume: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  generateResume: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
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
vi.mock("@/lib/rolefit/resumeClient", () => ({
  DEFAULT_RESUME_MODEL: "default-resume-model",
  generateResume: mocks.generateResume,
}));
// NOTE: @/lib/rolefit/resumeSource is intentionally NOT mocked — it's a pure function.

import { POST } from "@/app/api/resume/route";

const USER = "22222222-2222-2222-2222-222222222222";
const EMAIL = "u@x.com";
const RESUME = { name: "Ada", contact: "", headline: "", summary: "", skills: [], experience: [], education: [], certifications: [] };

function profileFixture(): Partial<ProfileRow> {
  return { resume_text: "resume text", model_resume: null, profile_version: "pv-9" };
}
function req(body?: unknown, raw?: string) {
  return new Request("http://localhost/api/resume", {
    method: "POST",
    body: raw !== undefined ? raw : JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: EMAIL });
  mocks.getProfile.mockResolvedValue(profileFixture());
  mocks.getJobForResume.mockResolvedValue({ title: "Eng", company_name: "Acme", description: "jd" });
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.generateResume.mockResolvedValue({ resume: RESUME, checks: {} });
  mocks.upsertApplicationPackage.mockResolvedValue({ jobId: "job-1", status: "prepared" });
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

describe("POST /api/resume — subscription/allowance gate", () => {
  test("no plan → 402 with the gate's error body; nothing generated or persisted", async () => {
    mocks.reserveGenerations.mockResolvedValue({
      ok: false, status: 402, code: "subscription_required", error: "Subscribe to generate.",
    });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Subscribe to generate.");
    // Machine-readable code the client's /billing upsell keys off (lib/rolefit/tierGate.ts).
    expect(body.code).toBe("subscription_required");
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
    expect(mocks.generateResume).not.toHaveBeenCalled();
    expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume — happy path", () => {
  test("reserves the résumé slot for the authed user, generates from resume_text, persists stamped package", async () => {
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(200);
    // Charged exactly once, for THIS user+email, for the résumé kind.
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
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
    // A success keeps the reserved slot — never refunded.
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume — error → status mapping (refunds a burned slot)", () => {
  // Each failure must NOT persist a package (a broken generation must not clobber a
  // previously-saved good one) AND must refund the reserved slot.
  const cases: [string, number, string?][] = [
    ["response truncated mid-stream", 502, "cut off"],
    ["OpenRouter returned non-JSON résumé content", 502, "cut off"],
    ["The operation was aborted due to timeout", 502, "timed out"],
    ["429 rate limited", 429],
    ["rate limit exceeded", 429],
    ["402 payment required", 502, "Insufficient credits."],
    ["some generic boom", 502, "Generation failed"],
  ];
  for (const [message, status, copy] of cases) {
    test(`Error("${message}") → ${status}, refunds the résumé slot`, async () => {
      mocks.generateResume.mockRejectedValue(new Error(message));
      const res = await POST(req({ jobId: "job-1" }));
      expect(res.status).toBe(status);
      if (copy) expect((await res.json()).error).toContain(copy);
      expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
    });
  }

  test("non-Error throw (string) → generic 502 and still refunds", async () => {
    mocks.generateResume.mockRejectedValue("plain string failure");
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Generation failed");
    expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
  });
});
