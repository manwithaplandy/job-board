"use client";

import { useEffect, useRef, useState } from "react";
import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { mergeGreenhouseQuestions } from "@/lib/rolefit/greenhouseAnswers";
import { hasCoverLetterQuestion } from "@/lib/rolefit/coverLetterQuestion";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { atsLabel as atsLabelOf } from "@/lib/rolefit/ats";
import { ResumePanel, legacyCopy } from "./ResumePanel";
import { CoverLetterEditor } from "./CoverLetterEditor";
import { GenerationInstructions } from "./GenerationInstructions";
import { downloadPdf } from "@/lib/rolefit/downloadPdf";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
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
  // Per-job generation instructions (ride the next generate/regenerate/prepare request).
  resumeInstructions: string;
  onResumeInstructionsChange: (v: string) => void;
  coverInstructions: string;
  onCoverInstructionsChange: (v: string) => void;
  // Save the instruction draft (persists independently of generating) + applied-status.
  resumeInstructionsDirty: boolean;
  resumeInstructionsApplied: "none" | "applied" | "pending";
  onSaveResumeInstructions: () => Promise<void>;
  coverInstructionsDirty: boolean;
  coverInstructionsApplied: "none" | "applied" | "pending";
  onSaveCoverInstructions: () => Promise<void>;
  // Cover letter (state owned by the board, keyed by job id)
  coverState: string | undefined;
  coverData: TailoredCoverLetter | undefined;
  coverError?: string;
  onGenerateCover: () => void;
  onRegenerateCover: () => void;
  // Human edit overlay (Phase: editable cover letters). Non-null = a CURRENT
  // (non-superseded) edit that displays/downloads over the structured original.
  coverEditedText: string | null;
  onCoverEditSaved: (jobId: string, text: string) => void;
  onCoverEditReset: (jobId: string) => void;
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
  resumeInstructions,
  onResumeInstructionsChange,
  coverInstructions,
  onCoverInstructionsChange,
  resumeInstructionsDirty,
  resumeInstructionsApplied,
  onSaveResumeInstructions,
  coverInstructionsDirty,
  coverInstructionsApplied,
  onSaveCoverInstructions,
  coverState,
  coverData,
  coverError,
  onGenerateCover,
  onRegenerateCover,
  coverEditedText,
  onCoverEditSaved,
  onCoverEditReset,
  onPrepare,
  generating,
  onCancelGeneration,
  prepareStatus,
  greenhouseQuestions,
  prefilledAnswers,
  status,
  appliedAt,
}: ApplicationPanelProps) {
  // Ephemeral "Copied!" feedback for the cover letter + per-field answers.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Application-questions panel is collapsed by default — Apply stays the top CTA, the
  // questions are a reference the operator opens on demand.
  const [questionsOpen, setQuestionsOpen] = useState(false);
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
  // Does this posting ask for a cover letter? Same detection the prepare route uses
  // (the `cover_letter` field name, not just the label) — so a cover-letter-only,
  // file-field posting (no text-answerable rows) still flags in the summary.
  const coverRequested = hasCoverLetterQuestion(greenhouseQuestions);
  const appliedDate = appliedAt ? new Date(appliedAt).toLocaleDateString() : null;

  // Cover-letter PDF download — shared helper handles the import + .txt fallback.
  const handleCoverDownload = async () => {
    if (!coverData && !coverEditedText) return;
    const fname = `Cover Letter - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
    const text = coverEditedText ?? composeCoverLetterText(coverData!);
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
        if (coverEditedText) {
          // Edited letters are plain text: render line-by-line, blank lines as spacing.
          coverEditedText.split("\n").forEach((line) => {
            if (line.trim() === "") { y += 10; return; }
            writeBlock(line);
          });
        } else {
          writeBlock(coverData!.greeting);
          y += 8;
          coverData!.paragraphs.forEach((p) => { writeBlock(p); y += 10; });
          writeBlock(coverData!.closing);
          writeBlock(coverData!.signature);
        }
      },
      text,
    );
  };

  // The external Apply link must be an <a>, so it can't be a <Button>; instead it mirrors
  // <Button>'s primary md tokens. Apply is the panel's primary CTA at ALL times —
  // supersedes #10's prepared-based swap, whose pre-prepare surface/outline state left
  // Apply near-invisible in dark mode while the accent Prepare button pulled the eye.
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
    background: "var(--accent)",
    color: "var(--text-on-accent)",
    border: "none",
    boxShadow: "var(--shadow-accent)",
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
        className="rf-generation-panel"
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
            {job.ats === "greenhouse"
              ? "Tailored résumé, prefilled answers, and — when this posting asks — a cover letter."
              : `Tailored résumé and cover letter — ready for ${job.company_name}.`}
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
            <Icon name="check" size={16} /> Applied{appliedDate ? ` · ${appliedDate}` : ""}
          </Chip>
        )}
        {isAuthed && job.ats === "greenhouse" && (
          <Button
            // Secondary whenever the Apply link renders (Apply owns primary emphasis);
            // leads only for jobs with no usable apply url.
            variant={applyHref || prepared ? "secondary" : "primary"}
            onClick={onPrepare}
            disabled={preparing || generating}
            style={{ flex: "0 0 auto" }}
          >
            <Icon name="sparkle" size={16} />
            {preparing ? "Prefilling… ~60s" : prepared ? "Re-prefill" : "Prefill application"}
          </Button>
        )}
        {applyHref && (
          <a
            href={applyHref}
            data-ui-contract-composite="external ATS application action"
            target="_blank"
            rel="noopener noreferrer"
            style={applyLinkStyle}
          >
            Apply on {atsLabel}<Icon name="arrow-right" size={16} />
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
            Some parts couldn&apos;t be prefilled
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {failedLegs.map((leg) => (
              <Button
                key={leg.key}
                type="button"
                variant="outline"
                size="compact"
                onClick={leg.onRetry}
                disabled={generating}
              >
                Retry {leg.label}
              </Button>
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
        instructions={resumeInstructions}
        onInstructionsChange={onResumeInstructionsChange}
        onSaveInstructions={onSaveResumeInstructions}
        instructionsDirty={resumeInstructionsDirty}
        instructionsApplied={resumeInstructionsApplied}
        generating={generating}
        onCancelGeneration={onCancelGeneration}
      />

      {/* ── Cover letter ── */}
      <Panel className="rf-generation-panel" style={{ marginTop: "18px", padding: 0, overflow: "hidden" }}>
        {/* Idle (authed) */}
        {isAuthed && coverIdle && (
          <div
            className="rf-generation-panel__row"
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
              <GenerationInstructions
                value={coverInstructions}
                onChange={onCoverInstructionsChange}
                kind="cover letter"
                onSave={onSaveCoverInstructions}
                dirty={coverInstructionsDirty}
                appliedState={coverInstructionsApplied}
              />
            </div>
            <Button variant="primary" onClick={onGenerateCover} disabled={generating} style={{ flex: "0 0 auto" }}>
              <Icon name="sparkle" size={16} />Generate cover letter
            </Button>
          </div>
        )}

        {/* Anon: sign-in nudge */}
        {!isAuthed && coverIdle && (
          <div
            className="rf-generation-panel__row"
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
              data-ui-contract-composite="application sign-in action"
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
              <Button type="button" variant="outline" size="sm" onClick={onCancelGeneration}>
                Cancel
              </Button>
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
                <Icon name="check" size={16} />
              </span>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text-primary)" }}>
                Cover letter ready — tailored to {job.company_name}
              </div>
              {coverEditedText && (
                <Chip
                  color="var(--accent)"
                  bg="var(--accent-bg)"
                  border="var(--accent-border)"
                  style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "3px 8px" }}
                >
                  Edited
                </Chip>
              )}
            </div>
            {coverEditedText ? (
              <div
                style={{
                  marginTop: "12px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "15px 16px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  fontSize: "13px",
                  lineHeight: 1.62,
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  whiteSpace: "pre-wrap",
                }}
              >
                {coverEditedText}
              </div>
            ) : (
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
            )}
            <div className="rf-generation-actions" style={{ display: "flex", gap: "10px", marginTop: "13px" }}>
              {/* One-off small accent glow (unique geometry 0 3px 10px .26; no shared token —
                  --shadow-accent/-sm differ in geometry). Reads bright-blue on dark; a
                  dark-mode softening is deferred to the later visual pass. */}
              <Button variant="primary" size="sm" onClick={handleCoverDownload} style={{ boxShadow: "var(--shadow-accent-md)" }}>
                <Icon name="download" size={16} />Download PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => flashCopied("cover", coverEditedText ?? composeCoverLetterText(coverData))}
              >
                <Icon name="copy" size={16} />
                <span aria-live="polite">{copiedKey === "cover" ? "Copied!" : "Copy text"}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRegenerateCover}
                disabled={generating}
              >
                <Icon name="refresh" size={16} />Regenerate
              </Button>
            </div>
            <GenerationInstructions
              value={coverInstructions}
              onChange={onCoverInstructionsChange}
              kind="cover letter"
              onSave={onSaveCoverInstructions}
              dirty={coverInstructionsDirty}
              appliedState={coverInstructionsApplied}
            />
            <CoverLetterEditor
              job={job}
              letterText={coverEditedText ?? composeCoverLetterText(coverData)}
              hasEdit={Boolean(coverEditedText)}
              isAuthed={isAuthed}
              onSaved={onCoverEditSaved}
              onReset={onCoverEditReset}
            />
          </div>
        )}

        {/* Error */}
        {coverError_ && (
          <div
            className="rf-generation-panel__row"
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
      {isAuthed && (hasGreenhouse || coverRequested) && (
        <Panel className="rf-generation-panel" style={{ marginTop: "18px", padding: "17px 19px" }}>
          {/* Collapsed by default: a header/toggle carrying the question count + a
              "cover letter requested" flag. Apply stays the top CTA; the operator opens
              the questions on demand. */}
          <Button
            type="button"
            variant="ghost"
            className="rf-generation-panel__disclosure"
            onClick={() => setQuestionsOpen((v) => !v)}
            aria-expanded={questionsOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textAlign: "left",
            }}
          >
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
              {[
                ghRows.length > 0 ? `${ghRows.length} question${ghRows.length === 1 ? "" : "s"}` : null,
                coverRequested ? "cover letter requested" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              {ghRows.length > 0 ? ` · ${questionsOpen ? "Hide" : "Show"}` : ""}
            </div>
          </Button>

          {/* Only the text-answerable questions expand; a cover-letter-only posting has an
              empty ghRows, so the panel is just the summary flag. */}
          {questionsOpen && ghRows.length > 0 && (
            <>
              <div
                style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "12px", fontWeight: 500 }}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="compact"
                      onClick={() => flashCopied(row.key, row.answer as string)}
                      style={{ color: copiedKey === row.key ? "var(--success)" : undefined }}
                    >
                      <span aria-live="polite">{copiedKey === row.key ? "Copied!" : "Copy"}</span>
                    </Button>
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
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
