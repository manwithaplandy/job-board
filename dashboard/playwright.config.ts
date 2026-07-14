import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  // Dynamic regions must use explicit masks rather than a permissive page budget.
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", threshold: 0.2, maxDiffPixelRatio: 0.005 } },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  webServer: process.env.VISUAL_BASE_URL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
