"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

// A dotted-underlined term that reveals a plain-language definition on hover AND
// keyboard focus (Escape dismisses). Inline styles only, Rolefit tokens. The
// tooltip flips its horizontal anchor near the viewport edges so it never clips.
export function InfoTip({
  term,
  gloss,
  children,
  labelStyle,
}: {
  term: string;
  gloss: string;
  children?: React.ReactNode;
  labelStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"center" | "left" | "right">("center");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const half = 132; // half of the 264px max tooltip width, + a little slack
    const mid = r.left + r.width / 2;
    if (mid - half < 8) setAlign("left");
    else if (mid + half > vw - 8) setAlign("right");
    else setAlign("center");
  }, [open]);

  const anchor: React.CSSProperties =
    align === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : align === "left"
        ? { left: 0 }
        : { right: 0 };

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        role="button"
        aria-describedby={open ? id : undefined}
        aria-label={`${term}. ${gloss}`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        style={{
          borderBottom: "1px dotted #9aa3b0",
          cursor: "help",
          outline: "none",
          ...labelStyle,
        }}
      >
        {children ?? term}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 7px)",
            ...anchor,
            zIndex: 40,
            width: "max-content",
            maxWidth: "264px",
            background: "#161d29",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: 1.45,
            letterSpacing: 0,
            // Reset transform so a tooltip attached to an uppercase subhead (e.g. the
            // funnel's "VERDICTS (SHARE OF CLASSIFIED)") doesn't render its body in
            // hard-to-read all-caps (audit R4-P1).
            textTransform: "none",
            textAlign: "left",
            padding: "9px 11px",
            borderRadius: "8px",
            boxShadow: "0 6px 20px rgba(22,29,41,.28)",
            pointerEvents: "none",
            whiteSpace: "normal",
          }}
        >
          <span style={{ display: "block", fontWeight: 700, marginBottom: "2px" }}>{term}</span>
          {gloss}
        </span>
      )}
    </span>
  );
}
