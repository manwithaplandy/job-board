import { describe, expect, test } from "vitest";
import { CHIP_ARM_MS, isArmed, nextFrameHeight } from "./arming";

describe("isArmed (fix wave I1)", () => {
  test("a press counts only CHIP_ARM_MS after the request was shown", () => {
    expect(isArmed(1_000 + CHIP_ARM_MS - 1, 1_000, Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isArmed(1_000 + CHIP_ARM_MS, 1_000, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  test("a move after the request was shown re-arms it from the move", () => {
    const shownAt = 1_000;
    const movedAt = 5_000;
    // Long past the shown clock, but just after the move: ignored.
    expect(isArmed(movedAt + 10, shownAt, movedAt)).toBe(false);
    expect(isArmed(movedAt + CHIP_ARM_MS - 1, shownAt, movedAt)).toBe(false);
    expect(isArmed(movedAt + CHIP_ARM_MS, shownAt, movedAt)).toBe(true);
  });

  test("a move from before the request appeared changes nothing", () => {
    expect(isArmed(2_000 + CHIP_ARM_MS - 1, 2_000, 1_900)).toBe(false);
    expect(isArmed(2_000 + CHIP_ARM_MS, 2_000, 1_900)).toBe(true);
  });

  test("a request shown long ago (the gallery's initialRequest) is armed unless the region moved", () => {
    const longAgo = Number.NEGATIVE_INFINITY;
    expect(isArmed(0, longAgo, longAgo)).toBe(true);
    expect(isArmed(100, longAgo, 50)).toBe(false);
    expect(isArmed(50 + CHIP_ARM_MS, longAgo, 50)).toBe(true);
  });
});

describe("nextFrameHeight (fix wave I1)", () => {
  test("clamps to the cap and says whether the applied height changed", () => {
    expect(nextFrameHeight(320, 0, 1_200)).toEqual({ height: 320, changed: true });
    expect(nextFrameHeight(320, 320, 1_200)).toEqual({ height: 320, changed: false });
    expect(nextFrameHeight(5_000, 320, 1_200)).toEqual({ height: 1_200, changed: true });
    // A taller report past the cap leaves the applied height, so the region does not move.
    expect(nextFrameHeight(9_000, 1_200, 1_200)).toEqual({ height: 1_200, changed: false });
    expect(nextFrameHeight(40, null, 1_200)).toEqual({ height: 40, changed: true });
  });
});
