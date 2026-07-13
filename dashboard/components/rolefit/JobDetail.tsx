"use client";

import { useState } from "react";
import type { ApplicationPackage, JobReviewDetail, JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrepareLegStatus } from "./RolefitBoard";
import { fitColor, initialsOf, fmtPay, fmtPosted } from "@/lib/rolefit/fit";
import { displayEnumLabel } from "@/lib/rolefit/taxonomy";
import { applyUrl as normalizeApplyUrl } from "@/lib/rolefit/applyUrl";
import { ApplicationPanel } from "./ApplicationPanel";
import { ReviewPanel } from "./ReviewPanel";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

// Generic "Apply" link → the job's ATS posting. Opens a new tab; rel guards the
// opener. Now only the fallback for not-yet-reviewed roles (which have no
// Application panel); reviewed roles apply via "Apply on {provider}" in the panel.
function ApplyButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontWeight: 700,
        fontSize: "13px",
        color: "var(--text-on-accent)",
        background: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "9px",
        padding: "8px 18px",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      Apply
      <span aria-hidden="true">↗</span>
    </a>
  );
}

// Palette from reference getBaseJobs() — same as JobCard
const LOGO_COLORS = [
  "var(--logo-1)", "var(--logo-2)", "var(--logo-3)", "var(--logo-4)", "var(--logo-5)",
  "var(--logo-6)", "var(--logo-7)", "var(--logo-8)", "var(--logo-9)", "var(--logo-10)",
  "var(--logo-11)", "var(--logo-12)", "var(--logo-13)", "var(--logo-14)", "var(--logo-15)", "var(--logo-16)",
];

function logoColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) >>> 0;
  return LOGO_COLORS[h % LOGO_COLORS.length];
}

export interface JobDetailProps {
  job: JobRow;
  nowIso: string;
  isAuthed: boolean;
  gen: Record<string, string>;
  genData: Record<string, TailoredResume>;
  genError: Record<string, string>;
  onGenerate: (job: JobRow) => void;
  onCopy: (job: JobRow, data: TailoredResume) => void;
  copiedId: string | null;
  // Cover letter (state keyed by job id, owned by the board)
  coverGen: Record<string, string>;
  coverData: Record<string, TailoredCoverLetter>;
  coverError: Record<string, string>;
  onGenerateCover: (job: JobRow) => void;
  // Per-job generation instructions (maps keyed by job id, owned by the board) — the value
  // rides the next generate/regenerate/prepare request.
  resumeInstructions: Record<string, string>;
  coverInstructions: Record<string, string>;
  onResumeInstructionsChange: (jobId: string, v: string) => void;
  onCoverInstructionsChange: (jobId: string, v: string) => void;
  // The persisted saved-draft values the boxes would reload to (drive Save "dirty"), plus
  // the per-leg Save handlers. Keyed by job id, owned by the board.
  savedResumeInstructions: Record<string, string>;
  savedCoverInstructions: Record<string, string>;
  onSaveResumeInstructions: (jobId: string) => Promise<void>;
  onSaveCoverInstructions: (jobId: string) => Promise<void>;
  // Human cover-letter edits (current/non-superseded only), keyed by job id, owned by the board.
  coverEdited: Record<string, string>;
  onCoverEditSaved: (jobId: string, text: string) => void;
  onCoverEditReset: (jobId: string) => void;
  onPrepare: (job: JobRow) => void;
  // Single generation lock for this job (résumé/cover/prepare share one slot) + cancel.
  generating?: boolean;
  onCancelGeneration?: () => void;
  // Per-leg result of the last prepare — failed legs get an inline retry.
  prepareStatus?: PrepareLegStatus | null;
  // Job-level Greenhouse question schema (shared job_questions table). Static server
  // data forwarded to the application panel; per-user prefilled answers ride the package.
  greenhouseQuestions: GreenhouseQuestions | null;
  // Persisted package for the selected job (Phase 3) — undefined until prepared.
  pkg?: ApplicationPackage;
  // True when the shown tailored résumé was generated from an older profile_version.
  resumeStale: boolean;
  onMarkApplied: (job: JobRow) => void;
  onOpenProfile: () => void;
  onReject?: (job: JobRow) => void;
  onUnapply?: (job: JobRow) => void;
  // Session-rejected (hidden from the default board); the Rejected view surfaces an un-reject.
  isRejected?: boolean;
  onUnreject?: (job: JobRow) => void;
  onCorrected?: (jobId: string, form: CorrectionForm) => void;
  // Signalled true while the inline correction editor is open (mirrors ReviewPanel's local
  // `editing`); the board suppresses global keyboard nav so it can't remount this pane and
  // discard the unsaved correction.
  onCorrectionEditingChange?: (editing: boolean) => void;
  detailState?: { status: "loading" } | { status: "error" } | { status: "done"; detail: JobReviewDetail } | undefined;
  onRetryDetail?: () => void;
}

