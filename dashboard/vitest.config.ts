import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
});
