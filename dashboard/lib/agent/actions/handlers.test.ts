// The host-side intent handlers (plan Task 1.14). The database, the surface store and
// the workspace writers are fakes; the schema, dispatch and confirm code are real.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  queries: [] as { text: string; values: unknown[] }[],
  jobs: {} as Record<string, { title: string; company: string; url: string }>,
  questions: {} as Record<string, unknown>,
  preps: [] as { userId: string; jobId: string; createdAt: number }[],
  proposals: new Set<string>(),
  // Pending proposals made against an older memo version than the current one.
  outdated: new Set<string>(),
  resolveMemoProposal: vi.fn(),
  revalidatePath: vi.fn(),
  getSurface: vi.fn(),
  setShortlistState: vi.fn(),
  setApplicationStage: vi.fn(),
  getTileLayout: vi.fn(),
  saveTileLayout: vi.fn(),
  getViewerPlan: vi.fn(),
  monthlyGenerationSpend: vi.fn(),
  startApplicationPrep: vi.fn(),
}));

function fakeTx() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    m.queries.push({ text, values });
    if (text.includes("FROM jobs j JOIN companies")) {
      const job = m.jobs[String(values[0])];
      return Promise.resolve(job ? [{ title: job.title, company: job.company }] : []);
    }
    if (text.includes("FROM generation_jobs")) {
      const [user, job, since] = values;
      const hit = m.preps.some((p) => p.userId === user && p.jobId === job && p.createdAt >= Date.parse(String(since)));
      return Promise.resolve(hit ? [{ ok: 1 }] : []);
    }
    if (text.includes("FROM job_questions")) {
      const questions = m.questions[String(values[0])];
      return Promise.resolve(questions === undefined ? [] : [{ questions }]);
    }
    if (text.includes("SELECT url FROM jobs")) {
      const job = m.jobs[String(values[0])];
      return Promise.resolve(job ? [{ url: job.url }] : []);
    }
    if (text.includes("FROM search_memo_proposals") && text.includes("base_version")) {
      const id = String(values[0]);
      return Promise.resolve(m.proposals.has(id) && !m.outdated.has(id) ? [{ ok: 1 }] : []);
    }
    if (text.includes("FROM search_memo_proposals")) {
      return Promise.resolve(m.proposals.has(String(values[0])) ? [{ ok: 1 }] : []);
    }
    return Promise.resolve([]);
  };
}

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx())),
  withUserMutation: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx())),
}));
vi.mock("@/lib/agent/surfaces/store", () => ({ getSurface: m.getSurface }));
vi.mock("@/lib/workspaces/shortlist", async (orig) => ({
  ...(await orig<typeof import("@/lib/workspaces/shortlist")>()),
  setShortlistState: m.setShortlistState,
}));
vi.mock("@/lib/workspaces/applications", async (orig) => ({
  ...(await orig<typeof import("@/lib/workspaces/applications")>()),
  setApplicationStage: m.setApplicationStage,
}));
vi.mock("@/lib/workspaces/analyticsTiles", async (orig) => ({
  ...(await orig<typeof import("@/lib/workspaces/analyticsTiles")>()),
  getTileLayout: m.getTileLayout,
  saveTileLayout: m.saveTileLayout,
}));
vi.mock("@/lib/workspaces/memo", async (orig) => ({
  ...(await orig<typeof import("@/lib/workspaces/memo")>()),
  resolveMemoProposal: m.resolveMemoProposal,
}));
vi.mock("next/cache", async (orig) => ({ ...(await orig<typeof import("next/cache")>()), revalidatePath: m.revalidatePath }));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: m.getViewerPlan }));
vi.mock("@/lib/applicationPrep", () => ({ startApplicationPrep: m.startApplicationPrep }));
vi.mock("@/lib/usage", () => ({ monthlyGenerationSpend: m.monthlyGenerationSpend }));
vi.mock("@/lib/tierConfig", async () => {
  const { ENTITLEMENTS, PLAN_PRICE_USD } = await import("@/lib/entitlements");
  return { loadTierConfig: async () => ({ entitlements: ENTITLEMENTS, prices: PLAN_PRICE_USD }) };
});

