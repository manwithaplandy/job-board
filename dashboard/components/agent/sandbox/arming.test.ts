import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CHIP_ARM_MS,
  isArmed,
  isUnexplainedScroll,
  nextFrameHeight,
  noteFrameMoved,
  noteScroll,
  noteScrollInput,
  pageMovedAtNow,
  pressCounts,
  regionMoved,
  resetPageClocks,
  SCROLL_INPUT_WINDOW_MS,
  watchPageScroll,
  watchRegionHeight,
} from "./arming";

beforeEach(() => resetPageClocks());
afterEach(() => {
  resetPageClocks();
  vi.restoreAllMocks();
});

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

describe("pressCounts (fix wave follow-up)", () => {
  const NEVER = Number.NEGATIVE_INFINITY;
  const base = { now: 10_000, shownAt: 1_000, ownMovedAt: NEVER, pageMovedAt: NEVER, keyboard: false };

  test("a pointer press waits CHIP_ARM_MS after the latest of shownAt, its own move and the page clock", () => {
    expect(pressCounts(base)).toBe(true);
    // Another view moved the region (a), or an unexplained scroll did (b): the page clock.
    expect(pressCounts({ ...base, pageMovedAt: 10_000 - CHIP_ARM_MS + 1 })).toBe(false);
    expect(pressCounts({ ...base, pageMovedAt: 10_000 - CHIP_ARM_MS })).toBe(true);
    // Its own frame moved it.
    expect(pressCounts({ ...base, ownMovedAt: 9_900 })).toBe(false);
    // Both: the later one decides.
    expect(pressCounts({ ...base, ownMovedAt: 9_000, pageMovedAt: 9_500 })).toBe(false);
    expect(pressCounts({ ...base, now: 9_500 + CHIP_ARM_MS, ownMovedAt: 9_000, pageMovedAt: 9_500 })).toBe(true);
  });

  test("a keyboard activation skips both move clocks but never shownAt", () => {
    expect(pressCounts({ ...base, keyboard: true, ownMovedAt: 9_999, pageMovedAt: 9_999 })).toBe(true);
    expect(pressCounts({ ...base, keyboard: true, shownAt: 10_000 - CHIP_ARM_MS + 1 })).toBe(false);
    expect(pressCounts({ ...base, keyboard: true, shownAt: 10_000 - CHIP_ARM_MS })).toBe(true);
  });
});

