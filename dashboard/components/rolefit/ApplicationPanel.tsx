"use client";

import { useEffect, useRef, useState } from "react";
import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { mergeGreenhouseQuestions } from "@/lib/rolefit/greenhouseAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { atsLabel as atsLabelOf } from "@/lib/rolefit/ats";
import { ResumePanel, legacyCopy } from "./ResumePanel";
import { downloadPdf } from "@/lib/rolefit/downloadPdf";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Chip } from "@/components/ui/Chip";
import type { PrepareLegStatus } from "./RolefitBoard";

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

export interface ApplicationPanelProps {
  job: JobRow;
  isAuthed: boolean;
  // Résumé (state owned by the board, keyed by job id)
  resumeState: string | undefined;
  resumeData: TailoredResume | undefined;
  resumeError?: string;
  resumeStale: boolean;
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
  // Single generation lock for this job (résumé/cover/prepare) + cancel + last per-leg result.
  generating?: boolean;
  onCancelGeneration?: () => void;
  prepareStatus?: PrepareLegStatus | null;
  // Persisted package extras (Phase 3). Greenhouse postings carry the real question
  // schema + LLM-prefilled answers; everything else falls back to the generic package.
  greenhouseQuestions: GreenhouseQuestions | null;
  prefilledAnswers: PrefilledAnswer[] | null;
  status: "prepared" | "applied" | null;
  appliedAt: string | null;
  onMarkApplied: () => void;
  // Session-rejected: "Mark as applied" is withheld so one click can't create the invalid
  // applied+rejected state the board's reject gating guards against (un-reject first).
  isRejected?: boolean;
}

