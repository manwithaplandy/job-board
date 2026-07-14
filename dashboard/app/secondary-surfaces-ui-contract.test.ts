import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("secondary surface design-system contract", () => {
  test("loads the shared secondary-surface responsive and compact-density contract", () => {
    expect(source("app/globals.css")).toContain('@import "../components/secondary-surfaces.css"');
    const css = source("components/secondary-surfaces.css");
    expect(css).toContain("Compact data-density contract");
    expect(css).toContain(".rf-secondary-table-scroll");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("minmax(0, 1fr)");
  });

  test("companies use shared headers, cards, fields, tabs, badges, and actions", () => {
    const files = [
      source("app/companies/page.tsx"),
      source("components/companies/CompanyList.tsx"),
      source("components/companies/CompanyCard.tsx"),
      source("components/companies/CreditBanner.tsx"),
    ].join("\n");
    expect(files).toContain("<PageHeader");
    expect(files).toContain("<Card");
    expect(files).toContain("<TextField");
    expect(files).toContain("<Tabs");
    expect(files).toContain("<Badge");
    expect(files).toContain("<Button");
    expect(files).not.toMatch(/<button\b/);
    expect(files).not.toContain("⚠️");
  });

  test("billing uses shared cards, status badges, and 44px action primitives", () => {
    const files = [source("app/billing/page.tsx"), source("components/billing/BillingActions.tsx")].join("\n");
    expect(files).toContain("<PageHeader");
    expect(files).toContain("<Card");
    expect(files).toContain("<Badge");
    expect(files).toContain("<Button");
    expect(files).not.toMatch(/<button\b/);
  });

  test("analytics uses compact navigation, shared toggles and focusable information triggers", () => {
    const files = [
      source("components/analytics/PipelineDashboard.tsx"),
      source("components/analytics/TrendCharts.tsx"),
      source("components/analytics/InfoTip.tsx"),
      source("components/analytics/Chart.tsx"),
      source("components/analytics/KpiStrip.tsx"),
    ].join("\n");
    expect(files).toContain("rf-secondary-density--compact");
    expect(files).toContain("<PageHeader");
    expect(files).toContain("<SegmentedControl");
    expect(files).toContain('className="rf-info-tip__trigger rf-focusable"');
    expect(files).toContain('className="rf-analytics-card"');
    expect(files).toContain('className="rf-analytics-kpi-grid"');
    expect(files).toContain('className="rf-analytics-kpi"');
    expect(source("components/analytics/Chart.tsx")).not.toContain("const CARD:");
    expect(source("components/analytics/KpiStrip.tsx")).not.toContain('background: "var(--bg-surface)"');
    expect(files).not.toMatch(/<button\b/);
  });

  test("admin uses shared tabs, form fields, copy actions, and overflow-contained tables", () => {
    const files = [
      source("components/admin/AdminNav.tsx"),
      source("components/admin/InviteGenerator.tsx"),
      source("components/admin/CopyButton.tsx"),
      source("app/admin/invites/page.tsx"),
      source("app/admin/tenants/page.tsx"),
    ].join("\n");
    expect(files).toContain("<Tabs");
    expect(files).toContain("<TextField");
    expect(files).toContain("<Button");
    expect(files).toContain("<Icon");
    expect(files.match(/rf-secondary-table-scroll/g)?.length).toBeGreaterThanOrEqual(2);
    expect(files).not.toMatch(/<button\b/);
    expect(files).not.toContain("✗");
  });
});
