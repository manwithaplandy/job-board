// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { InfoTip } from "./InfoTip";
import { KpiStrip } from "./KpiStrip";

afterEach(cleanup);

describe("analytics compact surface fixes", () => {
  test("renders every KPI as a shared compact analytics card", () => {
    const snapshot = {
      funnel: {
        jobs: { open: 10, unreviewed: 4, reviewed: 6, approved: 3, applied: 1 },
        companies: { include: 2 },
      },
    } as unknown as PipelineSnapshot;
    const series = { jobDiscovery: [], review: [] } as unknown as RunSeries;
    const { container } = render(<KpiStrip snapshot={snapshot} series={series} nowIso="2026-07-13T12:00:00.000Z" />);

    const cards = container.querySelectorAll(".rf-card.rf-analytics-kpi");
    expect(cards).toHaveLength(5);
    expect([...cards].every((card) => card.getAttribute("style") == null)).toBe(true);
  });

  test("supports focus, Escape, and Enter/Space reopening without a blur cycle", () => {
    render(<InfoTip term="Open jobs" gloss="Jobs currently open.">Open jobs</InfoTip>);
    const trigger = screen.getByRole("button", { name: "Open jobs. Jobs currently open." });

    fireEvent.focus(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
