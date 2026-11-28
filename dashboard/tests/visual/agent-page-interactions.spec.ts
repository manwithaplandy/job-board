import { expect, test, type Page } from "@playwright/test";
import { ASK_PENDING_TEXT } from "../../components/agent/agentPageFixtureStates";
import { VISUAL_ROUTES } from "./routes";

// Behaviour on the agent page fixtures that a screenshot cannot prove (spec 08 section
// 14.2, plan "Browser validation" item 4). It runs in the public visual job against the
// gallery fixtures, at a desktop and a phone width, and takes no screenshots. PR 1: the
// steps row opens and closes by click and by keyboard, says so through aria-expanded, and
// keeps a 44px target. PR 2: "Go to it" on an updated view's old position moves focus to
// the latest view's title and brings it into view. PR 3 (spec 08 S6): Expand fills the
// viewport, Tab stays in the view and the dock (everything else is inert), the composer
// takes text while a view is expanded, Escape and Back close it with focus back on Expand,
// and an Expand/Close cycle leaves no more than one history entry. PR 6 (spec 08 S10.2):
// the pending ask shows its whole text, Dismiss clears it, and Send posts it to
// /api/agent as a view message (its id starts "view-") and leaves a draft in the composer
// alone. The gallery has no route to answer, so the request is read with waitForRequest
// and nothing is routed or stubbed.

const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated";
const VIEWPORTS = [
  { width: 1280, height: 1000 },
  { width: 375, height: 800 },
] as const;
const MIN_TARGET_PX = 44;

const EXPANDED = '.rf-view[data-expanded="true"]';

/** Where focus is: in the expanded view, in the dock, on the page itself (past the last control), or the element. */
async function focusPlace(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return "page";
    if (active.closest('.rf-view[data-expanded="true"]')) return "view";
    if (active.closest(".rf-agent-dock")) return "dock";
    return active.outerHTML.slice(0, 160);
  });
}

/** Close and Escape go back over the view's history entry; that traversal is asynchronous, so wait for it before the next step. */
async function waitForViewEntryGone(page: Page) {
  await expect.poll(() => page.evaluate(() => (history.state as { rfView?: unknown } | null)?.rfView ?? null)).toBeNull();
}

/**
 * Fix wave I1: Send ignores presses for CHIP_ARM_MS (700 ms) after the frame's height last
 * changed, as well as after the ask appeared. Waits until the sandbox frame's applied height
 * has held still for longer than that, so a press is not lost to a late resize at load.
 */
