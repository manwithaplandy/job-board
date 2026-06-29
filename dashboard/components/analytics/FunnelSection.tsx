"use client";

import type { FunnelCounts } from "@/lib/metrics";

interface Stage { label: string; value: number; tone?: "ok" | "bad" | "muted" }

const TONES = { ok: "#3b6fd4", bad: "#e0607e", muted: "#9aa3b0" } as const;

function Funnel({ title, stages }: { title: string; stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#161d29", marginBottom: "12px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {stages.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "118px", flex: "0 0 auto", fontSize: "12px", color: "#5b6472", fontWeight: 600 }}>{s.label}</div>
            <div style={{ flex: 1, height: "22px", background: "#f0f2f6", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{
                width: `${Math.round((s.value / max) * 100)}%`, height: "100%",
                background: TONES[s.tone ?? "ok"], borderRadius: "6px", minWidth: s.value > 0 ? "3px" : 0,
              }} />
            </div>
            <div style={{ width: "52px", textAlign: "right", fontSize: "12.5px", fontWeight: 700, color: "#1f2430" }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelSection({ funnel }: { funnel: FunnelCounts }) {
  const { companies: c, jobs: j } = funnel;
  const companyStages: Stage[] = [
    { label: "Tracked", value: c.tracked },
    { label: "Active", value: c.active },
    { label: "Discovery-sourced", value: c.discovery_sourced },
    { label: "Reviewed", value: c.reviewed },
    { label: "Included", value: c.include },
    { label: "Excluded", value: c.exclude, tone: "bad" },
    { label: "Unknown", value: c.unknown, tone: "muted" },
    { label: "Backlog", value: c.backlog, tone: "muted" },
  ];
  const jobStages: Stage[] = [
    { label: "Ever seen", value: j.ever_seen },
    { label: "Open now", value: j.open },
    { label: "Reviewed", value: j.reviewed },
    { label: "Gate-rejected", value: j.gate_rejected, tone: "bad" },
    { label: "Approved", value: j.approved },
    { label: "Denied", value: j.denied, tone: "bad" },
    { label: "Manual reject", value: j.manual_rejected, tone: "bad" },
    { label: "Unreviewed", value: j.unreviewed, tone: "muted" },
    { label: "Errors", value: j.errors, tone: "bad" },
  ];
  return (
    <div style={{
      display: "flex", gap: "32px", flexWrap: "wrap",
      background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px", padding: "18px 20px",
    }}>
      <Funnel title="Companies — discovery" stages={companyStages} />
      <Funnel title="Jobs — poller → reviewer" stages={jobStages} />
    </div>
  );
}
