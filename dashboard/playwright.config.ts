import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3100";
const authState = process.env.VISUAL_AUTH_STATE_JSON
  ? JSON.parse(process.env.VISUAL_AUTH_STATE_JSON)
  : undefined;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  // Shared baselines are reviewed on macOS and enforced by Linux CI. A 2% pixel
  // budget absorbs rasterizer/font-edge differences while still rejecting layout,
  // spacing, color-surface, control, and content regressions.
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", threshold: 0.3, maxDiffPixelRatio: 0.02 } },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    storageState: authState,
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
