"use client";

import type { TierGateNotice } from "@/lib/rolefit/tierGate";
import { Icon } from "@/components/ui/Icon";

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
        background: "var(--toast-bg)",
        color: "var(--text-on-accent)",
        borderRadius: "12px",
        padding: "11px 18px",
        boxShadow: "var(--shadow-toast)",
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
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontWeight: 800,
          fontSize: "13px",
          color: "var(--toast-link)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {notice.cta} <Icon name="arrow-right" size={16} />
      </a>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          fontWeight: 800,
          fontSize: "13px",
          color: "var(--toast-muted)",
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