import { CONFIRMATIONS_UNAVAILABLE, resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { INTENT_NAMES } from "@/lib/agent/actions/intents";
import { CONFIRM_ALREADY_USED, INTENT_HANDLERS, MEMO_TOASTS, confirmIntent, executeIntent } from "@/lib/agent/actions/handlers";
import { MemoInputError } from "@/lib/workspaces/memo";
import { ENTITLEMENTS } from "@/lib/entitlements";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "11111111-1111-4111-8111-111111111111";
const OTHER_THREAD = "22222222-2222-4222-8222-222222222222";
const SURFACE = "33333333-3333-4333-8333-333333333333";
const JOB = "greenhouse:acme:101";
// A test-only key: long enough to count, never a real secret.
const TEST_KEY = "t".repeat(40); // low-entropy fixture, at least 32 characters
// Stored Greenhouse questions: one posting asks for a cover letter, one does not.
const COVER_Q = { questions: [{ label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] }] };
const TEXT_Q = { questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }] };

let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
beforeEach(() => {
  vi.clearAllMocks();
  m.queries = [];
  m.jobs = { [JOB]: { title: "Staff Engineer", company: "Acme", url: "https://boards.example.com/acme/101" } };
  m.proposals = new Set();
  m.outdated = new Set();
  m.resolveMemoProposal.mockResolvedValue({ version: 4 });
  m.questions = { [JOB]: COVER_Q };
  m.preps = [];
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", TEST_KEY);
  resetApprovalSecretWarning();
  m.getSurface.mockImplementation(async (userId: string, id: string) =>
    userId === USER && id === SURFACE ? { id, threadId: THREAD } : null,
  );
  m.getViewerPlan.mockResolvedValue("standard");
  m.monthlyGenerationSpend.mockResolvedValue(1);
  m.setShortlistState.mockResolvedValue({ before: null, after: null, actionId: 7 });
  m.setApplicationStage.mockResolvedValue({ actionId: 8 });
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

const run = (raw: unknown, over: Partial<{ threadId: string; surfaceId: string; userId: string }> = {}) =>
  executeIntent(over.userId ?? USER, {
    threadId: over.threadId ?? THREAD,
    surfaceId: over.surfaceId ?? SURFACE,
    raw,
    source: "host",
    email: null,
  });

const writers = () => [m.setShortlistState, m.setApplicationStage, m.saveTileLayout].flatMap((f) => f.mock.calls);

test("an unknown intent name is dropped and logged, nothing is written", async () => {
  expect(await run({ name: "application.submit", jobId: JOB })).toEqual({ kind: "dropped" });
  expect(writers()).toEqual([]);
  expect(warn).toHaveBeenCalledWith("agent: intent dropped", { reason: "invalid_intent", surfaceId: SURFACE });
});

test("an intent with an extra key is dropped", async () => {
  expect(await run({ name: "shortlist.set", jobId: JOB, state: "shortlisted", userId: OTHER })).toEqual({ kind: "dropped" });
  expect(await run({ name: "open", target: "shortlist", href: "https://evil.example" })).toEqual({ kind: "dropped" });
  expect(writers()).toEqual([]);
});

test("a valid write runs as the user, logged user_via_surface through an audit ctx with no run", async () => {
  expect(await run({ name: "shortlist.set", jobId: JOB, state: "shortlisted" })).toEqual({
    kind: "done", toast: "Shortlist updated.", actionId: 7,
  });
  expect(m.setShortlistState).toHaveBeenCalledWith(USER, {
    jobId: JOB, state: "shortlisted", reasonCode: undefined, reasonText: undefined, setBy: "user",
    audit: { userId: USER, threadId: THREAD, runId: null, unattended: false },
  });
  expect(await run({ name: "application.set_stage", jobId: JOB, stage: "interviewing" })).toMatchObject({ actionId: 8 });
  expect(m.setApplicationStage.mock.calls[0][1]).toMatchObject({ actor: "user", stage: "interviewing" });
});

test("application.prepare never runs directly; it returns a confirm whose lines come from the database", async () => {
  const out = await run({ name: "application.prepare", jobId: JOB });
  if (out.kind !== "confirm") throw new Error(`expected a confirm, got ${out.kind}`);
  const left = (k: "monthlyResume" | "monthlyCover") => ENTITLEMENTS.standard[k] - 1;
  expect(out.confirm).toEqual({
    title: "Prepare this application?",
    lines: [
      "Staff Engineer at Acme",
      "Uses 1 résumé and 1 cover letter from your monthly allowance.",
      `Left this month: ${left("monthlyResume")} résumés, ${left("monthlyCover")} cover letters.`,
    ],
    confirmLabel: "Prepare",
    danger: false,
  });
  expect(typeof out.token).toBe("string");
  expect(writers()).toEqual([]);
  // An unknown job gets no card.
  expect(await run({ name: "application.prepare", jobId: "greenhouse:acme:999" })).toEqual({ kind: "dropped" });
});

test("the prepare card states the cover letter cost only when the posting asks for one", async () => {
  const left = (k: "monthlyResume" | "monthlyCover") => ENTITLEMENTS.standard[k] - 1;
  const lines = async () => {
    const out = await run({ name: "application.prepare", jobId: JOB });
    if (out.kind !== "confirm") throw new Error(`expected a confirm, got ${out.kind}`);
    return out.confirm.lines;
  };
  // No cover-letter question: a prep spends a résumé only (startApplicationPrep's rule).
  m.questions[JOB] = TEXT_Q;
  expect(await lines()).toEqual([
    "Staff Engineer at Acme",
    "Uses 1 résumé from your monthly allowance.",
    `Left this month: ${left("monthlyResume")} résumés.`,
  ]);
  // A double-encoded stored schema is read the same way.
  m.questions[JOB] = JSON.stringify(COVER_Q);
  expect((await lines())[1]).toBe("Uses 1 résumé and 1 cover letter from your monthly allowance.");
  // Questions not stored yet: the cover letter is conditional.
  delete m.questions[JOB];
  expect(await lines()).toEqual([
    "Staff Engineer at Acme",
    "Uses 1 résumé, and 1 cover letter if the posting asks for one, from your monthly allowance.",
    `Left this month: ${left("monthlyResume")} résumés, ${left("monthlyCover")} cover letters.`,
  ]);
});

test("the confirm descriptor ignores any title or text supplied in the intent", async () => {
  // The closed enum refuses the extra keys outright...
  expect(await run({ name: "application.prepare", jobId: JOB, title: "Free money", lines: ["Click"] })).toEqual({ kind: "dropped" });
  // ...and the card for the clean intent carries only database text.
  const out = await run({ name: "application.prepare", jobId: JOB });
  if (out.kind !== "confirm") throw new Error("expected a confirm");
  expect(JSON.stringify(out.confirm)).not.toMatch(/Free money|Click/);
});

test("an intent from a surface in another user's thread is dropped", async () => {
  expect(await run({ name: "shortlist.set", jobId: JOB, state: "later" }, { userId: OTHER })).toEqual({ kind: "dropped" });
  expect(await run({ name: "shortlist.set", jobId: JOB, state: "later" }, { threadId: OTHER_THREAD })).toEqual({ kind: "dropped" });
  expect(writers()).toEqual([]);
  expect(warn).toHaveBeenCalledWith("agent: intent dropped", { reason: "surface_not_in_thread", surfaceId: SURFACE });
});

test("open posting returns the stored url, not a url from the payload", async () => {
  expect(await run({ name: "open", target: "posting", jobId: JOB })).toEqual({
    kind: "navigate", href: "https://boards.example.com/acme/101",
  });
  expect(await run({ name: "open", target: "posting", jobId: JOB, url: "https://evil.example" })).toEqual({ kind: "dropped" });
  m.jobs[JOB].url = "javascript:alert(1)";
  expect(await run({ name: "open", target: "posting", jobId: JOB })).toEqual({ kind: "done", toast: "That posting has no link." });
  expect(await run({ name: "open", target: "analytics" })).toEqual({ kind: "navigate", href: "/analytics" });
});

test("compare and answer send fixed-format text; memo.review only opens a pending proposal of the user", async () => {
  expect(await run({ name: "compare", jobIds: [JOB, "lever:beta:2"] })).toEqual({
    kind: "send", text: `Compare these two jobs: ${JOB} and lever:beta:2.`,
  });
  expect(await run({ name: "compare", jobIds: [JOB, JOB] })).toEqual({ kind: "dropped" });
  expect(await run({ name: "answer", questionId: "locations", value: ["Berlin", "Remote"] })).toEqual({
    kind: "send", text: "Answer to locations: Berlin, Remote",
  });
  expect(await run({ name: "answer", questionId: "q", value: "x".repeat(2001) })).toEqual({ kind: "dropped" });
  const proposal = "44444444-4444-4444-8444-444444444444";
  expect(await run({ name: "memo.review", proposalId: proposal })).toEqual({ kind: "dropped" });
  m.proposals.add(proposal);
  expect(await run({ name: "memo.review", proposalId: proposal })).toEqual({ kind: "navigate", href: "/looking-for" });
});

describe("memo.resolve", () => {
  const proposal = "55555555-5555-4555-8555-555555555555";

  test("approve resolves the user's current pending proposal through the memo store, as the user, with no confirm", async () => {
    m.proposals.add(proposal);
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "approve" })).toEqual({ kind: "done", toast: MEMO_TOASTS.approved });
    expect(m.resolveMemoProposal).toHaveBeenCalledTimes(1);
    expect(m.resolveMemoProposal).toHaveBeenCalledWith(USER, proposal, "approve");
    expect(m.revalidatePath).toHaveBeenCalledWith("/looking-for");
  });

  test("decline resolves it the same way", async () => {
    m.proposals.add(proposal);
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "decline" })).toEqual({ kind: "done", toast: MEMO_TOASTS.declined });
    expect(m.resolveMemoProposal).toHaveBeenCalledWith(USER, proposal, "decline");
    expect(m.revalidatePath).toHaveBeenCalledWith("/looking-for");
  });

  test("an outdated, unknown or already-resolved proposal gets the fixed toast and writes nothing", async () => {
    // Made against an older memo version.
    m.proposals.add(proposal);
    m.outdated.add(proposal);
    for (const decision of ["approve", "decline"] as const) {
      expect(await run({ name: "memo.resolve", proposalId: proposal, decision })).toEqual({ kind: "done", toast: MEMO_TOASTS.closed });
    }
    // Unknown, or no longer pending.
    const other = "66666666-6666-4666-8666-666666666666";
    expect(await run({ name: "memo.resolve", proposalId: other, decision: "approve" })).toEqual({ kind: "done", toast: MEMO_TOASTS.closed });
    expect(m.resolveMemoProposal).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  test("a resolve that loses a race in the store gets the fixed toast; a store refusal gets its own", async () => {
    m.proposals.add(proposal);
    m.resolveMemoProposal.mockResolvedValueOnce(null);
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "approve" })).toEqual({ kind: "done", toast: MEMO_TOASTS.closed });
    m.resolveMemoProposal.mockRejectedValueOnce(new MemoInputError("too long", "memo_too_long", 10));
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "approve" })).toEqual({ kind: "done", toast: MEMO_TOASTS.refused });
    expect(m.revalidatePath).not.toHaveBeenCalled();
    m.resolveMemoProposal.mockRejectedValueOnce(new Error("db down"));
    await expect(run({ name: "memo.resolve", proposalId: proposal, decision: "approve" })).rejects.toThrow("db down");
  });

  test("the intent is strict: a bad uuid, an unknown decision or an extra key is dropped", async () => {
    m.proposals.add(proposal);
    expect(await run({ name: "memo.resolve", proposalId: "not-a-uuid", decision: "approve" })).toEqual({ kind: "dropped" });
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "edit" })).toEqual({ kind: "dropped" });
    expect(await run({ name: "memo.resolve", proposalId: proposal })).toEqual({ kind: "dropped" });
    expect(await run({ name: "memo.resolve", proposalId: proposal, decision: "approve", doc: {} })).toEqual({ kind: "dropped" });
    expect(m.resolveMemoProposal).not.toHaveBeenCalled();
  });
});

