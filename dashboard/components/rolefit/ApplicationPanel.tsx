"use client";

import { useEffect, useRef, useState } from "react";
import type { ApplicationAnswers, JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { mergeGreenhouseQuestions } from "@/lib/rolefit/greenhouseAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { ResumePanel, legacyCopy } from "./ResumePanel";
import { downloadPdf } from "@/lib/rolefit/downloadPdf";

// Plain-text cover letter — mirrors composeResumeText in ResumePanel.
function composeCoverLetterText(data: TailoredCoverLetter): string {
  let t = `${data.greeting}\n\n`;
  data.paragraphs.forEach((p) => { t += `${p}\n\n`; });
  t += `${data.closing}\n${data.signature}\n`;
  return t;
}

function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else {
      legacyCopy(text);
    }
  } catch {
    legacyCopy(text);
  }
}

const triLabel = (v: boolean | null): string => (v === true ? "Yes" : v === false ? "No" : "");

export interface ApplicationPanelProps {
  job: JobRow;
  isAuthed: boolean;
  answers: ApplicationAnswers | null;
  // Résumé (state owned by the board, keyed by job id)
  resumeState: string | undefined;
  resumeData: TailoredResume | undefined;
  resumeError?: string;
  onGenerateResume: () => void;
  onRegenerateResume: () => void;
  onCopyResume: () => void;
  resumeCopyLabel: string;
  usingSample: boolean;
  onOpenProfile: () => void;
  // Cover letter (state owned by the board, keyed by job id)
  coverState: string | undefined;
  coverData: TailoredCoverLetter | undefined;
  coverError?: string;
  onGenerateCover: () => void;
  onRegenerateCover: () => void;
  // One-click: build + persist the application package
  onPrepare: () => void;
  // Persisted package extras (Phase 3). Greenhouse postings carry the real question
  // schema + LLM-prefilled answers; everything else falls back to the generic package.
  greenhouseQuestions: GreenhouseQuestions | null;
  prefilledAnswers: PrefilledAnswer[] | null;
  status: "prepared" | "applied" | null;
  appliedAt: string | null;
  onMarkApplied: () => void;
}

