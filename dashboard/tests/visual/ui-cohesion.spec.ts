import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
} from "./auth";
import { VISUAL_ROUTES } from "./routes";
import { assertRuntimeContracts } from "./runtime-contracts";

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

// Failure evidence for the networkidle wait: on a failed test, print the requests
// still in flight, the navigations and the console errors so CI logs show what kept
// the page busy (uploaded artifacts omit traces).
const networkLogs = new WeakMap<Page, { inflight: Map<string, number>; events: string[] }>();
test.beforeEach(({ page }) => {
  const started = Date.now();
  const log = { inflight: new Map<string, number>(), events: [] as string[] };
  const note = (event: string) => {
    log.events.push(`${((Date.now() - started) / 1000).toFixed(1)}s ${event}`);
    if (log.events.length > 60) log.events.splice(0, log.events.length - 60);
  };
  page.on("request", (request) => log.inflight.set(`${request.method()} ${request.url()}`, Date.now() - started));
  const settle = (request: { method(): string; url(): string }) => log.inflight.delete(`${request.method()} ${request.url()}`);
  page.on("requestfinished", settle);
  page.on("requestfailed", (request) => {
    settle(request);
    note(`failed ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) note(`navigated ${frame.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.text().includes("[HMR]") || message.text().includes("Fast Refresh")) note(`console.${message.type()} ${message.text().slice(0, 200)}`);
  });
  networkLogs.set(page, log);
});
test.afterEach(({ page }, testInfo) => {
  const log = networkLogs.get(page);
  if (!log || testInfo.status === testInfo.expectedStatus) return;
  const inflight = [...log.inflight].map(([request, at]) => `${(at / 1000).toFixed(1)}s ${request}`);
  console.log(`[network evidence] ${testInfo.title}\n  in flight:\n    ${inflight.join("\n    ") || "(none)"}\n  events:\n    ${log.events.join("\n    ") || "(none)"}`);
});

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
            test.skip(Boolean(route.harness), `Test driver, not a product surface: covered by ${route.harness}.`);
            await page.addInitScript((selectedTheme) => {
              localStorage.setItem("rolefit-theme", selectedTheme);
              document.documentElement.dataset.theme = selectedTheme;
            }, theme);
            const response = await page.goto(route.path, { waitUntil: "networkidle" });
            await expect(page.locator("body")).toBeVisible();
            const runtime = await assertRuntimeContracts(page);
            if (route.adminOnly) {
              // Access-control assertion: the non-admin identity must get the not-found
              // response, with no operator shell rendered. There is nothing to screenshot.
              expect(response?.status(), `${route.id} must be denied to the non-admin identity`).toBe(404);
              expect(runtime.shellCount, `${route.id} rendered an authenticated shell for a non-admin`).toBe(0);
              return;
            }
            if (route.shell === "app" || route.shell === "board") expect(runtime.shellCount, `${route.id} authenticated shell`).toBe(1);
            if (route.shell === "entry") expect(await page.locator(".rf-entry-shell").count(), `${route.id} entry shell`).toBe(1);
            // Applied only after the runtime contracts have run against the full page.
            if (route.live?.hide.length) await page.addStyleTag({ content: `${route.live.hide.join(",\n")} { display: none !important; }` });
            await expect(page).toHaveScreenshot(`${route.id}-${viewport.id}-${theme}.png`, {
              fullPage: true,
              mask: route.live?.mask.map((selector) => page.locator(selector)),
            });
          });
        });
      }
    });
  }
}