async function waitForFrameStill(page: Page, stillMs = 900, capMs = 8_000) {
  await page.evaluate(
    async ({ still, cap }) => {
      const t0 = performance.now();
      let last = "";
      let since = t0;
      for (;;) {
        const now = performance.now();
        const h = [...document.querySelectorAll<HTMLIFrameElement>(".rf-sandbox__frame")].map((f) => f.style.height).join(",");
        if (h !== last) {
          last = h;
          since = now;
        } else if (now - since >= still) return;
        if (now - t0 >= cap) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    { still: stillMs, cap: capMs },
  );
}

function routePath(state: string): string {
  const route = VISUAL_ROUTES.find((entry) => entry.path === `/ui-gallery/states/${state}`);
  expect(route, `${state} is in the visual inventory`).toBeDefined();
  return route!.path;
}

for (const viewport of VIEWPORTS) {
  test.describe(`agent page interactions w${viewport.width}`, () => {
    test.use({ viewport, colorScheme: "light" });

    test.beforeEach(async ({ page }) => {
      test.skip(AUTHENTICATED_ONLY, "Explicit authenticated-only screenshot subset.");
      await page.addInitScript(() => {
        localStorage.setItem("rolefit-theme", "light");
        document.documentElement.dataset.theme = "light";
      });
    });

    test(`steps row opens and closes w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-steps-done"), { waitUntil: "networkidle" });
      const toggle = page.getByRole("button", { name: /Worked through 8 steps/ });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      const panelId = await toggle.getAttribute("aria-controls");
      expect(panelId, "the toggle names its panel").toBeTruthy();
      const panel = page.locator(`[id="${panelId}"]`);
      await expect(panel).toBeHidden();

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Searched your reviewed jobs (5 times)");
      await expect(panel).toContainText("Could not read a job review");

      // Keyboard: the toggle keeps focus after the click; Enter closes the panel again.
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toBeHidden();
      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    test(`steps row keeps a 44px target w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-steps-done"), { waitUntil: "networkidle" });
      const box = await page.getByRole("button", { name: /Worked through 8 steps/ }).boundingBox();
      expect(box, "the toggle is laid out").not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    });

    test(`the working row shows its step and frozen timer w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-steps-working"), { waitUntil: "networkidle" });
      const toggle = page.getByRole("button", { name: /Searching your reviewed jobs/ });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(".rf-steps--working .rf-steps__timer")).toHaveText("1:05");
    });

    test(`Go to it focuses the updated view's title w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-view-updated"), { waitUntil: "networkidle" });
      await expect(page.getByText("This view was updated below.")).toBeVisible();
      const title = page.locator(".rf-view .rf-view__title");
      await expect(title).toHaveCount(1);
      await page.getByRole("button", { name: "Go to it" }).click();
      await expect(title).toBeFocused();
      await expect(title).toBeInViewport();
    });

    test(`Expand fills the viewport and keeps Tab in the view and the dock w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-surface"), { waitUntil: "networkidle" });
      await expect(page.locator("[inert]")).toHaveCount(0);
      await page.getByRole("button", { name: /^Expand view:/ }).click();
      const view = page.locator(EXPANDED);
      await expect(view).toHaveCount(1);
      const box = await view.boundingBox();
      expect(box, "the expanded view is laid out").not.toBeNull();
      for (const [got, want, what] of [
        [box!.x, 0, "x"],
        [box!.y, 0, "y"],
        [box!.width, viewport.width, "width"],
        [box!.height, viewport.height, "height"],
      ] as const) {
        expect(Math.abs(got - want), `the expanded view's ${what} is ${got}, the viewport's ${want}`).toBeLessThanOrEqual(1);
      }
      await expect(page.getByRole("button", { name: "Close expanded view" })).toBeFocused();
      await expect(page.locator("html")).toHaveClass(/\brf-view-expanded\b/);
      // Tab until focus reaches the dock: it only ever lands in the view or the dock ("page"
      // is the step past the last control, after which Tab comes back to the first one, in
      // the view). The fixture's view holds about 35 controls (three job cards, a compare
      // table, an approval and a form) before the dock, so the bound is generous.
      const TAB_BOUND = 120;
      const places: string[] = [];
      while (places.length < TAB_BOUND && places.at(-1) !== "dock") {
        await page.keyboard.press("Tab");
        places.push(await focusPlace(page));
      }
      expect(places.filter((p) => p !== "view" && p !== "dock" && p !== "page"), `focus left the view and the dock: ${JSON.stringify(places)}`).toEqual([]);
      expect(places, `Tab reached the dock within ${TAB_BOUND} presses`).toContain("dock");
      // Shift+Tab from the view's first control (Close): everything before it is inert, so
      // focus goes past the start of the page and comes in at the dock, its last controls.
      await page.getByRole("button", { name: "Close expanded view" }).focus();
      const back: string[] = [];
      while (back.length < 4 && back.at(-1) !== "dock") {
        await page.keyboard.press("Shift+Tab");
        back.push(await focusPlace(page));
      }
      expect(back.filter((p) => p !== "dock" && p !== "page"), `Shift+Tab from Close went elsewhere: ${JSON.stringify(back)}`).toEqual([]);
      expect(back, "Shift+Tab from Close reached the dock").toContain("dock");
    });

    test(`the composer takes text while a view is expanded w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-surface"), { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /^Expand view:/ }).click();
      await expect(page.locator(EXPANDED)).toHaveCount(1);
      const composer = page.getByLabel(/^Message/);
      await expect(composer).toBeInViewport();
      await composer.click();
      await composer.pressSequentially("A draft typed over the view");
      await expect(composer).toHaveValue("A draft typed over the view");
      await expect(page.locator(EXPANDED), "typing did not close the view").toHaveCount(1);
    });

    test(`Escape closes the expanded view and focus returns to Expand w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-surface"), { waitUntil: "networkidle" });
      const expand = page.getByRole("button", { name: /^Expand view:/ });
      await expand.click();
      await expect(page.getByRole("button", { name: "Close expanded view" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.locator(EXPANDED)).toHaveCount(0);
      await expect(expand).toBeFocused();
      await expect(expand).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("[inert]")).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveClass(/\brf-view-expanded\b/);
    });

    test(`Back closes the expanded view and the URL is unchanged w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-surface"), { waitUntil: "networkidle" });
      const url = page.url();
      await page.getByRole("button", { name: /^Expand view:/ }).click();
      await expect(page.locator(EXPANDED)).toHaveCount(1);
      expect(page.url(), "expanding does not change the URL").toBe(url);
      await page.goBack();
      await expect(page.locator(EXPANDED)).toHaveCount(0);
      expect(page.url(), "Back closed the view and stayed on the page").toBe(url);
      await expect(page.locator("[inert]")).toHaveCount(0);
    });

    test(`Expand and Close leave at most one history entry per cycle w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-surface"), { waitUntil: "networkidle" });
      const start = await page.evaluate(() => history.length);
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /^Expand view:/ }).click();
        await expect(page.locator(EXPANDED)).toHaveCount(1);
        await page.getByRole("button", { name: "Close expanded view" }).click();
        await expect(page.locator(EXPANDED)).toHaveCount(0);
        await waitForViewEntryGone(page);
        const now = await page.evaluate(() => history.length);
        expect(now - start, `history grew by ${now - start} after ${i + 1} cycle(s)`).toBeLessThanOrEqual(1);
      }
    });

    test(`the pending ask shows its whole text and Dismiss clears it w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-ask-pending"), { waitUntil: "networkidle" });
      const pending = page.locator("[data-sandbox-ask]");
      await expect(pending).toHaveCount(1);
      const text = pending.locator(".rf-ask__text");
      await expect(text).toHaveText(ASK_PENDING_TEXT);
      await expect(text).toBeVisible();
      const fit = await text.evaluate((el) => {
        const own = el.getBoundingClientRect();
        const holder = el.closest(".rf-view")!.getBoundingClientRect();
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, right: own.right, holderRight: holder.right, pageScroll: document.documentElement.scrollWidth, inner: window.innerWidth };
      });
      expect(fit.scrollWidth, `the ask text is not clipped: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.clientWidth);
      expect(fit.right, `the ask text stays inside its view: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.holderRight + 1);
      expect(fit.pageScroll, "no horizontal page scroll").toBeLessThanOrEqual(fit.inner);
      await page.getByRole("button", { name: `Dismiss: ${ASK_PENDING_TEXT}` }).click();
      await expect(pending).toHaveCount(0);
    });

    test(`Send posts the ask as a view message and keeps the composer's draft w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-ask-pending"), { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      const pending = page.locator("[data-sandbox-ask]");
      await expect(pending).toHaveCount(1);
      const composer = page.getByLabel(/^Message/);
      await composer.click();
      await composer.pressSequentially("A draft I am still writing");
      await expect(composer).toHaveValue("A draft I am still writing");

      await waitForFrameStill(page);
      const sent = page.waitForRequest((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/agent");
      await page.getByRole("button", { name: `Send: ${ASK_PENDING_TEXT}` }).click();
      const body: unknown = (await sent).postDataJSON();
      expect(body, "the request is a message").toMatchObject({ kind: "message", text: ASK_PENDING_TEXT, source: { kind: "view" } });
      const id = (body as { id?: unknown }).id;
      expect(typeof id === "string" && id.startsWith("view-"), `the message id starts "view-": ${String(id)}`).toBe(true);
      await expect(pending, "Send cleared the pending ask").toHaveCount(0);
      await expect(composer, "the draft is still in the composer").toHaveValue("A draft I am still writing");
    });

    test(`nothing is inert when no view is expanded w${viewport.width}`, async ({ page }) => {
      await page.goto(routePath("agent-page-steps-done"), { waitUntil: "networkidle" });
      await expect(page.locator(".rf-view")).toHaveCount(1);
      await expect(page.locator("[inert]")).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveClass(/\brf-view-expanded\b/);
    });
  });
}