test("a frame intent is dropped until the host chip press exists", async () => {
  expect(
    await executeIntent(USER, { threadId: THREAD, surfaceId: SURFACE, raw: { name: "open", target: "shortlist" }, source: "frame" }),
  ).toEqual({ kind: "dropped" });
});

test("every intent name has exactly one handler", () => {
  // The closed enum, listed out: a new intent must be added here on purpose.
  expect([...INTENT_NAMES].sort()).toEqual(
    [
      "analytics.pin", "answer", "application.prepare", "application.set_stage", "compare", "memo.resolve", "memo.review",
      "open", "shortlist.set",
    ].sort(),
  );
  expect(Object.keys(INTENT_HANDLERS).sort()).toEqual([...INTENT_NAMES].sort());
  expect(new Set(INTENT_NAMES).size).toBe(INTENT_NAMES.length);
});

test("without the approval secret no approval tool is offered and confirm intents write nothing", async () => {
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "");
  expect(await run({ name: "application.prepare", jobId: JOB })).toEqual({ kind: "done", toast: CONFIRMATIONS_UNAVAILABLE });
  expect(await confirmIntent(USER, null, "anything.at-all")).toEqual({ kind: "done", toast: CONFIRMATIONS_UNAVAILABLE });
  expect(writers()).toEqual([]);
  expect(m.queries).toEqual([]);
  // Logged once per process, with no value or length.
  const logged = warn.mock.calls.filter((c) => String(c[0]).includes("AGENT_TOOL_APPROVAL_SECRET"));
  expect(logged).toHaveLength(1);
  expect(JSON.stringify(logged)).not.toMatch(/\d/);
});

