"use client";

import type { Variant } from "@/lib/agent/config";
import { Button } from "@/components/ui/Button";
import { SURFACE_FAILED_TEXT } from "./SurfaceHost";

// What stands at a present part when its view is not there to draw (spec 08 S4.1, S7.3,
// S11): the sized placeholder while the view is built or loaded, the one line where an
// updated view used to be, and the line with Try again when the row could not be loaded.

export const VIEW_BUILDING_TEXT = "Building a view…";
export const VIEW_UPDATED_TEXT = "This view was updated below.";
export const VIEW_UPDATED_GO = "Go to it";
export const VIEW_RETRY = "Try again";

/** The view frame's border and a quiet shimmer, sized for the variant: taller for code. */
export function ViewPlaceholder({ variant }: { variant: Variant }) {
  return (
    <div className={variant === 3 ? "rf-view-placeholder rf-view-placeholder--code" : "rf-view-placeholder"} role="status">
      <span className="rf-view-placeholder__text">{VIEW_BUILDING_TEXT}</span>
    </div>
  );
}

/** At an older row of a chain: the view moved to its latest row. "Go to it" only when that frame is on the page. */
export function ViewUpdatedStub({ onGo }: { onGo?: () => void }) {
  return (
    <p className="rf-view-stub">
      <span>{VIEW_UPDATED_TEXT}</span>
      {onGo && (
        <Button variant="ghost" size="sm" onClick={onGo}>
          {VIEW_UPDATED_GO}
        </Button>
      )}
    </p>
  );
}

/** The stored row could not be read: the fixed line and a button that reads it again. */
export function ViewLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rf-view-failed">
      <p className="rf-view-failed__text">{SURFACE_FAILED_TEXT}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {VIEW_RETRY}
      </Button>
    </div>
  );
}
