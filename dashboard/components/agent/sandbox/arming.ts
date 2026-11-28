// When a press on a frame's pending request counts (fix wave I1, spec 08 S10.2).
//
// A press on the action chip or on an ask's Send is ignored for CHIP_ARM_MS after the request
// appeared or changed (fix round 1, I3), and also for CHIP_ARM_MS after the request region
// last moved. The region sits under the iframe, whose height follows the view's document, so
// a view can move Send or the chip under a pointer aimed at something else by changing its
// own height. The host records the time it applied a new frame height (movedAt); a press
// counts only once both clocks have run out.
//
// Kept apart from SandboxFrame.tsx, which imports the server actions, so it can be unit
// tested on its own.

/** A chip or Send ignores presses for this long after it appears, changes or moves. */
export const CHIP_ARM_MS = 700;

/**
 * Whether a press at `now` counts: CHIP_ARM_MS must have passed since the request was shown
 * (`shownAt`) and since the request region last moved (`movedAt`). Either may be
 * Number.NEGATIVE_INFINITY for "long ago".
 */
export function isArmed(now: number, shownAt: number, movedAt: number, armMs: number = CHIP_ARM_MS): boolean {
  return now - Math.max(shownAt, movedAt) >= armMs;
}

/**
 * The frame height the host applies for a reported document height, and whether it moves the
 * request region: `changed` is true only when the applied height differs from the one already
 * applied (`applied`, null before the first resize), so a repeated report moves nothing.
 */
export function nextFrameHeight(reported: number, applied: number | null, maxHeightPx: number): { height: number; changed: boolean } {
  const height = Math.min(reported, maxHeightPx);
  return { height, changed: applied !== height };
}
