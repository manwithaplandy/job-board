import { expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), withUserMutation: vi.fn() }));

import { AGENT_SKIP_REASONS, USER_SKIP_REASONS } from "@/lib/workspaces/shortlist";
import { AGENT_SKIP_REASON_LABELS, USER_SKIP_REASON_ORDER, skipReasonLabel } from "@/lib/workspaces/labels";

test("the skip picker offers exactly the user reasons, in the library's order", () => {
  expect(USER_SKIP_REASON_ORDER).toEqual([...USER_SKIP_REASONS]);
});

test("every agent reason has a label and an unknown code reads as Other", () => {
  expect(Object.keys(AGENT_SKIP_REASON_LABELS).sort()).toEqual([...AGENT_SKIP_REASONS].sort());
  expect(skipReasonLabel("red_flag")).toBe("Red flag");
  expect(skipReasonLabel("nonsense")).toBe("Other");
  expect(skipReasonLabel(null)).toBeNull();
});