export function JobDetail({
  job,
  nowIso,
  isAuthed,
  gen,
  genData,
  genError,
  onGenerate,
  onCopy,
  copiedId,
  coverGen,
  coverData,
  coverError,
  onGenerateCover,
  resumeInstructions,
  coverInstructions,
  onResumeInstructionsChange,
  onCoverInstructionsChange,
  savedResumeInstructions,
  savedCoverInstructions,
  onSaveResumeInstructions,
  onSaveCoverInstructions,
  coverEdited,
  onCoverEditSaved,
  onCoverEditReset,
  onPrepare,
  generating,
  onCancelGeneration,
  prepareStatus,
  greenhouseQuestions,
  pkg,
  resumeStale,
  onMarkApplied,
  onOpenProfile,
  onReject,
  onUnapply,
  isRejected,
  onUnreject,
  onCorrected,
  onCorrectionEditingChange,
  detailState,
  onRetryDetail,
}: JobDetailProps) {
  const hasReview = job.fit_score != null;
  const applied = pkg?.status === "applied";
  const fit = job.fit_score ?? 0;
  const c = fitColor(fit);
  const CIRC = 2 * Math.PI * 34;
  const ringOffset = CIRC * (1 - fit / 100);

  const logoBg = logoColor(job.company_name);
  const initials = initialsOf(job.company_name);
  const payLabel = fmtPay(job);
  const rawArrangement = job.work_arrangement;
  // displayEnumLabel hides the literal "unknown" taxonomy value and Title-Cases the rest,
  // matching JobCard (and the seniority pill below) so the treatments can't drift.
  const arrangement = displayEnumLabel(rawArrangement);
  const seniorityLabel = displayEnumLabel(job.seniority);
  const metaLine = [job.company_name, job.location, arrangement]
    .filter(Boolean)
    .join(" · ");
  const postedText = "Posted " + fmtPosted(job.first_seen_at, nowIso);

  // Per-job gen state
  const genState = gen[job.id];
  const gd = genData[job.id];
  const genErrorMsg = genError[job.id];
  const copyLabel = copiedId === job.id ? "Copied!" : "Copy text";

  // Per-job cover-letter state
  const coverState = coverGen[job.id];
  const coverGd = coverData[job.id];
  const coverErrorMsg = coverError[job.id];

  // Requirements
  const reqs = job.requirements ?? [];

  const benefits = job.benefits ?? [];

  // Apply link + full JD — both arrive on the lazy /api/jobs/[id] fetch, so they
  // pop in a beat after open (like the other detail-only fields). Collapsed by
  // default; toggle resets per job via key={job.id} on this component.
  const applyUrl = normalizeApplyUrl(job.ats, job.url);
  const fullJD = job.description;
  const [showJD, setShowJD] = useState(false);

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto", padding: "30px 36px 70px" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", gap: "18px", alignItems: "flex-start" }}>
        {/* Logo */}
        <div
          style={{
            flex: "0 0 54px",
            height: "54px",
            borderRadius: "13px",
            background: logoBg,
            color: "var(--text-on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "20px",
            letterSpacing: ".4px",
          }}
        >
          {initials}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "-.4px",
              color: "var(--text-primary)",
              lineHeight: 1.15,
            }}
          >
            {job.title}
          </h1>
          <div
            style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "5px", fontWeight: 600 }}
          >
            {metaLine}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "13px" }}>
            {job.role_category && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {job.role_category}
              </span>
            )}
            {seniorityLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {seniorityLabel}
              </span>
            )}
            {job.headcount && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {job.headcount} people
              </span>
            )}
            {payLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {payLabel}
              </span>
            )}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                borderRadius: "7px",
                padding: "4px 2px",
              }}
            >
              {postedText}
            </span>
          </div>
        </div>

        {/* Fit ring — only when reviewed */}
        {hasReview && (
          <div
            style={{
              flex: "0 0 auto",
              position: "relative",
              width: "88px",
              height: "88px",
            }}
          >
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="34" fill="none" stroke="var(--bg-muted)" strokeWidth="9" />
              <circle
                cx="44"
                cy="44"
                r="34"
                fill="none"
                stroke={c.strong}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRC.toFixed(1)}
                strokeDashoffset={ringOffset.toFixed(1)}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: "23px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {job.fit_score ?? "—"}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: "var(--text-secondary)",
                  marginTop: "3px",
                }}
              >
                FIT
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action row — Apply + operator controls (reviewed jobs only) ── */}
      {hasReview && (job.human_override || isRejected || applied || (isAuthed && job.verdict === "approve")) && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
            marginTop: "16px",
          }}
        >
          {(job.human_override || isRejected) && (
            <Chip
              color="var(--danger)"
              bg="var(--danger-bg)"
              border="var(--danger-border)"
              style={{ fontSize: "11.5px", fontWeight: 700, borderRadius: "20px", padding: "4px 11px" }}
            >
              Rejected · you
            </Chip>
          )}
          {isAuthed && isRejected && onUnreject && (
            <Button
              variant="secondary"
              onClick={() => onUnreject(job)}
              style={{
                fontSize: "12.5px",
                color: "var(--success)",
                border: "1px solid var(--success-border)",
                borderRadius: "9px",
                padding: "7px 16px",
              }}
            >
              Un-reject
            </Button>
          )}
          {applied && (
            <Chip
              color="var(--success)"
              bg="var(--success-bg)"
              border="var(--success-border)"
              style={{ gap: "8px", fontSize: "11.5px", fontWeight: 700, borderRadius: "20px", padding: "4px 11px" }}
            >
              <Icon name="check" size={16} /> Applied · you
              {onUnapply && (
                <Button
                  variant="ghost"
                  onClick={() => onUnapply(job)}
                  style={{
                    fontWeight: 800,
                    fontSize: "11px",
                    color: "var(--success)",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Undo
                </Button>
              )}
            </Chip>
          )}
          {isAuthed && job.verdict === "approve" && !applied && !isRejected && (
            <Button
              variant="secondary"
              onClick={() => onReject?.(job)}
              style={{
                fontSize: "12.5px",
                color: "var(--danger)",
                border: "1px solid var(--danger-border)",
                borderRadius: "9px",
                padding: "7px 16px",
              }}
            >
              Reject
            </Button>
          )}
          {/* Withheld while session-rejected so one click can't create the invalid
              applied+rejected state the board's reject gating guards against. */}
          {isAuthed && job.verdict === "approve" && !applied && !isRejected && (
            <Button
              variant="secondary"
              onClick={() => onMarkApplied(job)}
              style={{
                fontSize: "12.5px",
                color: "var(--success)",
                border: "1px solid var(--success-border)",
                borderRadius: "9px",
                padding: "7px 16px",
              }}
            >
              <Icon name="check" size={16} /> Mark as applied
            </Button>
          )}
        </div>
      )}

      {/* ── NOT YET REVIEWED branch ── */}
      {!hasReview && (
        <div
          style={{
            marginTop: "24px",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px 20px",
            background: "var(--bg-muted)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
            Not yet reviewed
          </div>
          <div
            style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}
          >
            AI analysis for this role is pending.
          </div>
        </div>
      )}

      {/* ── REVIEWED content ── */}
      {hasReview && (
        <>
          <ReviewPanel job={job} isAuthed={isAuthed} onCorrected={onCorrected} onEditingChange={onCorrectionEditingChange} />

          {/* ── Requirements ── */}
          {reqs.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-.2px",
                }}
              >
                What they&apos;re looking for
              </div>
              <div
                style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "9px" }}
              >
                {reqs.map((req) => (
                  <div key={req.text} style={{ display: "flex", gap: "11px", alignItems: "center" }}>
                    <span
                      style={{
                        flex: "0 0 auto",
                        width: "21px",
                        height: "21px",
                        borderRadius: "6px",
                        background: req.met ? "var(--success-bg)" : "var(--warning-bg)",
                        color: req.met ? "var(--success)" : "var(--warning)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      <Icon name={req.met ? "check" : "warning"} size={16} />
                    </span>
                    <span
                      style={{ fontSize: "13.5px", color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Benefits ── */}
          {benefits.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-.2px",
                }}
              >
                Benefits
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                {benefits.map((b) => (
                  <span
                    key={b}
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--success)",
                      background: "var(--success-bg)",
                      border: "1px solid var(--success-border)",
                      borderRadius: "8px",
                      padding: "5px 11px",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── About ── */}
          {job.about && (
            <div
              style={{ marginTop: "24px", borderTop: "1px solid var(--bg-muted)", paddingTop: "20px" }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-.2px",
                }}
              >
                About {job.company_name}
              </div>
              <p
                style={{
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                  margin: "10px 0 0",
                  fontWeight: 500,
                }}
              >
                {job.about}
              </p>
            </div>
          )}

          {/* Detail-fetch loading shimmer */}
          {detailState?.status === "loading" && (
            <div style={{ marginTop: "24px" }}>
              {[120, 80, 60].map((h, i) => (
                <div key={i} style={{ height: h, background: "var(--bg-muted)", borderRadius: 8, marginTop: 12 }} />
              ))}
            </div>
          )}
          {/* Detail-fetch error */}
          {detailState?.status === "error" && (
            <div style={{ marginTop: "24px", padding: "16px 20px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--danger-bg)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, fontSize: "13.5px", color: "var(--danger)", fontWeight: 600 }}>
                Couldn&apos;t load full job details.
              </div>
              {onRetryDetail && (
                <Button variant="ghost" onClick={onRetryDetail} style={{ fontSize: "13px", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: "9px", padding: "7px 14px" }}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Application panel — résumé + cover letter + apply */}
          <ApplicationPanel
            job={job}
            isAuthed={isAuthed}
            resumeState={genState}
            resumeData={gd}
            resumeError={genErrorMsg}
            resumeStale={resumeStale}
            onGenerateResume={() => onGenerate(job)}
            onRegenerateResume={() => onGenerate(job)}
            onCopyResume={() => { if (gd) onCopy(job, gd); }}
            resumeCopyLabel={copyLabel}
            usingSample={false}
            onOpenProfile={onOpenProfile}
            coverState={coverState}
            coverData={coverGd}
            coverError={coverErrorMsg}
            onGenerateCover={() => onGenerateCover(job)}
            onRegenerateCover={() => onGenerateCover(job)}
            resumeInstructions={resumeInstructions[job.id] ?? ""}
            onResumeInstructionsChange={(v) => onResumeInstructionsChange(job.id, v)}
            coverInstructions={coverInstructions[job.id] ?? ""}
            onCoverInstructionsChange={(v) => onCoverInstructionsChange(job.id, v)}
            resumeInstructionsDirty={(resumeInstructions[job.id] ?? "").trim() !== (savedResumeInstructions[job.id] ?? "").trim()}
            resumeInstructionsApplied={
              genState !== "done" ? "none"
                : (resumeInstructions[job.id] ?? "").trim() === (pkg?.resumeInstructions ?? "").trim() ? "applied" : "pending"
            }
            onSaveResumeInstructions={() => onSaveResumeInstructions(job.id)}
            coverInstructionsDirty={(coverInstructions[job.id] ?? "").trim() !== (savedCoverInstructions[job.id] ?? "").trim()}
            coverInstructionsApplied={
              coverState !== "done" ? "none"
                : (coverInstructions[job.id] ?? "").trim() === (pkg?.coverLetterInstructions ?? "").trim() ? "applied" : "pending"
            }
            onSaveCoverInstructions={() => onSaveCoverInstructions(job.id)}
            coverEditedText={coverEdited[job.id] ?? null}
            onCoverEditSaved={onCoverEditSaved}
            onCoverEditReset={onCoverEditReset}
            onPrepare={() => onPrepare(job)}
            generating={generating}
            onCancelGeneration={onCancelGeneration}
            prepareStatus={prepareStatus}
            greenhouseQuestions={greenhouseQuestions}
            prefilledAnswers={pkg?.prefilledAnswers ?? null}
            status={pkg?.status ?? null}
            appliedAt={pkg?.appliedAt ?? null}
          />

        </>
      )}

      {/* ── Full job description (collapsible) + Apply fallback — the Apply button here
           renders only for not-yet-reviewed roles (which have no Application panel), so an
           unreviewed role is never a dead end. Reviewed roles apply via the panel's
           "Apply on {provider}" button. ── */}
      {(fullJD || (!hasReview && applyUrl)) && (
        <div
          style={{ marginTop: "24px", borderTop: "1px solid var(--bg-muted)", paddingTop: "20px" }}
        >
          {fullJD && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowJD((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "var(--accent)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "9px",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {showJD ? "Hide full job description" : "Show full job description"}
                <Icon name={showJD ? "chevron-up" : "chevron-down"} size={16} />
              </Button>
              {showJD && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                    marginTop: "16px",
                    fontWeight: 500,
                  }}
                >
                  {fullJD}
                </div>
              )}
            </>
          )}
          {!hasReview && applyUrl && (
            <div style={{ marginTop: "18px" }}>
              <ApplyButton url={applyUrl} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
