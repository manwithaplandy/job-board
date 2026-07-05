"use client";

import { useState } from "react";

// Tiny client leaf so server-rendered admin tables can offer per-row copy.
// Best-effort: clipboard can be unavailable (http, permissions) — failure is silent
// and the label simply doesn't flip.
export function CopyButton({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — leave the label as "Copy" */
        }
      }}
      style={{
        border: "1px solid #dfe3ea",
        borderRadius: "8px",
        background: "#fff",
        color: "#5b6472",
        fontSize: "11.5px",
        fontWeight: 700,
        padding: "4px 9px",
        cursor: "pointer",
        fontFamily: "inherit",
        ...style,
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
