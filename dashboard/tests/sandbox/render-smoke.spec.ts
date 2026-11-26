// The render smoke (plan Task 2.11, spec 11 layer 4): every surface on the replay list
// (lib/agent/evals/replay.ts) rendered by app/ui-gallery/surface-replay at 390 and 1440 px
// wide, light and dark, against a production build (playwright.render-smoke.config.ts).
//
// Per surface, viewport and theme: no horizontal overflow (inside the frame too, for
// variant 3); every interactive element at least 44 by 44 px (inside the frame too); axe
// reports no serious or critical violation; one screenshot to test-results/render-smoke,
// not compared. Once per surface (1440, light): for variant 3, every fit score and pay
// figure in the frame's rendered text equals the stored value (findMisstatements), the
// canary saw nothing and the frame loaded once.
//
// Hand-written surfaces (the golden recordings and fixtures/surfaces) must pass every
// check. Recorded ones (matrix, injection) are data for the decision: their failures are
// written to test-results/render-smoke/results/ and annotated, not asserted, except that no
// variant 3 document may reach the canary or load twice, whoever wrote it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Frame, type Page } from "@playwright/test";
import { listReplaySurfaces, type ReplayEntry } from "../../lib/agent/evals/replay";
import { findMisstatements } from "../../lib/agent/evals/misstatements";
import { parseGathered } from "../../lib/agent/gatheredSchema";
import type { CanaryHits } from "./results";

const OUT_DIR = path.join("test-results", "render-smoke");
const RESULTS_DIR = path.join(OUT_DIR, "results");
const CONTROL = "http://127.0.0.1:4598";
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { id: "mobile", width: 390, height: 844 },
  { id: "desktop", width: 1440, height: 1000 },
] as const;
// Playwright loads specs as CommonJS (no import.meta); resolve from the dashboard folder.
const AXE_SOURCE = readFileSync(createRequire(path.join(process.cwd(), "package.json")).resolve("axe-core/axe.min.js"), "utf8");
/** The selector ui-cohesion.spec.ts checks for 44 px targets, plus the kit's own elements. */
const INTERACTIVE =
  "button,a[href],[role=button],[role=menuitem],[role=tab],[role=radio],input:not([type=hidden]),select,textarea,.rf-button,.rf-icon-button,jb-button,jb-field";

const ENTRIES = listReplaySurfaces().map(({ surface, ...entry }) => ({ ...entry, gathered: surface.gathered }));

interface Checked {
  overflow: { scrollWidth: number; viewport: number } | null;
  frameOverflow: { scrollWidth: number; viewport: number } | null;
  undersized: string[];
  axe: string[];
  frameAxe: string[] | "not run";
  fallbacks: unknown[];
  misstatements: string[] | null;
  canaryHits: number | null;
  frameLoads: number | null;
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9.-]+/g, "_");

