"use client";

import { useTransition } from "react";
import type { CompanyReviewRow } from "@/lib/types";
import { verdictMeta } from "@/lib/companies/format";
import { redFlagLabel } from "@/lib/redFlags";

export function CompanyCard({
  company, override,
}: {
  company: CompanyReviewRow;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const meta = verdictMeta(company.effective_verdict);
  const tags = [...(company.tech_tags ?? []), ...(company.red_flags ?? []).map(redFlagLabel)];

  const act = (verdict: "include" | "exclude") =>
    start(async () => { await override(company.id, verdict); });

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
      padding: "16px 18px", marginBottom: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>{company.name}</div>
        <span style={{
          fontSize: "11px", fontWeight: 700, color: meta.color, background: meta.bg,
          borderRadius: "20px", padding: "3px 9px",
        }}>{meta.label}{company.human_override ? " · you" : ""}</span>
        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginLeft: "auto" }}>
          {company.ats} · {company.token}
        </span>
      </div>
      {company.reasoning && (
        <div style={{
          fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {company.reasoning}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
          {tags.map((t, i) => (
            <span key={`${t}-${i}`} style={{
              fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)",
              background: "var(--bg-muted)", borderRadius: "7px", padding: "3px 8px",
            }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button type="button" onClick={() => act("include")} disabled={pending}
          style={overrideBtn(company.effective_verdict === "include", pending)}>
          Include
        </button>
        <button type="button" onClick={() => act("exclude")} disabled={pending}
          style={overrideBtn(company.effective_verdict === "exclude", pending)}>
          Exclude
        </button>
      </div>
    </div>
  );
}

function overrideBtn(active: boolean, disabled = false): React.CSSProperties {
  return {
    fontWeight: 700, fontSize: "12.5px",
    color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
    background: active ? "var(--accent)" : "var(--bg-surface)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "9px", padding: "7px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
