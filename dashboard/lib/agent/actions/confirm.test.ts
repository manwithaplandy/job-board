// Confirm tokens and fixed confirm cards (plan Task 1.14). The database is a fake.
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  documents: {} as Record<string, string>,
  queries: [] as string[],
}));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      m.queries.push(text);
      if (text.includes("FROM documents")) {
        const name = m.documents[String(values[0])];
        return Promise.resolve(name ? [{ filename: name }] : []);
      }
      return Promise.resolve([]);
    })),
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: vi.fn(async () => null) }));
vi.mock("@/lib/usage", () => ({ monthlyGenerationSpend: vi.fn(async () => 0) }));
vi.mock("@/lib/tierConfig", () => ({ loadTierConfig: vi.fn() }));

import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { CONFIRM_TTL_MS, describeConfirmation, signConfirmToken, verifyConfirmToken } from "@/lib/agent/actions/confirm";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "11111111-1111-4111-8111-111111111111";
const SURFACE = "33333333-3333-4333-8333-333333333333";
const DOC = "55555555-5555-4555-8555-555555555555";
const TEST_KEY = "test-approval-key-0123456789abcdefghijklmnop";

beforeEach(() => {
  m.documents = { [DOC]: "cv-2026.pdf" };
  m.queries = [];
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", TEST_KEY);
  resetApprovalSecretWarning();
});
afterEach(() => vi.unstubAllEnvs());

const prepare = (jobId: string) => ({ intent: { name: "application.prepare" as const, jobId }, threadId: THREAD, surfaceId: SURFACE });

test("a confirm token expires after 10 minutes and cannot be replayed for another job", () => {
  const t0 = 1_800_000_000_000;
  const token = signConfirmToken(USER, prepare("greenhouse:acme:1"), t0);
  if (!token) throw new Error("expected a token");
  expect(verifyConfirmToken(USER, token, t0 + CONFIRM_TTL_MS - 1)).toEqual(prepare("greenhouse:acme:1"));
  expect(verifyConfirmToken(USER, token, t0 + CONFIRM_TTL_MS)).toBeNull();
  // Swapping the job inside the payload breaks the signature.
  const [body, sig] = token.split(".");
  const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  json.intent.jobId = "greenhouse:acme:2";
  const forged = `${Buffer.from(JSON.stringify(json), "utf8").toString("base64url")}.${sig}`;
  expect(verifyConfirmToken(USER, forged, t0)).toBeNull();
  // Another user cannot use it, and garbage is refused.
  expect(verifyConfirmToken(OTHER, token, t0)).toBeNull();
  expect(verifyConfirmToken(USER, "nope", t0)).toBeNull();
  expect(verifyConfirmToken(USER, `${body}.${sig}.x`, t0)).toBeNull();
});

test("a token signed under another key does not verify, and no token is signed without the key", () => {
  const token = signConfirmToken(USER, prepare("greenhouse:acme:1"));
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", `${TEST_KEY}-rotated`);
  expect(verifyConfirmToken(USER, token)).toBeNull();
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "short");
  expect(signConfirmToken(USER, prepare("greenhouse:acme:1"))).toBeNull();
});

test("only confirm intents are carried by a token", () => {
  const token = signConfirmToken(USER, {
    intent: { name: "open", target: "shortlist" },
    threadId: THREAD,
    surfaceId: SURFACE,
  });
  expect(verifyConfirmToken(USER, token)).toBeNull();
});

test("set_resume and propose_profile_details cards hold only database values and fixed labels", async () => {
  expect(await describeConfirmation(USER, "set_resume", { documentId: DOC, title: "ignored" })).toEqual({
    title: "Use this file as your résumé?",
    lines: ["File: cv-2026.pdf", "Your current résumé is kept as an earlier version you can restore."],
    confirmLabel: "Use as résumé",
    danger: false,
  });
  expect(await describeConfirmation(USER, "set_resume", { documentId: "66666666-6666-4666-8666-666666666666" })).toBeNull();
  const card = await describeConfirmation(USER, "propose_profile_details", {
    fields: { phone: "+1 555 0100", work_authorized: true },
    screeningAnswers: { notice_period: "Two weeks" },
  });
  expect(card?.lines).toEqual([
    "Fields: Phone, Work authorization.",
    "Screening answers: 1.",
    "These replace what your application details hold now.",
  ]);
  expect(JSON.stringify(card)).not.toMatch(/555|Two weeks/);
  expect(await describeConfirmation(USER, "propose_profile_details", { fields: { eeo_gender: "x" } })).toBeNull();
});

test("a card for an unknown job is refused before any allowance read", async () => {
  expect(await describeConfirmation(USER, "refine_documents", { jobId: "greenhouse:acme:1", target: "cover" })).toBeNull();
  expect(m.queries).toHaveLength(1);
});
