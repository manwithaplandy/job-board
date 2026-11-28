// scripts/eval-agent.mjs, run as Andrew runs it but with no key (plan Task 2.10): the dry
// run prints the plan and the estimate and spends nothing; a flag above its ceiling, an
// unknown flag and a missing key are refused before vitest starts. Pure; runs in CI (it
// only spawns node on the script, which never reaches vitest in these cases).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import { finishRun, runRoot, startRun } from "@/lib/agent/evals/evalRuns";

const DASHBOARD_DIR = fileURLToPath(new URL("../../../", import.meta.url));

function run(...argv: Array<string | Record<string, string>>) {
  // An object first sets extra environment (EVAL_RECORDINGS_ROOT for a fixture folder).
  const extra = typeof argv[0] === "object" ? (argv.shift() as Record<string, string>) : {};
  const args = argv as string[];
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  delete env.OPENROUTER_API_KEY;
  delete env.AGENT_OPENROUTER_API_KEY;
  // A missing vitest binary would make a wrongly started run fail loudly rather than run.
  const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/eval-agent.mjs", ...args], {
    cwd: DASHBOARD_DIR,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

describe("eval-agent.mjs", () => {
  test("--matrix --dry-run prints the Haiku 5.5 plan and its estimate, uncached and cached, with no key, and exits 0", () => {
    const r = run("--matrix", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("nothing is run and nothing is spent. 180 cells over 1 model(s)");
    expect(r.out).toContain("| anthropic/claude-haiku-5.5 | 60 / 60 / 60 | 930 | 12.69M | 1.57M | $2.05 | $1.48 | yes |");
  });

  test("--dry-run takes --models and lowered caps, and says when a cap would stop the run", () => {
    const r = run("--matrix", "--dry-run", "--models", "anthropic/claude-haiku-5.5", "--max-usd=1");
    expect(r.status).toBe(0);
    expect(r.out).toContain("180 cells over 1 model(s)");
    expect(r.out).toMatch(/\$2\.05 \| \$1\.48 \| NO: the run would stop at a cap/);
    expect(r.out).toContain("| --max-usd | US dollars per model (reported cost) | 1 | 2.5 | 3 |");
  });

  test("PR J7: a matrix or injection run on any model but Haiku 5.5 needs --allow-non-haiku, dry run included (exit 2)", () => {
    const sonnet = run("--matrix", "--dry-run", "--model", "anthropic/claude-sonnet-5.5");
    expect(sonnet.status).toBe(2);
    expect(sonnet.err).toMatch(/anthropic\/claude-sonnet-5\.5 is not anthropic\/claude-haiku-5\.5, the eval default/);
    expect(sonnet.err).toMatch(/--allow-non-haiku/);
    expect(run("--injection", "--dry-run", "--models", AGENT_EVAL_MODELS.join(",")).status).toBe(2);
    // A real run is refused the same way, before the key is even checked.
    expect(run("--matrix", "--model", "anthropic/claude-sonnet-5.5").err).toMatch(/--allow-non-haiku/);
    const allowed = run("--matrix", "--dry-run", "--models", AGENT_EVAL_MODELS.join(","), "--allow-non-haiku");
    expect(allowed.status).toBe(0);
    expect(allowed.out).toContain("360 cells over 2 model(s)");
    // Even allowed, a full Sonnet matrix does not fit the $3 ceiling: the cap would stop it.
    expect(allowed.out).toMatch(/\| anthropic\/claude-sonnet-5\.5 \| .* \$41\.04 \| \$29\.65 \| NO: the run would stop at a cap \|/);
    expect(run("--judge", "--dry-run", "--allow-non-haiku").err).toMatch(/unknown argument --allow-non-haiku for --judge/);
  });

  test("PR J7: --matrix --spot-check --dry-run: Sonnet 5.5, one persona, one repeat, 12 cells, its own cap", () => {
    const r = run("--matrix", "--spot-check", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Spot check dry run (persona senior-backend, one repeat): nothing is run and nothing is spent. 12 cells over 1 model(s).");
    // Fix round 1: uncached, the look-ahead's reserve ($0.1951 for a Sonnet step) stops it short of $2.90.
    expect(r.out).toContain("| anthropic/claude-sonnet-5.5 | 4 / 4 / 4 | 62 | 0.85M | 0.10M | $2.74 | $1.98 | NO: the run would stop at a cap |");
    expect(r.out).toContain("| --max-usd | US dollars (reported cost) | 2.9 | 2.9 | 2.9 |");
    expect(run("--matrix", "--spot-check", "--dry-run", "--persona", "new-grad").out).toContain("(persona new-grad, one repeat)");
    expect(run("--matrix", "--spot-check", "--dry-run", "--persona", "intern").err).toMatch(/--persona must be one of/);
    expect(run("--matrix", "--spot-check", "--dry-run", "--max-usd", "3").err).toMatch(/ceiling of 2.9/);
    expect(run("--matrix", "--spot-check", "--dry-run", "--model", "anthropic/claude-haiku-5.5").err).toMatch(/unknown argument --model for --matrix --spot-check/);
    expect(run("--matrix", "--dry-run", "--persona", "new-grad").err).toMatch(/unknown argument --persona for --matrix/);
    expect(run("--injection", "--spot-check", "--dry-run").err).toMatch(/unknown argument --spot-check for --injection/);
    const noKey = run("--matrix", "--spot-check");
    expect(noKey.status).toBe(2);
    expect(noKey.err).toMatch(/eval:agent -- --matrix --spot-check/);
  });

  test("PR J7: --pass --dry-run prints the three stages and the pass total against $3, and exits 0", () => {
    const r = run("--pass", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Pass dry run: nothing is run and nothing is spent. Matrix, then injection, then judge, one budget of $3.00.");
    // PR 6: 57 injection runs put the uncached pass over $3 (the guard stops a stage; the ceiling stays 3).
    expect(r.out).toContain("| pass total | | | 1530 | 21.26M | 1.90M | $3.07 | $2.09 |");
    expect(r.out).toContain("Pass total against the budget: $3.07 uncached (within $3.00: NO), $2.09 cached (within: yes).");
    expect(run("--pass", "--dry-run", "--max-usd", "2").out).toContain("one budget of $2.00");
    expect(run("--pass", "--dry-run", "--max-usd", "3.5").err).toMatch(/ceiling of 3/);
    expect(run("--pass", "--dry-run", "--max-cells", "3").err).toMatch(/unknown argument --max-cells for --pass/);
    expect(run("--pass", "--dry-run", "--model", "anthropic/claude-sonnet-5.5").err).toMatch(/unknown argument --model for --pass/);
    expect(run("--pass", "--matrix", "--dry-run").err).toMatch(/give one of --matrix, --injection, --judge, --pass, once/);
    const noKey = run("--pass");
    expect(noKey.status).toBe(2);
    expect(noKey.err).toMatch(/OPENROUTER_API_KEY is not set/);
    expect(noKey.err).toMatch(/eval:agent -- --pass/);
  });

  test("a matrix cap above its ceiling, an unknown flag or a golden-only flag is a usage error", () => {
    expect(run("--matrix", "--dry-run", "--max-cells", "181")).toMatchObject({ status: 2 });
    expect(run("--matrix", "--dry-run", "--max-total-usd", "500").err).toMatch(/ceiling of 3/);
    expect(run("--matrix", "--dry-run", "--max-usd", "3.01").err).toMatch(/ceiling of 3/);
    expect(run("--matrix", "--dry-run", "--seed", "3").err).toMatch(/unknown argument --seed for --matrix/);
    expect(run("--matrix", "--dry-run", "--models", "a/b,a/b").err).toMatch(/names a model twice/);
    expect(run("--variant", "1", "--max-cells", "3").err).toMatch(/unknown argument --max-cells/);
  });

  test("PR J7 fix round 1: --variant <n> --dry-run prices the golden run on Haiku 5.5 with no key, and exits 0", () => {
    const r = run("--variant", "1", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Golden dry run (variant 1, seed 1): nothing is run and nothing is spent. 12 scenario x persona case(s) on anthropic/claude-haiku-5.5.");
    expect(r.out).toContain("| anthropic/claude-haiku-5.5 | 12 | 102 | 1.53M | 0.06M | $0.18 | $0.09 | yes |");
    expect(r.out).toContain("| --max-usd | US dollars (reported cost) | 2 | 2 | 3 |");
    expect(run("--variant", "3", "--dry-run", "--max-cases", "2").out).toContain("| anthropic/claude-haiku-5.5 | 2 | 26 |");
    expect(run("--variant", "1", "--dry-run", "--max-usd", "3.01").err).toMatch(/ceiling of 3/);
    const noKey = run("--variant", "1");
    expect(noKey.status).toBe(2);
    expect(noKey.err).toMatch(/OPENROUTER_API_KEY is not set/);
    expect(noKey.err).toMatch(/Add --dry-run/);
  });

  test("PR J7 fix round 1: the golden run refuses an unpriced --model, and any other model without --allow-non-haiku (exit 2)", () => {
    const unpriced = run("--variant", "1", "--dry-run", "--model", "x/unpriced", "--allow-non-haiku");
    expect(unpriced.status).toBe(2);
    expect(unpriced.err).toMatch(/no price for x\/unpriced in lib\/agent\/prices\.ts/);
    expect(unpriced.out).toBe("");
    // A real run is refused the same way, before the key is checked.
    expect(run("--variant", "1", "--model", "x/unpriced")).toMatchObject({ status: 2 });
    expect(run("--variant", "1", "--model", "x/unpriced").err).toMatch(/no price for x\/unpriced/);
    const sonnet = run("--variant", "2", "--dry-run", "--model", "anthropic/claude-sonnet-5.5");
    expect(sonnet.status).toBe(2);
    expect(sonnet.err).toMatch(/is not anthropic\/claude-haiku-5\.5, the eval default\. The golden run/);
    expect(run("--variant", "2", "--model", "anthropic/claude-sonnet-5.5").err).toMatch(/--allow-non-haiku/);
    const allowed = run("--variant", "2", "--dry-run", "--model", "anthropic/claude-sonnet-5.5", "--allow-non-haiku");
    expect(allowed.status).toBe(0);
    // Allowed, an uncached Sonnet golden run does not fit the $2 default: the cap would stop it.
    expect(allowed.out).toMatch(/\| anthropic\/claude-sonnet-5\.5 \| 12 \| 102 \| .* \$3\.67 \| \$1\.80 \| NO: the run would stop at a cap \|/);
    expect(run("--variant", "1", "--dry-run", "--model", "anthropic/claude-haiku-5.5").status).toBe(0);
  });

  test("--injection --dry-run prints 57 runs a model and the injection caps, and exits 0", () => {
    const r = run("--injection", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Injection dry run: nothing is run and nothing is spent.");
    expect(r.out).toContain("| anthropic/claude-haiku-5.5 | 57 | 456 | 6.84M | 0.27M | $0.82 | $0.40 | yes |");
    expect(r.out).toContain("| --max-cases | injection runs per model | 57 | 57 | 57 |");
    expect(r.out).toContain("| --max-usd | US dollars per model (reported cost) | 1 | 1 | 1.5 |");
    expect(run("--injection", "--dry-run", "--max-cases", "10").out).toContain("| 10 | 80 |");
  });

  test("two modes, an injection cap above its ceiling or a matrix-only flag are usage errors", () => {
    expect(run("--injection", "--matrix", "--dry-run").err).toMatch(/give one of --matrix, --injection/);
    expect(run("--injection", "--dry-run", "--max-cases", "58")).toMatchObject({ status: 2 });
    expect(run("--injection", "--dry-run", "--max-cells", "3").err).toMatch(/unknown argument --max-cells for --injection/);
    const noKey = run("--injection");
    expect(noKey.status).toBe(2);
    expect(noKey.err).toMatch(/OPENROUTER_API_KEY is not set/);
    expect(noKey.err).toMatch(/eval:agent -- --injection/);
  });

  test("--judge --dry-run prints 144 pairs for the judge model and the judge caps, and exits 0", () => {
    const r = run("--judge", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Judge dry run: nothing is run and nothing is spent.");
    expect(r.out).toContain("| anthropic/claude-haiku-5.5 | 144 | 144 | 1.73M | 0.06M | $0.20 | $0.20 | yes |");
    expect(r.out).toContain("| --max-usd | US dollars (reported cost) | 0.5 | 0.5 | 1 |");
    expect(r.out).toContain("| --max-pairs | judged pairs | 144 | 144 | 360 |");
    expect(r.out).toContain("| --max-steps | model calls per pair | 1 | 1 | 1 |");
    expect(run("--judge", "--dry-run", "--max-pairs", "20").out).toContain("| anthropic/claude-haiku-5.5 | 20 | 20 |");
  });

  test("the judge takes no model choice, no total caps and nothing above its ceilings", () => {
    expect(run("--judge", "--dry-run", "--model", "a/b").err).toMatch(/unknown argument --model for --judge/);
    expect(run("--judge", "--dry-run", "--models", "a/b").err).toMatch(/unknown argument --models for --judge/);
    expect(run("--judge", "--dry-run", "--max-pairs", "361").err).toMatch(/ceiling of 360/);
    expect(run("--judge", "--dry-run", "--max-steps", "2").err).toMatch(/ceiling of 1/);
    expect(run("--judge", "--dry-run", "--max-total-usd", "5").err).toMatch(/unknown argument --max-total-usd for --judge/);
    expect(run("--judge", "--injection", "--dry-run").err).toMatch(/give one of --matrix, --injection, --judge, --pass, once/);
    const noKey = run("--judge");
    expect(noKey.status).toBe(2);
    expect(noKey.err).toMatch(/eval:agent -- --judge/);
  });

  test("the matrix and the injection set refuse a model with no price, dry run included, with exit 2", () => {
    // The review's case: two dear models that the old dry run priced at Sonnet's $41.04 and called within caps.
    const m = run("--matrix", "--dry-run", "--models", "anthropic/claude-opus-4,openai/o1-pro");
    expect(m.status).toBe(2);
    expect(m.err).toMatch(/no price for anthropic\/claude-opus-4, openai\/o1-pro in lib\/agent\/prices\.ts/);
    expect(m.out).not.toContain("Within caps");
    expect(run("--matrix", "--models", "anthropic/claude-sonnet-5.5,x/unpriced")).toMatchObject({ status: 2 });
    const i = run("--injection", "--dry-run", "--model", "x/unpriced");
    expect(i.status).toBe(2);
    expect(i.err).toMatch(/no price for x\/unpriced/);
    // A priced model still runs its dry run.
    expect(run("--injection", "--dry-run", "--model", "anthropic/claude-haiku-5.5").status).toBe(0);
  });

  test("the judge dry run warns when --max-pairs would pass its caps", () => {
    const r = run("--judge", "--dry-run", "--max-pairs", "360");
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/\| anthropic\/claude-haiku-5\.5 \| 360 \| .* NO: the run would stop at a cap \|/);
  });

  test("the judge reads one matrix run: --run must be a run id that exists, and the dry run names the run or says none", () => {
    // No matrix run is committed, so the judge's dry run has none to name.
    expect(run("--judge", "--dry-run").out).toContain("Matrix run judged: none yet");
    const bad = run("--judge", "--dry-run", "--run", "latest");
    expect(bad.status).toBe(2);
    expect(bad.err).toMatch(/--run must be a run id/);
    const missing = run("--judge", "--dry-run", "--run", "20261126T010000Z");
    expect(missing.status).toBe(2);
    expect(missing.err).toMatch(/no run 20261126T010000Z/);
    expect(run("--matrix", "--dry-run", "--run", "20261126T010000Z").err).toMatch(/unknown argument --run for --matrix/);
  });

  test("PR J7: --matrix --rerender-only --run <id> --dry-run prices only the re-renders of that run's recorded surfaces", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "eval-agent-rr-"));
    try {
      const matrix = runRoot("matrix", root);
      const HAIKU = "anthropic/claude-haiku-5.5";
      const SONNET = "anthropic/claude-sonnet-5.5";
      const source = (runId: string, models: string[], extra: { kind?: "spot-check"; status?: "complete" | "failed" } = {}) => {
        finishRun(startRun(matrix, { runId, mode: "matrix", models, matrixRun: null, ...(extra.kind ? { kind: extra.kind } : {}) }), extra.status ?? "complete");
        const dir = path.join(matrix, runId, models[0].replace(/[^A-Za-z0-9.-]+/g, "-"), "v1");
        mkdirSync(dir, { recursive: true });
        for (const [scenario, surfaces] of [["a_resume_upload", 3], ["b_compare", 2]] as const) {
          const r = { evalRun: runId, variant: 1, model: models[0], scenario, persona: "senior-backend", seed: 1, surfaces: Array.from({ length: surfaces }, () => ({})) };
          writeFileSync(path.join(dir, `${scenario}.senior-backend.r1.json`), JSON.stringify(r));
        }
      };
      source("20261126T010000Z", [HAIKU]);
      source("20261126T020000Z", [HAIKU], { kind: "spot-check" });
      source("20261126T030000Z", [HAIKU], { status: "failed" });
      source("20261126T040000Z", [SONNET]);
      const dry = (...args: string[]) => run({ EVAL_RECORDINGS_ROOT: root }, "--matrix", "--rerender-only", "--dry-run", ...args);

      const r = dry("--run", "20261126T010000Z");
      expect(r.err).toBe("");
      expect(r.status).toBe(0);
      expect(r.out).toContain("Re-render-only dry run over matrix run 20261126T010000Z: nothing is run and nothing is spent. 4 re-render cells over 1 model(s)");
      // 5 recorded surfaces, each into variants 2 and 3, two calls each.
      expect(r.out).toContain(`| ${HAIKU} | 2 / 2 | 10 | 20 |`);
      expect(r.out).toContain("| --max-usd | US dollars per model (reported cost) | 2.5 | 2.5 | 3 |");

      expect(dry().err).toMatch(/--rerender-only needs --run <matrix run id>/);
      expect(dry("--run", "20261126T020000Z").err).toMatch(/is a spot-check run; only a full matrix run can be re-rendered/);
      expect(dry("--run", "20261126T030000Z").err).toMatch(/ended failed; only a complete matrix run can be re-rendered/);
      expect(dry("--run", "20261126T050000Z").err).toMatch(/no run 20261126T050000Z/);
      // The source's models are the run's: Sonnet needs --allow-non-haiku, and no --model or --models is taken.
      const sonnet = dry("--run", "20261126T040000Z");
      expect(sonnet.status).toBe(2);
      expect(sonnet.err).toMatch(/--allow-non-haiku/);
      expect(dry("--run", "20261126T040000Z", "--allow-non-haiku").out).toContain(`| ${SONNET} | 2 / 2 | 10 | 20 |`);
      expect(dry("--run", "20261126T010000Z", "--models", HAIKU).err).toMatch(/unknown argument --models for --matrix --rerender-only/);
      expect(dry("--run", "20261126T010000Z", "--spot-check").err).toMatch(/give --spot-check or --rerender-only, not both/);
      expect(dry("--run", "20261126T010000Z", "--max-usd", "3.01").status).toBe(2);
      for (const bad of [dry(), dry("--run", "20261126T020000Z"), dry("--run", "20261126T050000Z")]) expect(bad.status).toBe(2);
      // Without --dry-run, EVAL_RECORDINGS_ROOT is ignored: the real folder has no such run, refused before the key check.
      const real = run({ EVAL_RECORDINGS_ROOT: root }, "--matrix", "--rerender-only", "--run", "20261126T010000Z");
      expect(real.status).toBe(2);
      expect(real.err).toMatch(/no run 20261126T010000Z/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a real run without OPENROUTER_API_KEY is refused before vitest starts", () => {
    const matrix = run("--matrix");
    expect(matrix.status).toBe(2);
    expect(matrix.err).toMatch(/OPENROUTER_API_KEY is not set/);
    expect(matrix.err).toMatch(/--dry-run/);
    const golden = run("--variant", "1");
    expect(golden.status).toBe(2);
    expect(golden.err).toMatch(/OPENROUTER_API_KEY is not set/);
  });
});

function summary(...args: string[]) {
  const r = spawnSync(process.execPath, ["scripts/eval-summary.mjs", ...args], { cwd: DASHBOARD_DIR, encoding: "utf8", timeout: 30_000 });
  return { status: r.status, err: r.stderr };
}

describe("eval-agent.mjs runStage's environment (PR J7 fix round 1)", () => {
  // A real stage needs a key and spends money, so this reads the script: every per-mode
  // variable the script sets for a stage is first cleared from what the caller passed in.
  test("clears the inherited per-mode model, variant, seed and pass budget before setting its own", () => {
    const src = readFileSync(path.join(DASHBOARD_DIR, "scripts", "eval-agent.mjs"), "utf8");
    const list = src.slice(src.indexOf("function runStage"), src.indexOf("delete inherited[name]"));
    for (const name of ["EVAL_MODE", "EVAL_MODEL", "EVAL_MODELS", "EVAL_VARIANT", "EVAL_SEED", "runs.EVAL_PASS_BUDGET_ENV", "EVAL_ALLOW_NON_HAIKU", "EVAL_MATRIX_KIND"]) {
      expect(list).toContain(name.startsWith("runs.") ? name : `"${name}"`);
    }
  });
});

describe("eval-summary.mjs", () => {
  test("takes run ids only, each flag once, and refuses anything else before vitest starts", () => {
    expect(summary("--run", "latest")).toMatchObject({ status: 2, err: expect.stringMatching(/--run needs a run id/) });
    expect(summary("--judge-run")).toMatchObject({ status: 2, err: expect.stringMatching(/--judge-run needs a run id/) });
    expect(summary("--run", "20261126T010000Z", "--run=20261126T020000Z")).toMatchObject({ status: 2, err: expect.stringMatching(/--run given twice/) });
    expect(summary("--matrix-run", "20261126T010000Z")).toMatchObject({ status: 2, err: expect.stringMatching(/unknown argument --matrix-run/) });
  });
});
