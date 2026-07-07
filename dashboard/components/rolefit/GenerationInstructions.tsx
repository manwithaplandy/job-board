"use client";

import { useState } from "react";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

export interface GenerationInstructionsProps {
  /** Current instructions text ("" = none). */
  value: string;
  onChange: (v: string) => void;
  /** Labels the placeholder, e.g. "résumé" or "cover letter". */
  kind: string;
}

// Per-job "Generation instructions" expander. Defaults collapsed and empty; the text
// rides the NEXT generate/regenerate request (the route persists it alongside the
// artifact — typing without generating is deliberately ephemeral local state).
export function GenerationInstructions({ value, onChange, kind }: GenerationInstructionsProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "10px" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontWeight: 700, fontSize: "12px", color: "var(--text-secondary)",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "6px 11px", cursor: "pointer",
        }}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        Generation instructions
        {!open && value.trim() && (
          <span style={{ color: "var(--accent)", fontWeight: 800 }}>·</span>
        )}
      </button>
      {open && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={INSTRUCTIONS_MAX_LENGTH}
          rows={3}
          placeholder={`Optional — what the ${kind} should focus on or avoid. Applies on the next generate.`}
          style={{
            width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
            lineHeight: 1.5, border: "1px solid var(--border)", borderRadius: "9px",
            resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
}
