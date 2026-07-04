import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Same SaaS drift as /api/resume: auth via getUserClaims() ({id,email}) and an atomic
// reserveGenerations(userId, email, ["cover"]) tier gate (402 no plan / 429 exhausted)
// placed AFTER validation, with refundGenerations(userId, ["cover"]) in the catch. The
// cover-specific contract (profileVersion:null, review-context forwarding) is unchanged.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  getJobForCoverLetter: vi.fn(),
  upsertApplicationPackage: vi.fn(),
  generateCoverLetter: vi.fn(),
  reserveGenerations: vi.fn(),
  refundGenerations: vi.fn(),
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
vi.mock("@/lib/rolefit/coverLetterClient", () => ({
  DEFAULT_COVER_MODEL: "default-cover-model",
  generateCoverLetter: mocks.generateCoverLetter,
}));

import { POST } from "@/app/api/cover-letter/route";

const USER = "33333333-3333-3333-3333-333333333333";
const EMAIL = "u@x.com";
const LETTER = { greeting: "Dear", body: ["para"], signoff: "Best" };

function req(body?: unknown, raw?: string) {
  return new Request("http://localhost/api/cover-letter", {
    method: "POST",
    body: raw !== undefined ? raw : JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: EMAIL });
  mocks.getProfile.mockResolvedValue({ resume_text: "resume", full_name: "Ada", instructions: null, model_cover: null });
  mocks.getJobForCoverLetter.mockResolvedValue({
    title: "Eng", company_name: "Acme", description: "jd", about: "about",
    requirements: [{ text: "5y", met: true }], skill_gaps: ["rust"], red_flags: ["hours"],
  });
  mocks.reserveGenerations.mockResolvedValue({ ok: true, plan: "pro" });
  mocks.refundGenerations.mockResolvedValue(undefined);
  mocks.generateCoverLetter.mockResolvedValue(LETTER);
  mocks.upsertApplicationPackage.mockResolvedValue({ jobId: "job-1", status: "prepared" });
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

describe("POST /api/cover-letter — subscription/allowance gate", () => {
  test("no plan → 402 pass-through (status + error), nothing generated/persisted", async () => {
    mocks.reserveGenerations.mockResolvedValue({ ok: false, status: 402, error: "Subscribe first." });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("Subscribe first.");
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
    expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("exhausted → 429 pass-through", async () => {
    mocks.reserveGenerations.mockResolvedValue({ ok: false, status: 429, error: "Monthly cover letter allowance used (3/3)." });
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("Monthly cover letter allowance used (3/3).");
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
  });
});

describe("POST /api/cover-letter — cover-specific contract", () => {
  test("reserves the cover kind for the authed user, persists cover-only with profileVersion:null", async () => {
    const res = await POST(req({ jobId: "job-1" }));
    expect(res.status).toBe(200);
    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["cover"]);
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.coverLetter).toBe(LETTER);
    expect(pkg.resume).toBeNull();
    // A cover-only regen must NOT stamp or clear the stored résumé's profile_version
    // (ON CONFLICT preserves it).
    expect(pkg.profileVersion).toBeNull();
    expect(mocks.refundGenerations).not.toHaveBeenCalled();
  });

  test("forwards the review context (about/requirements/skillGaps/redFlags) to the generator", async () => {
    await POST(req({ jobId: "job-1" }));
    const arg = mocks.generateCoverLetter.mock.calls[0][0];
    expect(arg.job.about).toBe("about");
    expect(arg.job.skillGaps).toEqual(["rust"]);
    expect(arg.job.redFlags).toEqual(["hours"]);
    expect(arg.job.requirements).toEqual([{ text: "5y", met: true }]);
  });
});

describe("POST /api/cover-letter — error mapping (refunds a burned slot)", () => {
  const cases: [string, number][] = [
    ["response truncated", 502],
    ["429 too many", 429],
    ["402 no credits", 502],
    ["generic boom", 502],
  ];
  for (const [message, status] of cases) {
    test(`Error("${message}") → ${status}, refunds the cover slot`, async () => {
      mocks.generateCoverLetter.mockRejectedValue(new Error(message));
      const res = await POST(req({ jobId: "job-1" }));
      expect(res.status).toBe(status);
      expect(mocks.upsertApplicationPackage).not.toHaveBeenCalled();
      expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["cover"]);
    });
  }
});
