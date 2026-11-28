import { expect, test, type Page } from "@playwright/test";
import { VISUAL_ROUTES } from "./routes";
import { assertRuntimeContracts } from "./runtime-contracts";

// The agent page across the width matrix (spec 08 S12, plan D10): 375 (a phone), 768 (a
// tablet, the list still above the chat), 1024 (the list beside the chat from 900), 1280
// and 1440 (where the old surface column used to split the page) and 2000 (the page wrap
// capped at 1440). ui-cohesion.spec.ts adds 390 and 1440 for every route. Only the agent
// page fixtures run here.
// One conversation column at every width: views render inline in the reply, in their view
// frame, and the surface column is gone (spec 08 S4.1). Each run checks the shared runtime
// contracts, then that the conversation list, the toolbar, the transcript and the composer
// never overlap, that no surface column exists, that every view frame sits in the
// transcript or follows it as an orphan, and that the page never scrolls sideways; then it
// takes a screenshot named <route id>-w<width>-<theme>.png (ui-cohesion uses
// -desktop-/-mobile-, so the names cannot collide).
// An expanded state (its name ends "-expanded", spec 08 S6) also checks that the expanded
// frame's box is the viewport (1px slack), that the composer is visible and that the point
// at its centre belongs to the dock, so the dock is on top of the view and nothing covers
// it. The regions behind the expanded view overlap it by design, so the overlap check is
// left out there, and the screenshot is of the viewport (the view is fixed to it).
// agent-page-views-multi (spec 08 S4.4) also checks that its reply holds two views, in the
// order text, view, text, view, text.

const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated";
const THEMES = ["light", "dark"] as const;
const WIDTHS = [375, 768, 1024, 1280, 1440, 2000] as const;
const HEIGHT = 1000;
const STATES = [
  "agent-page-conversation",
  "agent-page-surface",
  "agent-page-failed",
  "agent-page-view-building",
  "agent-page-view-updated",
  "agent-page-view-degraded",
  "agent-page-steps-working",
  "agent-page-steps-done",
  "agent-page-steps-open",
  "agent-page-view-expanded",
  "agent-page-code-expanded",
  "agent-page-views-multi",
] as const;

const REGIONS = [".rf-agent-threads", ".rf-agent-toolbar", ".rf-agent-transcript", ".rf-agent-composer"] as const;

const isExpandedState = (state: string) => state.endsWith("-expanded");

async function assertExpanded(page: Page, width: number) {
  const box = await page.locator('.rf-view[data-expanded="true"]').boundingBox();
  expect(box, `the expanded view is laid out at ${width}px`).not.toBeNull();
  const viewport = page.viewportSize()!;
  for (const [got, want, what] of [
    [box!.x, 0, "x"],
    [box!.y, 0, "y"],
    [box!.width, viewport.width, "width"],
    [box!.height, viewport.height, "height"],
  ] as const) {
    expect(Math.abs(got - want), `the expanded view's ${what} is ${got}, the viewport's ${want}, at ${width}px`).toBeLessThanOrEqual(1);
  }
  const composer = page.locator(".rf-agent-composer");
  await expect(composer, `the composer is visible at ${width}px`).toBeVisible();
  await expect(composer, `the composer is on screen at ${width}px`).toBeInViewport();
  const onTop = await composer.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && hit.closest(".rf-agent-dock") !== null;
  });
  expect(onTop, `the point at the composer's centre is in the dock at ${width}px`).toBe(true);
}

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
    // Every view frame is in the transcript, or after it as an orphan (a chain no loaded
    // message names), never anywhere else.
    const transcript = document.querySelector(".rf-agent-transcript");
    const lastReply = [...document.querySelectorAll(".rf-agent-transcript > li")].at(-1);
    const replyOrder = lastReply
      ? [...lastReply.querySelectorAll(".rf-md, .rf-view")].map((el) => (el.classList.contains("rf-view") ? "view" : "text"))
      : [];
    const misplacedViews = [...document.querySelectorAll(".rf-view")]
      .filter((view) => !(transcript && (transcript.contains(view) || transcript.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING)))
      .map((view) => view.getAttribute("aria-label") ?? "view");
    return {
      found: boxes.map((box) => box.selector),
      overlaps,
      escapedTitles,
      surfaceColumn: document.querySelector(".rf-agent-surface-column") !== null,
      views: document.querySelectorAll(".rf-view").length,
      replyOrder,
      misplacedViews,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  }, [...REGIONS]);
  if (!isExpandedState(state)) expect(layout.overlaps, `agent page regions overlap: ${JSON.stringify(layout)}`).toEqual([]);
  expect(layout.escapedTitles, "conversation titles wider than the list").toEqual([]);
  for (const selector of REGIONS) {
    expect(layout.found, `${selector} is shown`).toContain(selector);
  }
  expect(layout.surfaceColumn, `no surface column at ${width}px`).toBe(false);
  expect(layout.misplacedViews, `views outside the transcript at ${width}px`).toEqual([]);
  if (state === "agent-page-surface" || state === "agent-page-view-updated" || state === "agent-page-view-degraded" || isExpandedState(state)) {
    expect(layout.views, `${state} shows its view at ${width}px`).toBe(1);
  }
  if (state === "agent-page-views-multi") {
    expect(layout.views, `${state} shows two views at ${width}px`).toBe(2);
    expect(layout.replyOrder, `${state} keeps text and views in stored order at ${width}px`).toEqual(["text", "view", "text", "view", "text"]);
  }
  expect(layout.scrollWidth, `no horizontal page scroll at ${width}px`).toBeLessThanOrEqual(layout.innerWidth);
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
          if (isExpandedState(state)) await assertExpanded(page, width);
          await expect(page).toHaveScreenshot(`${route!.id}-w${width}-${theme}.png`, { fullPage: !isExpandedState(state) });
        });
      }
    });
  }
}
