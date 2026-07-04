"use client";

import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { FunnelSection } from "@/components/analytics/FunnelSection";
import { HealthCards } from "@/components/analytics/HealthCards";
import { TrendCharts } from "@/components/analytics/TrendCharts";
import { BreakdownsSection } from "@/components/analytics/BreakdownsSection";

const SECTIONS = [
  { id: "funnel", label: "Funnel" },
  { id: "health", label: "Health" },
  { id: "trends", label: "Trends" },
  { id: "breakdowns", label: "Breakdowns" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ scrollMarginTop: "70px", fontSize: "16px", fontWeight: 800, color: "#161d29", margin: "28px 0 14px" }}>
      {children}
    </h2>
  );
}

export function PipelineDashboard({ snapshot, series, nowIso }: { snapshot: PipelineSnapshot; series: RunSeries; nowIso: string }) {
  // A brand-new account has no review runs yet — surface an empty-state note above the
  // reviewer panels instead of blank/zero-domain charts (T6; guards the recharts-3
  // empty-domain gotcha by telling the user rather than rendering degenerate axes).
  const noReviewRuns = snapshot.health.reviewer.totals.runs === 0;
  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Pipeline analytics
        </h1>
        <div style={{ fontSize: "13px", color: "#6b7480", marginBottom: "18px" }}>
          Company Discovery, Job Discovery, and reviewer pipelines — totals, throughput, and trends.
          {" "}
          <span style={{ fontWeight: 600 }}>Aggregates refresh at least every 10 minutes.</span>
        </div>

        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", gap: "8px",
          padding: "10px 0", background: "#f4f6fa", borderBottom: "1px solid #e7eaf0", marginBottom: "8px" }}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} style={{
              fontSize: "12.5px", fontWeight: 700, color: "#3b6fd4", textDecoration: "none",
              padding: "6px 12px", background: "#eef3fc", borderRadius: "8px",
            }}>{s.label}</a>
          ))}
        </div>

        {noReviewRuns && (
          <div style={{
            background: "#fff", border: "1px solid #e7eaf0", borderRadius: "12px",
            padding: "16px 18px", marginTop: "8px", display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#3b6fd4", flexShrink: 0 }} />
            <div style={{ fontSize: "13px", color: "#5b6472", lineHeight: 1.5 }}>
              <strong style={{ color: "#161d29" }}>No reviews yet.</strong>{" "}
              Once your board is reviewed, the funnel, throughput trends, and breakdowns below
              fill in. Trigger a first pass with “Review my board now” on your board.
            </div>
          </div>
        )}

        <SectionHeading id="funnel">Funnel</SectionHeading>
        <FunnelSection funnel={snapshot.funnel} />

        <SectionHeading id="health">Pipeline health</SectionHeading>
        <HealthCards health={snapshot.health} nowIso={nowIso} />

        <SectionHeading id="trends">Trends</SectionHeading>
        <TrendCharts series={series} nowIso={nowIso} />

        <SectionHeading id="breakdowns">Breakdowns</SectionHeading>
        <BreakdownsSection distributions={snapshot.distributions} />
      </div>
    </main>
  );
}
