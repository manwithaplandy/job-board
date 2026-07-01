"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { saveReviewCorrection } from "@/app/actions/corrections";
import {
  VERDICTS, EXPERIENCE_MATCH, INDUSTRIES, SUBCATEGORIES_BY_INDUSTRY,
  ROLE_CATEGORIES, SENIORITY, WORK_ARRANGEMENT, CONFIDENCE,
} from "@/lib/rolefit/taxonomy";

function initialForm(job: JobRow): CorrectionForm {
  return {
    verdict: job.verdict ?? null,
    experienceMatch: job.experience_match ?? null,
    industry: job.industry ?? null,
    industrySubcategory: job.industry_subcategory ?? null,
    confidence: job.confidence ?? null,
    roleCategory: job.role_category ?? null,
    seniority: job.seniority ?? null,
    workArrangement: job.work_arrangement ?? null,
    skillsScore: job.skills_score ?? null,
    experienceScore: job.experience_score ?? null,
    compScore: job.comp_score ?? null,
    reasoning: job.reasoning ?? null,
    about: job.about ?? null,
    payMin: job.pay_min ?? null,
    payMax: job.pay_max ?? null,
    payCurrency: job.pay_currency ?? null,
    payPeriod: job.pay_period ?? null,
    headcount: job.headcount ?? null,
    redFlags: job.red_flags ?? [],
    skillGaps: job.skill_gaps ?? [],
    benefits: job.benefits ?? [],
    requirements: job.requirements ?? [],
    note: job.note ?? null,
  };
}

