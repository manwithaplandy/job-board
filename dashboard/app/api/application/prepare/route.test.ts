import { beforeEach, describe, expect, test, vi } from "vitest";

// Route-level test for /api/application/prepare's allowance discipline (T9, minor 4):
// the route RESERVES (charges) both kinds atomically up front, runs its résumé +
// cover-letter LLM legs under Promise.allSettled, persists whatever succeeded, and
// REFUNDS only the kinds whose leg rejected — a rejected leg (e.g. OpenRouter outage)
// never burns its allowance, both-succeed refunds nothing, both-fail refunds both.
// Everything below the route is mocked; tracing is off so run() executes inline.

const state = vi.hoisted(() => ({
  resumeRejects: false,
  coverRejects: false,
  refundCalls: [] as string[][],
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
  upsertApplicationPackage: vi.fn(async () => ({ id: 1 })),
}));

vi.mock("@/lib/usage", () => ({
  reserveGenerations: vi.fn(async () => ({ ok: true, plan: "pro" })),
  refundGenerations: vi.fn(async (_userId: string, kinds: string[]) => {
    state.refundCalls.push(kinds);
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
    return { resume: { sections: [] }, checks: {} };
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

beforeEach(() => {
  state.resumeRejects = false;
  state.coverRejects = false;
  state.refundCalls.length = 0;
  process.env.OPENROUTER_API_KEY = "test-key"; // route 500s without it, before any leg runs
});

describe("prepare allowance reserve/refund", () => {
  test("both legs succeed → refunds nothing (both reserved slots kept)", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(state.refundCalls).toEqual([]);
  });

  test("résumé leg fails → refunds only résumé", async () => {
    state.resumeRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.resume).toBe("failed");
    expect(body.status.coverLetter).toBe("ok");
    expect(state.refundCalls).toEqual([["resume"]]);
  });

  test("cover leg fails → refunds only cover", async () => {
    state.coverRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(state.refundCalls).toEqual([["cover"]]);
  });

  test("both legs fail → refunds both", async () => {
    state.resumeRejects = true;
    state.coverRejects = true;
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(state.refundCalls).toEqual([["resume", "cover"]]);
  });
});
