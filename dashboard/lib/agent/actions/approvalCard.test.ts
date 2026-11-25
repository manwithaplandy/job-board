// The confirm card for a pending tool approval (plan Task 1.20): the kind mapping, the
// stored part as the only source of the input, and failing closed without the secret.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ secret: null as string | null, messages: [] as unknown[], describe: vi.fn() }));
vi.mock("@/lib/agent/approvalSecret", () => ({ approvalSecret: () => m.secret }));
vi.mock("@/lib/agent/threads", () => ({ loadMessages: vi.fn(async () => m.messages) }));
vi.mock("@/lib/agent/actions/confirm", () => ({ describeConfirmation: m.describe }));

import { APPROVAL_CONFIRM_KIND, describePendingApproval } from "@/lib/agent/actions/approvalCard";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "22222222-2222-4222-8222-222222222222";
const DESCRIPTOR = { kind: "application.prepare", title: "Prepare an application?", lines: [], confirmLabel: "Prepare", danger: false };

const pending = (tool: string, id: string, input: unknown) => ({
  id: "m2",
  role: "assistant",
  parts: [{ type: `tool-${tool}`, toolCallId: "c1", state: "approval-requested", input, approval: { id } }],
});

beforeEach(() => {
  m.secret = "s".repeat(32);
  m.messages = [];
  m.describe.mockReset().mockResolvedValue(DESCRIPTOR);
});

test("start_application_prep shows the application.prepare card", () => {
  expect(APPROVAL_CONFIRM_KIND.start_application_prep).toBe("application.prepare");
});

test("the card is described from the stored part's input", async () => {
  const input = { jobId: "greenhouse:acme:101" };
  m.messages = [{ id: "m1", role: "user", parts: [] }, pending("start_application_prep", "ap1", input)];
  expect(await describePendingApproval(USER, THREAD, "ap1", "a@example.com")).toEqual({ status: "ready", descriptor: DESCRIPTOR });
  expect(m.describe).toHaveBeenCalledWith(USER, "application.prepare", input, "a@example.com");
});

test("an approval id the stored message does not hold is pending, and a target that is gone is invalid", async () => {
  m.messages = [pending("start_application_prep", "ap1", {})];
  expect(await describePendingApproval(USER, THREAD, "other", null)).toEqual({ status: "pending" });
  m.describe.mockResolvedValue(null);
  expect(await describePendingApproval(USER, THREAD, "ap1", null)).toEqual({ status: "invalid" });
});

test("a tool that is not an approval tool builds no card", async () => {
  m.messages = [pending("shortlist_set", "ap1", {})];
  expect(await describePendingApproval(USER, THREAD, "ap1", null)).toEqual({ status: "invalid" });
  expect(m.describe).not.toHaveBeenCalled();
});

test("without the approval secret no card is built", async () => {
  m.secret = null;
  m.messages = [pending("start_application_prep", "ap1", {})];
  expect(await describePendingApproval(USER, THREAD, "ap1", null)).toEqual({ status: "unavailable" });
  expect(m.describe).not.toHaveBeenCalled();
});
