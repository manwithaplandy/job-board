import { mkdirSync, rmSync } from "node:fs";
import { SANDBOX_RESULTS_DIR } from "./results";

// Each run starts with an empty results folder, so the uploaded artifact holds this run only.
export default function globalSetup() {
  rmSync(SANDBOX_RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(SANDBOX_RESULTS_DIR, { recursive: true });
}
