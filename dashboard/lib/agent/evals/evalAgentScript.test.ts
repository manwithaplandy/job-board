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
  test("--matrix --dry-run prints the plan and the estimate per model with no key, and exits 0", () => {
    const r = run("--matrix", "--dry-run");
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("nothing is run and nothing is spent. 360 cells over 2 model(s)");
    for (const model of AGENT_EVAL_MODELS) expect(r.out).toContain(`| ${model} | 60 / 60 / 60 |`);
    expect(r.out).toContain("$41.04");
  });

  test("--dry-run takes --models and lowered caps, and says when a cap would stop the run", () => {
    const r = run("--matrix", "--dry-run", "--models", "anthropic/claude-haiku-5.5", "--max-usd=5");
    expect(r.status).toBe(0);
    expect(r.out).toContain("180 cells over 1 model(s)");
    expect(r.out).toMatch(/\$10\.26 \| NO: the run would stop at a cap/);
    expect(r.out).toContain("| --max-usd | US dollars per model (reported cost) | 5 | 60 | 120 |");
  });

  test("a matrix cap above its ceiling, an unknown flag or a golden-only flag is a usage error", () => {
    expect(run("--matrix", "--dry-run", "--max-cells", "181")).toMatchObject({ status: 2 });
    expect(run("--matrix", "--dry-run", "--max-total-usd", "500").err).toMatch(/ceiling of 200/);
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
    expect(r.out).toContain("| anthropic/claude-sonnet-5.5 | 45 | 360 | 5.40M | 0.22M | $12.96 |");
    expect(r.out).toContain("| --max-cases | injection runs per model | 45 | 45 | 45 |");
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
    expect(r.out).toContain("| openai/gpt-5.5 | 144 | 144 | 1.73M | 0.06M | $4.03 |");
    expect(r.out).toContain("| --max-pairs | judged pairs | 144 | 144 | 360 |");
    expect(r.out).toContain("| --max-steps | model calls per pair | 1 | 1 | 1 |");
    expect(run("--judge", "--dry-run", "--max-pairs", "20").out).toContain("| openai/gpt-5.5 | 20 | 20 |");
  });

  test("the judge takes no model choice, no total caps and nothing above its ceilings", () => {
    expect(run("--judge", "--dry-run", "--model", "a/b").err).toMatch(/unknown argument --model for --judge/);
    expect(run("--judge", "--dry-run", "--models", "a/b").err).toMatch(/unknown argument --models for --judge/);
    expect(run("--judge", "--dry-run", "--max-pairs", "361").err).toMatch(/ceiling of 360/);
    expect(run("--judge", "--dry-run", "--max-steps", "2").err).toMatch(/ceiling of 1/);
    expect(run("--judge", "--dry-run", "--max-total-usd", "5").err).toMatch(/unknown argument --max-total-usd for --judge/);
    expect(run("--judge", "--injection", "--dry-run").err).toMatch(/give one of --matrix, --injection, --judge, once/);
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

  test("the judge dry run warns when --max-pairs would pass its caps and says its price is unverified", () => {
    const r = run("--judge", "--dry-run", "--max-pairs", "360");
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/\| openai\/gpt-5\.5 \| 360 \| .* NO: the run would stop at a cap \|/);
    expect(r.out).toMatch(/real price may be\nhigher or lower/);
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
