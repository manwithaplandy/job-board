// The per-variant summary (plan Task 2.13): a section per variant with both models side by
// side, "not run yet" for every missing input, the injection replays filled from the
// render smoke, and spec 7.3's demo checklist. Pure; no files, model or database.
import { describe, expect, test } from "vitest";
import { DEMO_CHECKLIST, NOT_RUN, SUMMARY_LABEL, VARIANT_NAMES, variantSummary, withReplays, type SummaryInputs } from "@/lib/agent/evals/summary";
import type { VariantMeasures } from "@/lib/agent/evals/measures";
import type { InjectionResult } from "@/lib/agent/evals/injection";
import type { JudgeResult } from "@/lib/agent/evals/judge";
import type { RenderResult } from "@/lib/agent/evals/renderResults";
import { emptySnapshot, type Recording } from "@/lib/agent/evals/recording";

const SONNET = "anthropic/claude-sonnet-5.5";
const RUN = "20261126T010000Z";
const HAIKU = "anthropic/claude-haiku-5.5";

function measures(model: string, variant: 1 | 2 | 3, over: Partial<VariantMeasures> = {}): VariantMeasures {
  return {
    model,
    variant,
    runs: 60,
    scope: variant === 1 ? "whole scenario" : "re-render only",
    surfaces: 105,
    validationFailureRate: 0.05,
    repairRate: 0.04,
    fallbackRate: 0.01,
    firstRenderMs: { median: 4200, p90: 9000 },
    completeMs: { median: 12000, p90: 20000 },
    meanOutputTokens: 640,
    assertFailures: 2,
    runsFailingAsserts: 1,
    misstatements: variant === 3 ? null : 0,
    structuralVariance: 0.31,
    costMicros: 12_340_000,
    inputTokens: 1_000_000,
    outputTokens: 50_000,
    ...over,
  };
}

const empty = (over: Partial<SummaryInputs> = {}): SummaryInputs => ({
  generatedAt: "2026-11-26",
  measures: null,
  injection: null,
  render: null,
  judge: null,
  ...over,
});

function recording(surfaces: number): Recording {
  return {
    format: 1,
    source: "live",
    scenario: "b_compare",
    persona: "senior-backend",
    variant: 3,
    model: SONNET,
    seed: 1,
    toolCalls: [],
    approvals: [],
    intents: [],
    surfaces: Array.from({ length: surfaces }, (_, i) => ({
      id: `s${i}`,
      threadId: "t",
      runId: null,
      variant: 3 as const,
      payload: { variant: 3, title: "x", html: "<p>x</p>" },
      fallbackPayload: null,
      gathered: {},
      outcome: "valid" as const,
      failure: null,
      supersedes: null,
      rerenderOf: null,
      model: SONNET,
      latencyMs: null,
      createdAt: "2026-11-26T00:00:00Z",
    })),
    dbBefore: emptySnapshot(),
    dbAfter: emptySnapshot(),
    usage: { costMicros: 0, inputTokens: 0, outputTokens: 0 },
    timings: { firstRenderMs: null, completeMs: 1 },
  };
}

function render(name: string, over: Partial<RenderResult> = {}): RenderResult {
  return {
    name,
    source: "injection",
    variant: 3,
    handwritten: false,
    viewport: "desktop",
    theme: "light",
    failures: [],
    misstatements: [],
    canaryHits: 0,
    frameLoads: 1,
    ...over,
  };
}

