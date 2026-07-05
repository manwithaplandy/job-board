"use client";

import type { TierGateNotice } from "@/lib/rolefit/tierGate";

// Bottom-of-screen tier-gate upsell pill (402 subscribe / 429 monthly allowance /
// 409 daily review budget). Deliberately mirrors the Undo toast's dark pill + blue
// action styling — NOT the red error pill — because a gate rejection is an upgrade
// moment, not a failure. Plain <a href> matches the board's internal-link idiom
// (see Header's /analytics link).
export function UpsellNotice({
  notice,
  marginTop,
  onDismiss,
}: {
  notice: TierGateNotice;
  // Keeps the 8px gap from a pill above only when one is showing (mirrors actionError).
  marginTop: number;
  onDismiss: () => void;
}) {
  return (
    <div
      data-testid="upsell-notice"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginTop,
        background: "#1b2330",
        color: "#fff",
        borderRadius: "12px",
        padding: "11px 18px",
        boxShadow: "0 8px 22px rgba(20,28,40,.22)",
        fontSize: "13.5px",
        fontWeight: 600,
        // Unlike the one-word toasts, the message is a sentence or two — cap the pill
        // and let the text wrap instead of running off narrow viewports.
        maxWidth: "min(640px, calc(100vw - 32px))",
      }}
    >
      <span>{notice.message}</span>
      <a
        href="/billing"
        style={{
          fontWeight: 800,
          fontSize: "13px",
          color: "#9ec1ff",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {notice.cta} →
      </a>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          fontWeight: 800,
          fontSize: "13px",
          color: "#8fa0b8",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
