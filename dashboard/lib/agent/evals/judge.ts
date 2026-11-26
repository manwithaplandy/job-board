// The judge (plan Task 2.13, spec 11): a model from another family (AGENT_JUDGE_MODEL)
// compares two variants' surfaces for the same matrix cell (same model, scenario, persona
// and repeat) and says which serves the user better, or that they tie. It informs the
// variant decision and never decides it: Andrew hand-checks a 10% sample
// (sampleForHandCheck) and the summary labels the judge's counts as supporting
// information.
//
// Blind by construction: the two recordings go in a random order as "Response First" and
// "Response Second", and each is rendered the same way whatever its variant (surfaceText:
// the visible words, with job references resolved from the gathered data and the
// controls' labels), so the prompt never names a variant, a payload kind or the
// renderer. Words in a surface that would name one are redacted. A variant 3 document
// fills itself in from the gathered data only when it runs, so its words come from the
// render smoke (Task 2.11 writes each frame's rendered text, controls and links marked the
// same way); a pair whose document was not rendered is not judged (awaitsRender), rather
// than compared as an empty page.
//
// Pure apart from the one model call in judgePair, which goes through the model it is
// given: judge.eval.ts passes AGENT_JUDGE_MODEL wrapped in the judge caps (budget.ts),
// the unit tests pass a mock. No database, no harness.
import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { Variant } from "@/lib/agent/config";
import type { GatheredData } from "@/lib/agent/gathered";
import { parseGathered } from "@/lib/agent/gatheredSchema";
import { BLOCK_INTENTS } from "@/lib/agent/evals/asserts";
import type { Recording } from "@/lib/agent/evals/recording";
import { SCENARIOS, type ScenarioStep } from "@/lib/agent/evals/scenarios";

export type JudgeWinner = "a" | "b" | "tie";

export interface JudgeVerdict {
  winner: JudgeWinner;
  reason: string;
}

/** Two recordings of one matrix cell in two variants; `a` is the lower variant. */
export interface JudgePairInput {
  model: string;
  scenario: Recording["scenario"];
  persona: Recording["persona"];
  seed: number;
  a: Recording;
  b: Recording;
}

/** One judged pair, as judge.eval.ts writes it and the summary reads it. */
export interface JudgeResult {
  model: string;
  scenario: string;
  persona: string;
  seed: number;
  variantA: Variant;
  variantB: Variant;
  /** Which recording the judge saw first: the order is random per pair. */
  shownFirst: "a" | "b";
  winner: JudgeWinner;
  reason: string;
  /** False when the judge's reply did not parse (counted as a tie, and listed). */
  parsed: boolean;
  /** The judge run (evalRuns.ts) and the matrix run it judged; judge.eval.ts always sets both. */
  evalRun?: string;
  matrixRun?: string;
}

/** The judge's output budget: a short JSON verdict; low reasoning effort keeps it small. */
export const JUDGE_MAX_OUTPUT_TOKENS = 2_000;
/** Characters of one recording's rendered surfaces in the prompt. */
export const JUDGE_RECORDING_CHARS = 12_000;

export const JUDGE_SYSTEM = [
  "You compare two responses an assistant gave a job seeker for the same requests, built from the same data.",
  "Decide which response serves the user better: it answers what was asked; every job, score and pay figure it states is consistent across what it shows; it is easy to scan; the next step is clear and the controls say what they do.",
  "Length is not a merit. Do not prefer a response for being first or second.",
  'Reply with JSON only, no other text: {"winner": "first" | "second" | "tie", "reason": "one or two sentences"}.',
].join(" ");

// ---------------------------------------------------------------------------
// Pairs
// ---------------------------------------------------------------------------

const PAIRINGS: ReadonlyArray<readonly [Variant, Variant]> = [
  [1, 2],
  [1, 3],
  [2, 3],
];

/**
 * Every pair to judge: per eval run, model, scenario, persona and repeat (seed), each two
 * variants that both finished (1-2, 1-3, 2-3). Ordered by run, model, scenario, persona,
 * seed, pairing, so --max-pairs takes a stable prefix. judge.eval.ts reads one run.
 */