describe("variantSummary", () => {
  test("the summary contains one section per variant and both models", () => {
    const md = variantSummary(empty({ measures: [1, 2, 3].flatMap((v) => [measures(SONNET, v as 1 | 2 | 3), measures(HAIKU, v as 1 | 2 | 3)]) }));
    for (const v of [1, 2, 3] as const) {
      expect(md.split("\n").filter((l) => l === `## ${VARIANT_NAMES[v]}`)).toHaveLength(1);
    }
    const sections = md.split(/^## /m).filter((s) => s.startsWith("Variant "));
    expect(sections).toHaveLength(3);
    for (const s of sections) {
      expect(s).toContain(`| Measure | ${SONNET} | ${HAIKU} |`);
      expect(s).toContain(SUMMARY_LABEL);
      expect(s).toContain("| Matrix runs measured | 60 | 60 |");
    }
    expect(md).toContain("| Fell back | 1.0% | 1.0% |");
    // What the timings and cost cover: the whole scenario in variant 1, the re-render only in 2 and 3.
    const section = (v: number) => md.split(/^## /m).find((x) => x.startsWith(`Variant ${v}`))!;
    expect(section(1)).toContain("| Timings, tokens and cost cover | whole scenario | whole scenario |");
    expect(section(2)).toContain("| Timings, tokens and cost cover | re-render only | re-render only |");
    expect(section(3)).toContain("| Timings, tokens and cost cover | re-render only | re-render only |");
    expect(md).toContain("| Misstatements | not run yet (test:render-smoke) | not run yet (test:render-smoke) |");
  });

  test("with nothing run, both default models still show, every input reads not run yet, and the checklist is there", () => {
    const md = variantSummary(empty());
    expect(md).toContain(`| Measure | ${SONNET} | ${HAIKU} |`);
    expect(md).toContain(`| Matrix runs measured | ${NOT_RUN} | ${NOT_RUN} |`);
    expect(md).toContain(`| Variant matrix (recordings/matrix) | none | ${NOT_RUN} |`);
    expect(md).toContain(`| Judge (recordings/judge) | none | ${NOT_RUN} |`);
    expect(md).toContain(SUMMARY_LABEL);
    for (const item of DEMO_CHECKLIST) expect(md).toContain(`| ${item} |  |  |  |`);
    expect(md).toContain("docs/runbooks/agent-variant-signals.sql");
    expect(md).toContain("fails the injection set is fixed before it is demoed further");
  });

  test("the inputs table names the runs it read", () => {
    const md = variantSummary(empty({ runs: { matrix: "20261126T010000Z", injection: "20261125T090000Z (cap_exceeded)", judge: "none" } }));
    expect(md).toContain(`| Variant matrix (recordings/matrix) | 20261126T010000Z | ${NOT_RUN} |`);
    expect(md).toContain(`| Prompt-injection set (recordings/injection) | 20261125T090000Z (cap_exceeded) | ${NOT_RUN} |`);
    expect(md).toContain(`| Judge (recordings/judge) | none | ${NOT_RUN} |`);
  });

  test("the judge's record reads from each variant's side", () => {
    const j = (over: Partial<JudgeResult>): JudgeResult => ({
      model: SONNET,
      scenario: "b_compare",
      persona: "senior-backend",
      seed: 1,
      variantA: 1,
      variantB: 2,
      shownFirst: "a",
      winner: "a",
      reason: "x",
      parsed: true,
      ...over,
    });
    const md = variantSummary(empty({ judge: [j({}), j({ winner: "b" }), j({ winner: "b" })], handCheckFile: "lib/agent/evals/recordings/judge/hand-check.csv" }));
    const v1 = md.split(/^## /m).find((s) => s.startsWith("Variant 1"))!;
    const v2 = md.split(/^## /m).find((s) => s.startsWith("Variant 2"))!;
    expect(v1).toContain("vs 2: 1 won, 2 lost, 0 tied");
    expect(v2).toContain("vs 1: 2 won, 1 lost, 0 tied");
    expect(md).toContain("hand-check.csv");
  });

  test("variant 3 injection results take their replay from the render smoke, once every surface rendered", () => {
    const base: InjectionResult = {
      caseId: "jd_write_skip",
      variant: 3,
      model: SONNET,
      recording: recording(2),
      texts: [],
      contacts: [],
      replay: null,
      html: null,
      evalRun: RUN,
    };
    const name = (i: number, run = RUN) => `injection/${run}/anthropic-claude-sonnet-5.5/v3/jd_write_skip.json#${i}`;
    expect(withReplays([base], [render(name(0))])[0].replay).toBeNull();
    // Another run's replay of the same case never fills this run's result.
    expect(withReplays([base], [render(name(0)), render(name(1, "20261120T010000Z"))])[0].replay).toBeNull();
    // A result with no run id waits for its replay.
    expect(withReplays([{ ...base, evalRun: undefined }], [render(name(0)), render(name(1))])[0].replay).toBeNull();
    expect(withReplays([base], [render(name(0)), render(name(1), { canaryHits: 2, frameLoads: 3 })])[0].replay).toEqual({ canaryHits: 2, loads: 3 });
    expect(withReplays([base], [render(name(0)), render(name(1), { viewport: "mobile" })])[0].replay).toBeNull();
    const v1 = { ...base, variant: 1 as const };
    expect(withReplays([v1], [])[0]).toBe(v1);
  });
});
