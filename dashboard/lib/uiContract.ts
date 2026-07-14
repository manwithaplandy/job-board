import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type UiContractCode =
  | "raw-control"
  | "unicode-control-icon"
  | "inline-geometry"
  | "raw-theme-value"
  | "undersized-target"
  | "overflow-risk"
  | "missing-shared-shell"
  | "unapproved-svg-icon"
  | "unapproved-action"
  | "undocumented-compact-density";

export interface UiContractViolation {
  code: UiContractCode;
  file: string;
  line: number;
  detail: string;
}

const ROOT = path.resolve(process.cwd());
const SOURCE_ROOTS = ["app", "components"];

// Exact semantic-composite exceptions. These widgets require native semantics for
// roving focus, listbox/menu behavior, file inputs, rich board interactions, or
// server-form submission. The exception is file-scoped so new widgets cannot inherit it.
export const RAW_CONTROL_COMPOSITE_ALLOWLIST = new Set([
  "components/LocationPicker.tsx",
  "components/ModelPicker.tsx",
  "components/ReasoningEffortSelect.tsx",
  "components/profile/ApplicationDetailsForm.tsx",
  "components/profile/ApplicationPersonalizationForm.tsx",
  "components/profile/JobPreferencesForm.tsx",
  "components/profile/ResumeSettingsForm.tsx",
  "components/rolefit/AccountMenu.tsx",
  "components/rolefit/CoverLetterEditor.tsx",
  "components/rolefit/FilterBar.tsx",
  "components/rolefit/GenerationInstructions.tsx",
  "components/rolefit/Header.tsx",
  "components/rolefit/JobCard.tsx",
  "components/rolefit/ProfileModal.tsx",
  "components/rolefit/ResumeScorePanel.tsx",
  "components/rolefit/ResumeUploadField.tsx",
  "components/rolefit/ReviewPanel.tsx",
  "components/rolefit/RolefitBoard.tsx",
]);

export const RAW_ANCHOR_COMPOSITE_ALLOWLIST = new Set([
  "app/companies/page.tsx",
  "app/login/page.tsx",
  "app/privacy/page.tsx",
  "app/reset-password/page.tsx",
  "app/signup/page.tsx",
  "app/terms/page.tsx",
  "components/SupportLink.tsx",
  "components/analytics/PipelineDashboard.tsx",
  "components/profile/SectionFormShell.tsx",
  "components/rolefit/AccountMenu.tsx",
  "components/rolefit/ApplicationPanel.tsx",
  "components/rolefit/Header.tsx",
  "components/rolefit/ProfileModal.tsx",
  "components/rolefit/ResumePanel.tsx",
]);

// Inline geometry remains only in established data-visualisation and board composites.
// New files must use shared CSS/token classes; each retained exception is explicit.
export const INLINE_GEOMETRY_COMPOSITE_ALLOWLIST = new Set([
  "app/admin/invites/page.tsx", "app/admin/tenants/page.tsx",
  "components/LocationPicker.tsx", "components/ModelPicker.tsx", "components/ReasoningEffortSelect.tsx", "components/SupportLink.tsx",
  "components/analytics/BreakdownsSection.tsx", "components/analytics/Chart.tsx", "components/analytics/FunnelSection.tsx", "components/analytics/HealthCards.tsx", "components/analytics/InfoTip.tsx", "components/analytics/KpiStrip.tsx", "components/analytics/PipelineDashboard.tsx", "components/analytics/TrendCharts.tsx",
  "components/companies/CompanyList.tsx",
  "components/rolefit/AccountMenu.tsx", "components/rolefit/ApplicationPanel.tsx", "components/rolefit/CoverLetterEditor.tsx", "components/rolefit/FilterBar.tsx", "components/rolefit/GenerationInstructions.tsx", "components/rolefit/Header.tsx", "components/rolefit/JobCard.tsx", "components/rolefit/JobDetail.tsx", "components/rolefit/JobList.tsx", "components/rolefit/ProfileModal.tsx", "components/rolefit/ResumePanel.tsx", "components/rolefit/ResumeScorePanel.tsx", "components/rolefit/ResumeUploadField.tsx", "components/rolefit/ReviewNowPanel.tsx", "components/rolefit/ReviewPanel.tsx", "components/rolefit/RolefitBoard.tsx", "components/rolefit/UpsellNotice.tsx",
  "components/ui/Chip.tsx",
]);

const AUTHENTICATED_ROUTES = [
  "app/analytics/page.tsx", "app/billing/page.tsx", "app/companies/page.tsx",
  "app/admin/invites/page.tsx", "app/admin/tenants/page.tsx", "app/profile/layout.tsx",
];
const SVG_ALLOWLIST = new Set(["components/ui/Icon.tsx", "components/rolefit/JobDetail.tsx"]); // score ring is data-viz, not a control icon
const THEME_VALUE_ALLOWLIST = new Set(["app/globals.css", "app/layout.tsx"]);
const UNICODE_PROSE_ALLOWLIST = new Set(["components/analytics/FunnelSection.tsx"]); // process-flow separator in a sentence, not a control

