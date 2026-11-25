// The approval tools (plan Task 1.16): which exist for which context, that each stops
// at approval-requested without running, their strict inputs, and what the model reads
// back. The libraries behind the tools are fakes; the AI SDK is real (MockLanguageModelV4).
// The loop's half of the round trip (patching the stored part) is in loop.test.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  startApplicationPrep: vi.fn(),
  setResumeFromDocument: vi.fn(),
  withUserSql: vi.fn(),
  isAccountDeleted: vi.fn(async () => false),
}));
vi.mock("@/lib/applicationPrep", () => ({ startApplicationPrep: m.startApplicationPrep }));
vi.mock("@/lib/workspaces/resumeVersions", () => {
  class ResumeInputError extends Error {}
  return { ResumeInputError, setResumeFromDocument: m.setResumeFromDocument };
});
vi.mock("@/lib/db", () => ({ withUserSql: m.withUserSql, withUserMutation: vi.fn(), withUserPayloadMutation: vi.fn() }));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: m.isAccountDeleted }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { asSchema, isToolUIPart, simulateReadableStream, streamText, toUIMessageStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { emptyGathered } from "@/lib/agent/gathered";
import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { assertNoUserIdInput } from "@/lib/agent/tools/assertNoUserIdInput";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import { ResumeInputError } from "@/lib/workspaces/resumeVersions";
import {
  TOOL_APPROVAL,
  approvalStreamOptions,
  approvalTools,
  proposeProfileDetailsTool,
  setResumeTool,
  startApplicationPrepTool,
} from "@/lib/agent/tools/approval";
import { ProfileDetailsInputSchema } from "@/lib/agent/actions/profileDetails";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "55555555-5555-4555-8555-555555555555";
const JOB = "greenhouse:acme:101";
// A test-only key: long enough to count, never a real secret.
const TEST_KEY = "test-approval-key-0123456789abcdefghijklmnop";

function ctx(extra: Partial<ToolCtx> = {}): ToolCtx {
  return {
    userId: USER,
    email: "me@example.test",
    threadId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 },
    ...extra,
  };
}

let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", TEST_KEY);
  resetApprovalSecretWarning();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

const NAMES = ["propose_profile_details", "refine_documents", "set_resume", "start_application_prep"];

describe("which approval tools exist", () => {
  test("with the secret, an attended ctx has the four approval tools, each mapped to user-approval", () => {
    expect(Object.keys(approvalTools(ctx())).sort()).toEqual(NAMES);
    expect(TOOL_APPROVAL).toEqual(Object.fromEntries(NAMES.map((n) => [n, "user-approval"])));
    expect(Object.keys(buildTools(ctx()))).toEqual(expect.arrayContaining(NAMES));
    expect(approvalStreamOptions(ctx())).toEqual({ toolApproval: TOOL_APPROVAL, experimental_toolApprovalSecret: TEST_KEY });
  });

  test("unattended ctx has no approval tools", () => {
    expect(approvalTools(ctx({ unattended: true }))).toEqual({});
    for (const name of NAMES) expect(Object.keys(buildTools(ctx({ unattended: true })))).not.toContain(name);
    expect(approvalStreamOptions(ctx({ unattended: true }))).toEqual({});
  });

  test("without the approval secret no approval tool is offered and confirm intents write nothing", () => {
    // The confirm-intent half of this ruling is in lib/agent/actions/handlers.test.ts.
    vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "");
    expect(approvalTools(ctx())).toEqual({});
    for (const name of NAMES) expect(Object.keys(buildTools(ctx()))).not.toContain(name);
    // Neither a toolApproval map nor the secret reaches the model call.
    expect(approvalStreamOptions(ctx())).toEqual({});
    const logged = warn.mock.calls.filter((c) => String(c[0]).includes("AGENT_TOOL_APPROVAL_SECRET"));
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).not.toMatch(/\d/);
  });

  test("a secret under 32 characters counts as missing", () => {
    vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "k".repeat(31));
    expect(approvalTools(ctx())).toEqual({});
    expect(approvalStreamOptions(ctx())).toEqual({});
    vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "k".repeat(32));
    expect(Object.keys(approvalTools(ctx())).sort()).toEqual(NAMES);
  });

  test("no approval tool is named delete, send, fetch, export or submit, and none takes a user id", async () => {
    for (const name of NAMES) expect(name).not.toMatch(/delete|send|fetch|export|submit/i);
    await assertNoUserIdInput(approvalTools(ctx()));
  });
});

// ---------------------------------------------------------------------------
// The SDK stops each tool at approval-requested
// ---------------------------------------------------------------------------

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const INPUTS: Record<string, unknown> = {
  start_application_prep: { jobId: JOB },
  set_resume: { documentId: DOC },
  refine_documents: { jobId: JOB, target: "both", instructions: "Lead with the platform work." },
  propose_profile_details: { fields: { phone: "+1 555 0100" } },
};

