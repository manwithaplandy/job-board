/**
 * Writes the three synthetic demo résumés (plan Task 2.14, gate A7) to
 * docs/demo/personas/<persona id>.pdf at the repository root, from the personas in
 * lib/agent/evals/personas.ts, through lib/agent/evals/demoPersonas.ts. The output is
 * byte-stable, so rerun it after changing a persona and commit the files that changed;
 * lib/agent/evals/demoPersonas.test.ts fails while the committed files are stale.
 *
 * Run from dashboard/ (no key, no network, no database):
 *   npm run demo:personas
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAllPersonaPdfs } from "../lib/agent/evals/demoPersonas.ts";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/demo/personas");

mkdirSync(OUT, { recursive: true });
for (const pdf of renderAllPersonaPdfs()) {
  const path = resolve(OUT, pdf.name);
  writeFileSync(path, pdf.bytes);
  console.log(`wrote ${path} (${pdf.bytes.length} bytes)`);
}
