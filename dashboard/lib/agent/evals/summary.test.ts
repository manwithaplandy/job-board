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
    viewsPerTurn: 1.75,
    interactiveRate: variant === 3 ? 0.5 : null,
    rowListRate: variant === 3 ? 0.1 : null,
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

  test("PR 7: views per turn in every variant's section; interactive and row-list rates in variant 3's only", () => {
    const md = variantSummary(
      empty({
        measures: [1, 2, 3].flatMap((v) => [
          measures(SONNET, v as 1 | 2 | 3, { viewsPerTurn: 1.75, interactiveRate: v === 3 ? 0.4 : null, rowListRate: v === 3 ? 0.25 : null }),
          measures(HAIKU, v as 1 | 2 | 3, { viewsPerTurn: 2, interactiveRate: null, rowListRate: null }),
        ]),
      }),
    );
    const section = (v: number) => md.split(/^## /m).find((x) => x.startsWith(`Variant ${v}`))!;
    for (const v of [1, 2, 3]) expect(section(v)).toContain("| Views per turn (mean surfaces per run) | 1.75 | 2.00 |");
    expect(section(3)).toContain("| Interactive views (variant 3 documents) | 40.0% | n/a |");
    expect(section(3)).toContain("| Row-list views (variant 3 documents) | 25.0% | n/a |");
    for (const v of [1, 2]) expect(section(v)).not.toMatch(/Interactive views|Row-list views/);
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
    expect(md).not.toContain("## Pass spend");
  });

  test("PR J7: a matrix run from --pass shows the pass's reported spend against $3; an unknown cost makes it a floor", () => {
    const pass = {
      passId: RUN,
      limitUsd: 3,
      ceilingUsd: 3,
      runs: [
        { mode: "matrix", runId: "20261126T010001Z", status: "complete", costUsd: 1.5 },
        { mode: "injection", runId: "20261126T030000Z", status: "complete", costUsd: 0.3125 },
        { mode: "judge", runId: "20261126T040000Z", status: "complete", costUsd: 0.08 },
      ],
    };
    const md = variantSummary(empty({ pass }));
    expect(md).toContain(`Pass ${RUN} (\`npm run eval:agent -- --pass\`): reported spend $1.8925 against the $3.00 limit.`);
    expect(md).toContain("| injection | 20261126T030000Z | complete | $0.3125 |");
    expect(md).toContain("| pass total |  |  | $1.8925 of $3.00 |");
    const stopped = variantSummary(empty({ pass: { ...pass, runs: [{ ...pass.runs[0], status: "failed", costUsd: null }] } }));
    expect(stopped).toContain("reported spend at least $0.0000 against the $3.00 limit");
    expect(stopped).toContain("| matrix | 20261126T010001Z | failed | unknown |");
  });

  test("fix round 1: the pass's own --max-usd is the limit, and a stage that stopped on an unknown cost makes the spend a floor", () => {
    const pass = {
      passId: RUN,
      limitUsd: 2,
      ceilingUsd: 3,
      runs: [
        { mode: "matrix", runId: "20261126T010001Z", status: "complete", costUsd: 1.5, costFloor: false },
        { mode: "injection", runId: "20261126T030000Z", status: "cap_exceeded", costUsd: 0.25, costFloor: true },
      ],
    };
    const md = variantSummary(empty({ pass }));
    expect(md).toContain(`Pass ${RUN} (\`npm run eval:agent -- --pass\`): reported spend at least $1.7500 against the $2.00 limit.`);
    expect(md).toContain("| injection | 20261126T030000Z | cap_exceeded | at least $0.2500 |");
    expect(md).toContain("| matrix | 20261126T010001Z | complete | $1.5000 |");
    expect(md).toContain("| pass total |  |  | at least $1.7500 of $2.00 |");
    // A pass recorded before fix round 1 has no budget: the ceiling is shown, and says so.
    const old = variantSummary(empty({ pass: { ...pass, limitUsd: null, runs: [pass.runs[0]] } }));
    expect(old).toContain("reported spend $1.5000 against the $3.00 ceiling (this pass recorded no --max-usd).");
  });

  test("the judge's section names the judge model, Haiku 5.5 since PR J7", () => {
    expect(variantSummary(empty())).toContain(`The judge (${HAIKU}) informs and never decides.`);
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
    // PR 3: an expanded row (listed first, as its file name sorts first) never stands in for the inline one.
    expect(
      withReplays([base], [render(name(0)), render(name(1), { mode: "expanded", canaryHits: 9, frameLoads: 9 }), render(name(1), { canaryHits: 2, frameLoads: 1 })])[0].replay,
    ).toEqual({ canaryHits: 2, loads: 1 });
    expect(withReplays([base], [render(name(0)), render(name(1), { mode: "expanded" })])[0].replay).toBeNull();
    // PR 6: the asks made without a click are summed only when every surface's row counted them.
    expect(
      withReplays([base], [render(name(0), { asksWithoutClick: 1 }), render(name(1), { asksWithoutClick: 2 })])[0].replay,
    ).toEqual({ canaryHits: 0, loads: 1, asksWithoutClick: 3 });
    expect(withReplays([base], [render(name(0), { asksWithoutClick: 0 }), render(name(1), { asksWithoutClick: 0 })])[0].replay?.asksWithoutClick).toBe(0);
    expect(withReplays([base], [render(name(0), { asksWithoutClick: 1 }), render(name(1))])[0].replay).not.toHaveProperty("asksWithoutClick");
    const v1 = { ...base, variant: 1 as const };
    expect(withReplays([v1], [])[0]).toBe(v1);
  });

  test("PR 3: the model's render smoke cell counts a variant 3 surface's containment once, not again for its expanded run", () => {
    const name = `matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/a.json#0`;
    const rows = [
      render(name, { source: "matrix", canaryHits: 1, frameLoads: 2, evalRun: RUN }),
      render(name, { source: "matrix", viewport: "desktop-expanded", mode: "expanded", canaryHits: 1, frameLoads: 2, evalRun: RUN }),
    ];
    const md = variantSummary(empty({ render: { results: rows, counts: [] } }));
    expect(md).toContain("canary hits 1, reloads 1");
    expect(md).not.toContain("canary hits 2");
  });
});
