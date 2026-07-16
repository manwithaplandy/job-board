import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
} from "./auth";
import { VISUAL_ROUTES } from "./routes";

const PUBLIC_ONLY = process.env.VISUAL_SCOPE === "public";
const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated";
const NORMAL_AUTH_STATE = PUBLIC_ONLY ? undefined : ESTABLISHED_STATE_PATH;
const ONBOARDING_AUTH_STATE = PUBLIC_ONLY ? undefined : ONBOARDING_STATE_PATH;
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "mobile", width: 390, height: 844 },
] as const;

test.beforeAll(() => {
  if (
    !PUBLIC_ONLY &&
    (!existsSync(ESTABLISHED_STATE_PATH) || !existsSync(ONBOARDING_STATE_PATH))
  ) {
    throw new Error(
      "Full visual coverage requires fresh established and onboarding state files. Run npm run test:visual:auth-setup first.",
    );
  }
});

async function assertRuntimeContracts(page: Page) {
  const runtime = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const defaultControls = [...document.querySelectorAll("button,input:not([type=hidden]),select,textarea")]
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.fontFamily === "serif" || style.backgroundColor === "rgb(239, 239, 239)" || (element.tagName === "SELECT" && style.appearance === "auto");
      }).map((element) => element.outerHTML.slice(0, 180));
    const undersized = [...document.querySelectorAll("button,a[href],[role=button],[role=menuitem],[role=tab],[role=radio],input:not([type=hidden]),select,textarea,.rf-button,.rf-icon-button")]
      .filter(visible)
      .filter((element) => !(element.tagName === "A" && element.closest(".rf-reading-content,.rf-entry-consent")))
      // The 1px native file input delegates its focusable 44px hit target to the
      // immediately following styled label (the documented FileUpload composite).
      .filter((element) => !(element.matches(".rf-file-upload__input") && element.nextElementSibling?.matches("label.rf-button")))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).map((element) => ({ tag: element.tagName, className: element.getAttribute("class"), label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 50) }));
    const rawSvgs = [...document.querySelectorAll("svg:not(.rf-icon)")].filter((element) => !element.hasAttribute("data-fit-score-ring") && !element.closest('[data-ui-visual="data-viz"]'));
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      defaultControls,
      undersized,
      rawSvgCount: rawSvgs.length,
      shellCount: document.querySelectorAll('[data-testid="app-shell"],.app-shell--board').length,
    };
  });
  expect(runtime.scrollWidth, `document overflow: ${JSON.stringify(runtime)}`).toBeLessThanOrEqual(runtime.viewport);
  expect(runtime.defaultControls, "browser-default controls").toEqual([]);
  expect(runtime.undersized, "interactive targets under 44px").toEqual([]);
  expect(runtime.rawSvgCount, "SVGs outside the internal icon/data-viz exceptions").toBe(0);
  return runtime;
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.id} ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme });
      for (const route of VISUAL_ROUTES) {
        test.describe(route.id, () => {
          test.use({ storageState: route.access === "authenticated" ? (route.authState === "onboarding" ? ONBOARDING_AUTH_STATE : NORMAL_AUTH_STATE) : undefined });
          test(`${route.id}`, async ({ page }) => {
            test.skip(route.access === "authenticated" && PUBLIC_ONLY, "Explicit public-only screenshot subset.");
            test.skip(route.access === "public" && AUTHENTICATED_ONLY, "Explicit authenticated-only screenshot subset.");
            await page.addInitScript((selectedTheme) => {
              localStorage.setItem("rolefit-theme", selectedTheme);
              document.documentElement.dataset.theme = selectedTheme;
            }, theme);
            await page.goto(route.path, { waitUntil: "networkidle" });
            await expect(page.locator("body")).toBeVisible();
            const runtime = await assertRuntimeContracts(page);
            if (route.shell === "app" || route.shell === "board") expect(runtime.shellCount, `${route.id} authenticated shell`).toBe(1);
            if (route.shell === "entry") expect(await page.locator(".rf-entry-shell").count(), `${route.id} entry shell`).toBe(1);
            await expect(page).toHaveScreenshot(`${route.id}-${viewport.id}-${theme}.png`, { fullPage: true });
          });
        });
      }
    });
  }
}
