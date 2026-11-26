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
