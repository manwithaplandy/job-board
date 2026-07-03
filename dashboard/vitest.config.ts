import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // Automatic JSX runtime so .test.tsx files don't need to import React (matches
  // Next.js's build) — esbuild's default classic runtime would ReferenceError.
  esbuild: { jsx: "automatic" },
  test: {
    // Node is the default (fast) env for the lib logic suite; component tests
    // (.test.tsx under components/) opt into jsdom via environmentMatchGlobs so
    // only they pay for a DOM.
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
});
