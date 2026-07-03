// Registers alias-hooks.mjs on the module-loader thread so the local TS harnesses
// can resolve the `@/*` tsconfig path alias under `node --experimental-strip-types`.
// Use via `--import`:
//   node --experimental-strip-types --import ./scripts/alias-loader.mjs scripts/gen-resume.ts
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
