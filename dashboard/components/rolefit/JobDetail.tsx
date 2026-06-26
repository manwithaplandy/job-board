"use client";

import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { fitColor, initialsOf, fmtPay, fmtPosted } from "@/lib/rolefit/fit";
import { ResumePanel } from "./ResumePanel";

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
  onOpenProfile: () => void;
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
  onOpenProfile,
}: JobDetailProps) {
  const hasReview = job.fit_score != null;
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

  // Sub-score bars
  const subScores: { label: string; value: number | null }[] = [
    { label: "Skills match", value: job.skills_score },
    { label: "Experience level", value: job.experience_score },
    { label: "Comp & seniority", value: job.comp_score },
  ];

  // Requirements
  const reqs = job.requirements ?? [];

  // Red flags / skill gaps
  const redFlags = job.red_flags ?? [];
  const skillGaps = job.skill_gaps ?? [];
  const benefits = job.benefits ?? [];

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
                color: "#8a93a3",
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
                  color: "#8a93a3",
                  marginTop: "3px",
                }}
              >
                FIT
              </div>
            </div>
          </div>
        )}
      </div>

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
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#8a93a3" }}>
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
          {/* Résumé panel */}
          <ResumePanel
            job={job}
            isAuthed={isAuthed}
            state={genState}
            data={gd}
            error={genErrorMsg}
            onGenerate={() => onGenerate(job)}
            onRegenerate={() => onGenerate(job)}
            onCopy={() => { if (gd) onCopy(job, gd); }}
            copyLabel={copyLabel}
            usingSample={false}
            onOpenProfile={onOpenProfile}
          />

          {/* ── AI Review ── */}
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
        </>
      )}
    </div>
  );
}
