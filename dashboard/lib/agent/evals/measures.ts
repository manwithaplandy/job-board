// The variant matrix's automatic measures (plan Task 2.10, spec 11). Pure: recordings in,
// numbers out, so the CI tests and the summary (Task 2.13) compute them without a model
// or a database.
//
// Per model and variant: how often a surface needed a repair or fell back, how long the
// runs took, what they cost, how many assert failures and misstatements they had, and how
// much the layout moved between repeats of the same scenario and persona (structural
// variance: 0 when every repeat drew the same structure, 1 when no two shared anything).
import type { Variant } from "@/lib/agent/config";
import type { SurfacePayload } from "@/lib/agent/surfaces/v1/validate";
import { scanStartTags } from "@/lib/agent/surfaces/v3/document";
import { assertRecording, treeNodes, type AssertCode } from "@/lib/agent/evals/asserts";
import type { Recording } from "@/lib/agent/evals/recording";

/** The assert codes that mean a surface stated something other than the database. */
export const MISSTATEMENT_CODES: ReadonlySet<AssertCode> = new Set<AssertCode>([
  "job_not_in_database",
  "title_mismatch",
  "company_mismatch",
  "fit_mismatch",
  "pay_mismatch",
  "link_mismatch",
  "link_in_text",
]);

export interface Spread {
  median: number | null;
  p90: number | null;
}

/**
 * What a group's timings, tokens and cost cover: a live variant 1 run is the whole
 * scenario (every turn and tool call); a variant 2 or 3 matrix cell re-renders that run's
 * surfaces and records only the re-render.
 */
export type MeasureScope = "whole scenario" | "re-render only" | "mixed";

export interface VariantMeasures {
  model: string;
  variant: Variant;
  /** Recordings measured (matrix cells that finished). */
  runs: number;
  /** What the timings, tokens and cost below cover. */
  scope: MeasureScope;
  /** Surfaces over every run. */
  surfaces: number;
  /** Surfaces whose first payload failed validation: repaired or fell back. */
  validationFailureRate: number | null;
  /** Surfaces with outcome repaired, only. */
  repairRate: number | null;
  /** Surfaces with outcome fallback, only. */
  fallbackRate: number | null;
  firstRenderMs: Spread;
  completeMs: Spread;
  meanOutputTokens: number | null;
  /**
   * Assert failures over every run, and the runs with any. A re-render recording counts
   * only its surfaces' failures (isSurfaceFailure): its tool calls, presses and database
   * are variant 1's, copied, and were counted there.
   */
  assertFailures: number;
  runsFailingAsserts: number;
  /**
   * Figures that differ from the database: from assertRecording for variants 1 and 2; for
   * variant 3 from render smoke (Task 2.11), null until it is given.
   */
  misstatements: number | null;
  /** Mean over scenario x persona of the variance across its repeats; null with fewer than two repeats. */
  structuralVariance: number | null;
  costMicros: number;
  inputTokens: number;
  outputTokens: number;
  /** PR 7: mean surfaces per run (viewsPerTurn); null with no runs. */
  viewsPerTurn: number | null;
  /** PR 7, variant 3 only: the share of its documents that are interactive (isInteractiveDocument); null otherwise or with none. */
  interactiveRate: number | null;
  /** PR 7, variant 3 only: the share of its documents that only list rows (isRowListDocument); null otherwise or with none. */
  rowListRate: number | null;
}

/** Signature tokens are joined by spaces; surfaces in one run are separated by this token. */
export const SURFACE_SEPARATOR = "|";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A payload's structure as space-separated tokens: variant 1, the block types in order;
 * variant 2, the tree's node types in pre-order; variant 3, the start-tag names of the
 * HTML body in document order. Read by shape, so a variant 2 or 3 surface stored as its
 * variant 1 fallback signs as variant 1. Anything else signs as "invalid".
 */
export function structuralSignature(payload: SurfacePayload | Record<string, unknown>): string {
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.blocks)) {
    return p.blocks.map((b) => (isObject(b) && typeof b.type === "string" ? b.type : "?")).join(" ") || "empty";
  }
  if (p.variant === 2 && isObject(p.root)) {
    const types: string[] = [];
    for (const n of treeNodes(p.root as never)) types.push(typeof n?.type === "string" ? n.type : "?");
    return types.join(" ");
  }
  if (p.variant === 3 && typeof p.html === "string") {
    const bodyAt = p.html.search(/<body[\s>]/i);
    const html = bodyAt === -1 ? p.html : p.html.slice(bodyAt);
    return scanStartTags(html).map((t) => t.name).join(" ") || "empty";
  }
  return "invalid";
}

