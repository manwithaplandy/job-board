import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  acquireLoginFormWithRetry,
  ESTABLISHED_STATE_PATH,
  formatVisualAuthDiagnostic,
  ONBOARDING_STATE_PATH,
  readVercelProtectionBypassHeaders,
  readVisualCredentials,
  validateVisualBaseUrl,
  VISUAL_AUTH_DIR,
  type VisualAuthIdentity,
  type VisualAuthNetworkEvent,
  type VisualAuthPhase,
  type VisualAuthStructure,
} from "./auth";

const TEST_TIMEOUT_MS = 240_000;
const NAVIGATION_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 10_000;
const AUTH_OUTCOME_TIMEOUT_MS = 20_000;
const EVIDENCE_TIMEOUT_MS = 5_000;
const VISUAL_FAILURE_SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  "test-results/visual/auth-setup",
);

test.setTimeout(TEST_TIMEOUT_MS);

test("creates isolated established and onboarding sessions", async ({
  browser,
}) => {
  const baseURL = validateVisualBaseUrl(process.env.VISUAL_BASE_URL);
  const credentials = readVisualCredentials(process.env);
  const protectionBypassHeaders =
    readVercelProtectionBypassHeaders(process.env);
  await mkdir(VISUAL_AUTH_DIR, { recursive: true });

  async function captureLoginFormFailureEvidence(
    page: Page,
    identityName: VisualAuthIdentity,
  ): Promise<VisualAuthStructure | undefined> {
    let structure: VisualAuthStructure | undefined;
    await Promise.all([
      (async () => {
        try {
          const [forms, inputs, buttons, headings] = await Promise.all([
            page.locator("form").count(),
            page.locator("input").count(),
            page.locator("button").count(),
            page.locator("h1, h2, h3, h4, h5, h6").count(),
          ]);
          structure = { forms, inputs, buttons, headings };
        } catch {
          // The screenshot and primary diagnostic remain independently useful.
        }
      })(),
      (async () => {
        try {
          await mkdir(VISUAL_FAILURE_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({
            path: path.join(
              VISUAL_FAILURE_SCREENSHOT_DIR,
              `${identityName}-login-form-failure.png`,
            ),
            fullPage: true,
            timeout: EVIDENCE_TIMEOUT_MS,
          });
        } catch {
          // A missing screenshot must not mask the primary diagnostic.
        }
      })(),
    ]);
    return structure;
  }

  async function waitForAuthenticationOutcome(
    page: Page,
    expectedURL: string,
  ): Promise<"success" | "rejected" | "timeout" | "closed"> {
    const alert = page.getByRole("alert");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timeoutId = setTimeout(() => resolve("timeout"), AUTH_OUTCOME_TIMEOUT_MS);
    });

    try {
      return await Promise.race([
        page
          .waitForURL(expectedURL, { waitUntil: "commit", timeout: 0 })
          .then(() => "success" as const, () => "closed" as const),
        alert
          .waitFor({ state: "visible", timeout: 0 })
          .then(() => "rejected" as const, () => "closed" as const),
        timeout,
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function signIn(
    activeBrowser: Browser,
    identity: { email: string; password: string },
    identityName: VisualAuthIdentity,
    statePath: string,
    expectedPath: "/profile" | "/onboarding",
  ) {
    const context = await activeBrowser.newContext({
      extraHTTPHeaders: protectionBypassHeaders,
    });
    const network: VisualAuthNetworkEvent[] = [];
    let structure: VisualAuthStructure | undefined;
    let page: Page | undefined;
    let primaryError: unknown;
    try {
      page = await context.newPage();
      const diagnostic = (phase: VisualAuthPhase) =>
        formatVisualAuthDiagnostic({
          identity: identityName,
          phase,
          currentUrl: page?.url() ?? baseURL,
          network,
          structure,
        });
      const runPhase = async <T>(
        phase: VisualAuthPhase,
        operation: () => Promise<T>,
      ): Promise<T> => {
        try {
          return await operation();
        } catch {
          throw new Error(diagnostic(phase));
        }
      };
      const record = (event: VisualAuthNetworkEvent) => {
        network.push(event);
        if (network.length > 24) network.shift();
      };
      page.on("response", (response) => {
        if (new URL(response.url()).origin !== baseURL) return;
        record({
          method: response.request().method(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
        });
      });
      page.on("requestfailed", (request) => {
        if (new URL(request.url()).origin !== baseURL) return;
        record({
          method: request.method(),
          pathname: new URL(request.url()).pathname,
          status: "failed",
        });
      });

      await runPhase("open-login", () =>
        page!.goto(`${baseURL}/login`, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        }),
      );
      const loginForm = page.locator("form");
      const email = loginForm.locator('input[name="email"][type="email"]');
      const password = loginForm.locator(
        'input[name="password"][type="password"]',
      );
      const submit = loginForm.locator('button[type="submit"]');
      await runPhase("render-form", () =>
        acquireLoginFormWithRetry(
          async () => {
            await expect(loginForm).toHaveCount(1, {
              timeout: ACTION_TIMEOUT_MS,
            });
            await expect(email).toHaveCount(1, {
              timeout: ACTION_TIMEOUT_MS,
            });
            await expect(password).toHaveCount(1, {
              timeout: ACTION_TIMEOUT_MS,
            });
            await expect(submit).toHaveCount(1, {
              timeout: ACTION_TIMEOUT_MS,
            });
            await expect(email).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
            await expect(password).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
            await expect(submit).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
          },
          () =>
            page!.reload({
              waitUntil: "domcontentloaded",
              timeout: NAVIGATION_TIMEOUT_MS,
            }),
          async () => {
            structure = await captureLoginFormFailureEvidence(
              page!,
              identityName,
            );
          },
          EVIDENCE_TIMEOUT_MS,
        ),
      );
      await runPhase("fill-form", async () => {
        await email.fill(identity.email, { timeout: ACTION_TIMEOUT_MS });
        await password.fill(identity.password, { timeout: ACTION_TIMEOUT_MS });
      });

      const expectedURL =
        expectedPath === "/profile" ? `${baseURL}/` : `${baseURL}/onboarding`;
      const outcomePromise = waitForAuthenticationOutcome(page, expectedURL);
      await runPhase("submit-click", () =>
        submit.click({ timeout: ACTION_TIMEOUT_MS, noWaitAfter: true }),
      );
      const outcome = await outcomePromise;
      if (outcome === "rejected") {
        throw new Error(diagnostic("authentication-rejected"));
      }
      if (outcome !== "success") {
        throw new Error(diagnostic("authentication-outcome"));
      }

      if (expectedPath === "/profile") {
        await runPhase("verify-established-redemption", async () => {
          await page!.goto(`${baseURL}/billing`, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATION_TIMEOUT_MS,
          });
          await expect(
            page!.getByText("Comped beta invite", { exact: true }),
          ).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
        });
        await runPhase("render-profile", async () => {
          await page!.goto(`${baseURL}/profile`, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATION_TIMEOUT_MS,
          });
          await expect(
            page!.getByRole("heading", { name: "Profile", exact: true }),
          ).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
        });
      } else {
        await runPhase("verify-onboarding-redemption", async () => {
          const response = await context.request.post(
            `${baseURL}/api/resume/extract`,
            {
              multipart: {},
              timeout: NAVIGATION_TIMEOUT_MS,
            },
          );
          record({
            method: "POST",
            pathname: "/api/resume/extract",
            status: response.status(),
          });
          const { error } = (await response.json()) as { error?: unknown };
          if (response.status() !== 400 || error !== "no file provided") {
            throw new Error("Unexpected onboarding redemption probe response");
          }
        });
      }

      await runPhase("persist-state", () =>
        context.storageState({ path: statePath }),
      );
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        await context.close();
      } catch {
        if (!primaryError) {
          throw new Error(
            formatVisualAuthDiagnostic({
              identity: identityName,
              phase: "cleanup",
              currentUrl: page?.url() ?? baseURL,
              network,
            }),
          );
        }
      }
    }
  }

  await signIn(
    browser,
    credentials.established,
    "established",
    ESTABLISHED_STATE_PATH,
    "/profile",
  );
  await signIn(
    browser,
    credentials.onboarding,
    "onboarding",
    ONBOARDING_STATE_PATH,
    "/onboarding",
  );
});
