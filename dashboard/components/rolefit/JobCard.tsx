"use client";
import React from "react";
import type { JobRow } from "@/lib/types";
import { fitColor, initialsOf, fmtPay } from "@/lib/rolefit/fit";
import { Chip } from "@/components/ui/Chip";

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
  const c = fitColor(job.fit_score ?? 0);
  const initials = initialsOf(job.company_name);
  const payLabel = fmtPay(job);
  const rawArrangement = job.work_arrangement ?? (job.remote === true ? "remote" : null);
  // "unknown" is a real taxonomy value (lib/rolefit/taxonomy.ts) — don't surface it as a
  // literal "Unknown" pill; omit the chip instead (the render already guards on truthiness).
  const remoteLabel = rawArrangement && rawArrangement !== "unknown"
    ? rawArrangement.charAt(0).toUpperCase() + rawArrangement.slice(1)
    : null;
  const companyLine = [job.company_name, job.location].filter(Boolean).join(" · ");
  const logoBg = logoColor(job.company_name);

  const cardBg = selected ? "var(--bg-surface)" : c.tint;
  const cardBorder = selected ? "2px solid var(--accent)" : `2px solid ${c.tintBorder}`;
  // One-off card elevations (unique geometry, no shared token): a blue selected-state
  // glow and a faint neutral resting shadow. Both read weakly on dark charcoal; a
  // dark-mode deepening is deferred to the later visual pass.
  const cardShadow = selected
    ? "0 8px 22px rgba(59,111,212,.17)"
    : "0 1px 2px rgba(20,28,40,.045)";

  return (
    <div className="rf-card" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => onSelect(job.id)}
        aria-pressed={selected}
        style={{
          position: "relative",
          display: "flex",
          gap: "12px",
          margin: "0 13px 9px",
          padding: "13px 14px 14px 8px",
          borderRadius: "14px",
          cursor: "pointer",
          background: cardBg,
          border: cardBorder,
          boxShadow: cardShadow,
          textAlign: "left",
          width: "calc(100% - 26px)",
          font: "inherit",
          color: "inherit",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "9px",
            bottom: "9px",
            width: "4px",
            borderRadius: "4px",
            background: c.strong,
          }}
        />
        {/* Logo */}
        <div
          style={{
            flex: "0 0 40px",
            height: "40px",
            borderRadius: "10px",
            background: logoBg,
            color: "var(--text-on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "14px",
            letterSpacing: ".3px",
            marginLeft: "6px",
          }}
        >
          {initials}
        </div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "14.5px",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
              }}
            >
              {job.title}
            </div>
            <div
              style={{
                flex: "0 0 auto",
                fontWeight: 800,
                fontSize: "11.5px",
                padding: "3px 9px",
                borderRadius: "20px",
                background: c.strong,
                color: c.textOn,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {job.fit_score ?? "—"}
            </div>
          </div>
          <div
            style={{
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              marginTop: "3px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: 500,
            }}
          >
            {companyLine}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
            {payLabel && <Chip>{payLabel}</Chip>}
            {remoteLabel && <Chip>{remoteLabel}</Chip>}
            {job.role_category && <Chip>{job.role_category}</Chip>}
          </div>
        </div>
      </button>
      {onReject && (
        <button
          type="button"
          aria-label={`Reject ${job.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onReject(job.id);
          }}
          className="rf-card-reject"
          style={{
            // Vertically centered on the card's right edge — the top-right corner is owned
            // by the always-visible fit-score badge, which the × used to paint over on
            // hover (and, pre-pointer-events fix, overlap as an invisible tap target).
            position: "absolute",
            top: "50%",
            right: "18px",
            transform: "translateY(-50%)",
            zIndex: 1,
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            border: "none",
            // One-off faint neutral overlay for the hover-reveal reject ×; no token
            // covers it. Reads on light; a dark-mode inversion (light-on-dark) is
            // deferred to the later visual pass.
            background: "rgba(20,28,40,.06)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
});
