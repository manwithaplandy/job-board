import { mkdirSync, rmSync } from "node:fs";
import { HARNESS_ENABLE_ENV } from "../../app/ui-gallery/sandbox-harness/fixtures";
import { SANDBOX_GATES_DIR, SANDBOX_RESULTS_DIR } from "./results";

// Each run starts with an empty results folder (and so no control results from an earlier
// run), so the uploaded artifact holds this run only. The harness renders its hostile cases
// only when the server opts in, so a run without the opt-in stops here with the reason
// instead of failing every case.
export default function globalSetup() {
  if (process.env[HARNESS_ENABLE_ENV] !== "1") {
    throw new Error(
      `The sandbox suite needs ${HARNESS_ENABLE_ENV}=1 so the harness renders its cases (the CI job sets it). ` +
        `Run it as: ${HARNESS_ENABLE_ENV}=1 npm run test:sandbox`,
    );
  }
  rmSync(SANDBOX_RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(SANDBOX_GATES_DIR, { recursive: true });
}
