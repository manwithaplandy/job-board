// The per-variant summary (plan Task 2.13, spec 7.3): one short section per variant with
// the automatic measures (Task 2.10), the prompt-injection results (Task 2.12), the render
// smoke (Task 2.11) and the judge's counts, both models side by side, then the
// production-signal queries and the demo checklist. Supporting information for Andrew's
// decision, not a gate; the one hard line (spec 7.3) is the injection set.
//
// Pure: the inputs come in already read (scripts/eval-summary.mjs reads the files through
// summary.run.ts). An input that is missing reads "not run yet", so the summary can be
// generated at any point and shows what is there.
import type { Variant } from "@/lib/agent/config";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import type { VariantMeasures } from "@/lib/agent/evals/measures";
import { awaitsReplay, injectionTable, judgeInjection, type InjectionResult } from "@/lib/agent/evals/injection";
import { judgeTable, tallyJudge, type JudgeResult } from "@/lib/agent/evals/judge";
import type { RenderCounts, RenderResult } from "@/lib/agent/evals/renderResults";

export const NOT_RUN = "not run yet";
export const SUMMARY_LABEL = "Supporting information, not a gate.";

export const VARIANT_NAMES: Record<Variant, string> = {
  1: "Variant 1: curated blocks",
  2: "Variant 2: component tree",
  3: "Variant 3: sandboxed document",
};

/** Spec 7.3's things to watch for in demos: a checklist, not a score. */
export const DEMO_CHECKLIST = [
  "Not finding the primary action",
  "Mispredicting what a control does",
  "Not recognizing the same task when it is laid out differently the second time",
  "Needing to ask the agent how to use what it just built",
] as const;

export interface SummaryInputs {
  /** When the summary was generated (an ISO date), written in its header. */
  generatedAt: string;
  /** measure() over the matrix recordings; null or [] when there are none. */
  measures: VariantMeasures[] | null;
  /** The injection results, with variant 3 replays filled from the render smoke where it ran. */
  injection: InjectionResult[] | null;
  /** The render smoke's results and counts; null when there are none. */
  render: { results: RenderResult[]; counts: RenderCounts[] } | null;
  judge: JudgeResult[] | null;
  /** Where the hand-check CSV was written, if it was. */
  handCheckFile?: string | null;
}

const has = <T>(xs: readonly T[] | null | undefined): xs is readonly T[] => Array.isArray(xs) && xs.length > 0;

/**
 * Variant 3 injection results with their replay filled from the render smoke: the canary
 * hits over the run's surfaces and the most loads any frame had. A result whose surfaces
 * were not all rendered keeps replay null (it awaits the replay).
 */
export function withReplays(results: readonly InjectionResult[], render: readonly RenderResult[]): InjectionResult[] {
  return results.map((r) => {
    if (r.variant !== 3 || r.replay !== null || !r.recording) return r;
    const slug = r.model.replace(/[^A-Za-z0-9.-]+/g, "-");
    const prefix = `injection/${slug}/v3/${r.caseId}.json#`;
    const rows = r.recording.surfaces.map((_, i) =>
      render.find((x) => x.name === `${prefix}${i}` && x.viewport === "desktop" && x.theme === "light" && x.canaryHits !== null),
    );
    if (rows.some((x) => !x)) return r;
    return {
      ...r,
      replay: {
        canaryHits: rows.reduce((n, x) => n + (x?.canaryHits ?? 0), 0),
        loads: rows.reduce((n, x) => Math.max(n, x?.frameLoads ?? 0), 0),
      },
    };
  });
}

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const ms = (s: { median: number | null; p90: number | null }) =>
  s.median === null ? "n/a" : `${Math.round(s.median)} / ${s.p90 === null ? "n/a" : Math.round(s.p90)}`;
const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
const num = (x: number | null, digits = 0) => (x === null ? "n/a" : x.toFixed(digits));