async function layout(target: Page | Frame) {
  return target.evaluate((selector) => {
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const undersized = [...document.querySelectorAll(selector)]
      .filter(visible)
      .filter((el) => {
        const target = el.matches("input[type=checkbox],input[type=radio]") && el.parentElement?.tagName === "LABEL" ? el.parentElement : el;
        const rect = target.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
    return { scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, undersized };
  }, INTERACTIVE);
}

async function axeViolations(target: Page | Frame, scope: string | null): Promise<string[]> {
  // evaluate runs through the devtools protocol, so the page's CSP does not block it.
  await target.evaluate(AXE_SOURCE);
  const violations = await target.evaluate(async (sel) => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe;
    const context = sel ? (document.querySelector(sel) ?? document) : document;
    const result = await axe.run(context, { resultTypes: ["violations"] });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  }, scope);
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.impact} ${v.id} (${v.nodes})`);
}

async function readLog(page: Page, kind: "intents" | "fallbacks"): Promise<unknown[]> {
  const out = page.locator(`output[data-replay-log="${kind}"]`);
  if ((await out.count()) === 0) return [];
  try {
    const v: unknown = JSON.parse((await out.textContent({ timeout: 1_000 })) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function frameOf(page: Page): Promise<Frame | null> {
  const handle = await page.locator("[data-replay-surface] iframe").first().elementHandle({ timeout: 8_000 }).catch(() => null);
  return handle ? handle.contentFrame() : null;
}

function writeResult(entry: ReplayEntry, viewport: string, theme: string, checked: Checked) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const failures = [
    ...(checked.overflow ? [`overflow ${checked.overflow.scrollWidth} > ${checked.overflow.viewport}`] : []),
    ...(checked.frameOverflow ? [`frame overflow ${checked.frameOverflow.scrollWidth} > ${checked.frameOverflow.viewport}`] : []),
    ...checked.undersized.map((u) => `under 44px: ${u}`),
    ...checked.axe.map((a) => `axe: ${a}`),
    ...(Array.isArray(checked.frameAxe) ? checked.frameAxe.map((a) => `frame axe: ${a}`) : []),
    ...(entry.variant === 3 && checked.fallbacks.length > 0 ? [`frame fell back: ${JSON.stringify(checked.fallbacks)}`] : []),
    ...(checked.misstatements ?? []).map((m) => `misstatement: ${m}`),
  ];
  writeFileSync(
    path.join(RESULTS_DIR, `${slug(entry.name)}.${viewport}.${theme}.json`),
    `${JSON.stringify({ ...entry, viewport, theme, failures, ...checked }, null, 2)}\n`,
  );
  return failures;
}

for (const entry of ENTRIES) {
  test.describe(entry.name, () => {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        test(`${viewport.id} ${theme}`, async ({ page, request }, testInfo) => {
          const once = viewport.id === "desktop" && theme === "light";
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ colorScheme: theme });
          await page.addInitScript((t) => {
            localStorage.setItem("rolefit-theme", t);
            document.documentElement.dataset.theme = t;
          }, theme);
          let frameLoads = 0;
          page.on("framenavigated", (f) => {
            if (f !== page.mainFrame()) frameLoads += 1;
          });
          if (entry.variant === 3 && once) expect((await request.post(`${CONTROL}/reset`)).ok(), "the canary reset").toBe(true);

          const response = await page.goto(`/ui-gallery/surface-replay?surface=${encodeURIComponent(entry.name)}`, { waitUntil: "load" });
          expect(response?.status()).toBe(200);
          const main = page.locator("main[data-surface-replay]");
          const rendered = await main.getAttribute("data-surface-replay");
          if (rendered === "index") throw new Error("the replay page rendered its index: the server needs SURFACE_REPLAY=1");
          expect(rendered).toBe(entry.name);
          await expect(page.locator("[data-replay-surface]")).toBeVisible();

          let frame: Frame | null = null;
          if (entry.variant === 3 && (await main.getAttribute("data-replay-view")) === "sandbox") {
            frame = await frameOf(page);
            if (frame) {
              const f = frame;
              await expect.poll(async () => (await f.locator("body").innerText().catch(() => "")).trim().length, { timeout: 8_000 }).toBeGreaterThan(0);
            }
            await page.waitForTimeout(1_000);
          }

          const outer = await layout(page);
          const inner = frame ? await layout(frame).catch(() => null) : null;
          let frameAxe: string[] | "not run" = "not run";
          if (frame) {
            try {
              frameAxe = await axeViolations(frame, null);
            } catch (e) {
              testInfo.annotations.push({ type: "frame-axe", description: `axe could not run inside the frame: ${e instanceof Error ? e.message.slice(0, 160) : "error"}` });
            }
          }
          const checked: Checked = {
            overflow: outer.scrollWidth > outer.viewport ? { scrollWidth: outer.scrollWidth, viewport: outer.viewport } : null,
            frameOverflow: inner && inner.scrollWidth > inner.viewport ? { scrollWidth: inner.scrollWidth, viewport: inner.viewport } : null,
            undersized: [...outer.undersized, ...(inner?.undersized ?? []).map((u) => `in frame: ${u}`)],
            axe: await axeViolations(page, "[data-replay-surface]"),
            frameAxe,
            fallbacks: await readLog(page, "fallbacks"),
            misstatements: null,
            canaryHits: null,
            frameLoads: null,
          };
          if (entry.variant === 3 && once) {
            const gathered = parseGathered(entry.gathered);
            const text = frame ? await frame.locator("body").innerText().catch(() => "") : "";
            checked.misstatements = gathered ? findMisstatements(text, gathered).map((f) => f.message) : ["the stored gathered data does not parse"];
            await page.waitForTimeout(500);
            const hits = (await (await request.get(`${CONTROL}/hits`)).json()) as CanaryHits;
            checked.canaryHits = hits.total;
            checked.frameLoads = frameLoads;
          }

          mkdirSync(OUT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(OUT_DIR, `${slug(entry.name)}.${viewport.id}.${theme}.png`), fullPage: true });
          const failures = writeResult(entry, viewport.id, theme, checked);

          // Containment holds for every document, recorded or not.
          if (checked.canaryHits !== null) expect(checked.canaryHits, `${entry.name}: the canary saw requests`).toBe(0);
          if (checked.frameLoads !== null) expect(checked.frameLoads, `${entry.name}: the frame loaded more than once`).toBeLessThanOrEqual(1);
          if (entry.handwritten) {
            expect(await main.getAttribute("data-replay-degraded"), `${entry.name}: rendered its fallback`).toBe("no");
            expect(failures, `${entry.name} at ${viewport.id} ${theme}`).toEqual([]);
          } else if (failures.length > 0) {
            testInfo.annotations.push({ type: "render-smoke-data", description: `${entry.name} at ${viewport.id} ${theme}: ${failures.join("; ").slice(0, 600)}` });
          }
        });
      }
    }
  });
}
