// The matrix's automatic measures (plan Task 2.10), over the committed hand-written
// recordings and copies of them changed one thing at a time. Pure; runs in CI.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { assertRecording } from "@/lib/agent/evals/asserts";
import {
  measure,
  normalizedDistance,
  quantile,
  recordingSignature,
  structuralSignature,
  structuralVariance,
} from "@/lib/agent/evals/measures";
import { parseRecording, type Recording } from "@/lib/agent/evals/recording";

const V1_DIR = fileURLToPath(new URL("./recordings/v1/", import.meta.url));

function committed(scenario: Recording["scenario"]): Recording {
  const file = readdirSync(V1_DIR).find((f) => f.startsWith(`${scenario}.`) && f.endsWith(".handwritten.json"));
  if (!file) throw new Error(`no hand-written recording of ${scenario}`);
  const r = parseRecording(JSON.parse(readFileSync(path.join(V1_DIR, file), "utf8")));
  if (!r) throw new Error(`${file} does not parse`);
  return structuredClone(r);
}

describe("structuralVariance", () => {
  test("five identical signatures give variance 0; five disjoint give 1", () => {
    expect(structuralVariance(Array(5).fill("Stack Heading Text"))).toBe(0);
    expect(structuralVariance(["JobCard", "Callout", "StatRow", "MemoDiff", "StaleList"])).toBe(1);
    expect(structuralVariance(["a b", "c d", "e f", "g h", "i j"])).toBe(1);
  });

  test("is the mean pairwise normalized edit distance, between 0 and 1", () => {
    expect(normalizedDistance("a b c d", "a b c e")).toBe(0.25);
    expect(normalizedDistance("", "")).toBe(0);
    expect(normalizedDistance("a", "")).toBe(1);
    // Pairs: (x, x) 0, (x, y) 0.5, (x, y) 0.5.
    expect(structuralVariance(["a b", "a b", "a c"])).toBeCloseTo(1 / 3);
    expect(structuralVariance(["only one"])).toBe(0);
  });
});

describe("structuralSignature", () => {
  test("variant 1: block types; variant 2: node types in pre-order; variant 3: the body's start tags", () => {
    expect(structuralSignature({ variant: 1, blocks: [{ type: "JobCard", jobId: "x" }, { type: "Callout" }] } as never)).toBe(
      "JobCard Callout",
    );
    expect(
      structuralSignature({
        variant: 2,
        root: {
          type: "Stack",
          gap: "2",
          children: [
            { type: "Heading", level: 1, text: "Hi" },
            { type: "Tabs", tabs: [{ label: "A", child: { type: "Text", text: "a" } }, { label: "B", child: { type: "Divider" } }] },
          ],
        },
      }),
    ).toBe("Stack Heading Tabs Text Divider");
    expect(
      structuralSignature({
        variant: 3,
        title: "T",
        html: "<head><style>p{}</style></head><body><main><h1>A</h1><!-- <div> --><p>b</p><button>c</button></main></body>",
      }),
    ).toBe("body main h1 p button");
    expect(structuralSignature({ nonsense: true })).toBe("invalid");
  });

  test("a run's signature joins its surfaces in order", () => {
    expect(recordingSignature(committed("b_compare"))).toBe("JobComparison | MemoDiff Callout");
  });
});

describe("measure", () => {
  test("fallback rate counts outcome fallback only; repair rate counts repaired only", () => {
    const a = committed("a_resume_upload"); // 3 surfaces
    a.surfaces[0].outcome = "repaired";
    a.surfaces[1].outcome = "fallback";
    const b = committed("b_compare"); // 2 surfaces
    b.surfaces[0].outcome = "fallback";
    const [m] = measure([a, b]);
    expect(m.surfaces).toBe(5);
    expect(m.repairRate).toBeCloseTo(1 / 5);
    expect(m.fallbackRate).toBeCloseTo(2 / 5);
    expect(m.validationFailureRate).toBeCloseTo(3 / 5);
  });

  test("timings, tokens, cost, assert failures and misstatements per model and variant", () => {
    const runs = [1000, 2000, 3000, 4000, 10_000].map((completeMs, i) => {
      const r = committed("c_prep");
      r.seed = i + 1;
      r.timings = { firstRenderMs: completeMs / 10, completeMs };
      r.usage = { costMicros: 100, inputTokens: 1000, outputTokens: 50 * (i + 1) };
      return r;
    });
    // One run states a fit the database does not hold.
    const g = runs[4].surfaces[0].gathered as { reviews: Record<string, { fitScore: number }> };
    const jobId = Object.keys(g.reviews)[0];
    g.reviews[jobId].fitScore = 1;
    expect(assertRecording(runs[4]).map((f) => f.code)).toEqual(["fit_mismatch"]);

    const other = committed("c_prep");
    other.model = "another/model";
    other.variant = 3;
    const out = measure([...runs, other], { "another/model": 2 });
    expect(out.map((m) => [m.model, m.variant])).toEqual([
      [runs[0].model, 1],
      ["another/model", 3],
    ]);
    const [m, v3] = out;
    expect(m.runs).toBe(5);
    expect(m.completeMs).toEqual({ median: 3000, p90: 10_000 });
    expect(m.firstRenderMs).toEqual({ median: 300, p90: 1000 });
    expect(m.meanOutputTokens).toBe(150);
    expect(m.costMicros).toBe(500);
    expect(m.assertFailures).toBe(1);
    expect(m.runsFailingAsserts).toBe(1);
    expect(m.misstatements).toBe(1);
    // Five repeats of the same scenario and persona with the same layout.
    expect(m.structuralVariance).toBe(0);
    // Variant 3's misstatements come from render smoke.
    expect(v3.misstatements).toBe(2);
    expect(measure([other])[0].misstatements).toBeNull();
    expect(v3.structuralVariance).toBeNull();
  });

  test("quantile is nearest-rank and null for no values", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([5], 0.9)).toBe(5);
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2);
  });
});
