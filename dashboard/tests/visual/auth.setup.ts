import { mkdir } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
  readVisualCredentials,
  validateVisualBaseUrl,
  VISUAL_AUTH_DIR,
} from "./auth";

test("creates isolated established and onboarding sessions", async ({
  browser,
}) => {
  const baseURL = validateVisualBaseUrl(process.env.VISUAL_BASE_URL);
  const credentials = readVisualCredentials(process.env);
  await mkdir(VISUAL_AUTH_DIR, { recursive: true });

  async function waitForAuthenticationOutcome(
    page: Page,
    expectedURL: string,
  ) {
    const alert = page.getByRole("alert");
    await Promise.race([
      page.waitForURL(expectedURL),
      alert.waitFor({ state: "visible" }).then(async () => {
        const safeMessage = (await alert.innerText()).trim();
        throw new Error(
          `Visual authentication failed: ${safeMessage || "Sign in was rejected."}`,
        );
      }),
    ]);
  }

  async function signIn(
    activeBrowser: Browser,
    identity: { email: string; password: string },
    statePath: string,
    expectedPath: "/profile" | "/onboarding",
  ) {
    const context = await activeBrowser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/login`);
      await page
        .getByLabel("Email", { exact: true })
        .fill(identity.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill(identity.password);
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .click();

      const expectedURL =
        expectedPath === "/profile" ? `${baseURL}/` : `${baseURL}/onboarding`;
      await waitForAuthenticationOutcome(page, expectedURL);

      if (expectedPath === "/profile") {
        await page.goto(`${baseURL}/profile`);
        await expect(
          page.getByRole("heading", { name: "Profile", exact: true }),
        ).toBeVisible();
      }

      await context.storageState({ path: statePath });
    } finally {
      await context.close();
    }
  }

  await signIn(
    browser,
    credentials.established,
    ESTABLISHED_STATE_PATH,
    "/profile",
  );
  await signIn(
    browser,
    credentials.onboarding,
    ONBOARDING_STATE_PATH,
    "/onboarding",
  );
});
