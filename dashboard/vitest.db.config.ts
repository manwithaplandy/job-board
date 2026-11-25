// The real-database vitest lane: `npm run test:db`, run only through
// tools/lifecycle_test_db.py (owned throwaway Postgres). Not part of `npm test`.
//
// It must replace the base config's env.DATABASE_URL (a dead localhost DSN): lib/db.ts
// reads DATABASE_URL at import, so without this, library code under test would
// connect to nothing. The DSN passes the same guards the harness applies.
import { defineConfig } from "vitest/config";
import base from "./vitest.config";
import { assertHarnessDsn } from "./lib/testing/dbHarness";

const dsn = assertHarnessDsn(process.env.TEST_DATABASE_URL);

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["lib/testing/**/*.db.test.ts", "lib/agent/**/*.db.test.ts", "lib/workspaces/**/*.db.test.ts"],
    exclude: ["**/node_modules/**"],
    fileParallelism: false,
    env: { ...base.test?.env, DATABASE_URL: dsn },
  },
});
