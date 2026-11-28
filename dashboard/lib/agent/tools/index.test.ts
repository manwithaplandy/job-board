// The tool set a turn gets (PR 6, inline-UI spec S10.4): a turn that answers a message a
// generated view sent has no write tool. Only the names are checked; no tool runs.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), withUserMutation: vi.fn(), withUserPayloadMutation: vi.fn() }));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: vi.fn(async () => false) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { emptyGathered } from "@/lib/agent/gathered";
import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";

// A test-only key: long enough to count, never a real secret.
const TEST_KEY = "t".repeat(40); // low-entropy fixture, at least 32 characters

function ctx(extra: Partial<ToolCtx> = {}): ToolCtx {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "me@example.test",
    threadId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 },
    views: { used: 0 },
    fromView: false,
    ...extra,
  };
}

let warn: { mockRestore: () => void };
beforeEach(() => {
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", TEST_KEY);
  resetApprovalSecretWarning();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

const names = (c: ToolCtx) => Object.keys(buildTools(c)).sort();

// Today's attended tool set, pinned so a new tool has to be placed on one side or the other.
const READ = [
  "get_job",
  "get_memo",
  "get_profile_summary",
  "get_review",
  "list_applications",
  "list_documents",
  "list_shortlist",
  "query_metrics",
  "read_document",
  "search_jobs",
];
const APPROVAL = ["propose_profile_details", "refine_documents", "set_resume", "start_application_prep"];
const INTERACTIVE = ["ask_user", "present"];
// writeTools(ctx): the six undoable writes and propose_memo_change, which lives in the same
// group and so goes with it (spec S10.4 leaves out writeTools as a whole).
const WRITE = [
  "add_application_note",
  "propose_memo_change",
  "request_review",
  "set_analytics_tiles",
  "set_application_stage",
  "set_shortlist_state",
  "update_document_draft",
];

describe("buildTools and ToolCtx.fromView", () => {
  test("fromView false: the set is today's", () => {
    expect(names(ctx())).toEqual([...READ, ...APPROVAL, ...INTERACTIVE, ...WRITE].sort());
  });

  test("fromView true: no write tool, and the read, approval and interactive tools stay", () => {
    const got = names(ctx({ fromView: true }));
    for (const n of [
      "set_shortlist_state",
      "set_application_stage",
      "add_application_note",
      "set_analytics_tiles",
      "update_document_draft",
      "request_review",
    ]) {
      expect(got).not.toContain(n);
    }
    expect(got).not.toContain("propose_memo_change");
    expect(got).toEqual([...READ, ...APPROVAL, ...INTERACTIVE].sort());
  });

  test.each([1, 2, 3] as const)("variant %i: fromView removes exactly the write group", (variant) => {
    const all = names(ctx({ variant }));
    const fromView = names(ctx({ variant, fromView: true }));
    expect(all.filter((n) => !fromView.includes(n))).toEqual(WRITE);
  });
});