function measureRows(m: VariantMeasures | undefined): Array<[string, string]> {
  if (!m) {
    return [["Matrix runs measured", NOT_RUN]];
  }
  return [
    ["Matrix runs measured", String(m.runs)],
    ["Surfaces", String(m.surfaces)],
    ["Validation failures (repaired or fell back)", pct(m.validationFailureRate)],
    ["Repaired", pct(m.repairRate)],
    ["Fell back", pct(m.fallbackRate)],
    ["First render, median / p90 (ms)", ms(m.firstRenderMs)],
    ["Complete, median / p90 (ms)", ms(m.completeMs)],
    ["Mean output tokens", num(m.meanOutputTokens)],
    ["Assert failures (runs with any)", `${m.assertFailures} (${m.runsFailingAsserts})`],
    ["Misstatements", m.misstatements === null ? `${NOT_RUN} (test:render-smoke)` : String(m.misstatements)],
    ["Structural variance (0 same, 1 all different)", num(m.structuralVariance, 2)],
    ["Cost at reported prices", usd(m.costMicros)],
    ["Tokens in / out", `${m.inputTokens.toLocaleString("en-US")} / ${m.outputTokens.toLocaleString("en-US")}`],
  ];
}

function injectionCell(results: readonly InjectionResult[] | null, model: string, variant: Variant): string {
  if (!has(results)) return NOT_RUN;
  const rs = results.filter((r) => r.model === model && r.variant === variant && r.recording !== null);
  if (rs.length === 0) return NOT_RUN;
  const pass = rs.filter((r) => judgeInjection(r).pass).length;
  const waiting = rs.filter((r) => awaitsReplay(r)).length;
  const fail = rs.length - pass - waiting;
  return [`${pass} of ${rs.length} pass`, fail > 0 ? `${fail} FAIL` : null, waiting > 0 ? `${waiting} await replay` : null].filter(Boolean).join(", ");
}

function renderCell(render: SummaryInputs["render"], model: string, variant: Variant): string {
  if (!render || render.results.length === 0) return NOT_RUN;
  const slug = model.replace(/[^A-Za-z0-9.-]+/g, "-");
  const rs = render.results.filter((r) => r.source === "matrix" && r.variant === variant && r.name.startsWith(`matrix/${slug}/`));
  if (rs.length === 0) return NOT_RUN;
  const surfaces = new Set(rs.map((r) => r.name)).size;
  const failing = new Set(rs.filter((r) => r.failures.length > 0).map((r) => r.name)).size;
  const contained = variant === 3 ? `, canary hits ${rs.reduce((n, r) => n + (r.canaryHits ?? 0), 0)}, reloads ${rs.filter((r) => (r.frameLoads ?? 0) > 1).length}` : "";
  return `${failing} of ${surfaces} surfaces with a finding${contained}`;
}

function judgeCell(judge: readonly JudgeResult[] | null, model: string, variant: Variant): string {
  if (!has(judge)) return NOT_RUN;
  const parts: string[] = [];
  for (const t of tallyJudge(judge.filter((r) => r.model === model))) {
    if (t.variantA === variant) parts.push(`vs ${t.variantB}: ${t.winsA} won, ${t.winsB} lost, ${t.ties} tied`);
    else if (t.variantB === variant) parts.push(`vs ${t.variantA}: ${t.winsB} won, ${t.winsA} lost, ${t.ties} tied`);
  }
  return parts.length > 0 ? parts.join("; ") : NOT_RUN;
}

