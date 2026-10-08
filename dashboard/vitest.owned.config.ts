import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// Positive allowlist: other DB files contain deliberately omitted probes.
// Strict owned-target guards inside each selected suite remain authoritative.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["lib/jobLifecycle.flow.db.test.ts", "lib/jobLifecycleConsumers.db.test.ts"],
    exclude: ["**/node_modules/**"],
    fileParallelism: false,
  },
});
