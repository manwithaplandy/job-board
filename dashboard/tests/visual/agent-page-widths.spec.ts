import { expect, test, type Page } from "@playwright/test";
import { VISUAL_ROUTES } from "./routes";
import { assertRuntimeContracts } from "./runtime-contracts";
import { inlineSandboxView, screenshotSandboxView } from "./sandbox-view";
import { CODE_CHART_STAGES } from "../../components/agent/agentPageFixtureStates";

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
// agent-page-ask-pending (spec 08 S10.2) also checks that the pending ask shows its whole
// text (nothing clipped or scrolled sideways) and overlaps neither the view's header nor the
// composer.
// Fix wave I3: at the phone width, a state with an inline code view (a sandbox frame, not
// expanded) also gets an element screenshot of that view frame, <route id>-w375-<theme>-view.png,
// taken after the frame is scrolled into view and its document has painted (sandbox-view.ts):
// the full-page screenshot shows a below-the-fold frame's box without its content.
// agent-page-ask-pending must have one.
// agent-page-code-chart (polish wave, item A) also checks the code view's kit bar chart: its
// SVG is not scaled (so its text renders at its CSS size), every label's box is the height
// its font size gives, and the six stage labels sit inside the chart and keep apart. It does
// so at the frame's own width, then at the frame widths 320, 768, 1000 and 1440 by setting
// the chart element's width inside the frame (the kit redraws the chart at each), after the
// screenshots.

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
  "agent-page-ask-pending",
  "agent-page-code-chart",
] as const;

const REGIONS = [".rf-agent-threads", ".rf-agent-toolbar", ".rf-agent-transcript", ".rf-agent-composer"] as const;

const isExpandedState = (state: string) => state.endsWith("-expanded");
/** Fix wave I3: the width whose inline code views also get an element screenshot. */
const PHONE_WIDTH = 375;

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
  if (
    state === "agent-page-surface" ||
    state === "agent-page-view-updated" ||
    state === "agent-page-view-degraded" ||
    state === "agent-page-ask-pending" ||
    state === "agent-page-code-chart" ||
    isExpandedState(state)
  ) {
    expect(layout.views, `${state} shows its view at ${width}px`).toBe(1);
  }
  if (state === "agent-page-views-multi") {
    expect(layout.views, `${state} shows two views at ${width}px`).toBe(2);
    expect(layout.replyOrder, `${state} keeps text and views in stored order at ${width}px`).toEqual(["text", "view", "text", "view", "text"]);
  }
  expect(layout.scrollWidth, `no horizontal page scroll at ${width}px`).toBeLessThanOrEqual(layout.innerWidth);
}

/** The pending ask (PR 6): its text is all shown, and it sits clear of the view header and the composer. */
async function assertAskPending(page: Page, width: number) {
  const pending = page.locator("[data-sandbox-ask]");
  await expect(pending, `the pending ask is shown at ${width}px`).toBeVisible();
  const box = await pending.evaluate((el) => {
    const text = el.querySelector(".rf-ask__text")!;
    const rect = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
    };
    const own = el.getBoundingClientRect();
    return {
      textScroll: [text.scrollWidth, text.clientWidth, text.scrollHeight, text.clientHeight],
      own: { left: own.left, right: own.right, top: own.top, bottom: own.bottom },
      header: rect(".rf-view__header"),
      composer: rect(".rf-agent-composer"),
    };
  });
  const [scrollW, clientW, scrollH, clientH] = box.textScroll;
  expect(scrollW, `the ask text is not clipped sideways at ${width}px`).toBeLessThanOrEqual(clientW);
  expect(scrollH, `the ask text is not clipped vertically at ${width}px`).toBeLessThanOrEqual(clientH);
  for (const [name, other] of [["view header", box.header], ["composer", box.composer]] as const) {
    if (other === null) continue;
    const x = Math.min(box.own.right, other.right) - Math.max(box.own.left, other.left);
    const y = Math.min(box.own.bottom, other.bottom) - Math.max(box.own.top, other.top);
    expect(x > 1 && y > 1, `the pending ask overlaps the ${name} at ${width}px: ${JSON.stringify(box)}`).toBe(false);
  }
}

/** The frame widths the chart text is checked at, besides the frame's own (polish wave, item A). */
const CHART_FRAME_WIDTHS = [320, 768, 1000, 1440] as const;

