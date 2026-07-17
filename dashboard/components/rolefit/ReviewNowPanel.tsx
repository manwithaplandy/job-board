"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobRow } from "@/lib/types";
import { tierGateNotice, type TierGateNotice } from "@/lib/rolefit/tierGate";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// First-run "your board is being built" affordance (spec F core / T6). Two shapes:
//   • FULL card — shown on an empty board (firstRun) with the Review-now CTA.
//   • COMPACT strip — shown WHILE a request is pending/running, regardless of how many
//     jobs are already visible, with live progress ("N roles scored so far").
// It disappears only when the request SETTLES; on 'done' it calls onSettled (the board
// passes router.refresh) so the freshly-scored roles appear instead of the old
// "reload on next visit" dead end. Deliberately NOT a warning banner — a benign pending
// state is a neutral status card (memory: no-banner-for-benign-states).

type Status = "pending" | "running" | "done" | "failed" | null;

const cardStyle: React.CSSProperties = {
  margin: "12px 16px 0",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "14px",
};

const dot = (color: string): React.CSSProperties => ({
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

export interface ReviewNowPanelProps {
  // The board has zero jobs but unreviewed roles are waiting — show the full
  // "being built" CTA when no request is active.
  firstRun?: boolean;
  // Called once when an active request settles as 'done' — the board refreshes so the
  // new matches render (replacing the old reload-on-next-visit behavior).
  onSettled?: () => void;
  // Live population: called with each poll's newly approved matches (never empty) so
  // the board can merge them in while the run is still going. Pass a STABLE callback —
  // it participates in the poll closure's deps.
  onNewMatches?: (rows: JobRow[]) => void;
}

export function ReviewNowPanel({ firstRun = false, onSettled, onNewMatches }: ReviewNowPanelProps) {
  const [status, setStatus] = useState<Status>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reviewedToday, setReviewedToday] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tier-gate rejection (402 no plan / 409 daily budget spent): rendered as an
  // invitation with a /billing link, not through the red `error` line.
  const [gate, setGate] = useState<TierGateNotice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server-issued reviewed_at cursor (GET's `cursor` field), echoed back as ?since= on
  // the next poll. Server clock only — the client never contributes a timestamp.
  const cursorRef = useRef<string | null>(null);
  // Tracks whether we've observed an active request, so we only fire onSettled on a real
  // active→done transition (not a stale 'done' seen on the very first poll).
  const wasActiveRef = useRef(false);
  const settledRef = useRef(false);

  const active = status === "pending" || status === "running";

  const poll = useCallback(async () => {
    try {
      const url = cursorRef.current
        ? `/api/review/request?since=${encodeURIComponent(cursorRef.current)}`
        : "/api/review/request";
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        status?: Status; remaining?: number; reviewedToday?: number;
        cursor?: string; newMatches?: JobRow[];
      };
      setStatus(data.status ?? null);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (typeof data.reviewedToday === "number") setReviewedToday(data.reviewedToday);
      if (typeof data.cursor === "string") cursorRef.current = data.cursor;
      if (data.newMatches && data.newMatches.length > 0) onNewMatches?.(data.newMatches);
    } catch {
      /* transient — the next poll or a manual retry recovers; the cursor is unchanged,
         so the 10s overlap + settle-refresh make the skipped tick harmless */
    }
  }, [onNewMatches]);

  // Initial status load. Wrapped in an inline async IIFE so the awaited fetch (not a
  // synchronous setState) is what runs in the effect body — poll only setState()s after
  // its `await fetch`, so this never cascades a render.
  useEffect(() => {
    void (async () => {
      await poll();
    })();
  }, [poll]);

  // Poll WHILE a request is active — every 4s while running (matches arrive in
  // concurrency-5 bursts, so this is effectively per-burst live), 10s while queued
  // (nothing to stream yet). The chain re-arms ITSELF after each poll resolves, because a
  // stable running streak changes none of this effect's deps — an unchanged
  // setStatus("running") is a React no-op, reviewedToday isn't a dep, and the cursor is a
  // ref — so a one-shot timer would fire only once. A deps change (status transition or a
  // new poll identity) cancels the running chain via the cleanup's `cancelled` flag before
  // arming a fresh one; the !active branch stops everything when the request settles.
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    wasActiveRef.current = true;
    let cancelled = false;
    const arm = () => {
      timerRef.current = setTimeout(async () => {
        await poll();
        if (!cancelled) arm();
      }, status === "running" ? 4_000 : 10_000);
    };
    arm();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, status, poll]);

  // On an active→done settle, refresh the board once so the new scores render.
  useEffect(() => {
    if (status === "done" && wasActiveRef.current && !settledRef.current) {
      settledRef.current = true;
      onSettled?.();
    }
  }, [status, onSettled]);

  const request = async () => {
    setBusy(true);
    setError(null);
    setGate(null);
    try {
      const res = await fetch("/api/review/request", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        status?: Status; remaining?: number; error?: string;
      };
      if (!res.ok) {
        // Tier gate (402 subscribe / 409 daily budget): upsell with a /billing link
        // keyed off the status + the body's machine-readable code — anything else
        // keeps the generic retry copy.
        const notice = tierGateNotice(res.status, data);
        if (notice) setGate(notice);
        else setError(data.error ?? "Couldn't start a review. Please try again.");
      } else {
        setStatus(data.status ?? "pending");
        settledRef.current = false;
        if (typeof data.remaining === "number") setRemaining(data.remaining);
      }
    } catch {
      setError("Couldn't start a review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // COMPACT progress strip while a request runs — stays mounted regardless of job count.
  if (active) {
    return (
      <div style={cardStyle} data-testid="review-progress" role="status" aria-live="polite">
        <span style={dot("var(--chart-amber)")} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
            Reviewing your board…
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {reviewedToday != null
              ? `${reviewedToday.toLocaleString()} role${reviewedToday === 1 ? "" : "s"} scored so far — new matches appear here as they're scored.`
              : "This runs in the background — new matches appear here as they're scored."}
          </div>
        </div>
      </div>
    );
  }

  // Not active: the full "being built" CTA only makes sense on an empty first-run board.
  // A populated board with no active request shows nothing (the board carries the roles).
  if (!firstRun) return null;

  return (
    <div style={cardStyle}>
      <span style={dot(status === "failed" ? "var(--danger)" : "var(--accent)")} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
          Your board is being built
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {status === "failed"
            ? "The last review didn't finish. You can start another below."
            : "Run an AI review now to score the open roles against your profile, or wait for the next scheduled pass."}
          {remaining != null && <> · <span role="status" aria-live="polite">{remaining.toLocaleString()} reviews left in today&apos;s budget.</span></>}
        </div>
        {error && <div role="alert" style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>{error}</div>}
        {gate && (
          <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px" }}>
            <span role="status" aria-live="polite">{gate.message}</span>{" "}
            <ButtonLink href="/billing" variant="text-link" size="compact" style={{ gap: "4px", fontWeight: 700 }}>
              {gate.cta} <Icon name="arrow-right" size={16} />
            </ButtonLink>
          </div>
        )}
      </div>
      <Button
        onClick={request}
        loading={busy}
        loadingLabel="Starting review"
        size="compact"
        style={{
          flexShrink: 0,
        }}
      >
        {busy ? "Starting…" : "Review my board now"}
      </Button>
    </div>
  );
}