test("a secret under 32 characters counts as missing", async () => {
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "a".repeat(31));
  expect(await run({ name: "application.prepare", jobId: JOB })).toEqual({ kind: "done", toast: CONFIRMATIONS_UNAVAILABLE });
});

test("confirmIntent runs a token only for its own user and a surface still in its thread", async () => {
  const out = await run({ name: "application.prepare", jobId: JOB });
  if (out.kind !== "confirm") throw new Error("expected a confirm");
  m.startApplicationPrep.mockResolvedValue({ status: "started", generationId: "g1", generation: {} });
  expect(await confirmIntent(OTHER, null, out.token)).toEqual({ kind: "dropped" });
  expect(m.startApplicationPrep).not.toHaveBeenCalled();
  expect(await confirmIntent(USER, "pat@example.com", out.token)).toEqual({
    kind: "done", toast: "Preparing your application. It takes a minute or two.",
  });
  // The job comes from the signed token, the user and email from the session.
  expect(m.startApplicationPrep).toHaveBeenCalledWith(USER, "pat@example.com", JOB);
  m.startApplicationPrep.mockResolvedValue({ status: "allowance_exhausted", kind: "cover", gate: {} });
  expect(await confirmIntent(USER, null, out.token)).toEqual({ kind: "done", toast: "You've used this month's allowance for that." });
  m.getSurface.mockResolvedValue(null);
  expect(await confirmIntent(USER, null, out.token)).toEqual({ kind: "dropped" });
  expect(m.startApplicationPrep).toHaveBeenCalledTimes(2);
});

