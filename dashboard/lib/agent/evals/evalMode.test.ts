// Each eval file runs only under its own mode (fix round 1, M3): scripts/eval-agent.mjs sets
// EVAL_MODE to the mode it starts, and every *.eval.ts refuses to start under any other, so
// `vitest --config vitest.eval.config.ts` alone, or a file started under another mode's
// caps, never reaches a model. Pure; runs in CI.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { assertEvalMode, EVAL_MODE_ENV } from "@/lib/agent/evals/budget";

const EVALS = path.join(process.cwd(), "lib", "agent", "evals");
const OWN_MODE: Record<string, string> = {
  "live.eval.ts": "golden",
  "matrix.eval.ts": "matrix",
  "injection.eval.ts": "injection",
  "judge.eval.ts": "judge",
};

describe("EVAL_MODE", () => {
  test("assertEvalMode passes only its own mode and names the command otherwise", () => {
    expect(() => assertEvalMode({ [EVAL_MODE_ENV]: "matrix" }, "matrix")).not.toThrow();
    expect(() => assertEvalMode({ [EVAL_MODE_ENV]: "golden" }, "golden")).not.toThrow();
    expect(() => assertEvalMode({}, "judge")).toThrow(/npm run eval:agent -- --judge.*EVAL_MODE is unset/);
    expect(() => assertEvalMode({ [EVAL_MODE_ENV]: "matrix" }, "injection")).toThrow(/--injection.*EVAL_MODE is "matrix"/);
    expect(() => assertEvalMode({ [EVAL_MODE_ENV]: "judge" }, "golden")).toThrow(/--variant <1\|2\|3>/);
  });

  test("every *.eval.ts checks its own mode before anything else runs", () => {
    const files = readdirSync(EVALS).filter((f) => f.endsWith(".eval.ts")).sort();
    expect(files).toEqual(Object.keys(OWN_MODE).sort());
    for (const file of files) {
      const src = readFileSync(path.join(EVALS, file), "utf8");
      const call = `assertEvalMode(process.env, "${OWN_MODE[file]}");`;
      expect(src, file).toContain(call);
      // At module level, before the first describe or hook.
      const firstSuite = src.search(/^(describe|test|beforeAll|beforeEach)\(/m);
      expect(src.indexOf(call), file).toBeLessThan(firstSuite);
      expect(src.match(/assertEvalMode\(/g), file).toHaveLength(1);
    }
  });

  test("eval-agent.mjs is the one place that sets EVAL_MODE, to the mode it starts", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts", "eval-agent.mjs"), "utf8");
    expect(script).toContain("[budget.EVAL_MODE_ENV]: args.mode,");
    expect(script).toMatch(/for \(const name of \["EVAL_MODE", "EVAL_RUN_ID", "EVAL_MATRIX_RUN"\]\) delete inherited\[name\];/);
    expect(script).toMatch(/golden: \{ profile: "golden", file: "lib\/agent\/evals\/live\.eval\.ts" \}/);
    const setters = readdirSync(EVALS)
      .filter((f) => /\.(ts|mjs)$/.test(f) && f !== "budget.ts" && !f.endsWith(".test.ts"))
      .filter((f) => /EVAL_MODE\s*[:=]/.test(readFileSync(path.join(EVALS, f), "utf8")));
    expect(setters).toEqual([]);
  });
});
