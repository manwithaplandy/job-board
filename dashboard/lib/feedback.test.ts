import { describe, expect, test, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ getUserId: vi.fn(), assertNotDeleted: vi.fn(), withUserSql: vi.fn(), tx: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getUserId: mocks.getUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));
vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));
import { parseFeedback } from "./feedback";
import { submitFeedback } from "@/app/feedback/actions";
beforeEach(() => { vi.resetAllMocks(); mocks.getUserId.mockResolvedValue("verified-user"); mocks.withUserSql.mockImplementation(async (_id, fn) => fn(mocks.tx)); });
describe("feedback", () => {
  test("accepts only bounded typed messages and supported categories", () => {
    expect(parseFeedback({ kind: "criticism", message: "  Improve filters  " })).toEqual({ kind: "criticism", message: "Improve filters" });
    for (const input of [null, [], {kind: "spam", message: "hello"}, {kind: "issue", message: 42}, {kind: "issue", message: "   "}, {kind: "issue", message: "x".repeat(4001)}, {kind: "issue", message: "x\0y"}]) expect(parseFeedback(input)).toBeNull();
  });
  test("requires authentication before writes", async () => {
    mocks.getUserId.mockResolvedValue(null);
    expect(await submitFeedback({kind: "issue", message: "broken"})).toEqual({ok: false, error: "Please sign in to send feedback."});
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });
  test("invalid data never reaches SQL", async () => {
    expect((await submitFeedback({kind: "issue", message: ""})).ok).toBe(false);
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });
  test("uses verified identity, ignoring forged ownership", async () => {
    expect(await submitFeedback({kind: "feature_request", message: "Please add filters", user_id: "attacker"})).toEqual({ok: true});
    expect(mocks.withUserSql).toHaveBeenCalledWith("verified-user", expect.any(Function));
    expect(mocks.assertNotDeleted).toHaveBeenCalledWith("verified-user");
    expect(mocks.tx.mock.calls[0].slice(1)).toEqual(["feature_request", "Please add filters"]);
  });
  test("deleted accounts cannot write", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("deleted"));
    expect((await submitFeedback({kind: "issue", message: "broken"})).ok).toBe(false);
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });
  test("returns actionable rate error without leaking database internals", async () => {
    mocks.tx.mockRejectedValue({code: "P0001", message: "private database details"});
    expect(await submitFeedback({kind: "issue", message: "broken"})).toEqual({ok: false, error: "You can send up to 5 messages per hour. Please try again later."});
  });
});
