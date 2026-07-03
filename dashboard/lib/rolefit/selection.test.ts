import { describe, expect, test } from "vitest";
import { indexOfId, stepSelection, selectionAfterRemoval } from "@/lib/rolefit/selection";

describe("indexOfId", () => {
  test("returns index or -1", () => {
    expect(indexOfId(["a", "b", "c"], "b")).toBe(1);
    expect(indexOfId(["a", "b"], "z")).toBe(-1);
    expect(indexOfId(["a"], null)).toBe(-1);
  });
});

describe("stepSelection", () => {
  const ids = ["a", "b", "c"];
  test("moves forward and backward", () => {
    expect(stepSelection(ids, "a", 1)).toBe("b");
    expect(stepSelection(ids, "b", -1)).toBe("a");
  });
  test("clamps at the ends", () => {
    expect(stepSelection(ids, "c", 1)).toBe("c");
    expect(stepSelection(ids, "a", -1)).toBe("a");
  });
  test("null current seeds first (fwd) or last (back)", () => {
    expect(stepSelection(ids, null, 1)).toBe("a");
    expect(stepSelection(ids, null, -1)).toBe("c");
  });
  test("absent current is treated like null", () => {
    expect(stepSelection(ids, "gone", 1)).toBe("a");
  });
  test("empty list yields null", () => {
    expect(stepSelection([], null, 1)).toBeNull();
  });
});

describe("selectionAfterRemoval", () => {
  test("selects the item that took the slot", () => {
    expect(selectionAfterRemoval(["a", "b", "c"], "b")).toBe("c");
  });
  test("removing the last selects the new last", () => {
    expect(selectionAfterRemoval(["a", "b", "c"], "c")).toBe("b");
  });
  test("removing the only item yields null", () => {
    expect(selectionAfterRemoval(["a"], "a")).toBeNull();
  });
  test("removing an absent id yields null", () => {
    expect(selectionAfterRemoval(["a", "b"], "z")).toBeNull();
  });
});
