"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tierGateNotice, type TierGateNotice } from "@/lib/rolefit/tierGate";
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
}

export function ReviewNowPanel({ firstRun = false, onSettled }: ReviewNowPanelProps) {
  const [status, setStatus] = useState<Status>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reviewedToday, setReviewedToday] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tier-gate rejection (402 no plan / 409 daily budget spent): rendered as an
  // invitation with a /billing link, not through the red `error` line.
  const [gate, setGate] = useState<TierGateNotice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether we've observed an active request, so we only fire onSettled on a real
  // active→done transition (not a stale 'done' seen on the very first poll).
  const wasActiveRef = useRef(false);
  const settledRef = useRef(false);

  const active = status === "pending" || status === "running";

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/review/request", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        status?: Status; remaining?: number; reviewedToday?: number;
      };
      setStatus(data.status ?? null);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (typeof data.reviewedToday === "number") setReviewedToday(data.reviewedToday);
    } catch {
      /* transient — the next poll or a manual retry recovers */
    }
  }, []);

  // Initial status load. Wrapped in an inline async IIFE so the awaited fetch (not a
  // synchronous setState) is what runs in the effect body — poll only setState()s after
  // its `await fetch`, so this never cascades a render.
  useEffect(() => {
    void (async () => {
      await poll();
    })();
  }, [poll]);

  // Poll every ~10s WHILE a request is active; stop when it settles.
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    wasActiveRef.current = true;
    timerRef.current = setTimeout(() => void poll(), 10_000);
    return () => {
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
      <div style={cardStyle} data-testid="review-progress">
        <span style={dot("var(--chart-amber)")} />
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
      <span style={dot(status === "failed" ? "var(--danger)" : "var(--accent)")} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
          Your board is being built
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {status === "failed"
            ? "The last review didn't finish. You can start another below."
            : "Run an AI review now to score the open roles against your profile, or wait for the next scheduled pass."}
          {remaining != null && ` · ${remaining.toLocaleString()} reviews left in today's budget.`}
        </div>
        {error && <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>{error}</div>}
        {gate && (
          <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px" }}>
            {gate.message}{" "}
            <a href="/billing" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
              {gate.cta} <Icon name="arrow-right" size={16} />
            </a>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={request}
        disabled={busy}
        style={{
          border: "none",
          borderRadius: "9px",
          padding: "9px 14px",
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--text-on-accent)",
          background: "var(--accent)",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
          flexShrink: 0,
          fontFamily: "inherit",
        }}
      >
        {busy ? "Starting…" : "Review my board now"}
      </button>
    </div>
  );
}
