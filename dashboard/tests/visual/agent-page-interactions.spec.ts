import { expect, test } from "@playwright/test";
import { VISUAL_ROUTES } from "./routes";

// Behaviour on the agent page fixtures that a screenshot cannot prove (spec 08 section
// 14.2, plan "Browser validation" item 4). It runs in the public visual job against the
// gallery fixtures, at a desktop and a phone width, and takes no screenshots. PR 1: the
// steps row opens and closes by click and by keyboard, says so through aria-expanded, and
// keeps a 44px target. PR 2: "Go to it" on an updated view's old position moves focus to
// the latest view's title and brings it into view. Later PRs add Expand and the pending
// ask here.

const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated";
const VIEWPORTS = [
  { width: 1280, height: 1000 },
  { width: 375, height: 800 },
] as const;
const MIN_TARGET_PX = 44;

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
  });
}
