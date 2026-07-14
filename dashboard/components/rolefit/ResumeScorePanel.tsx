"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";
import { resumeOverall } from "@/lib/rolefit/resumeScore";
import { saveResumeScore } from "@/app/actions/resumeScores";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

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
    <div className="rf-resume-score-row">
      <span className="rf-resume-score-row__label">{label}</span>
      {DIMS.map((n) => (
        <Button
          key={n}
          type="button"
          variant={value === n ? "secondary" : "outline"}
          size="compact"
          aria-pressed={value === n}
          onClick={() => set(n)}
          style={{
            width: "44px", padding: 0,
            border: value === n ? "2px solid var(--accent)" : "1px solid var(--border)",
            background: value === n ? "var(--accent-bg)" : "var(--bg-surface)",
            color: value === n ? "var(--accent-hover)" : "var(--text-secondary)",
          }}
        >
          {n}
        </Button>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: "13px", borderTop: "1px dashed var(--border)", paddingTop: "13px" }}>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontWeight: 700, fontSize: "12.5px", color: "var(--text-secondary)", background: "var(--bg-surface)",
            border: "1px solid var(--border)", borderRadius: "9px", padding: "8px 13px", cursor: "pointer",
          }}
        >
          <Icon name="star" size={16} /> Score résumé
        </Button>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--text-primary)" }}>
            Score this résumé (1–5)
          </div>

          {/* Mechanical checks — guide the human score. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
            {checks.map((c) => (
              <span
                key={c.id}
                title={c.detail ?? c.label}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "3px 8px",
                  color: c.pass ? "var(--success)" : "var(--danger)",
                  background: c.pass ? "var(--success-bg)" : "var(--danger-bg)",
                  border: `1px solid ${c.pass ? "var(--success-border)" : "var(--danger-border)"}`,
                }}
              >
                <Icon name={c.pass ? "check" : "close"} size={16} /> {c.label}
              </span>
            ))}
          </div>

          {scale(grounding, setGrounding, "Grounding (truthful)")}
          {scale(jd, setJd, "JD relevance")}
          {grounding !== null && jd !== null && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>
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
              border: "1px solid var(--border)", borderRadius: "9px", resize: "vertical", boxSizing: "border-box",
            }}
          />

          <div className="rf-generation-actions" style={{ marginTop: "10px" }}>
            <Button
              type="button"
              onClick={onSave}
              disabled={!canSave}
            >
              {saving ? "Saving…" : "Save score"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); setStatus(null); }}
            >
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
