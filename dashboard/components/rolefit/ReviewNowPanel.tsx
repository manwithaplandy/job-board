"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// First-run "your board is being built" affordance (spec F core). Shown when an authed
// user has jobs waiting but none reviewed yet. Lets them trigger an on-demand review
// (the reviewer worker consumes the request) and polls for progress. Deliberately NOT
// a warning banner — a benign pending state carries a status dot + copy only
// (memory: no-banner-for-benign-states).

type Status = "pending" | "running" | "done" | "failed" | null;

const cardStyle: React.CSSProperties = {
  margin: "12px 16px 0",
  background: "#fff",
  border: "1px solid #e7eaf0",
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

export function ReviewNowPanel() {
  const [status, setStatus] = useState<Status>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = status === "pending" || status === "running";

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/review/request", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as { status?: Status; remaining?: number };
      setStatus(data.status ?? null);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      /* transient — the next poll or a manual retry recovers */
    }
  }, []);

  // Initial status load.
  useEffect(() => {
    void poll();
  }, [poll]);

  // Poll every ~10s WHILE a request is active; stop when it settles.
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => void poll(), 10_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, status, poll]);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/request", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { status?: Status; remaining?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't start a review. Please try again.");
      } else {
        setStatus(data.status ?? "pending");
        if (typeof data.remaining === "number") setRemaining(data.remaining);
      }
    } catch {
      setError("Couldn't start a review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "done") return null; // board will populate on next load

  return (
    <div style={cardStyle}>
      <span style={dot(active ? "#e0a83b" : status === "failed" ? "#c0392b" : "#3b6fd4")} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#161d29" }}>
          {active ? "Reviewing your board…" : "Your board is being built"}
        </div>
        <div style={{ fontSize: "12px", color: "#6b7480", marginTop: "2px" }}>
          {active
            ? "This runs in the background — new matches appear here as they're scored. You can keep browsing."
            : status === "failed"
              ? "The last review didn't finish. You can start another below."
              : "Run an AI review now to score the open roles against your profile, or wait for the next scheduled pass."}
          {remaining != null && !active && ` · ${remaining.toLocaleString()} reviews left in today's budget.`}
        </div>
        {error && <div style={{ fontSize: "12px", color: "#c0392b", marginTop: "4px" }}>{error}</div>}
      </div>
      {!active && (
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
            color: "#fff",
            background: "#3b6fd4",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            flexShrink: 0,
            fontFamily: "inherit",
          }}
        >
          {busy ? "Starting…" : "Review my board now"}
        </button>
      )}
    </div>
  );
}
