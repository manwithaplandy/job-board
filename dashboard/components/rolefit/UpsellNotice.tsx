"use client";

import type { TierGateNotice } from "@/lib/rolefit/tierGate";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Bottom-of-screen tier-gate upsell pill (402 subscribe / 429 monthly allowance /
// 409 daily review budget). Deliberately mirrors the Undo toast's dark pill + blue
// action styling — NOT the red error pill — because a gate rejection is an upgrade
// moment, not a failure. Shared actions preserve the same destinations while keeping
// focus, pressed, and 44px target behavior consistent with the rest of the app.
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
      role="status"
      aria-live="polite"
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
        flexWrap: "wrap",
        // Unlike the one-word toasts, the message is a sentence or two — cap the pill
        // and let the text wrap instead of running off narrow viewports.
        maxWidth: "min(640px, calc(100vw - 32px))",
      }}
    >
      <span style={{ minWidth: 0, overflowWrap: "anywhere", flex: "1 1 240px" }}>{notice.message}</span>
      <ButtonLink
        href="/billing"
        variant="text-link"
        size="compact"
        style={{
          fontWeight: 800,
          fontSize: "13px",
          color: "var(--toast-link)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {notice.cta} <Icon name="arrow-right" size={16} />
      </ButtonLink>
      <Button
        variant="ghost"
        size="compact"
        onClick={onDismiss}
        style={{
          fontWeight: 800,
          fontSize: "13px",
          color: "var(--toast-muted)",
          flexShrink: 0,
        }}
      >
        Dismiss
      </Button>
    </div>
  );
}