export function judgePairs(recordings: readonly Recording[]): JudgePairInput[] {
  const cells = new Map<string, Map<Variant, Recording>>();
  for (const r of recordings) {
    // The eval run is part of the cell: two runs' recordings are never paired.
    const key = JSON.stringify([r.evalRun ?? "", r.model, r.scenario, r.persona, r.seed]);
    const cell = cells.get(key) ?? new Map<Variant, Recording>();
    if (!cell.has(r.variant)) cell.set(r.variant, r);
    cells.set(key, cell);
  }
  const keys = [...cells.keys()].sort((x, y) => {
    const [ex, mx, sx, px, nx] = JSON.parse(x) as [string, string, string, string, number];
    const [ey, my, sy, py, ny] = JSON.parse(y) as [string, string, string, string, number];
    return ex.localeCompare(ey) || mx.localeCompare(my) || sx.localeCompare(sy) || px.localeCompare(py) || nx - ny;
  });
  const out: JudgePairInput[] = [];
  for (const key of keys) {
    const cell = cells.get(key)!;
    for (const [va, vb] of PAIRINGS) {
      const a = cell.get(va);
      const b = cell.get(vb);
      if (a && b) out.push({ model: a.model, scenario: a.scenario, persona: a.persona, seed: a.seed, a, b });
    }
  }
  return out;
}

/**
 * The order judge.eval.ts takes pairs in: every cell's first repeat, then every cell's
 * second, and so on (judgePairs order within a repeat). --max-pairs takes a prefix, so the
 * default 144 is two repeats of each scenario, persona and pairing for two models, and
 * the ceiling of 360 is the whole matrix.
 */
export function judgeQueue(pairs: readonly JudgePairInput[]): JudgePairInput[] {
  const seeds = new Map<string, number[]>();
  for (const p of pairs) {
    const key = JSON.stringify([p.model, p.scenario, p.persona]);
    const list = seeds.get(key) ?? [];
    if (!list.includes(p.seed)) list.push(p.seed);
    seeds.set(key, list);
  }
  for (const list of seeds.values()) list.sort((x, y) => x - y);
  const rank = (p: JudgePairInput) => seeds.get(JSON.stringify([p.model, p.scenario, p.persona]))!.indexOf(p.seed);
  return pairs
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map(({ p }) => p);
}

// ---------------------------------------------------------------------------
// Rendering a recording without naming its variant
// ---------------------------------------------------------------------------

/** Words that would name a variant, a payload kind or a renderer: redacted from surface text. */
const NAMING_RE = /\bvariant\s*[123]?\b|\bv[123]\b|\bsandbox(?:ed)?\b|\biframe\b|\bhtml\b|\bjson\b/gi;

/** Keys whose values are structure or wiring, not words the user sees. */
const SKIP_KEYS = new Set([
  "type",
  "variant",
  "id",
  "kind",
  "bind",
  "rowsBind",
  "action",
  "actions",
  "intent",
  "surfaceId",
  "jobId",
  "jobIds",
  "metric",
  "metricIndex",
  "tone",
  "gap",
  "align",
  "justify",
  "size",
  "level",
  "columns",
  "icon",
  "format",
  "target",
  "href",
  "url",
  "open",
  "state",
]);
const LABEL_KEYS = new Set(["label", "cta", "confirmLabel"]);
/** The words a kit block's built-in controls show, by intent. */
const CONTROL_LABELS: Record<string, string> = {
  "shortlist.set": "Shortlist",
  "application.prepare": "Prepare application",
  compare: "Compare",
  "memo.review": "Review the change",
  "memo.resolve": "Approve or decline",
  open: "Open",
  "application.set_stage": "Move to a stage",
  "analytics.pin": "Pin",
  answer: "Answer",
};
/** A lone identifier (snake case, dotted, a job id): wiring, not prose. */
const IDENTIFIER_RE = /^(?:[a-z0-9]+(?:[._:-][a-z0-9]+)*|[a-z]+:[^\s]+)$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function payText(review: GatheredData["reviews"][string] | undefined): string | null {
  if (!review || (review.payMin === null && review.payMax === null)) return null;
  const n = (x: number | null) => (x === null ? "?" : x.toLocaleString("en-US"));
  const range = review.payMin === review.payMax || review.payMax === null ? n(review.payMin) : `${n(review.payMin)} to ${n(review.payMax)}`;
  return `pay ${[review.payCurrency, range, review.payPeriod ? `per ${review.payPeriod}` : null].filter(Boolean).join(" ")}`;
}

