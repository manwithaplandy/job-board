import { defineConfig } from "@playwright/test";

// Offline regression suite: synthetic pages only, no accounts or app server.
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: /auth-outcome\.browser\.ts/,
  reporter: "list",
  outputDir: "test-results/auth-harness",
  use: {
    trace: "off", screenshot: "off", video: "off",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
});