export function ApplicationPanel({
  job,
  isAuthed,
  resumeState,
  resumeData,
  resumeError,
  resumeStale,
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
  generating,
  onCancelGeneration,
  prepareStatus,
  greenhouseQuestions,
  prefilledAnswers,
  status,
  appliedAt,
  onMarkApplied,
  isRejected,
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
  const atsLabel = atsLabelOf(job.ats);

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

  const cancelBtnStyle: React.CSSProperties = {
    flex: "0 0 auto",
    fontWeight: 700,
    fontSize: "12.5px",
    color: "var(--text-secondary)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "9px",
    padding: "8px 14px",
    cursor: "pointer",
  };

  // The external Apply link must be an <a>, so it can't be a <Button>; instead it mirrors
  // <Button>'s md tokens (primary/secondary). Prepare leads as the primary CTA until the
  // package is prepared; then Apply takes primary emphasis and Prepare drops to secondary (#10).
  const applyLinkStyle: React.CSSProperties = {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: "14px",
    borderRadius: "11px",
    padding: "12px 20px",
    cursor: "pointer",
    textDecoration: "none",
    ...(prepared
      ? { background: "var(--accent)", color: "var(--text-on-accent)", border: "none", boxShadow: "var(--shadow-accent)" }
      : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }),
  };

  // Per-leg failures from the last prepare. Résumé + cover retry their own endpoints;
  // there's no answers-only route, so "answers" retries the whole prepare.
  const failedLegs: { key: string; label: string; onRetry: () => void }[] = [];
  if (prepareStatus) {
    if (prepareStatus.resume === "failed") failedLegs.push({ key: "resume", label: "résumé", onRetry: onGenerateResume });
    if (prepareStatus.coverLetter === "failed") failedLegs.push({ key: "coverLetter", label: "cover letter", onRetry: onGenerateCover });
    if (prepareStatus.answers === "failed") failedLegs.push({ key: "answers", label: "application answers", onRetry: onPrepare });
  }

  return (
    <div style={{ marginTop: "24px" }}>
      {/* ── Header: title + prepare + apply ── */}
      <Panel
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          padding: "17px 19px",
          background: "var(--bg-muted)",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
            Application
          </div>
          <div
            style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
          >
            Tailored résumé and cover letter — ready for {job.company_name}.
          </div>
        </div>
        {applied && (
          <Chip
            color="var(--success)"
            bg="var(--success-bg)"
            border="var(--success-border)"
            style={{
              flex: "0 0 auto",
              gap: "7px",
              fontWeight: 700,
              fontSize: "12.5px",
              borderRadius: "20px",
              padding: "7px 14px",
            }}
          >
            ✓ Applied{appliedDate ? ` · ${appliedDate}` : ""}
          </Chip>
        )}
        {isAuthed && !applied && !isRejected && (
          <button
            onClick={onMarkApplied}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontWeight: 700,
              fontSize: "13.5px",
              color: "var(--success)",
              background: "var(--bg-surface)",
              border: "1px solid var(--success-border)",
              borderRadius: "11px",
              padding: "12px 16px",
              cursor: "pointer",
            }}
          >
            ✓ Mark as applied
          </button>
        )}
        {isAuthed && (
          <Button
            variant={prepared ? "secondary" : "primary"}
            onClick={onPrepare}
            disabled={preparing || generating}
            style={{ flex: "0 0 auto" }}
          >
            <span style={{ fontSize: "15px" }}>✦</span>
            {preparing ? "Preparing… ~30s" : prepared ? "Re-prepare" : "Prepare application"}
          </Button>
        )}
        {applyHref && (
          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer"
            style={applyLinkStyle}
          >
            Apply on {atsLabel}<span style={{ fontSize: "15px" }}>→</span>
          </a>
        )}
      </Panel>

      {/* Per-leg prepare failures — retry only the parts that failed (résumé / cover hit
          their own endpoints; answers re-runs Prepare, as there's no answers-only route). */}
      {failedLegs.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "12px",
            padding: "13px 15px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--danger)" }}>
            Some parts couldn&apos;t be prepared
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {failedLegs.map((leg) => (
              <button
                key={leg.key}
                type="button"
                onClick={leg.onRetry}
                disabled={generating}
                style={{
                  fontWeight: 700,
                  fontSize: "12.5px",
                  color: "var(--danger)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "9px",
                  padding: "7px 13px",
                  cursor: generating ? "not-allowed" : "pointer",
                  opacity: generating ? 0.6 : 1,
                }}
              >
                Retry {leg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tailored résumé (reused ResumePanel) ── */}
      <ResumePanel
        job={job}
        isAuthed={isAuthed}
        state={resumeState}
        data={resumeData}
        error={resumeError}
        stale={resumeStale}
        onGenerate={onGenerateResume}
        onRegenerate={onRegenerateResume}
        onCopy={onCopyResume}
        copyLabel={resumeCopyLabel}
        usingSample={usingSample}
        onOpenProfile={onOpenProfile}
        generating={generating}
        onCancelGeneration={onCancelGeneration}
      />

      {/* ── Cover letter ── */}
      <Panel style={{ marginTop: "18px", padding: 0, overflow: "hidden" }}>
        {/* Idle (authed) */}
        {isAuthed && coverIdle && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "17px 19px",
              background: "var(--bg-muted)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
                Cover letter
              </div>
              <div
                style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
              >
                A focused letter that ties your background to this role.
              </div>
            </div>
            <Button variant="primary" onClick={onGenerateCover} disabled={generating} style={{ flex: "0 0 auto" }}>
              <span style={{ fontSize: "15px" }}>✦</span>Generate cover letter
            </Button>
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
              background: "var(--bg-muted)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
                Cover letter
              </div>
              <div
                style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
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
                color: "var(--text-on-accent)",
                background: "var(--accent)",
                border: "none",
                borderRadius: "11px",
                padding: "12px 20px",
                cursor: "pointer",
                textDecoration: "none",
                boxShadow: "var(--shadow-accent)",
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
              background: "var(--bg-muted)",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                border: "3px solid var(--accent-border)",
                borderTopColor: "var(--accent)",
                animation: "rf-spin .8s linear infinite",
                flex: "0 0 auto",
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text-primary)" }}>
                Drafting your cover letter for {job.company_name}…
              </div>
              <div
                style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
              >
                Connecting your experience to this role&apos;s requirements. Usually about 30 seconds.
              </div>
            </div>
            {onCancelGeneration && (
              <button type="button" onClick={onCancelGeneration} style={cancelBtnStyle}>
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Done */}
        {coverDone && coverData && (
          <div style={{ padding: "17px 19px", background: "var(--success-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "6px",
                  background: "var(--success-bg)",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text-primary)" }}>
                Cover letter ready — tailored to {job.company_name}
              </div>
            </div>
            <div
              style={{
                marginTop: "12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "15px 16px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>
                {coverData.greeting}
              </div>
              {coverData.paragraphs.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.62,
                    color: "var(--text-primary)",
                    margin: "11px 0 0",
                    fontWeight: 500,
                  }}
                >
                  {p}
                </p>
              ))}
              <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500, marginTop: "11px" }}>
                {coverData.closing}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 700, marginTop: "2px" }}>
                {coverData.signature}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "13px" }}>
              {/* One-off small accent glow (unique geometry 0 3px 10px .26; no shared token —
                  --shadow-accent/-sm differ in geometry). Reads bright-blue on dark; a
                  dark-mode softening is deferred to the later visual pass. */}
              <Button variant="primary" size="sm" onClick={handleCoverDownload} style={{ boxShadow: "0 3px 10px rgba(59,111,212,.26)" }}>
                <span>⤓</span>Download PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => flashCopied("cover", composeCoverLetterText(coverData))}
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
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRegenerateCover}
                disabled={generating}
              >
                <span>↻</span>Regenerate
              </Button>
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
              background: "var(--danger-bg)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--danger)" }}>
                Cover letter failed
              </div>
              {coverError && (
                <div
                  style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
                >
                  {coverError}
                </div>
              )}
            </div>
            <Button variant="primary" onClick={onGenerateCover} disabled={generating} style={{ flex: "0 0 auto" }}>
              Retry
            </Button>
          </div>
        )}
      </Panel>

      {/* ── Greenhouse application questions (this posting's real form) ── */}
      {isAuthed && hasGreenhouse && (
        <Panel style={{ marginTop: "18px", padding: "17px 19px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
              Application questions
            </div>
            <Chip
              color="var(--success)"
              bg="var(--success-bg)"
              border="var(--success-border)"
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                letterSpacing: ".4px",
                textTransform: "uppercase",
                borderRadius: "6px",
                padding: "3px 8px",
              }}
            >
              Greenhouse
            </Chip>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
              Pulled from this posting
            </div>
          </div>

          <div
            style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "6px", fontWeight: 500 }}
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
                  background: "var(--bg-muted)",
                  border: "1px solid var(--bg-muted)",
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
                      color: "var(--text-primary)",
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
                        color: "var(--warning)",
                        background: "var(--warning-bg)",
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
                        color: copiedKey === row.key ? "var(--success)" : "var(--text-secondary)",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
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
                      color: "var(--text-primary)",
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
                      color: "var(--warning)",
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
        </Panel>
      )}
    </div>
  );
}
