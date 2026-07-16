// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const entrySurfaces = [
  "app/login/page.tsx",
  "app/signup/page.tsx",
  "app/reset-password/page.tsx",
  "app/reset-password/update/page.tsx",
  "app/onboarding/page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/error.tsx",
  "components/OnboardingForm.tsx",
];

describe("entry and system-state design contracts", () => {
  it.each(entrySurfaces)("%s avoids page-local inline geometry", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/style=\{/);
    expect(source).not.toMatch(/React\.CSSProperties/);
  });

  it("uses a shared entry shell and shared form fields on every auth route", () => {
    for (const file of [
      "app/login/page.tsx",
      "app/signup/page.tsx",
      "app/reset-password/page.tsx",
      "app/reset-password/update/page.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("EntryShell");
      expect(source).toContain("TextField");
    }
  });

  it("uses shared status primitives for auth feedback and the app error boundary", () => {
    expect(read("app/login/page.tsx")).toContain("<Alert");
    expect(read("app/signup/page.tsx")).toContain("<Alert");
    expect(read("app/reset-password/page.tsx")).toContain("<Alert");
    expect(read("app/error.tsx")).toContain("<ErrorState");
  });

  it("preserves authentication and routing actions", () => {
    expect(read("app/login/page.tsx")).toMatch(/signInWithPassword[\s\S]*redirect\("\/"\)/);
    expect(read("app/signup/page.tsx")).toContain("action={signUp}");
    expect(read("app/reset-password/page.tsx")).toMatch(/resetPasswordForEmail[\s\S]*redirect\("\/reset-password\?sent=1"\)/);
    expect(read("app/reset-password/update/page.tsx")).toMatch(/updateUser\(\{ password \}\)[\s\S]*redirect\("\/"\)/);
    expect(read("app/onboarding/page.tsx")).toContain("action={completeOnboarding}");
  });

  it("standardizes the complete board and secondary exceptional-state inventory", () => {
    expect(read("components/rolefit/JobList.tsx")).toContain("<EmptyState");
    expect(read("components/companies/CompanyList.tsx")).toContain("<EmptyState");
    expect(read("app/companies/page.tsx")).toContain("<EmptyState");
    expect(read("components/analytics/PipelineDashboard.tsx")).toContain("<Alert");
    for (const adminPage of ["app/admin/invites/page.tsx", "app/admin/tenants/page.tsx"]) {
      const source = read(adminPage);
      expect(source).toContain("<EmptyState");
      expect(source).not.toMatch(/<div style=\{\{[^}]*padding:\s*"24px 4px"/);
    }
    const chartSource = read("components/analytics/Chart.tsx");
    expect(chartSource.match(/<EmptyState/g)).toHaveLength(4);
    expect(chartSource).not.toContain("rf-analytics-card__empty");
    expect(read("components/secondary-surfaces.css")).not.toContain("rf-analytics-card__empty");
    expect(read("components/rolefit/JobDetail.tsx")).toContain("<LoadingState");
    expect(read("components/rolefit/DetailErrorBoundary.tsx")).toContain("<ErrorState");
  });

  it("defines responsive entry, reading, and state layouts", () => {
    const css = read("components/ui/ui.css");
    expect(css).toContain(".rf-entry-shell");
    expect(css).toContain(".rf-reading-shell");
    expect(css).toContain(".rf-empty-state");
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*\.rf-entry-shell/);
  });

  it("gives entry, consent, footer, and reading links the themed focus-visible ring", () => {
    const css = read("components/ui/ui.css");
    for (const selector of [
      ".rf-entry-link:focus-visible",
      ".rf-entry-footer a:focus-visible",
      ".rf-entry-consent a:focus-visible",
      ".rf-reading-content a:focus-visible",
    ]) {
      expect(css).toContain(selector);
    }
    expect(css).toMatch(/\.rf-entry-footer a\s*\{[^}]*min-width:\s*var\(--target-size\)[^}]*min-height:\s*var\(--target-size\)/s);
    expect(read("app/login/page.tsx")).toContain("rf-entry-link rf-focusable");
    expect(read("app/signup/page.tsx")).toContain("rf-entry-link rf-focusable");
    expect(read("app/reset-password/page.tsx")).toContain("rf-entry-link rf-focusable");
  });
});
