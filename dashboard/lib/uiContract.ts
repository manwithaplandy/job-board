import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { VISUAL_ROUTES } from "@/tests/visual/routes";

export type UiContractCode = "raw-control" | "unicode-control-icon" | "inline-geometry" | "raw-theme-value" | "undersized-target" | "overflow-risk" | "missing-shared-shell" | "unapproved-svg-icon" | "unapproved-action" | "undocumented-compact-density";
export interface UiContractViolation { code: UiContractCode; file: string; line: number; detail: string }

const ROOT = path.resolve(process.cwd());
const SOURCE_ROOTS = ["app", "components"];
const CONTROL_ICON = /[←→▲▼△▽▾▿⌄⌃×✕✗✓✔⚠★☆]/g;
const RAW_THEME = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(|\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*(?:["'`])?(?:white|black|red|blue|green|gray|grey|orange|yellow|purple)(?:["'`])?/gi;
const GEOMETRY_PROPERTIES = new Set(["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "padding", "paddingInline", "paddingBlock", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "gap", "rowGap", "columnGap", "borderRadius", "gridTemplateColumns"]);
const COMPOSITE_CLASSES = ["rf-control", "rf-picker-input", "rf-board-filter-trigger", "rf-board-filter-option", "rf-job-card__button", "rf-picker-option", "rf-profile-tab", "rf-toast-action", "rf-account-trigger", "rf-header-search"];
const ACTION_CLASSES = ["rf-button", "rf-back-link", "rf-entry-link", "rf-reading-content", "rf-picker-option", "rf-secondary-link", "rf-tabs__item", "rf-profile-error-link", "rf-support-link", "settings-card-action"];
// Component-scoped legacy geometry exceptions. Unlike the former file allowlist,
// these apply only inside the named render function; unrelated/new components in
// the same file are audited. Each is an established board/data-viz composite whose
// numeric geometry is data-driven or pending migration to shared CSS.
const GEOMETRY_SCOPES = new Set([
  "app/admin/invites/page.tsx:AdminInvitesPage", "app/admin/invites/page.tsx:Row", "app/admin/tenants/page.tsx:AdminTenantsPage", "app/admin/tenants/page.tsx:Row",
  "components/LocationPicker.tsx:LocationPicker", "components/LocationPicker.tsx:module", "components/ModelPicker.tsx:ModelPicker", "components/ModelPicker.tsx:module", "components/ReasoningEffortSelect.tsx:ReasoningEffortSelect",
  "components/analytics/BreakdownsSection.tsx:Group", "components/analytics/Chart.tsx:HBarCard", "components/analytics/Chart.tsx:LegendList", "components/analytics/Chart.tsx:StateCard", "components/analytics/Chart.tsx:module", "components/analytics/FunnelSection.tsx:FunnelSection", "components/analytics/FunnelSection.tsx:Panel", "components/analytics/FunnelSection.tsx:Row", "components/analytics/HealthCards.tsx:Card", "components/analytics/HealthCards.tsx:HealthCards", "components/analytics/HealthCards.tsx:StatGrid", "components/analytics/HealthCards.tsx:module", "components/analytics/InfoTip.tsx:InfoTip", "components/analytics/KpiStrip.tsx:Delta", "components/analytics/PipelineDashboard.tsx:SectionHeading", "components/analytics/TrendCharts.tsx:TrendCharts",
  "components/companies/CompanyList.tsx:CompanyList", "components/rolefit/AccountMenu.tsx:AccountMenu", "components/rolefit/ApplicationPanel.tsx:ApplicationPanel", "components/rolefit/ApplicationPanel.tsx:module", "components/rolefit/CoverLetterEditor.tsx:CoverLetterEditor", "components/rolefit/FilterBar.tsx:module", "components/rolefit/GenerationInstructions.tsx:GenerationInstructions", "components/rolefit/JobDetail.tsx:JobDetail", "components/rolefit/JobDetail.tsx:module", "components/rolefit/JobList.tsx:module", "components/rolefit/ProfileModal.tsx:ProfileModal", "components/rolefit/ResumePanel.tsx:ResumePanel", "components/rolefit/ResumePanel.tsx:module", "components/rolefit/ResumeScorePanel.tsx:ResumeScorePanel", "components/rolefit/ResumeScorePanel.tsx:module", "components/rolefit/ResumeUploadField.tsx:ResumeUploadField", "components/rolefit/ReviewNowPanel.tsx:ReviewNowPanel", "components/rolefit/ReviewPanel.tsx:ReviewPanel", "components/rolefit/ReviewPanel.tsx:module", "components/rolefit/ReviewPanel.tsx:num", "components/rolefit/ReviewPanel.tsx:sel", "components/rolefit/RolefitBoard.tsx:RolefitBoard", "components/rolefit/UpsellNotice.tsx:UpsellNotice",
  "components/analytics/Chart.tsx:SimpleTableCard", "components/rolefit/FilterBar.tsx:FilterBar", "components/rolefit/FilterBar.tsx:FilterMenu", "components/rolefit/JobList.tsx:VirtualJobList", "components/rolefit/ResumeScorePanel.tsx:scale",
]);

function lineOf(source: string, index: number): number { return source.slice(0, index).split("\n").length; }
function stripComments(source: string): string { return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).split("\n").map((line) => line.replace(/\/\/.*$/, (comment) => " ".repeat(comment.length))).join("\n"); }
function walk(directory: string, out: string[] = []): string[] { for (const name of readdirSync(directory)) { const absolute = path.join(directory, name); if (statSync(absolute).isDirectory()) { if (name !== "node_modules" && name !== ".next") walk(absolute, out); } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(absolute); } return out; }
function violation(code: UiContractCode, file: string, source: string, index: number, detail: string): UiContractViolation { return { code, file, line: lineOf(source, index), detail }; }
function attr(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined { return node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name); }
function attrText(node: ts.JsxOpeningLikeElement, name: string, sourceFile: ts.SourceFile): string { return attr(node, name)?.initializer?.getText(sourceFile) ?? ""; }
function jsxAncestors(node: ts.Node): ts.JsxOpeningLikeElement[] { const result: ts.JsxOpeningLikeElement[] = []; let current: ts.Node | undefined = node.parent; while (current) { if (ts.isJsxElement(current)) result.push(current.openingElement); else if (ts.isJsxSelfClosingElement(current)) result.push(current); current = current.parent; } return result; }
function withinMarker(node: ts.Node, marker: string): boolean { return jsxAncestors(node).some((ancestor) => Boolean(attr(ancestor, marker))); }
function includesClass(node: ts.JsxOpeningLikeElement, sourceFile: ts.SourceFile, classes: string[]): boolean { const value = attrText(node, "className", sourceFile); return classes.some((className) => value.includes(className)); }
function isNumericGeometry(style: ts.JsxAttribute, sourceFile: ts.SourceFile): boolean {
  const expression = style.initializer && ts.isJsxExpression(style.initializer) ? style.initializer.expression : undefined;
  if (!expression || !ts.isObjectLiteralExpression(expression)) return false;
  return expression.properties.some((property) => {
    if (!ts.isPropertyAssignment(property)) return false;
    const name = property.name.getText(sourceFile).replace(/["']/g, "");
    if (!GEOMETRY_PROPERTIES.has(name)) return false;
    const value = property.initializer;
    return ts.isNumericLiteral(value) || (ts.isStringLiteral(value) && /-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(value.text));
  });
}
function renderScope(node: ts.Node, sourceFile: ts.SourceFile): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
      if (ts.isPropertyAssignment(current.parent)) return current.parent.name.getText(sourceFile);
    }
    current = current.parent;
  }
  return "module";
}

function auditTsx(file: string, source: string, fixture: boolean): UiContractViolation[] {
  const result: UiContractViolation[] = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const uiPrimitive = file.startsWith("components/ui/");
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const start = node.getStart(sourceFile);
      const hidden = tag === "input" && /hidden/.test(attrText(node, "type", sourceFile));
      const fieldChild = jsxAncestors(node).some((ancestor) => ancestor.tagName.getText(sourceFile) === "Field");
      const shellChild = jsxAncestors(node).some((ancestor) => ["EntryShell", "ReadingShell"].includes(ancestor.tagName.getText(sourceFile)));
      const composite = Boolean(attr(node, "data-ui-contract-composite")) || withinMarker(node, "data-ui-contract-composite") || includesClass(node, sourceFile, COMPOSITE_CLASSES) || fieldChild;
      if (!uiPrimitive && ["button", "input", "select", "textarea"].includes(tag) && !hidden && !composite) result.push(violation("raw-control", file, source, start, "Use a shared primitive or a locally marked semantic composite wrapper with a reason."));
      const style = attr(node, "style");
      if (style && isNumericGeometry(style, sourceFile) && !GEOMETRY_SCOPES.has(`${file}:${renderScope(node, sourceFile)}`) && !attr(node, "data-ui-contract-geometry") && !withinMarker(node, "data-ui-contract-geometry")) result.push(violation("inline-geometry", file, source, style.getStart(sourceFile), "Move geometry to shared CSS or mark the smallest data-driven composite wrapper with a reason."));
      if (tag === "svg" && file !== "components/ui/Icon.tsx" && !attr(node, "data-fit-score-ring") && !withinMarker(node, "data-ui-visual")) result.push(violation("unapproved-svg-icon", file, source, start, "Use Icon, data-fit-score-ring on the exact score SVG, or a data-ui-visual data-viz wrapper."));
      if (tag === "a" && !uiPrimitive && !shellChild && !includesClass(node, sourceFile, ACTION_CLASSES) && !composite && attrText(node, "role", sourceFile) !== '"menuitem"') result.push(violation("unapproved-action", file, source, start, "Use ButtonLink/BackLink or a marked semantic navigation composite."));
      const className = attrText(node, "className", sourceFile);
      if (/compact-(?:table|density)/.test(className) && !/rf-secondary-density--compact/.test(className)) result.push(violation("undocumented-compact-density", file, source, start, "Use rf-secondary-density--compact."));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const clean = stripComments(source);
  if (file !== "components/analytics/FunnelSection.tsx") for (const match of clean.matchAll(CONTROL_ICON)) result.push(violation("unicode-control-icon", file, clean, match.index, "Use Icon for control glyphs."));
  if (file !== "app/globals.css" && file !== "app/layout.tsx" && !file.startsWith("components/theme/")) for (const match of clean.matchAll(RAW_THEME)) result.push(violation("raw-theme-value", file, clean, match.index, "Use a semantic theme token."));
  if (fixture && /<main\b/.test(clean) && !/<AppShell\b/.test(clean)) result.push(violation("missing-shared-shell", file, clean, clean.indexOf("<main"), "Protected routes must declare their shell contract."));
  return result;
}

function auditCss(file: string, source: string): UiContractViolation[] {
  const result: UiContractViolation[] = [];
  const clean = stripComments(source);
  if (file !== "app/globals.css" && !file.startsWith("components/theme/")) for (const match of clean.matchAll(RAW_THEME)) result.push(violation("raw-theme-value", file, clean, match.index, "Use a semantic theme token."));
  for (const block of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim(); const body = block[2]; const start = block.index;
    const interactive = /(^|[\s,>+~])(?:a|button|input|select|textarea)(?:[\s.#[:>+~]|$)|\[role\s*=\s*["']?(?:button|menuitem|tab|radio|option)/i.test(selector) || /:(?:hover|focus|active)/.test(selector);
    if (interactive && /(?:min-height|height|min-width|width)\s*:\s*(?:[0-3]\d|4[0-3])px/.test(body) && !/(?:icon|spinner|indicator|sr-only)/.test(selector)) result.push(violation("undersized-target", file, clean, start, "Interactive selectors with explicit dimensions must preserve a 44px target."));
    const selectorIndex = source.indexOf(selector, start);
    if (/(?:^|;)\s*(?:width|min-width)\s*:\s*(?:3(?:9[1-9]|[1-9]\d)|[4-9]\d\d|\d{4,})px/.test(body) && !source.slice(Math.max(0, selectorIndex - 180), selectorIndex).includes("ui-contract-allow-overflow")) result.push(violation("overflow-risk", file, clean, start, "Fixed route width above 390px requires a local responsive override annotation."));
  }
  return result;
}

export function auditSource(file: string, source: string, fixture: boolean): UiContractViolation[] { return (file.endsWith(".css") ? auditCss(file, source) : auditTsx(file, source, fixture)).sort((a, b) => a.line - b.line || a.code.localeCompare(b.code)); }
export function auditFixtureFile(relativeFile: string): UiContractViolation[] { return auditSource(relativeFile, readFileSync(path.join(ROOT, relativeFile), "utf8"), true); }
export function auditProductionUi(): UiContractViolation[] {
  const files = SOURCE_ROOTS.flatMap((directory) => walk(path.join(ROOT, directory))).filter((absolute) => !absolute.includes(`${path.sep}__fixtures__${path.sep}`));
  const result = files.flatMap((absolute) => { const file = path.relative(ROOT, absolute); return auditSource(file, readFileSync(absolute, "utf8"), false); });
  for (const route of VISUAL_ROUTES.filter((entry) => entry.access === "authenticated" && entry.source)) {
    const source = readFileSync(path.join(ROOT, route.source!), "utf8");
    if (route.shell === "app" && !source.includes("<AppShell")) result.push({ code: "missing-shared-shell", file: route.source!, line: 1, detail: `${route.id} must compose AppShell.` });
    if (route.shell === "board" && !source.includes("BOARD_SHELL_COMPOSITE_EXCEPTION")) result.push({ code: "missing-shared-shell", file: route.source!, line: 1, detail: `${route.id} must document the board shell exception.` });
    if (route.shell === "entry" && !source.includes("<EntryShell")) result.push({ code: "missing-shared-shell", file: route.source!, line: 1, detail: `${route.id} must compose EntryShell.` });
  }
  return result.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
}
