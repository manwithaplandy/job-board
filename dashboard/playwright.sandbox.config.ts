import { defineConfig, devices } from "@playwright/test";

// Real-browser enforcement tests for the variant 3 sandbox (plan Task 2.7): every case in
// Chromium, Firefox and WebKit, against a production build (`next build` runs first in
// `npm run test:sandbox`; this config starts `next start`), so the route-scoped CSP and
// the other headers are the real ones. The canary (tests/sandbox/canary-server.mjs) is a
// second web server.
//
// One worker and no retries: the canary's record is shared, so cases run one at a time and
// a hit belongs to the case that was running; and a retry must never turn a recorded hit
// into a pass. Each case writes a JSON result under test-results/sandbox/results/, which
// CI uploads on success as well as failure.
const PORT = Number(process.env.SANDBOX_APP_PORT ?? 3200);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/sandbox",
  testMatch: /\.spec\.ts$/,
  // The render smoke shares the folder and the canary but has its own config.
  testIgnore: /render-smoke\.spec\.ts$/,
  globalSetup: "./tests/sandbox/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never", outputFolder: "test-results/sandbox/html" }]] : "list",
  outputDir: "test-results/sandbox/artifacts",
  use: {
    baseURL,
    serviceWorkers: "block",
    // No action waits until the test times out (CI run 1: a textContent() on a missing
    // element did, and the control then failed at the canary read with a closed context).
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      name: "canary",
      command: "node tests/sandbox/canary-server.mjs",
      url: "http://127.0.0.1:4598/health",
      reuseExistingServer: false,
      stdout: "pipe",
      timeout: 30_000,
    },
    {
      name: "app",
      command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
      url: `${baseURL}/ui-gallery/sandbox-harness`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