test("a confirm token starts at most one prep: a replay after its prep was created is refused and charges nothing", async () => {
  // The fake startApplicationPrep records the prepare generation_jobs row a real start creates.
  m.startApplicationPrep.mockImplementation(async (userId: string, _email: string | null, jobId: string) => {
    m.preps.push({ userId, jobId, createdAt: Date.now() });
    return { status: "started", generationId: "g1", generation: {} };
  });
  // A prep of this job created before the token was issued does not block it.
  m.preps.push({ userId: USER, jobId: JOB, createdAt: Date.now() - 60_000 });
  const out = await run({ name: "application.prepare", jobId: JOB });
  if (out.kind !== "confirm") throw new Error("expected a confirm");
  expect(await confirmIntent(USER, null, out.token)).toEqual({
    kind: "done", toast: "Preparing your application. It takes a minute or two.",
  });
  // The same token again (a double press, a retried request, or after the prep settled).
  expect(await confirmIntent(USER, null, out.token)).toEqual({ kind: "done", toast: CONFIRM_ALREADY_USED });
  expect(m.startApplicationPrep).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith("agent: intent dropped", { reason: "confirm_token_used", surfaceId: SURFACE });
  // The check is scoped to the token's user and job.
  const replayQuery = m.queries.filter((q) => q.text.includes("FROM generation_jobs")).at(-1);
  expect(replayQuery?.values.slice(0, 2)).toEqual([USER, JOB]);
  // A fresh token (a new confirm card, issued after that prep) can prepare again.
  await new Promise((r) => setTimeout(r, 2));
  const again = await run({ name: "application.prepare", jobId: JOB });
  if (again.kind !== "confirm") throw new Error("expected a confirm");
  expect(await confirmIntent(USER, null, again.token)).toMatchObject({ toast: "Preparing your application. It takes a minute or two." });
  expect(m.startApplicationPrep).toHaveBeenCalledTimes(2);
});