/** What a reference to a job shows, read from the gathered data. */
function jobText(jobId: string, type: string | null, g: GatheredData | null): string {
  const job = g?.jobs[jobId];
  const review = g?.reviews[jobId];
  const t = (type ?? "").toLowerCase();
  if (t.includes("fit")) return review?.fitScore != null ? `fit ${review.fitScore}` : "fit not scored";
  if (t.includes("pay") || t.includes("salary")) return payText(review) ?? "pay not stated";
  if (t.includes("link") || t.includes("posting")) return "[link: the posting]";
  if (t.includes("company")) return job?.company ?? "a company";
  if (t.includes("title")) return job ? job.title : "a job";
  if (!job) return "a job";
  const facts = [
    `${job.title} at ${job.company}`,
    job.remote ? "remote" : job.location,
    review?.fitScore != null ? `fit ${review.fitScore}` : null,
    payText(review),
  ].filter(Boolean);
  return facts.join(", ");
}

/** A bind pointer (/jobs/<id>/title, /shortlist) resolved against the gathered data. */
function pointerText(pointer: string, g: GatheredData | null): string | null {
  if (!g || !pointer.startsWith("/")) return null;
  let v: unknown = g;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(v)) v = v[Number(key)];
    else if (isObject(v)) v = v[key];
    else return null;
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const rows = v.slice(0, 20).map((row) => (isObject(row) && typeof row.jobId === "string" ? jobText(row.jobId, null, g) : null));
    return rows.filter(Boolean).join("; ") || null;
  }
  return null;
}

function walk(v: unknown, g: GatheredData | null, out: string[]): void {
  if (typeof v === "string") {
    const s = v.trim();
    if (s.length > 0 && !IDENTIFIER_RE.test(s)) out.push(s);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, g, out);
    return;
  }
  if (!isObject(v)) return;
  const type = typeof v.type === "string" ? v.type : null;
  // A kit block draws its own controls; name them the way the other kinds' controls read.
  const builtIn = type !== null && Object.hasOwn(BLOCK_INTENTS, type) ? BLOCK_INTENTS[type as keyof typeof BLOCK_INTENTS] : [];
  for (const intent of builtIn) out.push(`[control: ${CONTROL_LABELS[intent] ?? intent}]`);
  if (typeof v.jobId === "string") out.push(jobText(v.jobId, type, g));
  if (Array.isArray(v.jobIds)) for (const id of v.jobIds) if (typeof id === "string") out.push(jobText(id, null, g));
  for (const key of ["bind", "rowsBind"]) {
    const text = typeof v[key] === "string" ? pointerText(v[key] as string, g) : null;
    if (text) out.push(text);
  }
  for (const [key, value] of Object.entries(v)) {
    if (SKIP_KEYS.has(key)) continue;
    if (LABEL_KEYS.has(key) && typeof value === "string" && value.trim()) {
      out.push(`[control: ${value.trim()}]`);
      continue;
    }
    walk(value, g, out);
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A document's visible words: no scripts, styles or comments; controls marked as such. */
function documentText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<button\b[^>]*>([\s\S]*?)<\/button\s*>/gi, (_m, inner: string) => ` [control: ${inner.replace(/<[^>]*>/g, " ").trim()}] `)
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, inner: string) => ` [link: ${inner.replace(/<[^>]*>/g, " ").trim()}] `)
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|table|ul|ol)\s*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, ref: string) => {
      if (ref[0] === "#") {
        const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[ref.toLowerCase()] ?? m;
    });
}

type StoredSurfaceOf = Recording["surfaces"][number];

/** What the user saw: the fallback when the surface fell back, else the payload. */
function shownPayload(surface: StoredSurfaceOf): Record<string, unknown> {
  return surface.outcome === "fallback" && surface.fallbackPayload ? surface.fallbackPayload : surface.payload;
}