export function ApplicationPanel({
  job,
  isAuthed,
  answers,
  resumeState,
  resumeData,
  resumeError,
  onGenerateResume,
  onRegenerateResume,
  onCopyResume,
  resumeCopyLabel,
  usingSample,
  onOpenProfile,
  coverState,
  coverData,
  coverError,
  onGenerateCover,
  onRegenerateCover,
  onPrepare,
  greenhouseQuestions,
  prefilledAnswers,
  status,
  appliedAt,
  onMarkApplied,
}: ApplicationPanelProps) {
  // Ephemeral "Copied!" feedback for the cover letter + per-field answers.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const flashCopied = (key: string, text: string) => {
    copyToClipboard(text);
    setCopiedKey(key);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => setCopiedKey((prev) => (prev === key ? null : prev)),
      1600,
    );
  };

  const applyHref = applyUrl(job.ats, job.url);
  const atsLabel = job.ats ? job.ats.charAt(0).toUpperCase() + job.ats.slice(1) : "site";

  const coverBusy = coverState === "busy";
  const coverDone = coverState === "done";
  const coverError_ = coverState === "error";
  const coverIdle = !coverState || coverState === "idle";
  const preparing = resumeState === "busy" || coverState === "busy";

  // Phase 3: persisted package status + Greenhouse Q/A.
  const prepared = status === "prepared" || status === "applied";
  const applied = status === "applied";
  // Every text-answerable question this posting asks, paired with its prefilled answer
  // when one exists — so answered AND still-unanswered (required) questions both render.
  const ghRows = mergeGreenhouseQuestions(greenhouseQuestions, prefilledAnswers);
  const hasGreenhouse = ghRows.length > 0;
  const appliedDate = appliedAt ? new Date(appliedAt).toLocaleDateString() : null;

  // Cover-letter PDF download — shared helper handles the import + .txt fallback.
  const handleCoverDownload = async () => {
    if (!coverData) return;
    const fname = `Cover Letter - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
    const text = composeCoverLetterText(coverData);
    await downloadPdf(
      fname,
      (doc) => {
        const W: number = doc.internal.pageSize.getWidth();
        const M = 56;
        let y = 72;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(31, 36, 48);
        const wrap = (txt: string): string[] => doc.splitTextToSize(txt, W - 2 * M);
        const writeBlock = (txt: string) => {
          wrap(txt).forEach((l: string) => {
            if (y > 720) { doc.addPage(); y = 72; }
            doc.text(l, M, y);
            y += 16;
          });
        };
        writeBlock(coverData.greeting);
        y += 8;
        coverData.paragraphs.forEach((p) => { writeBlock(p); y += 10; });
        writeBlock(coverData.closing);
        writeBlock(coverData.signature);
      },
      text,
    );
  };

  // Read-only application answers, surfaced only when present.
  const answerRows: { key: string; label: string; value: string }[] = [];
  const pushAnswer = (key: string, label: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v) answerRows.push({ key, label, value: v });
  };
  pushAnswer("full_name", "Full name", answers?.full_name);
  pushAnswer("email", "Email", answers?.email);
  pushAnswer("phone", "Phone", answers?.phone);
  pushAnswer("location", "Location", answers?.location);
  pushAnswer("linkedin", "LinkedIn", answers?.links?.linkedin);
  pushAnswer("github", "GitHub", answers?.links?.github);
  pushAnswer("portfolio", "Portfolio", answers?.links?.portfolio);
  pushAnswer("work_authorized", "Work authorized", triLabel(answers?.work_authorized ?? null));
  pushAnswer("needs_sponsorship", "Needs sponsorship", triLabel(answers?.needs_sponsorship ?? null));
  pushAnswer("notice_period", "Notice period", answers?.screening_answers?.notice_period);
  pushAnswer("salary_expectation", "Salary expectation", answers?.screening_answers?.salary_expectation);
  pushAnswer("relocation", "Relocation", answers?.screening_answers?.relocation);
  pushAnswer("eeo_gender", "Gender (EEO)", answers?.eeo_gender);
  pushAnswer("eeo_race", "Race / ethnicity (EEO)", answers?.eeo_race);
  pushAnswer("eeo_veteran", "Veteran status (EEO)", answers?.eeo_veteran);
  pushAnswer("eeo_disability", "Disability status (EEO)", answers?.eeo_disability);

  const copyBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: 700,
    fontSize: "13.5px",
    color: "#5b6472",
    background: "#fff",
    border: "1px solid #dfe3ea",
    borderRadius: "10px",
    padding: "10px 15px",
    cursor: "pointer",
  };
  const primaryBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
    fontSize: "13.5px",
    color: "#fff",
    background: "#3b6fd4",
    border: "none",
    borderRadius: "10px",
    padding: "10px 17px",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(59,111,212,.26)",
  };

  return (
    <div style={{ marginTop: "24px" }}>
      {/* ── Header: title + prepare + apply ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          border: "1px solid #e3e7ee",
          borderRadius: "16px",
          padding: "17px 19px",
          background: "#f7f9fc",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
            Application
          </div>
          <div
            style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
          >
            Tailored résumé, cover letter, and your saved answers — ready for {job.company_name}.
          </div>
        </div>
        {applied && (
          <span
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontWeight: 700,
              fontSize: "12.5px",
              color: "#2f7d54",
              background: "#e3f1e9",
              border: "1px solid #cfe6d8",
              borderRadius: "20px",
              padding: "7px 14px",
            }}
          >
            ✓ Applied{appliedDate ? ` · ${appliedDate}` : ""}
          </span>
        )}
        {isAuthed && prepared && !applied && (
          <button
            onClick={onMarkApplied}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontWeight: 700,
              fontSize: "13.5px",
              color: "#2f7d54",
              background: "#fff",
              border: "1px solid #cfe6d8",
              borderRadius: "11px",
              padding: "12px 16px",
              cursor: "pointer",
            }}
          >
            ✓ Mark as applied
          </button>
        )}
        {isAuthed && (
          <button
            onClick={onPrepare}
            disabled={preparing}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
              fontSize: "14px",
              color: "#fff",
              background: "#3b6fd4",
              border: "none",
              borderRadius: "11px",
              padding: "12px 20px",
              cursor: preparing ? "not-allowed" : "pointer",
              opacity: preparing ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(59,111,212,.28)",
            }}
          >
            <span style={{ fontSize: "15px" }}>✦</span>
            {preparing ? "Preparing…" : prepared ? "Re-prepare" : "Prepare application"}
          </button>
        )}
        {applyHref && (
          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontWeight: 700,
              fontSize: "14px",
              color: "#3b6fd4",
              background: "#fff",
              border: "1px solid #cfddf6",
              borderRadius: "11px",
              padding: "12px 18px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Apply on {atsLabel}<span style={{ fontSize: "15px" }}>→</span>
          </a>
        )}
      </div>

      {/* ── Tailored résumé (reused ResumePanel) ── */}
      <ResumePanel
        job={job}
        isAuthed={isAuthed}
        state={resumeState}
        data={resumeData}
        error={resumeError}
        onGenerate={onGenerateResume}
        onRegenerate={onRegenerateResume}
        onCopy={onCopyResume}
        copyLabel={resumeCopyLabel}
        usingSample={usingSample}
        onOpenProfile={onOpenProfile}
      />

      {/* ── Cover letter ── */}
      <div
        style={{
          marginTop: "18px",
          border: "1px solid #e3e7ee",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Idle (authed) */}
        {isAuthed && coverIdle && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "17px 19px",
              background: "#f7f9fc",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
                Cover letter
              </div>
              <div
                style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
              >
                A focused letter that ties your background to this role.
              </div>
            </div>
            <button
              onClick={onGenerateCover}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "14px",
                color: "#fff",
                background: "#3b6fd4",
                border: "none",
                borderRadius: "11px",
                padding: "12px 20px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(59,111,212,.28)",
              }}
            >
              <span style={{ fontSize: "15px" }}>✦</span>Generate cover letter
            </button>
          </div>
        )}

        {/* Anon: sign-in nudge */}
        {!isAuthed && coverIdle && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "17px 19px",
              background: "#f7f9fc",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
                Cover letter
              </div>
              <div
                style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
              >
                Sign in to draft a cover letter tailored to this exact role.
              </div>
            </div>
            <a
              href="/login"
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "14px",
                color: "#fff",
                background: "#3b6fd4",
                border: "none",
                borderRadius: "11px",
                padding: "12px 20px",
                cursor: "pointer",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(59,111,212,.28)",
              }}
            >
              Sign in
            </a>
          </div>
        )}

        {/* Busy */}
        {coverBusy && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              padding: "21px 19px",
              background: "#f7f9fc",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                border: "3px solid #e0e8f5",
                borderTopColor: "#3b6fd4",
                animation: "rf-spin .8s linear infinite",
                flex: "0 0 auto",
              }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
                Drafting your cover letter for {job.company_name}…
              </div>
              <div
                style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
              >
                Connecting your experience to this role&apos;s requirements.
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {coverDone && coverData && (
          <div style={{ padding: "17px 19px", background: "#f6faf7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "6px",
                  background: "#dcefe2",
                  color: "#2f7d54",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
                Cover letter ready — tailored to {job.company_name}
              </div>
            </div>
            <div
              style={{
                marginTop: "12px",
                background: "#fff",
                border: "1px solid #e3e7ee",
                borderRadius: "12px",
                padding: "15px 16px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: "13px", color: "#2f3845", fontWeight: 600 }}>
                {coverData.greeting}
              </div>
              {coverData.paragraphs.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.62,
                    color: "#2f3845",
                    margin: "11px 0 0",
                    fontWeight: 500,
                  }}
                >
                  {p}
                </p>
              ))}
              <div style={{ fontSize: "13px", color: "#2f3845", fontWeight: 500, marginTop: "11px" }}>
                {coverData.closing}
              </div>
              <div style={{ fontSize: "13px", color: "#161d29", fontWeight: 700, marginTop: "2px" }}>
                {coverData.signature}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "13px" }}>
              <button onClick={handleCoverDownload} style={primaryBtnStyle}>
                <span>⤓</span>Download PDF
              </button>
              <button
                onClick={() => flashCopied("cover", composeCoverLetterText(coverData))}
                style={copyBtnStyle}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M3 11V3.6C3 2.7 3.7 2 4.6 2H11"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span aria-live="polite">{copiedKey === "cover" ? "Copied!" : "Copy text"}</span>
              </button>
              <button onClick={onRegenerateCover} style={copyBtnStyle}>
                <span>↻</span>Regenerate
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {coverError_ && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "17px 19px",
              background: "#fdf6f5",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#b25a36" }}>
                Cover letter failed
              </div>
              {coverError && (
                <div
                  style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
                >
                  {coverError}
                </div>
              )}
            </div>
            <button
              onClick={onGenerateCover}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "14px",
                color: "#fff",
                background: "#3b6fd4",
                border: "none",
                borderRadius: "11px",
                padding: "12px 20px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(59,111,212,.28)",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Greenhouse application questions (this posting's real form) ── */}
      {isAuthed && hasGreenhouse && (
        <div
          style={{
            marginTop: "18px",
            border: "1px solid #e3e7ee",
            borderRadius: "16px",
            padding: "17px 19px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
              Application questions
            </div>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                letterSpacing: ".4px",
                textTransform: "uppercase",
                color: "#2f7d54",
                background: "#e3f1e9",
                border: "1px solid #cfe6d8",
                borderRadius: "6px",
                padding: "3px 8px",
              }}
            >
              Greenhouse
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: "11.5px", color: "#6b7480", fontWeight: 600 }}>
              Pulled from this posting
            </div>
          </div>

          <div
            style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "6px", fontWeight: 500 }}
          >
            Pre-filled from your profile and résumé where possible — review before submitting,
            and fill in anything still marked “Needs your answer” on the form.
          </div>
          {/* Every question this posting asks: answered ones carry a suggested answer +
              copy button; unanswered (often required) ones stay visible so the operator
              never discovers a missing required field only on the live form. */}
          <div
            style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {ghRows.map((row) => (
              <div
                key={row.key}
                style={{
                  background: "#f7f9fc",
                  border: "1px solid #eef1f5",
                  borderRadius: "10px",
                  padding: "11px 13px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#414b59",
                    }}
                  >
                    {row.label}
                  </div>
                  {row.required && (
                    <span
                      style={{
                        flex: "0 0 auto",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        color: "#b07a2e",
                        background: "#f6edda",
                        borderRadius: "6px",
                        padding: "2px 7px",
                      }}
                    >
                      Required
                    </span>
                  )}
                  {row.answer != null && (
                    <button
                      onClick={() => flashCopied(row.key, row.answer as string)}
                      style={{
                        flex: "0 0 auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 700,
                        fontSize: "12px",
                        color: copiedKey === row.key ? "#2f7d54" : "#5b6472",
                        background: "#fff",
                        border: "1px solid #dfe3ea",
                        borderRadius: "8px",
                        padding: "6px 11px",
                        cursor: "pointer",
                      }}
                    >
                      <span aria-live="polite">{copiedKey === row.key ? "Copied!" : "Copy"}</span>
                    </button>
                  )}
                </div>
                {row.answer != null ? (
                  <div
                    style={{
                      fontSize: "13px",
                      lineHeight: 1.55,
                      color: "#2f3845",
                      fontWeight: 500,
                      marginTop: "7px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {row.answer}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#b07a2e",
                      fontWeight: 600,
                      marginTop: "7px",
                    }}
                  >
                    Needs your answer — fill this in on the form.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Profile answers (generic package — shown when no Greenhouse schema) ── */}
      {isAuthed && !hasGreenhouse && (
        <div
          style={{
            marginTop: "18px",
            border: "1px solid #e3e7ee",
            borderRadius: "16px",
            padding: "17px 19px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
              Profile answers
            </div>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                letterSpacing: ".4px",
                textTransform: "uppercase",
                color: "#5b6472",
                background: "#f2f4f8",
                border: "1px solid #e7eaf0",
                borderRadius: "6px",
                padding: "3px 8px",
              }}
            >
              Generic
            </span>
            <div style={{ flex: 1 }} />
            <a
              href="/profile"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#3b6fd4",
                textDecoration: "none",
              }}
            >
              Edit →
            </a>
          </div>

          {answerRows.length === 0 ? (
            <div
              style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "10px", fontWeight: 500 }}
            >
              No saved answers yet —{" "}
              <a href="/profile" style={{ color: "#3b6fd4", textDecoration: "underline" }}>
                add your application details
              </a>{" "}
              to copy them in one click per role.
            </div>
          ) : (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {answerRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "#f7f9fc",
                    border: "1px solid #eef1f5",
                    borderRadius: "10px",
                    padding: "9px 12px",
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 150px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#6b7480",
                    }}
                  >
                    {row.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#2f3845",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.value}
                  </div>
                  <button
                    onClick={() => flashCopied(row.key, row.value)}
                    style={{
                      flex: "0 0 auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 700,
                      fontSize: "12px",
                      color: copiedKey === row.key ? "#2f7d54" : "#5b6472",
                      background: "#fff",
                      border: "1px solid #dfe3ea",
                      borderRadius: "8px",
                      padding: "6px 11px",
                      cursor: "pointer",
                    }}
                  >
                    <span aria-live="polite">{copiedKey === row.key ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { composeCoverLetterText };