describe("the page clock (fix wave follow-up)", () => {
  test("starts at never and only moves forward", () => {
    expect(pageMovedAtNow()).toBe(Number.NEGATIVE_INFINITY);
    noteFrameMoved(5_000);
    noteFrameMoved(4_000);
    expect(pageMovedAtNow()).toBe(5_000);
    noteFrameMoved(6_000);
    expect(pageMovedAtNow()).toBe(6_000);
  });

  test("a scroll with no scroll input in the window before it moves the page clock (fails closed)", () => {
    expect(isUnexplainedScroll(1_000, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(isUnexplainedScroll(1_000, 1_000 - SCROLL_INPUT_WINDOW_MS)).toBe(false);
    expect(isUnexplainedScroll(1_000, 1_000 - SCROLL_INPUT_WINDOW_MS - 1)).toBe(true);
    noteScroll(2_000);
    expect(pageMovedAtNow()).toBe(2_000);
  });

  test("a scroll just after a wheel, touch, key or pointer press is the user's own and moves nothing", () => {
    noteScrollInput(3_000);
    noteScroll(3_000 + SCROLL_INPUT_WINDOW_MS);
    expect(pageMovedAtNow()).toBe(Number.NEGATIVE_INFINITY);
    // The same input no longer explains a later scroll.
    noteScroll(3_000 + SCROLL_INPUT_WINDOW_MS + 1);
    expect(pageMovedAtNow()).toBe(3_000 + SCROLL_INPUT_WINDOW_MS + 1);
  });
});

describe("watchPageScroll (fix wave follow-up)", () => {
  test("a scroll on the watched target moves the page clock; an untrusted input does not explain it", () => {
    const win = new EventTarget();
    const stop = watchPageScroll(win);
    const now = vi.spyOn(Date, "now").mockReturnValue(7_000);
    // A script-made wheel (isTrusted false) is not a user input.
    win.dispatchEvent(new Event("wheel"));
    now.mockReturnValue(7_010);
    win.dispatchEvent(new Event("scroll"));
    expect(pageMovedAtNow()).toBe(7_010);
    stop();
  });

  test("listens once however many frames watch, and stops when the last one stops", () => {
    const win = new EventTarget();
    const add = vi.spyOn(win, "addEventListener");
    const remove = vi.spyOn(win, "removeEventListener");
    const stopA = watchPageScroll(win);
    const stopB = watchPageScroll(win);
    const added = add.mock.calls.length;
    expect(added).toBeGreaterThan(0);
    expect(add.mock.calls.filter((c) => c[0] === "scroll")).toHaveLength(1);
    stopA();
    stopA();
    expect(remove).not.toHaveBeenCalled();
    stopB();
    expect(remove.mock.calls).toHaveLength(added);
    vi.spyOn(Date, "now").mockReturnValue(9_000);
    win.dispatchEvent(new Event("scroll"));
    expect(pageMovedAtNow()).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("regionMoved (fix wave follow-up 2)", () => {
  test("the first observation moves the page only when the region has height", () => {
    expect(regionMoved(null, 0)).toBe(false);
    expect(regionMoved(null, 96)).toBe(true);
  });

  test("after that, any change of height moves the page and a repeat does not", () => {
    expect(regionMoved(0, 96)).toBe(true); // an ask or chip appears
    expect(regionMoved(240, 96)).toBe(true); // a tall ask swapped for a shorter action
    expect(regionMoved(96, 0)).toBe(true); // dismissed
    expect(regionMoved(96, 96)).toBe(false);
    expect(regionMoved(0, 0)).toBe(false);
  });
});

describe("watchRegionHeight (fix wave follow-up 2)", () => {
  type Cb = (entries: Array<{ borderBoxSize?: Array<{ blockSize: number }>; contentRect: { height: number } }>) => void;
  let observers: Array<{ cb: Cb; observed: unknown[]; disconnected: boolean }>;

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        rec: { cb: Cb; observed: unknown[]; disconnected: boolean };
        constructor(cb: Cb) {
          this.rec = { cb, observed: [], disconnected: false };
          observers.push(this.rec);
        }
        observe(el: unknown) {
          this.rec.observed.push(el);
        }
        unobserve() {}
        disconnect() {
          this.rec.disconnected = true;
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const fire = (height: number) => observers[0].cb([{ borderBoxSize: [{ blockSize: height }], contentRect: { height } }]);

  test("moves the page clock when the region's height changes, not when an empty region appears", () => {
    const now = vi.spyOn(Date, "now");
    const el = {} as Element;
    const stop = watchRegionHeight(el);
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([el]);

    now.mockReturnValue(1_000);
    fire(0);
    expect(pageMovedAtNow()).toBe(Number.NEGATIVE_INFINITY);

    now.mockReturnValue(2_000);
    fire(240); // a tall pending ask appears
    expect(pageMovedAtNow()).toBe(2_000);

    now.mockReturnValue(3_000);
    fire(240); // same height: nothing moved
    expect(pageMovedAtNow()).toBe(2_000);

    now.mockReturnValue(4_000);
    fire(96); // swapped for an action: everything below slides up
    expect(pageMovedAtNow()).toBe(4_000);
    // A long-armed chip of another view, pressed just after, is ignored.
    expect(pressCounts({ now: 4_000 + CHIP_ARM_MS - 1, shownAt: 0, ownMovedAt: Number.NEGATIVE_INFINITY, pageMovedAt: pageMovedAtNow(), keyboard: false })).toBe(false);
    expect(pressCounts({ now: 4_000 + CHIP_ARM_MS, shownAt: 0, ownMovedAt: Number.NEGATIVE_INFINITY, pageMovedAt: pageMovedAtNow(), keyboard: false })).toBe(true);

    now.mockReturnValue(5_000);
    stop();
    expect(observers[0].disconnected).toBe(true);
    // The region still had height as it left, so it moves the page too.
    expect(pageMovedAtNow()).toBe(5_000);
  });

  test("falls back to contentRect, and stopping an empty region moves nothing", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const stop = watchRegionHeight({} as Element);
    observers[0].cb([{ contentRect: { height: 0 } }]);
    now.mockReturnValue(2_000);
    observers[0].cb([{ contentRect: { height: 50 } }]);
    expect(pageMovedAtNow()).toBe(2_000);
    now.mockReturnValue(3_000);
    observers[0].cb([{ contentRect: { height: 0 } }]);
    expect(pageMovedAtNow()).toBe(3_000);
    now.mockReturnValue(4_000);
    stop();
    stop();
    expect(pageMovedAtNow()).toBe(3_000);
  });

  test("does nothing without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const stop = watchRegionHeight({} as Element);
    expect(() => stop()).not.toThrow();
    expect(pageMovedAtNow()).toBe(Number.NEGATIVE_INFINITY);
  });
});
