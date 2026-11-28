// The matrix's automatic measures (plan Task 2.10), over the committed hand-written
// recordings and copies of them changed one thing at a time. Pure; runs in CI.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { assertRecording } from "@/lib/agent/evals/asserts";
import {
  interactiveRate,
  isInteractiveDocument,
  isRowListDocument,
  isSurfaceFailure,
  measure,
  normalizedDistance,
  quantile,
  recordingSignature,
  rowListRate,
  structuralSignature,
  SURFACE_SEPARATOR,
  structuralVariance,
  viewsPerTurn,
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

  // Spec 08 S15.2: a turn's views are joined in stored order, which is the order the
  // recording lists them (listThreadSurfaces: created_at, then id), never re-sorted.
  test("two views of one turn are joined in stored order with SURFACE_SEPARATOR", () => {
    const r = committed("b_compare");
    r.surfaces[1].runId = r.surfaces[0].runId;
    expect(recordingSignature(r)).toBe(["JobComparison", SURFACE_SEPARATOR, "MemoDiff Callout"].join(" "));
    r.surfaces.reverse();
    expect(recordingSignature(r)).toBe(["MemoDiff Callout", SURFACE_SEPARATOR, "JobComparison"].join(" "));
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

  test("a re-render counts only its surfaces' assert failures, and each row says what its timings cover", () => {
    const live = committed("c_prep");
    // One run-level failure (a press with no handler), one surface failure (a fit the database does not hold).
    live.intents = [{ intent: { name: "no_such_action" } } as unknown as Recording["intents"][number]];
    const g = live.surfaces[0].gathered as { reviews: Record<string, { fitScore: number }> };
    g.reviews[Object.keys(g.reviews)[0]].fitScore = 1;
    const codes = assertRecording(live).map((f) => f.code).sort();
    expect(codes).toEqual(["fit_mismatch", "unhandled_action"]);
    const rerender = { ...structuredClone(live), source: "rerender" as const, model: "m/re" };
    const out = measure([live, rerender]);
    const row = (model: string) => out.find((m) => m.model === model)!;
    expect(row(live.model)).toMatchObject({ scope: "whole scenario", assertFailures: 2, runsFailingAsserts: 1, misstatements: 1 });
    expect(row("m/re")).toMatchObject({ scope: "re-render only", assertFailures: 1, runsFailingAsserts: 1, misstatements: 1 });
    expect(measure([live, { ...structuredClone(live), source: "rerender" as const, seed: 9 }])[0].scope).toBe("mixed");
    expect(isSurfaceFailure({ path: "surfaces" })).toBe(true);
    expect(isSurfaceFailure({ path: "surfaces[0].payload" })).toBe(true);
    expect(isSurfaceFailure({ path: "surfacesExtra" })).toBe(false);
    expect(isSurfaceFailure({ path: "intents[0]" })).toBe(false);
    expect(isSurfaceFailure({})).toBe(false);
  });

  test("quantile is nearest-rank and null for no values", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([5], 0.9)).toBe(5);
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2);
  });
});

// PR 7 (inline-UI spec S15.2): views per turn, and how many variant 3 documents let the
// person work with the data (interactive) or only list rows (row list). Summary only.
const INTERACTIVE_DOC = [
  "<!doctype html><html><head><title>Pay</title></head><body>",
  '<h1>Roles by pay</h1><jb-slider id="pay" min="0" max="250000" step="10000"></jb-slider>',
  '<div id="out"></div>',
  "</body></html>",
].join("");
const ROW_LIST_DOC = [
  "<!doctype html><html><head><title>Saved roles</title></head><body><h1>Saved roles</h1>",
  ...["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark"].map((c) => `<div class="jb-card"><h3>${c}</h3><p class="jb-muted">Remote</p></div>`),
  "</body></html>",
].join("");
const CHART_DOC = [
  "<!doctype html><html><head><title>Fit</title></head><body>",
  '<h1>Fit by company</h1><div id="chart" class="jb-card"></div>',
  '<script>host.chart(document.getElementById("chart"), { viz: "bar", series: [{ name: "Fit", points: [{ x: "Acme", y: 82 }] }] });</script>',
  "</body></html>",
].join("");

function withDocuments(variant: 1 | 2 | 3, htmls: string[]): Recording {
  const r = committed("b_compare");
  const base = r.surfaces[0];
  r.variant = variant;
  r.surfaces = htmls.map((html, i) => ({ ...structuredClone(base), id: `doc-${i}`, variant: 3, payload: { variant: 3, title: `View ${i}`, html } }) as Recording["surfaces"][number]);
  return r;
}