/** A run's structure: every surface's signature, in order. */
export function recordingSignature(r: Recording): string {
  return r.surfaces.map((s) => structuralSignature(s.payload)).join(` ${SURFACE_SEPARATOR} `);
}

function tokens(s: string): string[] {
  return s.split(" ").filter((t) => t.length > 0);
}

/** Levenshtein distance over token sequences. */
function editDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** The edit distance divided by the longer sequence's length: 0 to 1. */
export function normalizedDistance(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const longer = Math.max(ta.length, tb.length);
  return longer === 0 ? 0 : editDistance(ta, tb) / longer;
}

/** The mean pairwise normalized edit distance across `signatures`, 0 to 1; 0 for fewer than two. */
export function structuralVariance(signatures: string[]): number {
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      sum += normalizedDistance(signatures[i], signatures[j]);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
}

/** The value at quantile q (nearest rank) of `values`, or null when there are none. */
export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(q * sorted.length)));
  return sorted[rank - 1];
}

/** A failure about the surfaces themselves (path under "surfaces"), not the run's tools, presses or database. */
export function isSurfaceFailure(f: { path?: string }): boolean {
  const p = f.path ?? "";
  return p === "surfaces" || p.startsWith("surfaces[") || p.startsWith("surfaces.");
}

// ---------------------------------------------------------------------------
// PR 7 (inline-UI spec S15.2): views per turn, interactive and row-list documents. They
// feed the summary only; no gate reads them.
// ---------------------------------------------------------------------------

/** What makes a variant 3 document interactive: a kit control, a kit table, a chart's onSelect, or a listener of its own. */
const INTERACTIVE_TAGS = ["<jb-select", "<jb-slider", "<jb-toggle", "<jb-segmented", "<jb-tabs", "<jb-field"] as const;
const INTERACTIVE_SCRIPT = ["host.table(", "onSelect", "addEventListener("] as const;

/** A row list repeats one class value on this many elements or more. */
const ROW_LIST_MIN_ROWS = 4;

/** True when the document lets the person work with the data: any of INTERACTIVE_TAGS or INTERACTIVE_SCRIPT in it. */
export function isInteractiveDocument(html: string): boolean {
  const lower = html.toLowerCase();
  return INTERACTIVE_TAGS.some((t) => lower.includes(t)) || INTERACTIVE_SCRIPT.some((s) => html.includes(s));
}

/**
 * True when the document only lists rows: it is not interactive, and one class attribute
 * value (trimmed, whitespace collapsed) is on ROW_LIST_MIN_ROWS elements or more of its
 * markup. Rows a script builds (host.el in a loop) are not markup and are not counted.
 */
export function isRowListDocument(html: string): boolean {
  if (isInteractiveDocument(html)) return false;
  const counts = new Map<string, number>();
  for (const tag of scanStartTags(html)) {
    const cls = tag.attrs.find((a) => a.name.toLowerCase() === "class")?.value?.trim().split(/\s+/).join(" ");
    if (!cls) continue;
    const n = (counts.get(cls) ?? 0) + 1;
    if (n >= ROW_LIST_MIN_ROWS) return true;
    counts.set(cls, n);
  }
  return false;
}

/** The HTML of every variant 3 document in `recordings`' variant 3 runs (a surface stored as its fallback is not one). */
function variant3Documents(recordings: readonly Recording[]): string[] {
  const out: string[] = [];
  for (const r of recordings) {
    if (r.variant !== 3) continue;
    for (const s of r.surfaces) {
      const p = s.payload as Record<string, unknown>;
      if (p.variant === 3 && typeof p.html === "string") out.push(p.html);
    }
  }
  return out;
}

/** The share of `recordings`' variant 3 documents that are interactive; null with none. */
export function interactiveRate(recordings: readonly Recording[]): number | null {
  const docs = variant3Documents(recordings);
  return rate(docs.filter(isInteractiveDocument).length, docs.length);
}

/** The share of `recordings`' variant 3 documents that only list rows; null with none. */
export function rowListRate(recordings: readonly Recording[]): number | null {
  const docs = variant3Documents(recordings);
  return rate(docs.filter(isRowListDocument).length, docs.length);
}

