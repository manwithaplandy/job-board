// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { InfoTip } from "./InfoTip";
import { KpiStrip } from "./KpiStrip";

afterEach(cleanup);

describe("analytics compact surface fixes", () => {
  test("keeps short tooltip triggers at least 44px on both axes", () => {
    render(<InfoTip term="Errors" gloss="Failed review attempts.">Errors</InfoTip>);
    const trigger = screen.getByRole("button", { name: "Errors. Failed review attempts." });
    expect(trigger.className).toContain("rf-info-tip__trigger");
    expect(readFileSync("components/secondary-surfaces.css", "utf8")).toMatch(/\.rf-info-tip__trigger\s*\{[^}]*min-width:\s*var\(--target-size\)[^}]*min-height:\s*var\(--target-size\)/s);
  });
  test("gives secondary navigation links a 44px-high hit area", () => {
    const css = readFileSync("components/secondary-surfaces.css", "utf8");
    const companies = readFileSync("app/companies/page.tsx", "utf8");
    expect(companies).toContain('className="rf-secondary-link"');
    expect(css).toMatch(/\.rf-secondary-link\s*\{[^}]*min-height:\s*var\(--target-size\)[^}]*display:\s*inline-flex/s);
  });
  test("uses token-backed inline spacing for the KPI trend icon", () => {
    const source = readFileSync("components/analytics/KpiStrip.tsx", "utf8");
    expect(source).toContain('className="rf-kpi-delta__value"');
    expect(readFileSync("components/secondary-surfaces.css", "utf8")).toMatch(/\.rf-kpi-delta__value[^}]*display:\s*inline-flex[^}]*gap:\s*var\(--space-1\)/s);
  });
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

  test("an unfocused pointer activation stays open after the browser focus then click sequence", () => {
    render(<InfoTip term="Open jobs" gloss="Jobs currently open.">Open jobs</InfoTip>);
    const trigger = screen.getByRole("button", { name: "Open jobs. Jobs currently open." });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.focus(trigger);
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});

describe("analytics content width", () => {
  const css = readFileSync("components/secondary-surfaces.css", "utf8");

  // /analytics widens via the --wide modifier. Like --admin, this only works if the modifier
  // overrides `width`: the base sets `width: min(100%, --content-reading)` (720px), and a bare
  // `max-width` cannot grow an element already narrower than its own max-width. The [{;\s]
  // before `width:` anchors the property name so it CANNOT match inside `max-width:` (the char
  // before `width` there is `-`) — reverting to `max-width: 1040px` (the old dead rule) or to
  // `max-width: min(100%, 1040px)` must FAIL this test, not pass it. 1040px is a bespoke width
  // for this single consumer, not a --content-* token (the nearest, --content-wide, is 1200px).
  test("--wide overrides width (not just max-width) so /analytics actually widens", () => {
    expect(css).toMatch(
      /\.rf-secondary-wrap--wide\s*\{[^}]*[{;\s]width:\s*min\(100%,\s*1040px\)/,
    );
  });

  // Same single-class cascade caveat as --admin: --wide (specificity 0,1,0) only beats the base
  // width by appearing LATER in source order. Pin the order so a modifier-grouping or
  // stylelint-ordering refactor that hoists it above the base can't silently revert /analytics
  // to 720px while the rule-text assertion above still passes. (The base must be matched as
  // /\.rf-secondary-wrap\s*\{/ — a bare ".rf-secondary-wrap" is a prefix of --wide/--admin.)
  test("the base wrap precedes --wide so the cascade actually widens", () => {
    const baseIdx = css.search(/\.rf-secondary-wrap\s*\{/);
    const wideIdx = css.search(/\.rf-secondary-wrap--wide\s*\{/);
    expect(baseIdx).toBeGreaterThanOrEqual(0);
    expect(wideIdx).toBeGreaterThan(baseIdx);
  });

  // The only consumer of --wide is the analytics dashboard; if it drops the modifier the width
  // fix above becomes dead CSS. Mirrors adminWrap's "all three admin tabs carry the wrap".
  test("the analytics dashboard carries the --wide wrap", () => {
    expect(readFileSync("components/analytics/PipelineDashboard.tsx", "utf8")).toContain(
      "rf-secondary-wrap--wide",
    );
  });
});
