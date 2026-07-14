"use client";
import React from "react";
import type { JobRow } from "@/lib/types";
import { fitColor, initialsOf, fmtPay } from "@/lib/rolefit/fit";
import { displayEnumLabel } from "@/lib/rolefit/taxonomy";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/Action";

// Palette from the reference design's getBaseJobs() logoBg array
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

export interface JobCardProps {
  job: JobRow;
  selected: boolean;
  onSelect: (id: string) => void;
  // Hover/focus-revealed reject × on the card (#14). Absent → no × is rendered.
  onReject?: (id: string) => void;
}

export const JobCard = React.memo(function JobCard({ job, selected, onSelect, onReject }: JobCardProps) {
  // A null fit_score means "not yet reviewed" — same gate JobDetail uses (`hasReview`).
  // fitColor(0) bottoms out at the red end of its red→green scale, so an unscored card
  // would read as a misleading RED. Instead give it the SAME neutral-grey treatment as
  // JobDetail's "Not yet reviewed" card (var(--bg-muted) fill / var(--border) edge /
  // var(--text-secondary) text); scored cards keep the fitColor tint exactly as before.
  const hasReview = job.fit_score != null;
  const c = fitColor(job.fit_score ?? 0);
  const initials = initialsOf(job.company_name);
  const payLabel = fmtPay(job);
  // "unknown" is a real taxonomy value (lib/rolefit/taxonomy.ts) — displayEnumLabel hides
  // it (returns null → chip omitted, the render guards on truthiness) and Title-Cases the
  // rest. Shared with JobDetail's arrangement + seniority so the treatments can't drift.
  const remoteLabel = displayEnumLabel(
    job.work_arrangement ?? (job.remote === true ? "remote" : null));
  const companyLine = [job.company_name, job.location].filter(Boolean).join(" · ");
  const logoBg = logoColor(job.company_name);

  return (
    <div className="rf-job-card" data-selected={selected || undefined}>
      <button
        type="button"
        onClick={() => onSelect(job.id)}
        aria-pressed={selected}
        data-selected={selected || undefined}
        className="rf-job-card__button rf-focusable"
        style={{
          background: hasReview ? "var(--bg-surface)" : "var(--bg-muted)",
          borderColor: selected ? "var(--accent)" : "var(--border)",
        }}
      >
        {/* Accent bar */}
        <div
          className="rf-job-card__score-rail"
          style={{
            background: hasReview ? c.strong : "var(--border-strong)",
          }}
        />
        {/* Logo */}
        <div
          className="rf-job-card__logo"
          style={{
            background: logoBg,
          }}
        >
          {initials}
        </div>
        {/* Content */}
        <div className="rf-job-card__content">
          <div className="rf-job-card__heading">
            <div
              className="rf-job-card__title"
            >
              {job.title}
            </div>
            <div
              className="rf-job-card__score"
              aria-label={hasReview ? `${job.fit_score}% fit` : "Not yet reviewed"}
              style={{
                background: hasReview ? c.strong : "var(--bg-surface)",
                color: hasReview ? c.textOn : "var(--text-secondary)",
              }}
            >
              {job.fit_score ?? "—"}
            </div>
          </div>
          <div
            className="rf-job-card__meta"
          >
            {companyLine}
          </div>
          <div className="rf-job-card__chips">
            {payLabel && <Chip>{payLabel}</Chip>}
            {remoteLabel && <Chip>{remoteLabel}</Chip>}
            {job.role_category && <Chip>{job.role_category}</Chip>}
          </div>
        </div>
      </button>
      {onReject && (
        <IconButton
          label={`Reject ${job.title}`}
          icon="close"
          tone="danger"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onReject(job.id);
          }}
          className="rf-card-reject rf-job-card__reject"
        />
      )}
    </div>
  );
});
