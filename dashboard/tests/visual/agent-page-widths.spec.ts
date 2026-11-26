import { expect, test, type Page } from "@playwright/test";
import { VISUAL_ROUTES } from "./routes";
import { assertRuntimeContracts } from "./runtime-contracts";

// The agent page at the widths between ui-cohesion.spec.ts's 390 and 1440 and past it
// (PR K1): 1024 (the conversation list beside the chat, a surface inline), 1280 (the
// surface in its own column from 1200) and 2000 (the page wrap capped at 1440). Only the
// agent page fixtures run here; every other route keeps the shared 390/1440 matrix.
// Each run checks the shared runtime contracts, then that the conversation list, the
// toolbar, the transcript, the composer and the surface column never overlap, then takes
// a screenshot named <route id>-w<width>-<theme>.png (ui-cohesion uses -desktop-/-mobile-,
// so the names cannot collide).

const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated";
const THEMES = ["light", "dark"] as const;
const WIDTHS = [1024, 1280, 2000] as const;
const HEIGHT = 1000;
/** From this width the latest surface takes its own column (agent.css, SurfaceHost.tsx). */
const SPLIT_FROM = 1200;
const STATES = ["agent-page-conversation", "agent-page-surface", "agent-page-failed"] as const;

const REGIONS = [".rf-agent-threads", ".rf-agent-toolbar", ".rf-agent-transcript", ".rf-agent-composer", ".rf-agent-surface-column"] as const;

async function assertAgentLayout(page: Page, state: (typeof STATES)[number], width: number) {
  const layout = await page.evaluate((selectors) => {
    const boxes = selectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      return [{ selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
    });
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        // One pixel of slack for borders that meet.
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) overlaps.push(`${a.selector} overlaps ${b.selector}`);
      }
    }
    const list = document.querySelector(".rf-agent-threads")?.getBoundingClientRect();
    const escapedTitles = [...document.querySelectorAll(".rf-agent-threads__item")]
      .filter((item) => list && item.getBoundingClientRect().right > list.right + 1)
      .map((item) => item.textContent?.trim().slice(0, 60) ?? "");
    return { found: boxes.map((box) => box.selector), overlaps, escapedTitles };
  }, [...REGIONS]);
  expect(layout.overlaps, `agent page regions overlap: ${JSON.stringify(layout)}`).toEqual([]);
  expect(layout.escapedTitles, "conversation titles wider than the list").toEqual([]);
  for (const selector of [".rf-agent-threads", ".rf-agent-toolbar", ".rf-agent-transcript", ".rf-agent-composer"]) {
    expect(layout.found, `${selector} is shown`).toContain(selector);
  }
  if (state === "agent-page-surface") {
    expect(layout.found.includes(".rf-agent-surface-column"), `surface column at ${width}px`).toBe(width >= SPLIT_FROM);
  }
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`agent page w${width} ${theme}`, () => {
      test.use({ viewport: { width, height: HEIGHT }, colorScheme: theme });
      for (const state of STATES) {
        const route = VISUAL_ROUTES.find((entry) => entry.path === `/ui-gallery/states/${state}`);
        test(`${state} w${width} ${theme}`, async ({ page }) => {
          test.skip(AUTHENTICATED_ONLY, "Explicit authenticated-only screenshot subset.");
          expect(route, `${state} is in the visual inventory`).toBeDefined();
          await page.addInitScript((selectedTheme) => {
            localStorage.setItem("rolefit-theme", selectedTheme);
            document.documentElement.dataset.theme = selectedTheme;
          }, theme);
          await page.goto(route!.path, { waitUntil: "networkidle" });
          await expect(page.locator("body")).toBeVisible();
          await assertRuntimeContracts(page);
          await assertAgentLayout(page, state, width);
          await expect(page).toHaveScreenshot(`${route!.id}-w${width}-${theme}.png`, { fullPage: true });
        });
      }
    });
  }
}
