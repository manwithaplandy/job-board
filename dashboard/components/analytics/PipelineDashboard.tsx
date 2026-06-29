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
  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
        <a href="/" style={{ fontSize: "12.5px", fontWeight: 600, color: "#5b6472", textDecoration: "none" }}>← Back to board</a>
        <h1 style={{ margin: "14px 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Pipeline analytics
        </h1>
        <div style={{ fontSize: "13px", color: "#8a93a3", marginBottom: "18px" }}>
          Discovery, poller, and reviewer pipelines — totals, throughput, and trends.
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

        <SectionHeading id="funnel">Funnel</SectionHeading>
        <FunnelSection funnel={snapshot.funnel} />

        <SectionHeading id="health">Pipeline health</SectionHeading>
        <HealthCards latest={snapshot.latest} nowIso={nowIso} />

        <SectionHeading id="trends">Trends</SectionHeading>
        <TrendCharts series={series} nowIso={nowIso} />

        <SectionHeading id="breakdowns">Breakdowns</SectionHeading>
        <BreakdownsSection distributions={snapshot.distributions} />
      </div>
    </main>
  );
}