function callModel(toolName: string) {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(INPUTS[toolName]) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
  ];
  return new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks }) }) });
}

test.each(NAMES)("each approval tool stops at approval-requested and execute has not run (%s)", async (name) => {
  const c = ctx();
  const user: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "go" }] };
  const result = streamText({
    model: callModel(name),
    messages: [{ role: "user", content: "go" }],
    tools: approvalTools(c),
    ...approvalStreamOptions(c),
  });
  let saved: UIMessage[] = [];
  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: [user],
    generateMessageId: () => "a1",
    onEnd: (e) => {
      saved = e.messages;
    },
  });
  const reader = stream.getReader();
  while (!(await reader.read()).done) {
    /* drain */
  }
  const part = saved.at(-1)?.parts.find((p) => p.type === `tool-${name}`);
  if (!part || !isToolUIPart(part)) throw new Error(`no ${name} part`);
  expect(part.state).toBe("approval-requested");
  expect(part.approval?.signature).toEqual(expect.any(String));
  expect(m.startApplicationPrep).not.toHaveBeenCalled();
  expect(m.setResumeFromDocument).not.toHaveBeenCalled();
  expect(m.withUserSql).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Inputs and results
// ---------------------------------------------------------------------------

describe("propose_profile_details", () => {
  test("propose_profile_details rejects any eeo_ key", async () => {
    const schema = asSchema(approvalTools(ctx()).propose_profile_details!.inputSchema);
    for (const bad of [
      { fields: { eeo_gender: "x" } },
      { fields: { phone: "1" }, eeo_race: "x" },
      { fields: {}, screeningAnswers: { eeo_veteran: "no" } },
      { fields: {}, screeningAnswers: { eeoDisability: "no" } },
      { fields: { links: { linkedin: "https://x.example/in/a", eeo: "x" } } },
    ]) {
      expect((await schema.validate?.(bad))?.success, JSON.stringify(bad)).toBe(false);
      expect(ProfileDetailsInputSchema.safeParse(bad).success).toBe(false);
    }
    expect((await schema.validate?.({ fields: { phone: "1" }, screeningAnswers: { notice_period: "2 weeks" } }))?.success).toBe(true);
  });

  test("the write names only the listed columns, merges links and answers, and never touches EEO columns", async () => {
    const queries: string[] = [];
    m.withUserSql.mockImplementation(async (_u: string, fn: (tx: unknown) => unknown) =>
      fn((strings: TemplateStringsArray) => {
        queries.push(strings.join("?"));
        return Promise.resolve([{ ok: 1 }]);
      }),
    );
    const out = await proposeProfileDetailsTool(ctx(), {
      fields: { phone: "+1 555 0100", links: { github: "https://github.example/pat" } },
      screeningAnswers: { notice_period: "2 weeks" },
    });
    expect(out).toEqual({ status: "done", fields: ["phone", "links"], screeningAnswers: 1 });
    expect(m.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/eeo/i);
    expect(queries[0]).toContain("links = links ||");
    expect(queries[0]).toContain("screening_answers = screening_answers ||");
  });

  test("a tombstoned account writes nothing", async () => {
    m.isAccountDeleted.mockResolvedValueOnce(true);
    expect(await proposeProfileDetailsTool(ctx(), { fields: { phone: "1" } })).toEqual({ status: "refused", reason: "account_deleted" });
    expect(m.withUserSql).not.toHaveBeenCalled();
  });
});

describe("set_resume and start_application_prep", () => {
  test("set_resume runs as the agent with the tool context as its audit context; a refused document reads as refused", async () => {
    m.setResumeFromDocument.mockResolvedValueOnce({ displacedVersion: 3, actionId: 9 });
    const c = ctx();
    expect(await setResumeTool(c, { documentId: DOC })).toEqual({ status: "done", actionId: 9, displacedVersion: 3 });
    expect(m.setResumeFromDocument).toHaveBeenCalledWith(USER, { documentId: DOC, actor: "agent", audit: c });
    m.setResumeFromDocument.mockRejectedValueOnce(new ResumeInputError("That file had no readable text."));
    expect(await setResumeTool(c, { documentId: DOC })).toEqual({ status: "refused", reason: "unusable_document" });
  });

  test("start_application_prep with exhausted allowance returns allowance_exhausted and reserves nothing", async () => {
    // The library reserves all-or-nothing and starts nothing on a refused gate
    // (lib/applicationPrep.test.ts); the tool passes only the status and kind back.
    m.startApplicationPrep.mockResolvedValueOnce({
      status: "allowance_exhausted",
      kind: "cover",
      gate: { ok: false, status: 429, code: "allowance_exhausted", plan: "standard", error: "Monthly cover letter allowance used (5/5 on Standard)." },
    });
    expect(await startApplicationPrepTool(ctx(), { jobId: JOB })).toEqual({ status: "allowance_exhausted", kind: "cover" });
    expect(m.startApplicationPrep).toHaveBeenCalledWith(USER, "me@example.test", JOB);
  });
});