const CONTROL_ICON = /[←→▲▼△▽▾▿⌄⌃×✕✗✓✔⚠★☆]/g;
const INLINE_GEOMETRY = /style\s*=\s*\{\{[\s\S]{0,800}?\b(?:width|height|minWidth|maxWidth|minHeight|maxHeight|padding|margin|gap|borderRadius|gridTemplateColumns)\s*:\s*(?:["'`]?-?\d)/g;
const RAW_THEME = /#[0-9a-fA-F]{3,8}\b|\b(?:color|background(?:Color)?)\s*:\s*["'`](?:white|black|red|blue|gray|grey)["'`]/g;

function lineOf(source: string, index: number): number { return source.slice(0, index).split("\n").length; }
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " ")).split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
}
function walk(directory: string, out: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const absolute = path.join(directory, name);
    if (statSync(absolute).isDirectory()) { if (name !== "node_modules" && name !== ".next") walk(absolute, out); }
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(absolute);
  }
  return out;
}
function pushMatches(violations: UiContractViolation[], code: UiContractCode, file: string, source: string, regex: RegExp, detail: string) {
  regex.lastIndex = 0;
  for (const match of source.matchAll(regex)) violations.push({ code, file, line: lineOf(source, match.index), detail });
}

function auditFile(file: string, source: string, fixture: boolean): UiContractViolation[] {
  const violations: UiContractViolation[] = [];
  const clean = stripComments(source);
  const isUiPrimitive = file.startsWith("components/ui/");
  if (fixture || (!isUiPrimitive && !RAW_CONTROL_COMPOSITE_ALLOWLIST.has(file))) {
    pushMatches(violations, "raw-control", file, clean, /<(?:button|select|textarea)\b|<input\b(?![^>]*\btype=["']hidden["'])/g, "Use a shared control primitive or an exact semantic-composite exception.");
  }
  if (fixture || !UNICODE_PROSE_ALLOWLIST.has(file)) pushMatches(violations, "unicode-control-icon", file, clean, CONTROL_ICON, "Use the internal Icon component for control glyphs.");
  if (fixture || !INLINE_GEOMETRY_COMPOSITE_ALLOWLIST.has(file)) pushMatches(violations, "inline-geometry", file, clean, INLINE_GEOMETRY, "Move geometry to token-backed shared CSS.");
  if (fixture || (!THEME_VALUE_ALLOWLIST.has(file) && !file.startsWith("components/theme/"))) pushMatches(violations, "raw-theme-value", file, clean, RAW_THEME, "Use a semantic theme token.");
  if (fixture || !SVG_ALLOWLIST.has(file)) pushMatches(violations, "unapproved-svg-icon", file, clean, /<svg\b/g, "Use components/ui/Icon; the only non-control SVG exception is the score ring.");
  if (fixture || (!isUiPrimitive && !RAW_ANCHOR_COMPOSITE_ALLOWLIST.has(file))) pushMatches(violations, "unapproved-action", file, clean, /<a\b[^>]*href=/g, "Use ButtonLink/BackLink or an exact semantic navigation exception.");
  pushMatches(violations, "undocumented-compact-density", file, clean, /className=["'][^"']*(?<!rf-secondary-density--)compact-(?:table|density)[^"']*["']/g, "Use the documented rf-secondary-density--compact contract.");
  if (fixture && /<main\b/.test(clean) && !/<AppShell\b/.test(clean)) {
    violations.push({ code: "missing-shared-shell", file, line: lineOf(clean, clean.indexOf("<main")), detail: "Authenticated route fixtures must compose AppShell." });
  }

  if (file.endsWith(".css")) {
    for (const block of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = block[1]; const body = block[2]; const offset = block.index;
      if (/(?:button|action|control|tab|trigger|option)/i.test(selector) && /(?:min-height|height|width|min-width)\s*:\s*(?:[0-3]\d|4[0-3])px/.test(body) && !/(?:spinner|indicator|icon|health|sr-only)/.test(selector)) {
        violations.push({ code: "undersized-target", file, line: lineOf(clean, offset), detail: "Interactive targets must be at least 44px; compact visuals need a 44px hit target." });
      }
      if (/(?:page|shell|workspace)/i.test(selector) && /(?:^|;)\s*(?:width|min-width)\s*:\s*(?:[4-9]\d\d|\d{4,})px/.test(body)) {
        violations.push({ code: "overflow-risk", file, line: lineOf(clean, offset), detail: "Route containers may not impose a fixed width above the 390px viewport." });
      }
    }
  }
  return violations;
}

export function auditFixtureDirectory(relativeDirectory: string): UiContractViolation[] {
  const directory = path.join(ROOT, relativeDirectory);
  return walk(directory).flatMap((absolute) => auditFile(path.relative(ROOT, absolute), readFileSync(absolute, "utf8"), true));
}

export function auditProductionUi(): UiContractViolation[] {
  const files = SOURCE_ROOTS.flatMap((directory) => walk(path.join(ROOT, directory)))
    .filter((absolute) => !absolute.includes(`${path.sep}__fixtures__${path.sep}`));
  const violations = files.flatMap((absolute) => {
    const file = path.relative(ROOT, absolute);
    return auditFile(file, readFileSync(absolute, "utf8"), false);
  });
  for (const file of AUTHENTICATED_ROUTES) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    if (!source.includes("<AppShell")) violations.push({ code: "missing-shared-shell", file, line: 1, detail: "Authenticated routes must compose AppShell." });
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
}