const row = (cells: readonly string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;

/** The models side by side: those the matrix measured, else AGENT_EVAL_MODELS. */
function summaryModels(inputs: SummaryInputs): string[] {
  const seen = [
    ...(inputs.measures ?? []).map((m) => m.model),
    ...(inputs.injection ?? []).map((r) => r.model),
    ...(inputs.judge ?? []).map((r) => r.model),
  ];
  const models = [...new Set(seen)];
  return models.length > 0 ? models : [...AGENT_EVAL_MODELS];
}

/** The summary as Markdown. */
export function variantSummary(inputs: SummaryInputs): string {
  const models = summaryModels(inputs);
  const out: string[] = [
    "# Agent variants: per-variant summary",
    "",
    `> ${SUMMARY_LABEL} Generated by \`npm run eval:summary\` on ${inputs.generatedAt}. The decision is Andrew's, from demos (spec 7.3); these numbers inform it. The one hard line is security: a variant that fails the injection set is fixed before it is demoed further.`,
    "",
    "## Inputs",
    "",
    "| Input | Status |",
    "|---|---|",
    row(["Variant matrix (recordings/matrix)", has(inputs.measures) ? `${inputs.measures.reduce((n, m) => n + m.runs, 0)} recordings measured` : NOT_RUN]),
    row(["Prompt-injection set (recordings/injection)", has(inputs.injection) ? `${inputs.injection.length} results` : NOT_RUN]),
    row(["Render smoke (test-results/render-smoke/results)", inputs.render && inputs.render.results.length > 0 ? `${inputs.render.results.length} results` : NOT_RUN]),
    row(["Judge (recordings/judge)", has(inputs.judge) ? `${inputs.judge.length} pairs` : NOT_RUN]),
    row(["Production signals (docs/runbooks/agent-variant-signals.sql)", "read by hand; not in this file"]),
    "",
  ];

  for (const variant of [1, 2, 3] as const) {
    out.push(`## ${VARIANT_NAMES[variant]}`, "", `_${SUMMARY_LABEL}_`, "", row(["Measure", ...models]), row(["---", ...models.map(() => "---")]));
    const perModel = models.map((model) => measureRows(inputs.measures?.find((m) => m.model === model && m.variant === variant)));
    const labels = perModel.reduce((longest, rows) => (rows.length > longest.length ? rows : longest), perModel[0]).map(([label]) => label);
    for (const label of labels) {
      out.push(row([label, ...perModel.map((rows) => rows.find(([l]) => l === label)?.[1] ?? NOT_RUN)]));
    }
    out.push(row(["Prompt-injection set", ...models.map((m) => injectionCell(inputs.injection, m, variant))]));
    out.push(row(["Render smoke (matrix surfaces)", ...models.map((m) => renderCell(inputs.render, m, variant))]));
    out.push(row(["Judge (pairwise, this variant's record)", ...models.map((m) => judgeCell(inputs.judge, m, variant))]));
    out.push("");
  }

  out.push("## Prompt-injection set", "", "A failure here blocks further demos of that variant until it is fixed (spec 7.3).", "");
  out.push(has(inputs.injection) ? injectionTable([...inputs.injection]) : NOT_RUN);
  out.push(
    "",
    "The three hand-written variant 3 documents (auto_fire, intent_loop, chip_spoof) need no model and run in every CI build in `npm run test:sandbox`.",
    "",
  );

  out.push("## Render smoke", "");
  if (inputs.render && inputs.render.counts.length > 0) {
    out.push(row(["Source", "Variant", "Surfaces", "Width and theme runs with a finding", "Misstatements", "Canary hits", "Reloads"]), row(["---", "---", "---", "---", "---", "---", "---"]));
    for (const c of inputs.render.counts) {
      out.push(row([c.source, String(c.variant), String(c.surfaces), String(c.failing), String(c.misstatements), String(c.canaryHits), String(c.reloads)]));
    }
  } else out.push(NOT_RUN);
  out.push("");

  out.push("## Judge", "", `_${SUMMARY_LABEL} The judge (openai/gpt-5.5) informs and never decides._`, "");
  if (has(inputs.judge)) {
    out.push(judgeTable(inputs.judge));
    if (inputs.handCheckFile) out.push("", `Hand-check sample (10% of the pairs): \`${inputs.handCheckFile}\`.`);
  } else out.push(NOT_RUN);
  out.push("");

  out.push(
    "## Production signals",
    "",
    "Read-only queries per variant (fallback rate, re-render use, undo within 60 seconds of an agent action, the same question asked again in a thread, a surface left for a workspace) are in `docs/runbooks/agent-variant-signals.sql`. They are run by hand on a read-only connection once variants have real traffic; their numbers are not copied here.",
    "",
    "## Demo checklist",
    "",
    "Things worth watching for in demos (spec 7.3): a checklist, not a score.",
    "",
    row(["Watch for", ...([1, 2, 3] as const).map((v) => `Variant ${v}`)]),
    row(["---", "---", "---", "---"]),
    ...DEMO_CHECKLIST.map((item) => row([item, "", "", ""])),
    "",
  );
  return out.join("\n");
}
