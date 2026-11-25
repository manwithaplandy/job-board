// The ask_user tool (plan Task 1.17): no execute (the turn ends at the call) and a
// strict question schema shared with the IntakeQuestions block.
import { describe, expect, test } from "vitest";
import { emptyGathered } from "@/lib/agent/gathered";
import { askUserInput, askUserTool } from "@/lib/agent/tools/askUser";
import { assertNoUserIdInput } from "@/lib/agent/tools/assertNoUserIdInput";

const ctx = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "me@example.test", threadId: null, runId: "r", variant: 1 as const,
  unattended: false, gathered: emptyGathered(), repairsLeft: { n: 1 },
};

describe("ask_user", () => {
  test("has no execute, so the turn stops at the call", () => {
    expect(askUserTool(ctx).execute).toBeUndefined();
  });

  test("takes 1 to 6 strict questions and nothing else", async () => {
    const ok = { questions: [{ id: "floor", label: "What is your pay floor?", kind: "text" }] };
    expect(askUserInput.safeParse(ok).success).toBe(true);
    expect(askUserInput.safeParse({ ...ok, userId: "x" }).success).toBe(false);
    expect(askUserInput.safeParse({ questions: [{ ...ok.questions[0], placeholder: "x" }] }).success).toBe(false);
    expect(askUserInput.safeParse({ questions: [] }).success).toBe(false);
    expect(askUserInput.safeParse({ questions: [{ id: "bad id!", label: "Q?", kind: "text" }] }).success).toBe(false);
    await expect(assertNoUserIdInput({ ask_user: askUserTool(ctx) })).resolves.toBeUndefined();
  });
});
