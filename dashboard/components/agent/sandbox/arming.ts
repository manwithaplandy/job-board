// When a press on a frame's pending request counts (fix wave I1, spec 08 S10.2).
//
// A press on the action chip or on an ask's Send is ignored for CHIP_ARM_MS after the request
// appeared or changed (fix round 1, I3), and also for CHIP_ARM_MS after the request region
// last moved. The region sits under the iframe, whose height follows the view's document, so
// a view can move Send or the chip under a pointer aimed at something else by changing its
// own height. The host records the time it applied a new frame height (movedAt); a press
// counts only once both clocks have run out.
//
// Fix wave follow-up: the region moves for reasons outside its own frame too, so there is one
// page-level move clock as well (module state, shared by every SandboxFrame on the page):
//   - (a) another view's resize: every frame's applied-height change updates the page clock,
//     so view A above cannot shrink itself and slide view B's Send or chip under the pointer;
//   - (b) a scroll of the host page that no user wheel, touch, key or pointer press came just
//     before (within SCROLL_INPUT_WINDOW_MS), such as a frame scrolling its ancestors from
//     inside with scrollIntoView or focus(). The host cannot see a wheel the user turns over
//     a frame, so such a scroll also re-arms: this fails closed (a press just after it is
//     dropped), which is the safe side.
// A keyboard activation (a click with event.detail 0) skips both move clocks but never the
// shownAt clock: a slide cannot aim a key press, and an honest view that keeps resizing would
// otherwise leave Send dead to keyboard users.
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

/** A host scroll this soon after a user wheel, touch, key or pointer press counts as the user's own. */
export const SCROLL_INPUT_WINDOW_MS = 300;

/** Whether a host scroll at `scrollAt` moved the page without the user: no scroll input in the window before it. */
export function isUnexplainedScroll(scrollAt: number, lastInputAt: number, windowMs: number = SCROLL_INPUT_WINDOW_MS): boolean {
  return scrollAt - lastInputAt > windowMs;
}

/**
 * Whether a press on a request counts. `ownMovedAt` is the view's own last applied-height
 * change, `pageMovedAt` the page clock (any view's resize, or an unexplained scroll), and
 * `keyboard` whether the press came from a key (a click with detail 0), which skips the
 * move clocks but not shownAt.
 */
export function pressCounts(a: { now: number; shownAt: number; ownMovedAt: number; pageMovedAt: number; keyboard: boolean }): boolean {
  const movedAt = a.keyboard ? Number.NEGATIVE_INFINITY : Math.max(a.ownMovedAt, a.pageMovedAt);
  return isArmed(a.now, a.shownAt, movedAt);
}

// The page-level move clock (module state: one per page, shared by every SandboxFrame).
let pageMovedAt = Number.NEGATIVE_INFINITY;
let lastScrollInputAt = Number.NEGATIVE_INFINITY;

/** The page clock: when any view's request region last moved for a reason outside its own frame. */
export function pageMovedAtNow(): number {
  return pageMovedAt;
}

/** Records that some frame on the page applied a new height at `now` (moves every region below it). */
export function noteFrameMoved(now: number): void {
  if (now > pageMovedAt) pageMovedAt = now;
}

/** Records a user wheel, touch, key or pointer press at `now`, which may scroll the page. */
export function noteScrollInput(now: number): void {
  if (now > lastScrollInputAt) lastScrollInputAt = now;
}

/** Records a host scroll at `now`; it moves the page clock unless a scroll input came just before. */
export function noteScroll(now: number): void {
  if (isUnexplainedScroll(now, lastScrollInputAt)) noteFrameMoved(now);
}

/** Tests only: forgets both page clocks. */
export function resetPageClocks(): void {
  pageMovedAt = Number.NEGATIVE_INFINITY;
  lastScrollInputAt = Number.NEGATIVE_INFINITY;
}

const SCROLL_INPUT_EVENTS = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown", "mousedown"] as const;
let watchers = 0;
let detachWatch: (() => void) | null = null;

/**
 * Starts watching the host page's scrolls and scroll inputs while at least one SandboxFrame is
 * mounted. Capture listeners on `win` see every element's scroll (scroll does not bubble but
 * is captured), so a scrolling transcript container counts as well as the window. Only a
 * trusted input explains a scroll; scroll events themselves are not filtered (the host's own
 * scrolls re-arm too, which is the safe side). Returns the
 * frame's stop function; the listeners go when the last frame stops.
 */
export function watchPageScroll(win: EventTarget): () => void {
  if (watchers === 0) {
    const onInput = (e: Event) => {
      if (e.isTrusted) noteScrollInput(Date.now());
    };
    const onScroll = () => noteScroll(Date.now());
    const opts = { capture: true, passive: true } as const;
    for (const type of SCROLL_INPUT_EVENTS) win.addEventListener(type, onInput, opts);
    win.addEventListener("scroll", onScroll, opts);
    detachWatch = () => {
      for (const type of SCROLL_INPUT_EVENTS) win.removeEventListener(type, onInput, opts);
      win.removeEventListener("scroll", onScroll, opts);
    };
  }
  watchers += 1;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    watchers -= 1;
    if (watchers === 0 && detachWatch !== null) {
      detachWatch();
      detachWatch = null;
    }
  };
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
