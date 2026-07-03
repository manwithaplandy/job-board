// Module-resolution hooks for the local TS harnesses (gen-resume,
// calibrate-resume-judge). Node's native `--experimental-strip-types` neither
// reads the tsconfig `@/*` path alias nor does extensionless resolution, so any
// runtime `@/...` value import in the dependency chain (e.g. promptPolicy) fails.
// This hook maps `@/x` → <dashboard-root>/x and appends `.ts` (or `/index.ts`).
// Registered by alias-loader.mjs; see the run command in scripts/gen-resume.ts.
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let p = resolvePath(ROOT, specifier.slice(2));
    if (!/\.[cm]?[jt]s$/i.test(p)) {
      if (existsSync(`${p}.ts`)) p = `${p}.ts`;
      else if (existsSync(resolvePath(p, "index.ts"))) p = resolvePath(p, "index.ts");
    }
    return nextResolve(pathToFileURL(p).href, context);
  }
  return nextResolve(specifier, context);
}
