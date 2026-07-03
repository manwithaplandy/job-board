"use client";

import { useState } from "react";
import type { ApplicationPackage, JobReviewDetail, JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import type { PrepareLegStatus } from "./RolefitBoard";
import { fitColor, initialsOf, fmtPay, fmtPosted } from "@/lib/rolefit/fit";
import { applyUrl as normalizeApplyUrl } from "@/lib/rolefit/applyUrl";
import { ApplicationPanel } from "./ApplicationPanel";
import { ReviewPanel } from "./ReviewPanel";

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
        color: "#fff",
        background: "#3b6fd4",
        border: "1px solid #3b6fd4",
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
  "#3f6695", "#4f8a7e", "#8a6da3", "#a9663f", "#4a7a52",
  "#b08a3e", "#6f88a8", "#9a5b6e", "#586b8c", "#5f8f6a",
  "#9c6a4a", "#5e7e9e", "#8a7d52", "#7a6aa0", "#4f8a86", "#a05f5f",
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
  onPrepare: (job: JobRow) => void;
  // Single generation lock for this job (résumé/cover/prepare share one slot) + cancel.
  generating?: boolean;
  onCancelGeneration?: () => void;
  // Per-leg result of the last prepare — failed legs get an inline retry.
  prepareStatus?: PrepareLegStatus | null;
  // Persisted package for the selected job (Phase 3) — undefined until prepared.
  pkg?: ApplicationPackage;
  onMarkApplied: (job: JobRow) => void;
  onOpenProfile: () => void;
  onReject?: (job: JobRow) => void;
  onUnapply?: (job: JobRow) => void;
  // Session-rejected (hidden from the default board); the Rejected view surfaces an un-reject.
  isRejected?: boolean;
  onUnreject?: (job: JobRow) => void;
  onCorrected?: (jobId: string, form: CorrectionForm) => void;
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
  onPrepare,
  generating,
  onCancelGeneration,
  prepareStatus,
  pkg,
  onMarkApplied,
  onOpenProfile,
  onReject,
  onUnapply,
  isRejected,
  onUnreject,
  onCorrected,
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
  const arrangement = rawArrangement
    ? rawArrangement.charAt(0).toUpperCase() + rawArrangement.slice(1)
    : null;
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
            color: "#fff",
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
              color: "#161d29",
              lineHeight: 1.15,
            }}
          >
            {job.title}
          </h1>
          <div
            style={{ fontSize: "14px", color: "#5b6472", marginTop: "5px", fontWeight: 600 }}
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
                  color: "#414b59",
                  background: "#f2f4f8",
                  border: "1px solid #e7eaf0",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {job.role_category}
              </span>
            )}
            {job.seniority && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#414b59",
                  background: "#f2f4f8",
                  border: "1px solid #e7eaf0",
                  borderRadius: "7px",
                  padding: "4px 10px",
                }}
              >
                {job.seniority}
              </span>
            )}
            {job.headcount && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#414b59",
                  background: "#f2f4f8",
                  border: "1px solid #e7eaf0",
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
                  color: "#414b59",
                  background: "#f2f4f8",
                  border: "1px solid #e7eaf0",
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
                color: "#6b7480",
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
              <circle cx="44" cy="44" r="34" fill="none" stroke="#eef1f5" strokeWidth="9" />
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
                  color: "#161d29",
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
                  color: "#6b7480",
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
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#a05f5f",
                background: "#f8eded",
                border: "1px solid #ecd6d6",
                borderRadius: "20px",
                padding: "4px 11px",
              }}
            >
              Rejected · you
            </span>
          )}
          {isAuthed && isRejected && onUnreject && (
            <button
              type="button"
              onClick={() => onUnreject(job)}
              style={{
                fontWeight: 700,
                fontSize: "12.5px",
                color: "#2f7d54",
                background: "#fff",
                border: "1px solid #cfe6d8",
                borderRadius: "9px",
                padding: "7px 16px",
                cursor: "pointer",
              }}
            >
              Un-reject
            </button>
          )}
          {applied && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#2f7d54",
                background: "#e3f1e9",
                border: "1px solid #cfe6d8",
                borderRadius: "20px",
                padding: "4px 11px",
              }}
            >
              ✓ Applied · you
              {onUnapply && (
                <button
                  type="button"
                  onClick={() => onUnapply(job)}
                  style={{
                    fontWeight: 800,
                    fontSize: "11px",
                    color: "#2f7d54",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Undo
                </button>
              )}
            </span>
          )}
          {isAuthed && job.verdict === "approve" && !applied && !isRejected && (
            <button
              type="button"
              onClick={() => onReject?.(job)}
              style={{
                fontWeight: 700,
                fontSize: "12.5px",
                color: "#a05f5f",
                background: "#fff",
                border: "1px solid #e2c9c9",
                borderRadius: "9px",
                padding: "7px 16px",
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          )}
        </div>
      )}

      {/* ── NOT YET REVIEWED branch ── */}
      {!hasReview && (
        <div
          style={{
            marginTop: "24px",
            border: "1px solid #e3e7ee",
            borderRadius: "16px",
            padding: "24px 20px",
            background: "#f7f9fc",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7480" }}>
            Not yet reviewed
          </div>
          <div
            style={{ fontSize: "13px", color: "#aab2be", marginTop: "6px", fontWeight: 500 }}
          >
            AI analysis for this role is pending.
          </div>
        </div>
      )}

      {/* ── REVIEWED content ── */}
      {hasReview && (
        <>
          <ReviewPanel job={job} isAuthed={isAuthed} onCorrected={onCorrected} />

          {/* ── Requirements ── */}
          {reqs.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#1b2330",
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
                        background: req.met ? "#e3f1e9" : "#f6edda",
                        color: req.met ? "#2f7d54" : "#b07a2e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      {req.met ? "✓" : "△"}
                    </span>
                    <span
                      style={{ fontSize: "13.5px", color: "#2f3845", fontWeight: 500 }}
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
                  color: "#1b2330",
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
                      color: "#3f6b50",
                      background: "#eaf4ee",
                      border: "1px solid #d3e7da",
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
              style={{ marginTop: "24px", borderTop: "1px solid #eef1f5", paddingTop: "20px" }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#1b2330",
                  letterSpacing: "-.2px",
                }}
              >
                About {job.company_name}
              </div>
              <p
                style={{
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  color: "#5b6472",
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
                <div key={i} style={{ height: h, background: "#eef1f5", borderRadius: 8, marginTop: 12 }} />
              ))}
            </div>
          )}
          {/* Detail-fetch error */}
          {detailState?.status === "error" && (
            <div style={{ marginTop: "24px", padding: "16px 20px", border: "1px solid #e3e7ee", borderRadius: "12px", background: "#fdf6f5", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, fontSize: "13.5px", color: "#b25a36", fontWeight: 600 }}>
                Couldn&apos;t load full job details.
              </div>
              {onRetryDetail && (
                <button type="button" onClick={onRetryDetail} style={{ fontWeight: 700, fontSize: "13px", color: "#3b6fd4", background: "#eef3fc", border: "1px solid #d8e2f6", borderRadius: "9px", padding: "7px 14px", cursor: "pointer" }}>
                  Retry
                </button>
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
            onPrepare={() => onPrepare(job)}
            generating={generating}
            onCancelGeneration={onCancelGeneration}
            prepareStatus={prepareStatus}
            greenhouseQuestions={pkg?.greenhouseQuestions ?? null}
            prefilledAnswers={pkg?.prefilledAnswers ?? null}
            status={pkg?.status ?? null}
            appliedAt={pkg?.appliedAt ?? null}
            onMarkApplied={() => onMarkApplied(job)}
          />

        </>
      )}

      {/* ── Full job description (collapsible) + Apply fallback — the Apply button here
           renders only for not-yet-reviewed roles (which have no Application panel), so an
           unreviewed role is never a dead end. Reviewed roles apply via the panel's
           "Apply on {provider}" button. ── */}
      {(fullJD || (!hasReview && applyUrl)) && (
        <div
          style={{ marginTop: "24px", borderTop: "1px solid #eef1f5", paddingTop: "20px" }}
        >
          {fullJD && (
            <>
              <button
                type="button"
                onClick={() => setShowJD((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "#3b6fd4",
                  background: "#fff",
                  border: "1px solid #d7e0f2",
                  borderRadius: "9px",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {showJD ? "Hide full job description" : "Show full job description"}
                <span aria-hidden="true">{showJD ? "▴" : "▾"}</span>
              </button>
              {showJD && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: "#5b6472",
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
