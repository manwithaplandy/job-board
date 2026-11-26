// The variant 2 grammar (plan Task 2.1, spec 7.1 "Primitives + tokens"): the model lays
// out a tree of exactly 19 primitive nodes. Style is token enums only (gap, tone, button
// variant); there is no style, className, color, width, href, src or html key anywhere,
// and every object is strict, so such a key fails. Data reaches the page two ways only:
//   - bound atoms (JobTitle, FitScore, Pay, PostingLink) name a job the turn read and the
//     renderer fills the value from the gathered data, so they cannot misstate it;
//   - binds (Stat, Table, Chart) are JSON pointers into the gathered data (bind.ts).
// Free text (Heading, Text, Badge, List, labels) is the model's plain text, rendered as
// text nodes. Buttons carry one intent from the closed enum (ActionIntentSchema).
//
// validateSurfaceV2 is the gate: caps first on the raw input (so a hostile depth never
// reaches the recursive schema), then the schema, then the checks against the gathered
// data and the accessibility rules. Every error is a short plain string that goes back
// to the model as repair feedback (Task 2.3).
import { z } from "zod";
import type { GatheredData } from "@/lib/agent/gathered";
import { ActionIntentSchema, type ActionIntent } from "@/lib/agent/actions/intents";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { VIZ, VIZ_FOR_KIND, type Viz } from "@/lib/workspaces/analyticsTiles";
import type { MetricResult } from "@/lib/workspaces/types";
import {
  BIND_RE,
  METRIC_BIND_RE,
  ROW_BIND_RE,
  WHOLE_LIST_BIND_RE,
  resolveBind,
  resolveRowBind,
  resolveRowsBind,
} from "@/lib/agent/surfaces/v2/bind";
import { checkA11y } from "@/lib/agent/surfaces/v2/a11y";

export { BIND_RE, resolveBind } from "@/lib/agent/surfaces/v2/bind";

export const V2_LIMITS = { maxDepth: 6, maxNodes: 120, maxTextChars: 400 } as const;
export const V2_TITLE_MAX = 80;

export const GAPS = ["1", "2", "3", "4"] as const;
export const TONES = ["neutral", "accent", "success", "warning", "danger"] as const;
export const BUTTON_VARIANTS = ["primary", "secondary", "ghost"] as const;
export type Gap = (typeof GAPS)[number];
export type Tone = (typeof TONES)[number];
export type TreeButtonVariant = (typeof BUTTON_VARIANTS)[number];

type JobAtom<T extends string> = { type: T; jobId: string };

export type V2Node =
  // Layout.
  | { type: "Stack"; gap: Gap; children: V2Node[] }
  | { type: "Grid"; columns: 1 | 2 | 3 | 4; children: V2Node[] }
  | { type: "Card"; tone?: Tone; children: V2Node[] }
  | { type: "Tabs"; tabs: Array<{ label: string; child: V2Node }> }
  | { type: "Divider" }
  // Content.
  | { type: "Heading"; level: 1 | 2 | 3; text: string }
  | { type: "Text"; text: string; tone?: Tone }
  | { type: "Badge"; text: string; tone: Tone }
  | { type: "List"; items: string[] }
  | { type: "Stat"; label: string; bind: string }
  | { type: "Table"; columns: Array<{ header: string; bind: string }>; rowsBind: string }
  | { type: "Chart"; viz: Viz; bind: string; title: string }
  // Inputs.
  | { type: "Button"; label: string; variant: TreeButtonVariant; action: ActionIntent }
  | { type: "Field"; id: string; label: string; kind: "text" | "number" }
  | { type: "Select"; id: string; label: string; options: string[] }
  // Bound atoms.
  | JobAtom<"JobTitle">
  | JobAtom<"FitScore">
  | JobAtom<"Pay">
  | JobAtom<"PostingLink">;

export type V2NodeType = V2Node["type"];

export interface SurfacePayloadV2 {
  variant: 2;
  title?: string;
  root: V2Node;
}

/** Plain text, 1 to `max` characters, not only whitespace. */
const text = (max: number = V2_LIMITS.maxTextChars) =>
  z.string().min(1).max(max).refine((s) => s.trim().length > 0, { message: "must not be blank" });
const jobId = z.string().regex(JOB_ID_RE, { message: "must be a job id your tools returned" }).max(300);
const bind = z.string().max(300).regex(BIND_RE, {
  message: "must be a pointer like /reviews/<jobId>/fitScore into jobs, reviews, metrics, applications, shortlist or profile",
});
// A Table's rows (R14): a bind, or the whole shortlist or applications list.
const rowsBind = z
  .string()
  .max(300)
  .refine((s) => BIND_RE.test(s) || WHOLE_LIST_BIND_RE.test(s), {
    message: "must be a list pointer like /reviews/<jobId>/requirements, or /shortlist or /applications for the whole list",
  });
