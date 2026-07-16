import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // Automatic JSX runtime so .test.tsx files don't need to import React (matches
  // Next.js's build). vite is pinned to ^7 (see package.json) to keep esbuild — which
  // honors this — as the default transformer: vite 8's default Oxc/Rolldown transformer
  // ignores esbuild.jsx and fails on JSX in tests (RolldownError: Unexpected JSX).
  esbuild: { jsx: "automatic" },
  test: {
    // Node is the default (fast) env for the lib logic suite; the one component
    // test (.test.tsx under components/) opts into jsdom via a `// @vitest-environment
    // jsdom` docblock at the top of the file — vitest 4 removed environmentMatchGlobs.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "tests/visual/**/*.test.ts",
    ],
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
});