/**
 * agent-page-code-chart (polish wave, item A): the kit's chart text renders at its CSS size
 * (within 10%) and the stage labels never overlap, at the frame's own width and at each of
 * CHART_FRAME_WIDTHS (the kit's body has 16px padding on each side, so the chart element is
 * set to the frame width less 32px). Run after the screenshots: it changes the frame's layout.
 */
async function assertChartText(page: Page, width: number) {
  const view = await inlineSandboxView(page);
  expect(view, `agent-page-code-chart has an inline code view at ${width}px`).not.toBeNull();
  await view!.scrollIntoViewIfNeeded();
  const handle = await view!.locator("iframe.rf-sandbox__frame").first().elementHandle({ timeout: 8_000 });
  const frame = handle ? await handle.contentFrame() : null;
  expect(frame, `the chart view has a document at ${width}px`).not.toBeNull();
  await expect
    .poll(() => frame!.locator("svg.jb-chart text.jb-chart-label").count(), { message: `the chart drew its labels at ${width}px`, timeout: 8_000 })
    .toBeGreaterThan(0);
  for (const frameWidth of [null, ...CHART_FRAME_WIDTHS]) {
    const at = frameWidth === null ? `the frame's own width (page ${width}px)` : `frame width ${frameWidth}px (page ${width}px)`;
    const got = await frame!.evaluate(async (fw) => {
      const host = document.getElementById("stages")!;
      if (fw !== null) host.style.setProperty("width", `${fw - 32}px`);
      // The kit redraws from its ResizeObserver, which runs before the next paint.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const svg = host.querySelector<SVGSVGElement>("svg.jb-chart")!;
      const box = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll<SVGTextElement>("text")].map((t) => {
        const r = t.getBoundingClientRect();
        return {
          text: t.childNodes[0]?.textContent ?? "",
          row: t.getAttribute("y") ?? "",
          fontSize: Number.parseFloat(getComputedStyle(t).fontSize),
          height: r.height,
          left: r.left - box.left,
          right: r.right - box.left,
        };
      });
      return {
        scale: box.width / svg.viewBox.baseVal.width,
        width: box.width,
        texts,
        scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      };
    }, frameWidth);
    expect(Math.abs(got.scale - 1), `the chart's SVG is drawn at its own width, not scaled, at ${at}: ${JSON.stringify(got)}`).toBeLessThanOrEqual(0.1);
    expect(got.texts.map((t) => t.text).sort(), `every stage label is shown in full at ${at}`).toEqual(CODE_CHART_STAGES.map((s) => s.label).sort());
    const rows = new Map<string, typeof got.texts>();
    for (const t of got.texts) {
      // A label's box is about 1.2 times its font size; a scaled SVG would make it 2.5 times.
      const ratio = t.height / (t.fontSize * got.scale);
      expect(ratio, `"${t.text}" renders at its CSS size at ${at}: ${JSON.stringify(t)}`).toBeGreaterThanOrEqual(0.9);
      expect(t.height / t.fontSize, `"${t.text}" is not drawn larger than its CSS size at ${at}: ${JSON.stringify(t)}`).toBeLessThanOrEqual(1.6);
      expect(t.left, `"${t.text}" starts inside the chart at ${at}`).toBeGreaterThanOrEqual(-0.5);
      expect(t.right, `"${t.text}" ends inside the chart at ${at}`).toBeLessThanOrEqual(got.width + 0.5);
      rows.set(t.row, [...(rows.get(t.row) ?? []), t]);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.left - b.left);
      for (let i = 1; i < row.length; i++) {
        expect(row[i].left - row[i - 1].right, `"${row[i - 1].text}" and "${row[i].text}" keep apart at ${at}`).toBeGreaterThanOrEqual(4);
      }
    }
    if (frameWidth === null) {
      expect(got.scroll[0], `the chart view does not scroll sideways at ${at}`).toBeLessThanOrEqual(got.scroll[1]);
    }
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
          if (isExpandedState(state)) await assertExpanded(page, width);
          if (state === "agent-page-ask-pending") await assertAskPending(page, width);
          await expect(page).toHaveScreenshot(`${route!.id}-w${width}-${theme}.png`, { fullPage: !isExpandedState(state) });
          if (width === PHONE_WIDTH && !isExpandedState(state)) {
            const view = await inlineSandboxView(page);
            if (state === "agent-page-ask-pending") expect(view, `${state} has an inline code view at ${width}px`).not.toBeNull();
            if (view) await screenshotSandboxView(view, `${route!.id}-w${width}-${theme}-view.png`);
          }
          if (state === "agent-page-code-chart") await assertChartText(page, width);
        });
      }
    });
  }
}
