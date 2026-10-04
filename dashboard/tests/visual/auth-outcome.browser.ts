import { expect, test } from "@playwright/test";
import { waitForAuthenticationOutcome } from "./auth-outcome";

const loginURL = "http://auth-harness.invalid/login";

async function loginPage(page: import("@playwright/test").Page) {
  // Fulfill every request locally; this suite must never contact an auth service.
  await page.route("**/*", (route) => route.fulfill({
    contentType: "text/html",
    body: '<form><input name="email" type="email"><input name="password" type="password"><button type="submit">Sign in</button></form>',
  }));
  await page.goto(loginURL);
  await page.evaluate(() => {
    // Next 16.2.10 app-router route announcer: visible to Playwright even empty.
    const host = document.createElement("next-route-announcer");
    const alert = document.createElement("div");
    alert.setAttribute("role", "alert");
    alert.setAttribute("aria-live", "assertive");
    alert.style.cssText = "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap;word-wrap:normal";
    host.attachShadow({ mode: "open" }).appendChild(alert);
    document.body.appendChild(host);
  });
  await expect(page.getByRole("alert")).toBeVisible();
}

test("ignores an empty framework announcer while waiting for successful navigation", async ({ page }) => {
  await loginPage(page);
  const outcome = waitForAuthenticationOutcome(page, "http://auth-harness.invalid/");
  // A failed submission never navigates here; success must still require the URL.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.goto("http://auth-harness.invalid/");
  expect(await outcome).toEqual({ status: "success" });
});

for (const [message, classification] of [
  ["Incorrect email or password.", "invalid_credentials"],
  ["An unexpected sign-in error", "generic_or_unknown"],
] as const) {
  test(`rejects actual form error: ${classification}`, async ({ page }) => {
    await loginPage(page);
    const outcome = waitForAuthenticationOutcome(page, "http://auth-harness.invalid/");
    await page.evaluate((text) => {
      const alert = document.createElement("div");
      alert.setAttribute("role", "alert");
      alert.textContent = text;
      document.querySelector("form")!.appendChild(alert);
    }, message);
    expect(await outcome).toEqual({ status: "rejected", classification });
    expect(page.url()).toBe(loginURL);
  });
}
