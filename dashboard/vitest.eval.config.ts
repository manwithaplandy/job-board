// The live golden-scenario lane (plan Task 1.22): `npm run eval:agent` only, through
// scripts/eval-agent.mjs inside tools/lifecycle_test_db.py's throwaway Postgres. Not part
// of `npm test` or `npm run test:db`; it calls a real model and spends money.
//
// It is the db lane (the same harness-DSN guards and DATABASE_URL override) with only
// *.eval.ts files and long timeouts, one file at a time.
import { defineConfig } from "vitest/config";
import db from "./vitest.db.config";

export default defineConfig({
  ...db,
  test: {
    ...db.test,
    include: ["lib/agent/evals/**/*.eval.ts"],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