describe("interactive and row-list documents (PR 7)", () => {
  test("a document with a slider is interactive; six jb-card rows are a row list; a single chart is neither", () => {
    expect(isInteractiveDocument(INTERACTIVE_DOC)).toBe(true);
    expect(isRowListDocument(INTERACTIVE_DOC)).toBe(false);
    expect(isInteractiveDocument(ROW_LIST_DOC)).toBe(false);
    expect(isRowListDocument(ROW_LIST_DOC)).toBe(true);
    expect(isInteractiveDocument(CHART_DOC)).toBe(false);
    expect(isRowListDocument(CHART_DOC)).toBe(false);
  });

  test("each marker alone makes a document interactive", () => {
    for (const marker of ['<jb-select id="a"></jb-select>', "<jb-slider></jb-slider>", "<jb-toggle></jb-toggle>", "<jb-segmented></jb-segmented>", "<jb-tabs></jb-tabs>", "<jb-field></jb-field>"]) {
      expect(isInteractiveDocument(`<body><h1>x</h1>${marker}</body>`)).toBe(true);
    }
    for (const script of ["host.table(el, rows, cols)", "host.chart(el, { viz: 'bar', onSelect: (p) => p })", 'el.addEventListener("click", f)']) {
      expect(isInteractiveDocument(`<body><div id="el"></div><script>${script}</script></body>`)).toBe(true);
    }
  });

  test("a row list needs one class value on four or more elements, and no interactive marker", () => {
    const rows = (n: number, cls = "jb-card") => `<body>${Array.from({ length: n }, (_, i) => `<div class="${cls}">${i}</div>`).join("")}</body>`;
    expect(isRowListDocument(rows(3))).toBe(false);
    expect(isRowListDocument(rows(4))).toBe(true);
    // The class value is compared after trimming and collapsing whitespace.
    expect(isRowListDocument('<body><p class=" jb-row  jb-muted">a</p><p class="jb-row jb-muted">b</p><p class="jb-row jb-muted ">c</p><p class="jb-row\tjb-muted">d</p></body>')).toBe(true);
    // Four elements with four different classes are not a list of rows.
    expect(isRowListDocument('<body><p class="a">1</p><p class="b">2</p><p class="c">3</p><p class="d">4</p></body>')).toBe(false);
    // Rows with a filter are a working view, not a row list.
    expect(isRowListDocument(rows(6).replace("<body>", "<body><jb-field></jb-field>"))).toBe(false);
  });

  test("over three variant 3 recordings, one interactive, one row list, one chart: each rate is 1/3", () => {
    const rs = [withDocuments(3, [INTERACTIVE_DOC]), withDocuments(3, [ROW_LIST_DOC]), withDocuments(3, [CHART_DOC])];
    expect(interactiveRate(rs)).toBeCloseTo(1 / 3);
    expect(rowListRate(rs)).toBeCloseTo(1 / 3);
    // Only variant 3 recordings count, and a fallback surface (variant 1 blocks) is not a document.
    const fallback = withDocuments(3, [INTERACTIVE_DOC]);
    fallback.surfaces[0].payload = { variant: 1, title: "x", blocks: [{ type: "Callout", tone: "info", text: "x" }] } as never;
    expect(interactiveRate([...rs, withDocuments(2, [INTERACTIVE_DOC]), fallback])).toBeCloseTo(1 / 3);
    expect(interactiveRate([])).toBeNull();
    expect(rowListRate([withDocuments(1, [ROW_LIST_DOC])])).toBeNull();
  });

  test("viewsPerTurn is the mean surfaces per run, per variant: 2 for a run with two surfaces", () => {
    expect(viewsPerTurn([withDocuments(3, [CHART_DOC, ROW_LIST_DOC])])[3]).toBe(2);
    expect(viewsPerTurn([withDocuments(3, [CHART_DOC, ROW_LIST_DOC]), withDocuments(3, [CHART_DOC]), withDocuments(1, [CHART_DOC])])).toEqual({ 1: 1, 2: 0, 3: 1.5 });
  });

  test("measure() carries them: views per turn for every variant, the two rates for variant 3 only", () => {
    const rs = [withDocuments(3, [INTERACTIVE_DOC, CHART_DOC]), withDocuments(3, [ROW_LIST_DOC]), withDocuments(2, [CHART_DOC])];
    const out = measure(rs);
    const v3 = out.find((m) => m.variant === 3)!;
    const v2 = out.find((m) => m.variant === 2)!;
    expect(v3).toMatchObject({ viewsPerTurn: 1.5 });
    expect(v3.interactiveRate).toBeCloseTo(1 / 3);
    expect(v3.rowListRate).toBeCloseTo(1 / 3);
    expect(v2).toMatchObject({ viewsPerTurn: 1, interactiveRate: null, rowListRate: null });
  });
});
