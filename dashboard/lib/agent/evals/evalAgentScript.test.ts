// scripts/eval-agent.mjs, run as Andrew runs it but with no key (plan Task 2.10): the dry
// run prints the plan and the estimate and spends nothing; a flag above its ceiling, an
// unknown flag and a missing key are refused before vitest starts. Pure; runs in CI (it
// only spawns node on the script, which never reaches vitest in these cases).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";

const DASHBOARD_DIR = fileURLToPath(new URL("../../../", import.meta.url));

function run(...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env };
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
    expect(r.out).toContain("| anthropic/claude-sonnet-5.5 | 4 / 4 / 4 | 62 | 0.85M | 0.10M | $2.74 | $1.98 | yes |");
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
    expect(r.out).toContain("| pass total | | | 1434 | 19.82M | 1.84M | $2.90 | $2.00 |");
    expect(r.out).toContain("Pass total against the budget: $2.90 uncached (within $3.00: yes), $2.00 cached (within: yes).");
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
    expect(run("--variant", "1", "--dry-run").err).toMatch(/unknown argument --dry-run/);
    expect(run("--variant", "1", "--max-cells", "3").err).toMatch(/unknown argument --max-cells/);
  });

  test("--injection --dry-run prints 45 runs a model and the injection caps, and exits 0", () => {
    const r = run("--injection", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Injection dry run: nothing is run and nothing is spent.");
    expect(r.out).toContain("| anthropic/claude-haiku-5.5 | 45 | 360 | 5.40M | 0.22M | $0.65 | $0.32 | yes |");
    expect(r.out).toContain("| --max-cases | injection runs per model | 45 | 45 | 45 |");
    expect(r.out).toContain("| --max-usd | US dollars per model (reported cost) | 1 | 1 | 1.5 |");
    expect(run("--injection", "--dry-run", "--max-cases", "10").out).toContain("| 10 | 80 |");
  });

  test("two modes, an injection cap above its ceiling or a matrix-only flag are usage errors", () => {
    expect(run("--injection", "--matrix", "--dry-run").err).toMatch(/give one of --matrix, --injection/);
    expect(run("--injection", "--dry-run", "--max-cases", "46")).toMatchObject({ status: 2 });
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

describe("eval-summary.mjs", () => {
  test("takes run ids only, each flag once, and refuses anything else before vitest starts", () => {
    expect(summary("--run", "latest")).toMatchObject({ status: 2, err: expect.stringMatching(/--run needs a run id/) });
    expect(summary("--judge-run")).toMatchObject({ status: 2, err: expect.stringMatching(/--judge-run needs a run id/) });
    expect(summary("--run", "20261126T010000Z", "--run=20261126T020000Z")).toMatchObject({ status: 2, err: expect.stringMatching(/--run given twice/) });
    expect(summary("--matrix-run", "20261126T010000Z")).toMatchObject({ status: 2, err: expect.stringMatching(/unknown argument --matrix-run/) });
  });
});
