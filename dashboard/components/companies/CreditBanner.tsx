"use client";

import { useTransition } from "react";
import type { DiscoveryStateRow } from "@/lib/types";

export function CreditBanner({
  state, refresh,
}: { state: DiscoveryStateRow; refresh: () => Promise<void> }) {
  const [pending, start] = useTransition();
  if (!state.halted_no_credits) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 16px", margin: "0 0 16px",
      background: "#fdf3e6", border: "1px solid #f3d9ad",
      borderRadius: "12px", color: "#8a5a12", fontSize: "13px", fontWeight: 600,
    }}>
      <span>⚠️ Company scan paused — OpenRouter out of credits.
        {state.backlog > 0 ? ` ${state.backlog.toLocaleString()} companies still pending.` : ""}
      </span>
      <button
        onClick={() => start(async () => { await refresh(); })}
        disabled={pending}
        style={{
          marginLeft: "auto", fontWeight: 700, fontSize: "12.5px", color: "#fff",
          background: "#3b6fd4", border: "none", borderRadius: "9px",
          padding: "8px 14px", cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
