// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";

vi.mock("@/components/analytics/KpiStrip", () => ({ KpiStrip: () => <div data-testid="kpis" /> }));
vi.mock("@/components/analytics/FunnelSection", () => ({ FunnelSection: () => <div /> }));
vi.mock("@/components/analytics/HealthCards", () => ({ HealthCards: () => <div /> }));
vi.mock("@/components/analytics/TrendCharts", () => ({ TrendCharts: () => <div /> }));
vi.mock("@/components/analytics/BreakdownsSection", () => ({ BreakdownsSection: () => <div /> }));

const { BarsCard, HBarCard, LinesCard, SimpleTableCard } = await import("./Chart");
const { PipelineDashboard } = await import("./PipelineDashboard");

afterEach(cleanup);

describe("analytics shared system states", () => {
  it("renders every empty chart branch through the compact EmptyState contract", () => {
    const { container } = render(<>
      <BarsCard title="Bars" data={[]} xKey="date" bars={[]} empty="No bars yet." />
      <LinesCard title="Lines" data={[]} xKey="date" lines={[]} empty="No lines yet." />
      <HBarCard title="Ranked" data={[]} empty="No ranks yet." />
      <SimpleTableCard title="Table" data={[]} empty="No rows yet." />
    </>);

    expect(container.querySelectorAll(".rf-empty-state--compact")).toHaveLength(4);
    for (const text of ["No bars yet.", "No lines yet.", "No ranks yet.", "No rows yet."]) {
      expect(screen.getByRole("heading", { name: text })).toBeTruthy();
    }
  });

  it("announces the analytics first-run explanation as shared informational status", () => {
    const snapshot = { health: { reviewer: { totals: { runs: 0 } } } } as unknown as PipelineSnapshot;
    const series = {} as RunSeries;

    render(<PipelineDashboard snapshot={snapshot} series={series} nowIso="2026-07-13T12:00:00.000Z" />);

    const status = screen.getByRole("status");
    expect(status.className).toContain("rf-alert--info");
    expect(status.textContent).toContain("No reviews yet.");
    expect(status.textContent).toContain("Review my board now");
  });
});
