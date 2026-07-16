import { mkdir } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
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
} from "./auth";

const TEST_TIMEOUT_MS = 120_000;
const NAVIGATION_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 10_000;
const AUTH_OUTCOME_TIMEOUT_MS = 20_000;

test.setTimeout(TEST_TIMEOUT_MS);

test("creates isolated established and onboarding sessions", async ({
  browser,
}) => {
  const baseURL = validateVisualBaseUrl(process.env.VISUAL_BASE_URL);
  const credentials = readVisualCredentials(process.env);
  const protectionBypassHeaders =
    readVercelProtectionBypassHeaders(process.env);
  await mkdir(VISUAL_AUTH_DIR, { recursive: true });

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
      const email = page.getByLabel("Email", { exact: true });
      const password = page.getByLabel("Password", { exact: true });
      const submit = page.getByRole("button", {
        name: "Sign in",
        exact: true,
      });
      await runPhase("render-form", async () => {
        await expect(email).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
        await expect(password).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
        await expect(submit).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
      });
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
        await runPhase("render-profile", async () => {
          await page!.goto(`${baseURL}/profile`, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATION_TIMEOUT_MS,
          });
          await expect(
            page!.getByRole("heading", { name: "Profile", exact: true }),
          ).toBeVisible({ timeout: ACTION_TIMEOUT_MS });
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