/** Whether the surface shown is a document that fills itself in when it runs (its words need a render). */
export function isDocumentSurface(surface: StoredSurfaceOf): boolean {
  return typeof shownPayload(surface).html === "string";
}

/**
 * A document surface's rendered words, by recording and surface index: the render smoke
 * writes them (frameText in test-results/render-smoke/results). Null when not rendered.
 */
export type RenderedText = (r: Recording, surfaceIndex: number) => string | null;

/**
 * The words a stored surface shows the user, whatever its variant, with naming words
 * redacted. A document surface reads as `rendered` when given (what ran in the browser),
 * else as its static words only.
 */
export function surfaceText(surface: StoredSurfaceOf, rendered: string | null = null): string {
  const g = parseGathered(surface.gathered);
  const shown = shownPayload(surface);
  const parts: string[] = [];
  if (typeof shown.title === "string" && shown.title.trim()) parts.push(shown.title.trim());
  if (typeof shown.html === "string") parts.push(rendered ?? documentText(shown.html));
  else walk({ ...shown, title: undefined }, g, parts);
  return parts
    .join("\n")
    .replace(NAMING_RE, "[redacted]")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** A recording's surfaces as the judge reads them, cut to `max` characters. */
export function recordingText(r: Recording, rendered: RenderedText | null = null, max = JUDGE_RECORDING_CHARS): string {
  const text =
    r.surfaces
      .map((s, i) => `Screen ${i + 1}:\n${surfaceText(s, isDocumentSurface(s) && rendered ? rendered(r, i) : null) || "(empty)"}`)
      .join("\n\n") || "(no screens)";
  return text.length > max ? `${text.slice(0, max)}\n(cut)` : text;
}

/** A recording with a document surface that has no rendered words: judging it would compare an unrendered page. */
export function awaitsRender(r: Recording, rendered: RenderedText | null): boolean {
  return r.surfaces.some((s, i) => isDocumentSurface(s) && (!rendered || rendered(r, i) === null));
}

function stepText(step: ScenarioStep): string {
  switch (step.kind) {
    case "message":
      return step.attachResume ? `${step.text} (attaches a résumé)` : step.text;
    case "compare":
      return "Compare these two jobs for me.";
    case "approve":
      return step.approved ? "(approves the action the assistant asked to take)" : "(declines the action the assistant asked to take)";
    case "memo_resolve":
      return step.decision === "approve" ? "(approves the proposed change to their preferences)" : "(declines the proposed change)";
  }
}

/** The judge's prompt for `first` then `second` (one scenario: the user's requests are the same). */
export function judgePrompt(first: Recording, second: Recording, rendered: RenderedText | null = null): string {
  const steps = SCENARIOS[first.scenario].steps.map((s) => `- ${stepText(s)}`).join("\n");
  return [
    "The user's requests, in order:",
    steps,
    "",
    "Response First:",
    recordingText(first, rendered),
    "",
    "Response Second:",
    recordingText(second, rendered),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

const ReplySchema = z.object({ winner: z.enum(["first", "second", "tie"]), reason: z.string().min(1).max(1000) });

/** The judge's reply, read as the first JSON object in it; null when it does not parse. */
export function parseJudgeReply(text: string): z.infer<typeof ReplySchema> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = ReplySchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface JudgeDeps {
  /** The judge's model; judge.eval.ts wraps AGENT_JUDGE_MODEL in the judge caps. */
  model: LanguageModel;
  /** Decides the order: below 0.5 shows `a` first. */
  random?: () => number;
  /** Rendered words for document surfaces (judge.eval.ts: the render smoke's results). */
  rendered?: RenderedText | null;
}

/**
 * Which of `a` and `b` (the same cell in two variants) serves the user better, or a tie.
 * The pair goes to the judge in a random order and the verdict is mapped back to a and b;
 * a reply that does not parse counts as a tie with parsed false.
 */
export async function judgePair(a: Recording, b: Recording, deps: JudgeDeps): Promise<JudgeVerdict & { shownFirst: "a" | "b"; parsed: boolean }> {
  const aFirst = (deps.random ?? Math.random)() < 0.5;
  const [first, second] = aFirst ? [a, b] : [b, a];
  const { text } = await generateText({
    model: deps.model,
    system: JUDGE_SYSTEM,
    prompt: judgePrompt(first, second, deps.rendered ?? null),
    maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    providerOptions: { openrouter: { reasoning: { effort: "low", exclude: true } } },
  });
  const reply = parseJudgeReply(text);
  if (!reply) return { winner: "tie", reason: "the judge's reply did not parse", shownFirst: aFirst ? "a" : "b", parsed: false };
  const winner: JudgeWinner = reply.winner === "tie" ? "tie" : (reply.winner === "first") === aFirst ? "a" : "b";
  return { winner, reason: reply.reason, shownFirst: aFirst ? "a" : "b", parsed: true };
}

// ---------------------------------------------------------------------------
// Andrew's hand check and the tally
// ---------------------------------------------------------------------------

/** ceil(n * rate) of `pairs`, drawn without replacement, in their original order. */
export function sampleForHandCheck<T>(pairs: readonly T[], rate = 0.1, random: () => number = Math.random): T[] {
  if (!(rate > 0 && rate <= 1)) throw new Error("sampleForHandCheck: rate must be in (0, 1]");
  const want = Math.ceil(pairs.length * rate);
  const index = pairs.map((_, i) => i);
  for (let i = index.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [index[i], index[j]] = [index[j], index[i]];
  }
  return index
    .slice(0, want)
    .sort((x, y) => x - y)
    .map((i) => pairs[i]);
}

function csvCell(v: string | number | boolean): string {
  const s = String(v);
  // A leading = + - @ would run as a formula in a spreadsheet: prefix it.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The hand-check sheet: one row per sampled pair, with an empty column for Andrew's call. */
export function handCheckCsv(results: readonly JudgeResult[]): string {
  const header = ["model", "scenario", "persona", "seed", "variant_a", "variant_b", "judge_winner", "judge_reason", "andrew_winner", "andrew_note"];
  const rows = results.map((r) =>
    [r.model, r.scenario, r.persona, r.seed, r.variantA, r.variantB, r.winner === "tie" ? "tie" : `v${r.winner === "a" ? r.variantA : r.variantB}`, r.reason, "", ""]
      .map(csvCell)
      .join(","),
  );
  return `${[header.join(","), ...rows].join("\n")}\n`;
}

export interface JudgeTally {
  model: string;
  variantA: Variant;
  variantB: Variant;
  pairs: number;
  winsA: number;
  winsB: number;
  ties: number;
  unparsed: number;
}

/** Wins, ties and unparsed replies per model and pairing. */
export function tallyJudge(results: readonly JudgeResult[]): JudgeTally[] {
  const out: JudgeTally[] = [];
  for (const model of [...new Set(results.map((r) => r.model))]) {
    for (const [va, vb] of PAIRINGS) {
      const rs = results.filter((r) => r.model === model && r.variantA === va && r.variantB === vb);
      if (rs.length === 0) continue;
      out.push({
        model,
        variantA: va,
        variantB: vb,
        pairs: rs.length,
        winsA: rs.filter((r) => r.winner === "a").length,
        winsB: rs.filter((r) => r.winner === "b").length,
        ties: rs.filter((r) => r.winner === "tie").length,
        unparsed: rs.filter((r) => !r.parsed).length,
      });
    }
  }
  return out;
}

/** The judge's table for the run report and the summary. */
export function judgeTable(results: readonly JudgeResult[]): string {
  const rows = tallyJudge(results).map(
    (t) => `| ${t.model} | ${t.variantA} vs ${t.variantB} | ${t.pairs} | ${t.winsA} | ${t.winsB} | ${t.ties} | ${t.unparsed} |`,
  );
  if (rows.length === 0) return "No judged pairs.";
  return ["| Model | Pairing | Pairs | First variant wins | Second variant wins | Ties | Unparsed |", "|---|---|---|---|---|---|---|", ...rows].join("\n");
}
