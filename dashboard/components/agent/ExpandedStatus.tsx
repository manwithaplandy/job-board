"use client";

// The turn status line of an expanded view (spec 08 S6.2): the first line of the dock, and
// only while a view is expanded, so someone working in the full-screen view knows what the
// turn they sent is doing and can reach its result. A running turn shows the steps row's
// working label and timer; a finished one says what it produced:
// - "reply": an answer with no new view: "Reply ready." and "Back to conversation";
// - "new-view": a view other than the expanded one: "New view ready." and "Show it";
// - "none": nothing to say (no turn ended while expanded, or the turn updated the
//   expanded view itself, which swaps in place);
// - "error": the turn's error sentence and Retry, when the turn can be resent.
import { Button } from "@/components/ui/Button";
import { formatElapsed } from "@/lib/agent/steps";
import type { HostChain } from "@/lib/agent/surfaces/host";

export const REPLY_READY = "Reply ready.";
export const BACK_TO_CONVERSATION = "Back to conversation";
export const NEW_VIEW_READY = "New view ready.";
export const SHOW_IT = "Show it";

export type ExpandedOutcome = "none" | "reply" | "new-view" | "error";

export function ExpandedStatus({
  expanded,
  working,
  outcome,
  errorText,
  onBack,
  onShow,
  onRetry,
}: {
  expanded: boolean;
  /** The running turn's working label and time since it was sent; null when no turn runs. */
  working: { label: string; elapsedMs: number } | null;
  outcome: ExpandedOutcome;
  /** The TurnError sentence, for "error". */
  errorText?: string;
  onBack: () => void;
  onShow: () => void;
  /** Null when the failed turn cannot be resent (a refusal took the message back). */
  onRetry: (() => void) | null;
}) {
  if (!expanded) return null;
  if (working) {
    return (
      <div className="rf-expanded-status" role="status">
        <span className="rf-steps__spinner" aria-hidden="true" />
        <span className="rf-expanded-status__text">{working.label}</span>
        {/* The Send button's status announces the wait; the ticking time is for the eye only. */}
        <span className="rf-expanded-status__timer" aria-hidden="true">
          {formatElapsed(working.elapsedMs)}
        </span>
      </div>
    );
  }
  if (outcome === "none") return null;
  const [text, action, onAction] =
    outcome === "reply"
      ? [REPLY_READY, BACK_TO_CONVERSATION, onBack]
      : outcome === "new-view"
        ? [NEW_VIEW_READY, SHOW_IT, onShow]
        : [errorText ?? "", onRetry ? "Retry" : null, onRetry];
  return (
    <div className={`rf-expanded-status rf-expanded-status--${outcome}`} role="status">
      <span className="rf-expanded-status__text">{text}</span>
      {action && onAction && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

/**
 * What a turn that ended while a view was expanded produced, from the surfaces its present
 * calls stored (`surfaceIds`): a chain other than the expanded one is a new view (the last
 * one wins); only the expanded chain is an update, which needs no line; no surface is a
 * reply. A surface whose row is still loading says nothing yet, so the line does not read
 * "Reply ready." for a moment before "New view ready."; one that failed to load counts as
 * no view.
 */
export function turnOutcome({
  surfaceIds,
  chains,
  failedLoads,
  expandedChainId,
}: {
  surfaceIds: readonly string[];
  chains: readonly HostChain[];
  failedLoads: ReadonlySet<string>;
  expandedChainId: string;
}): { outcome: Exclude<ExpandedOutcome, "error">; newChainId: string | null } {
  let newChainId: string | null = null;
  let loading = false;
  let updated = false;
  for (const id of surfaceIds) {
    const chain = chains.find((c) => c.memberIds.includes(id));
    if (!chain) loading ||= !failedLoads.has(id);
    else if (chain.chainId === expandedChainId) updated = true;
    else newChainId = chain.chainId;
  }
  if (newChainId !== null) return { outcome: "new-view", newChainId };
  return { outcome: loading || updated ? "none" : "reply", newChainId: null };
}