/** Mean surfaces per run, per variant; 0 for a variant with no runs in `recordings`. */
export function viewsPerTurn(recordings: readonly Recording[]): Record<Variant, number> {
  const mean = (v: Variant) => {
    const rs = recordings.filter((r) => r.variant === v);
    return rs.length === 0 ? 0 : rs.reduce((n, r) => n + r.surfaces.length, 0) / rs.length;
  };
  return { 1: mean(1), 2: mean(2), 3: mean(3) };
}

function scopeOf(rs: readonly Recording[]): MeasureScope {
  const rerenders = rs.filter((r) => r.source === "rerender").length;
  return rerenders === 0 ? "whole scenario" : rerenders === rs.length ? "re-render only" : "mixed";
}

const spread = (values: number[]): Spread => ({ median: quantile(values, 0.5), p90: quantile(values, 0.9) });
const rate = (n: number, of: number) => (of === 0 ? null : n / of);

/** The measures of one model and variant's recordings. */
function measureGroup(model: string, variant: Variant, rs: Recording[], v3Misstatements: number | undefined): VariantMeasures {
  const surfaces = rs.flatMap((r) => r.surfaces);
  const repaired = surfaces.filter((s) => s.outcome === "repaired").length;
  const fallback = surfaces.filter((s) => s.outcome === "fallback").length;
  let assertFailures = 0;
  let runsFailingAsserts = 0;
  let misstated = 0;
  for (const r of rs) {
    const all = assertRecording(r);
    const failures = r.source === "rerender" ? all.filter(isSurfaceFailure) : all;
    assertFailures += failures.length;
    if (failures.length > 0) runsFailingAsserts += 1;
    misstated += failures.filter((f) => MISSTATEMENT_CODES.has(f.code)).length;
  }
  const groups = new Map<string, string[]>();
  for (const r of rs) {
    const key = `${r.scenario}|${r.persona}`;
    groups.set(key, [...(groups.get(key) ?? []), recordingSignature(r)]);
  }
  const variances = [...groups.values()].filter((g) => g.length >= 2).map(structuralVariance);
  return {
    model,
    variant,
    runs: rs.length,
    scope: scopeOf(rs),
    surfaces: surfaces.length,
    validationFailureRate: rate(repaired + fallback, surfaces.length),
    repairRate: rate(repaired, surfaces.length),
    fallbackRate: rate(fallback, surfaces.length),
    firstRenderMs: spread(rs.map((r) => r.timings.firstRenderMs).filter((v): v is number => v !== null)),
    completeMs: spread(rs.map((r) => r.timings.completeMs)),
    meanOutputTokens: rs.length === 0 ? null : rs.reduce((s, r) => s + r.usage.outputTokens, 0) / rs.length,
    assertFailures,
    runsFailingAsserts,
    misstatements: variant === 3 ? (v3Misstatements ?? null) : misstated,
    structuralVariance: variances.length === 0 ? null : variances.reduce((s, v) => s + v, 0) / variances.length,
    costMicros: rs.reduce((s, r) => s + r.usage.costMicros, 0),
    inputTokens: rs.reduce((s, r) => s + r.usage.inputTokens, 0),
    outputTokens: rs.reduce((s, r) => s + r.usage.outputTokens, 0),
    viewsPerTurn: rs.length === 0 ? null : viewsPerTurn(rs)[variant],
    interactiveRate: variant === 3 ? interactiveRate(rs) : null,
    rowListRate: variant === 3 ? rowListRate(rs) : null,
  };
}

/**
 * The measures per model and variant, models in first-seen order and variants 1 to 3.
 * `v3Misstatements` maps a model to render smoke's variant 3 misstatement count (Task 2.11).
 */
export function measure(recordings: Recording[], v3Misstatements: Record<string, number> = {}): VariantMeasures[] {
  const models = [...new Set(recordings.map((r) => r.model))];
  const out: VariantMeasures[] = [];
  for (const model of models) {
    for (const variant of [1, 2, 3] as const) {
      const rs = recordings.filter((r) => r.model === model && r.variant === variant);
      if (rs.length === 0) continue;
      const v3 = Object.hasOwn(v3Misstatements, model) ? v3Misstatements[model] : undefined;
      out.push(measureGroup(model, variant, rs, v3));
    }
  }
  return out;
}