export function ReviewPanel({
  job,
  isAuthed,
  onCorrected,
}: {
  job: JobRow;
  isAuthed: boolean;
  onCorrected?: (jobId: string, form: CorrectionForm) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CorrectionForm>(() => initialForm(job));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function set<K extends keyof CorrectionForm>(k: K, v: CorrectionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveReviewCorrection(job.id, form);
      setToast(res.langfuseSynced ? "Saved." : "Saved. LangFuse sync failed — will reconcile.");
      setEditing(false);
      onCorrected?.(job.id, form);
    } catch (e) {
      console.error(e);
      setToast("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const sel = (label: string, k: keyof CorrectionForm, opts: readonly string[]) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
      {label}
      <select
        value={(form[k] as string) ?? ""}
        onChange={(e) => set(k, (e.target.value || null) as CorrectionForm[typeof k])}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }}
      >
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  const num = (label: string, k: "skillsScore" | "experienceScore" | "compScore") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
      {label}
      <input
        type="number" min={0} max={100}
        value={form[k] ?? ""}
        onChange={(e) => set(k, e.target.value === "" ? null : Number(e.target.value))}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13, width: 90 }}
      />
    </label>
  );

  // Sub-score bars
  const subScores: { label: string; value: number | null }[] = [
    { label: "Skills match", value: job.skills_score },
    { label: "Experience level", value: job.experience_score },
    { label: "Comp & seniority", value: job.comp_score },
  ];

  // Red flags / skill gaps
  const redFlags = job.red_flags ?? [];
  const skillGaps = job.skill_gaps ?? [];

  return (
    <div
      style={{
        marginTop: "18px",
        border: "1px solid #e3e7ee",
        borderRadius: "16px",
        padding: "19px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 800,
            color: "#fff",
            background: "#3b6fd4",
            borderRadius: "6px",
            padding: "3px 8px",
            letterSpacing: ".5px",
          }}
        >
          AI
        </span>
        <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>Review</div>
        <div style={{ flex: 1 }} />
        {job.role_category && (
          <div style={{ fontSize: "11.5px", color: "#8a93a3", fontWeight: 600 }}>
            Auto-categorized ·{" "}
            <span style={{ color: "#5b6472", fontWeight: 700 }}>{job.role_category}</span>
          </div>
        )}
      </div>

      {isAuthed && (
        <div style={{ marginTop: 12 }}>
          {!editing ? (
            <button type="button" onClick={() => { setForm(initialForm(job)); setEditing(true); }}
              style={{ fontWeight: 700, fontSize: 12.5, color: "#3b6fd4", background: "#fff", border: "1px solid #d7e0f2", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
              {job.corrected ? "Edit correction" : "Correct job details"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e3e7ee", borderRadius: 12, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {sel("Verdict", "verdict", VERDICTS)}
                {sel("Experience match", "experienceMatch", EXPERIENCE_MATCH)}
                {sel("Confidence", "confidence", CONFIDENCE)}
                {sel("Role category", "roleCategory", ROLE_CATEGORIES)}
                {sel("Seniority", "seniority", SENIORITY)}
                {sel("Work arrangement", "workArrangement", WORK_ARRANGEMENT)}
                {sel("Industry", "industry", INDUSTRIES)}
                {sel("Subcategory", "industrySubcategory",
                  form.industry ? (SUBCATEGORIES_BY_INDUSTRY[form.industry] ?? []) : [])}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {num("Skills", "skillsScore")}
                {num("Experience", "experienceScore")}
                {num("Comp", "compScore")}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
                Reasoning
                <textarea value={form.reasoning ?? ""} rows={3}
                  onChange={(e) => set("reasoning", e.target.value || null)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
                Note (why corrected)
                <input value={form.note ?? ""}
                  onChange={(e) => set("note", e.target.value || null)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }} />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={onSave} disabled={saving}
                  style={{ fontWeight: 700, fontSize: 12.5, color: "#fff", background: "#3b6fd4", border: "1px solid #3b6fd4", borderRadius: 9, padding: "7px 16px", cursor: "pointer" }}>
                  {saving ? "Saving…" : "Save correction"}
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving}
                  style={{ fontWeight: 700, fontSize: 12.5, color: "#5b6472", background: "#fff", border: "1px solid #d7dce5", borderRadius: 9, padding: "7px 16px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {toast && <div style={{ fontSize: 12, color: "#5b6472", marginTop: 6 }}>{toast}</div>}
        </div>
      )}

      {/* Sub-score bars */}
      <div style={{ marginTop: "15px" }}>
        {subScores.map((r) =>
          r.value !== null ? (
            <div
              key={r.label}
              style={{ display: "flex", alignItems: "center", gap: "13px", marginTop: "9px" }}
            >
              <div
                style={{
                  width: "128px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#5b6472",
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "8px",
                  background: "#eef1f5",
                  borderRadius: "5px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${r.value}%`,
                    background: "#3b6fd4",
                    borderRadius: "5px",
                  }}
                />
              </div>
              <div
                style={{
                  width: "38px",
                  textAlign: "right",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#3b6fd4",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.value}%
              </div>
            </div>
          ) : null,
        )}
      </div>

      {job.reasoning && (
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.62,
            color: "#2f3845",
            margin: "17px 0 0",
            fontWeight: 500,
          }}
        >
          {job.reasoning}
        </p>
      )}

      {/* Red flags + skill gaps */}
      {(redFlags.length > 0 || skillGaps.length > 0) && (
        <div
          style={{ display: "flex", gap: "24px", marginTop: "18px", flexWrap: "wrap" }}
        >
          {redFlags.length > 0 && (
            <div style={{ flex: 1, minWidth: "230px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#b25a36",
                  letterSpacing: ".3px",
                  textTransform: "uppercase",
                }}
              >
                Red flags
              </div>
              {redFlags.map((flag) => (
                <div
                  key={flag}
                  style={{
                    display: "flex",
                    gap: "9px",
                    alignItems: "flex-start",
                    marginTop: "8px",
                  }}
                >
                  <span
                    style={{
                      color: "#c2683f",
                      fontSize: "11px",
                      lineHeight: 1.5,
                      flex: "0 0 auto",
                    }}
                  >
                    ▲
                  </span>
                  <span
                    style={{ fontSize: "13px", color: "#414b59", lineHeight: 1.5, fontWeight: 500 }}
                  >
                    {flag}
                  </span>
                </div>
              ))}
            </div>
          )}
          {skillGaps.length > 0 && (
            <div style={{ flex: 1, minWidth: "230px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#9a6a1e",
                  letterSpacing: ".3px",
                  textTransform: "uppercase",
                }}
              >
                Skill gaps
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "10px" }}>
                {skillGaps.map((gap) => (
                  <span
                    key={gap}
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#9a6a1e",
                      background: "#f8efdd",
                      border: "1px solid #ecdcb8",
                      borderRadius: "7px",
                      padding: "3px 10px",
                    }}
                  >
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
