"use client";

import type { JobRow } from "@/lib/types";

export function ReviewPanel({ job }: { job: JobRow }) {
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
