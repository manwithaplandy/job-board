"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import { saveCoverLetterEdit, deleteCoverLetterEdit } from "@/app/actions/coverLetterEdits";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export interface CoverLetterEditorProps {
  job: JobRow;
  /** Current display text: the live edit when one exists, else the composed original. */
  letterText: string;
  /** True when a current (non-superseded) edit overlays the generated letter. */
  hasEdit: boolean;
  isAuthed: boolean;
  onSaved: (jobId: string, editedText: string) => void;
  onReset: (jobId: string) => void;
}

// Plain-text single-window editor for the generated cover letter (spec: we never
// reconstruct the structured TailoredCoverLetter from edited text). Mirrors
// ResumeScorePanel's save/UI conventions: DB-first server action, sync status note.
export function CoverLetterEditor({ job, letterText, hasEdit, isAuthed, onSaved, onReset }: CoverLetterEditorProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(letterText);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(null);

  if (!isAuthed) return null;

  const onSave = async () => {
    setBusy(true); setStatus(null);
    try {
      const res = await saveCoverLetterEdit(job.id, text, comment.trim() || null);
      setStatus({
        ok: res.langfuseSynced,
        text: res.langfuseSynced ? "Edit saved." : "Saved. LangFuse sync failed — will reconcile.",
      });
      onSaved(job.id, text.trim());
      setOpen(false);
    } catch {
      setStatus({ ok: false, text: "Save failed — try again." });
    } finally {
      setBusy(false);
    }
  };

  const onResetClick = async () => {
    setBusy(true); setStatus(null);
    try {
      await deleteCoverLetterEdit(job.id);
      onReset(job.id);
      setOpen(false);
    } catch {
      setStatus({ ok: false, text: "Reset failed — try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: "13px", borderTop: "1px dashed var(--border)", paddingTop: "13px" }}>
      {!open ? (
        <div className="rf-generation-actions">
          <Button type="button" variant="outline" size="compact" onClick={() => { setText(letterText); setOpen(true); }}>
            <Icon name="edit" size={16} /> Edit letter
          </Button>
          {hasEdit && (
            <Button type="button" variant="outline" size="compact" onClick={onResetClick} disabled={busy}>
              Reset to generated
            </Button>
          )}
          {status && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "var(--success)" : "var(--danger)" }}>
              {status.text}
            </span>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--text-primary)" }}>
            Edit cover letter
          </div>
          <textarea
            aria-label="Edited cover letter"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            maxLength={20000}
            style={{
              width: "100%", marginTop: "9px", padding: "10px 12px", fontSize: "13px",
              lineHeight: 1.6, border: "1px solid var(--border)", borderRadius: "9px",
              resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          <input
            aria-label="Edit comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why this edit? (optional — travels with the golden item)"
            style={{
              width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
              border: "1px solid var(--border)", borderRadius: "9px", boxSizing: "border-box",
            }}
          />
          <div className="rf-generation-actions" style={{ marginTop: "10px" }}>
            <Button
              type="button"
              onClick={onSave}
              disabled={busy || !text.trim()}
            >
              {busy ? "Saving…" : "Save edit"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setStatus(null); }}>
              Cancel
            </Button>
            {status && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "var(--success)" : "var(--danger)" }}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
