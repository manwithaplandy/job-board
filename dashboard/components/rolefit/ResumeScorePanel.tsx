"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";
import { resumeOverall } from "@/lib/rolefit/resumeScore";
import { saveResumeScore } from "@/app/actions/resumeScores";

export interface ResumeScorePanelProps {
  job: JobRow;
  resume: TailoredResume;
  isAuthed: boolean;
}

const DIMS = [1, 2, 3, 4, 5];

export function ResumeScorePanel({ job, resume, isAuthed }: ResumeScorePanelProps) {
  const [open, setOpen] = useState(false);
  const [grounding, setGrounding] = useState<number | null>(null);
  const [jd, setJd] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(null);
  const [saving, setSaving] = useState(false);

  if (!isAuthed) return null;

  // Résumé-only mechanical checks (no ParsedProfile client-side).
  const { checks } = resumeChecks(resume);
  const canSave = grounding !== null && jd !== null && !saving;

  const onSave = async () => {
    if (grounding === null || jd === null) return;
    setSaving(true); setStatus(null);
    try {
      const form = { grounding, jdRelevance: jd, comment: comment.trim() || null };
      const res = await saveResumeScore(job.id, form);
      setStatus({
        ok: res.langfuseSynced,
        text: res.langfuseSynced ? "Score saved." : "Saved. LangFuse sync failed — will reconcile.",
      });
    } catch {
      setStatus({ ok: false, text: "Save failed — try again." });
    } finally {
      setSaving(false);
    }
  };

  const scale = (value: number | null, set: (n: number) => void, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
      <span style={{ width: "150px", fontSize: "12.5px", fontWeight: 700, color: "#3b4250" }}>{label}</span>
      {DIMS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => set(n)}
          style={{
            width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer",
            fontWeight: 700, fontSize: "13px",
            border: value === n ? "2px solid #3b6fd4" : "1px solid #dfe3ea",
            background: value === n ? "#eef3fc" : "#fff",
            color: value === n ? "#2b52a0" : "#5b6472",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: "13px", borderTop: "1px dashed #d8dee8", paddingTop: "13px" }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            fontWeight: 700, fontSize: "12.5px", color: "#5b6472", background: "#fff",
            border: "1px solid #dfe3ea", borderRadius: "9px", padding: "8px 13px", cursor: "pointer",
          }}
        >
          ★ Score résumé
        </button>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: "13px", color: "#1b2330" }}>
            Score this résumé (1–5)
          </div>

          {/* Mechanical checks — guide the human score. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
            {checks.map((c) => (
              <span
                key={c.id}
                title={c.detail ?? c.label}
                style={{
                  fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "3px 8px",
                  color: c.pass ? "#2f7d54" : "#b25a36",
                  background: c.pass ? "#e6f4ec" : "#fdf0ec",
                  border: `1px solid ${c.pass ? "#c7e6d3" : "#f3d5c9"}`,
                }}
              >
                {c.pass ? "✓" : "✕"} {c.label}
              </span>
            ))}
          </div>

          {scale(grounding, setGrounding, "Grounding (truthful)")}
          {scale(jd, setJd, "JD relevance")}
          {grounding !== null && jd !== null && (
            <div style={{ fontSize: "12px", color: "#6b7480", marginTop: "8px", fontWeight: 600 }}>
              Overall: {resumeOverall(grounding, jd)} (grounding-weighted 0.7/0.3)
            </div>
          )}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)…"
            rows={2}
            style={{
              width: "100%", marginTop: "9px", padding: "8px 10px", fontSize: "12.5px",
              border: "1px solid #dfe3ea", borderRadius: "9px", resize: "vertical", boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: "9px", marginTop: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              style={{
                fontWeight: 700, fontSize: "13px", color: "#fff",
                background: canSave ? "#3b6fd4" : "#9db6e2", border: "none", borderRadius: "9px",
                padding: "9px 16px", cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Saving…" : "Save score"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setStatus(null); }}
              style={{
                fontWeight: 700, fontSize: "13px", color: "#5b6472", background: "#fff",
                border: "1px solid #dfe3ea", borderRadius: "9px", padding: "9px 14px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            {status && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "#2f7d54" : "#b25a36" }}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
