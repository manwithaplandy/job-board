"use client";

import { useState } from "react";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

export interface GenerationInstructionsProps {
  /** Current instructions text ("" = none). */
  value: string;
  onChange: (v: string) => void;
  /** Labels the placeholder + badge, e.g. "résumé" or "cover letter". */
  kind: string;
  /** Persist the box independently of generating. Absent ⇒ no Save button. */
  onSave?: () => Promise<void>;
  /** Box differs from the persisted saved value ⇒ Save enabled. */
  dirty?: boolean;
  /** Whether the shown artifact reflects the box. "none" ⇒ no badge (idle / no artifact). */
  appliedState?: "none" | "applied" | "pending";
}

// Per-job "Generation instructions" expander. The text rides the NEXT generate/regenerate;
// Save persists it independently (survives reload). The applied badge compares the box
// against the instructions the current artifact was generated with.
export function GenerationInstructions({
  value,
  onChange,
  kind,
  onSave,
  dirty = false,
  appliedState = "none",
}: GenerationInstructionsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave();
      setJustSaved(true);
    } catch {
      // The parent surfaces its own error toast; just don't show the "✓ Saved"
      // confirmation and don't let the rejection escape as an unhandled promise.
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (v: string) => {
    if (justSaved) setJustSaved(false); // a fresh edit invalidates the "Saved" confirmation
    onChange(v);
  };

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
        <>
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={INSTRUCTIONS_MAX_LENGTH}
            rows={3}
            placeholder={`Optional — what the ${kind} should focus on or avoid. Applies on the next generate.`}
            style={{
              width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
              lineHeight: 1.5, border: "1px solid var(--border)", borderRadius: "9px",
              resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", minHeight: "26px" }}>
            {onSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                style={{
                  fontWeight: 700, fontSize: "12px",
                  color: "var(--text-on-accent)", background: "var(--accent)",
                  border: "none", borderRadius: "8px", padding: "6px 14px",
                  cursor: !dirty || saving ? "not-allowed" : "pointer",
                  opacity: !dirty || saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {onSave && justSaved && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success)" }} aria-live="polite">
                ✓ Saved
              </span>
            )}
            {appliedState === "applied" && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginLeft: "auto" }}>
                ✓ Applied to current {kind}
              </span>
            )}
            {appliedState === "pending" && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)", marginLeft: "auto" }}>
                ● Not yet applied — Regenerate to apply
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