const rowBind = z.string().max(200).regex(ROW_BIND_RE, { message: "must be a pointer into one row, like /text, or empty for the row itself" });
// The answer intent's question id (lib/agent/actions/intents.ts), so a field's value can be
// sent as the answer to that id.
const fieldId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, { message: "must be 1 to 40 letters, digits, _ or -" });
const tone = z.enum(TONES);

// Children are checked lazily so the union can refer to itself; the node and depth caps
// are enforced before this schema runs.
const node = z.lazy(() => V2NodeSchema);
const children = z.array(node).min(1).max(V2_LIMITS.maxNodes);

const NodeUnion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Stack"), gap: z.enum(GAPS), children }).strict(),
  z.object({ type: z.literal("Grid"), columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), children }).strict(),
  z.object({ type: z.literal("Card"), tone: tone.optional(), children }).strict(),
  z
    .object({ type: z.literal("Tabs"), tabs: z.array(z.object({ label: text(), child: node }).strict()).min(2).max(5) })
    .strict(),
  z.object({ type: z.literal("Divider") }).strict(),
  z.object({ type: z.literal("Heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: text() }).strict(),
  z.object({ type: z.literal("Text"), text: text(), tone: tone.optional() }).strict(),
  z.object({ type: z.literal("Badge"), text: text(), tone }).strict(),
  z.object({ type: z.literal("List"), items: z.array(text()).min(1).max(20) }).strict(),
  z.object({ type: z.literal("Stat"), label: text(), bind }).strict(),
  z
    .object({
      type: z.literal("Table"),
      columns: z.array(z.object({ header: text(), bind: rowBind }).strict()).min(1).max(6),
      rowsBind,
    })
    .strict(),
  z.object({ type: z.literal("Chart"), viz: z.enum(VIZ), bind, title: text() }).strict(),
  z.object({ type: z.literal("Button"), label: text(), variant: z.enum(BUTTON_VARIANTS), action: ActionIntentSchema }).strict(),
  z.object({ type: z.literal("Field"), id: fieldId, label: text(), kind: z.enum(["text", "number"]) }).strict(),
  z
    .object({
      type: z.literal("Select"),
      id: fieldId,
      label: text(),
      options: z
        .array(text(120))
        .min(1)
        .max(20)
        .refine((opts) => new Set(opts.map((o) => o.trim())).size === opts.length, { message: "options must be unique" }),
    })
    .strict(),
  z.object({ type: z.literal("JobTitle"), jobId }).strict(),
  z.object({ type: z.literal("FitScore"), jobId }).strict(),
  z.object({ type: z.literal("Pay"), jobId }).strict(),
  z.object({ type: z.literal("PostingLink"), jobId }).strict(),
]);

export const V2NodeSchema: z.ZodType<V2Node> = NodeUnion;

/** The 19 node types, in schema order. */
export const V2_NODE_TYPES: readonly V2NodeType[] = NodeUnion.options.map((o) => o.shape.type.value);

export const SurfacePayloadV2Schema: z.ZodType<SurfacePayloadV2> = z
  .object({ variant: z.literal(2), title: text(V2_TITLE_MAX).optional(), root: V2NodeSchema })
  .strict();

export type SurfaceValidationV2 = { ok: true; payload: SurfacePayloadV2 } | { ok: false; errors: string[] };

const ERRORS_MAX = 20;
const ERROR_CHARS_MAX = 199;
/** Table rows checked against the column binds (and drawn by the renderer). */
export const TABLE_ROWS_MAX = 50;

/** One error line: single-line and under 200 characters. */
function line(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= ERROR_CHARS_MAX ? flat : `${flat.slice(0, ERROR_CHARS_MAX - 1)}…`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The depth and node count of a raw tree, walked iteratively (no recursion), stopping as
 * soon as either cap is passed. Anything at a node position counts as a node.
 */
function capErrors(root: unknown): string[] {
  let nodes = 0;
  let depth = 0;
  const stack: Array<[unknown, number]> = [[root, 1]];
  while (stack.length > 0) {
    const [v, d] = stack.pop() as [unknown, number];
    if (!isRecord(v)) continue;
    nodes += 1;
    depth = Math.max(depth, d);
    if (nodes > V2_LIMITS.maxNodes || depth > V2_LIMITS.maxDepth) break;
    if (Array.isArray(v.children)) {
      if (v.children.length > V2_LIMITS.maxNodes) {
        nodes = V2_LIMITS.maxNodes + 1;
        break;
      }
      for (const c of v.children) stack.push([c, d + 1]);
    }
    if (Array.isArray(v.tabs)) {
      for (const t of v.tabs.slice(0, 10)) if (isRecord(t)) stack.push([t.child, d + 1]);
    }
  }
  const errors: string[] = [];
  if (depth > V2_LIMITS.maxDepth) errors.push(`root: the tree is nested deeper than ${V2_LIMITS.maxDepth} levels`);
  if (nodes > V2_LIMITS.maxNodes) errors.push(`root: the tree has more than ${V2_LIMITS.maxNodes} nodes`);
  return errors;
}

function isMetric(v: unknown): v is MetricResult {
  return isRecord(v) && (v.kind === "value" || v.kind === "series" || v.kind === "rows") && isRecord(v.spec);
}

function isScalar(v: unknown): boolean {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/** The job ids an intent names. */
function intentJobIds(action: ActionIntent): Array<[string, string]> {
  if (action.name === "compare") return action.jobIds.map((id, k) => [id, `jobIds.${k}`]);
  if ("jobId" in action && typeof action.jobId === "string") return [[action.jobId, "jobId"]];
  return [];
}

/** The checks against the gathered data, on a schema-valid tree, in document order. */
function dataErrors(root: V2Node, g: GatheredData): string[] {
  const errors: string[] = [];
  const fieldIds = new Set<string>();
  const unresolved = (path: string, pointer: string) =>
    errors.push(`${path}: ${pointer} does not resolve in the data read this turn`);
  const job = (id: string, path: string) => {
    if (!has(g.jobs, id)) errors.push(`${path}: job ${id} was not read this turn`);
  };

  const visit = (n: V2Node, path: string): void => {
    switch (n.type) {
      case "Stack":
      case "Grid":
      case "Card":
        n.children.forEach((c, i) => visit(c, `${path}.children.${i}`));
        return;
      case "Tabs":
        n.tabs.forEach((t, i) => visit(t.child, `${path}.tabs.${i}.child`));
        return;
      case "Stat": {
        const v = resolveBind(g, n.bind);
        if (v === undefined) unresolved(`${path}.bind`, n.bind);
        else if (!isScalar(v) && !(METRIC_BIND_RE.test(n.bind) && isMetric(v))) {
          errors.push(`${path}.bind: ${n.bind} is a list or an object; a Stat binds one value or one metric`);
        }
        return;
      }
      case "Chart": {
        const v = resolveBind(g, n.bind);
        if (v === undefined) unresolved(`${path}.bind`, n.bind);
        else if (!METRIC_BIND_RE.test(n.bind) || !isMetric(v)) {
          errors.push(`${path}.bind: a Chart binds one metric, like /metrics/0`);
        } else if (!VIZ_FOR_KIND[v.kind].includes(n.viz)) {
          errors.push(`${path}.viz: ${n.viz} cannot draw a ${v.kind} metric`);
        }
        return;
      }
      case "Table": {
        const rows = resolveRowsBind(g, n.rowsBind);
        if (rows === undefined) {
          unresolved(`${path}.rowsBind`, n.rowsBind);
          return;
        }
        if (!Array.isArray(rows)) {
          errors.push(`${path}.rowsBind: ${n.rowsBind} is not a list of rows`);
          return;
        }
        const sample = rows.slice(0, TABLE_ROWS_MAX);
        if (sample.length === 0) return;
        n.columns.forEach((c, k) => {
          if (!sample.some((r) => resolveRowBind(r, c.bind) !== undefined)) {
            errors.push(`${path}.columns.${k}.bind: ${c.bind || '""'} resolves on no row of ${n.rowsBind}`);
          }
        });
        return;
      }
      case "Button":
        for (const [id, at] of intentJobIds(n.action)) job(id, `${path}.action.${at}`);
        return;
      case "Field":
      case "Select":
        if (fieldIds.has(n.id)) errors.push(`${path}.id: field id ${n.id} is used twice`);
        fieldIds.add(n.id);
        return;
      case "JobTitle":
      case "FitScore":
      case "Pay":
      case "PostingLink":
        job(n.jobId, `${path}.jobId`);
        return;
      case "Divider":
      case "Heading":
      case "Text":
      case "Badge":
      case "List":
        return;
    }
  };
  visit(root, "root");
  return errors;
}

/**
 * The variant 2 gate. All errors are short plain strings (at most 20, each under 200
 * characters), usable as repair feedback: caps, schema, then data binding, ids and
 * accessibility.
 */
export function validateSurfaceV2(payload: unknown, gathered: GatheredData): SurfaceValidationV2 {
  if (isRecord(payload) && has(payload, "root")) {
    const caps = capErrors(payload.root);
    if (caps.length > 0) return { ok: false, errors: caps };
  }
  const parsed = SurfacePayloadV2Schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, ERRORS_MAX).map((i) => line(`${i.path.join(".") || "payload"}: ${i.message}`)),
    };
  }
  const errors = [...dataErrors(parsed.data.root, gathered), ...checkA11y(parsed.data.root)];
  return errors.length > 0 ? { ok: false, errors: errors.slice(0, ERRORS_MAX).map(line) } : { ok: true, payload: parsed.data };
}
