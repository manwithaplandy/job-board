import { defineConfig, devices } from "@playwright/test";

// The render smoke (plan Task 2.11): tests/sandbox/render-smoke.spec.ts over every surface
// on the replay list, against a production build (`npm run test:render-smoke` runs
// `next build` first; CI reuses the sandbox job's build). Chromium only: the checks are
// about layout, targets, axe and what the frame says, which the sandbox suite's three
// browsers do not change; containment in every browser is that suite's job.
//
// The app server is started with SURFACE_REPLAY=1, the replay page's opt-in, so nothing
// else needs to set it. The canary (tests/sandbox/canary-server.mjs) runs too, so a
// variant 3 document that reaches out is caught. One worker: the canary's record is shared.
const PORT = Number(process.env.RENDER_SMOKE_PORT ?? 3201);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/sandbox",
  testMatch: /render-smoke\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  outputDir: "test-results/render-smoke/artifacts",
  use: {
    baseURL,
    serviceWorkers: "block",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
      url: `${baseURL}/ui-gallery/surface-replay`,
      env: { SURFACE_REPLAY: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
