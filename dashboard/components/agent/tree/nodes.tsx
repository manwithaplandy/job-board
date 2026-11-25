"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { SegmentedControl } from "@/components/ui/Navigation";
import { Badge, Card } from "@/components/ui/Panel";
import { JobLink } from "@/components/workspaces/JobLink";
import { fitLabel } from "@/components/workspaces/ShortlistRowCard";
import { MetricVisual } from "@/components/agent/blocks/MetricChartBlock";
import { METRIC_LABELS, WINDOW_LABELS, countLabel, metricValue } from "@/components/agent/blocks/metricLabels";
import { own, payLabel } from "@/components/agent/blocks/shared";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V2Node } from "@/lib/agent/surfaces/v2/tree";
import { resolveBind, resolveRowBind, resolveRowsBind } from "@/lib/agent/surfaces/v2/bind";
import type { MetricResult } from "@/lib/workspaces/types";

// One component per variant 2 node (plan Task 2.2), over the shared primitives. The rules:
//   - agent text (headings, text, badges, lists, labels) renders as React text nodes only;
//   - bound atoms read the job by id from the surface's gathered data; PostingLink renders
//     the stored url through JobLink (http and https only);
//   - a bind that no longer resolves, a job that is not in the gathered data, a node past
//     the depth cap or an unknown node renders TREE_NA_TEXT and never throws;
//   - a Button emits only its own closed-enum action (an answer button first sends the
//     surface's Field and Select values, one answer intent each).
// This file is client code: lib/agent/surfaces/v2/tree.ts and lib/agent/actions/intents.ts
// are imported for their types only, so no server module reaches the browser bundle.

/** The fixed placeholder for anything that cannot be drawn from the gathered data. */
export const TREE_NA_TEXT = "n/a";
/** Mirrors V2_LIMITS.maxDepth (a value import of tree.ts would pull server code in). */
export const TREE_RENDER_DEPTH_MAX = 6;
/** Mirrors TABLE_ROWS_MAX in tree.ts. */
const TABLE_ROWS_MAX = 50;
/** The answer intent's cap (ANSWER_MAX in lib/agent/actions/intents.ts). */
const ANSWER_MAX = 2000;

export interface TreeCtx {
  gathered: GatheredData;
  values: Record<string, string>;
  setValue: (id: string, value: string) => void;
  press: (action: ActionIntent) => void;
}

export const TreeContext = createContext<TreeCtx | null>(null);

function useTree(): TreeCtx {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("tree nodes render inside TreeRenderer");
  return ctx;
}

function Na({ type }: { type?: string }) {
  return (
    <span className="rf-tree-na" data-tree-node={type}>
      {TREE_NA_TEXT}
    </span>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A metric result whose shape metricValue and MetricVisual can read without throwing. */
function asMetric(v: unknown): MetricResult | null {
  if (!isRecord(v) || !isRecord(v.spec) || typeof v.spec.metric !== "string" || typeof v.spec.window !== "string") return null;
  if (typeof v.n !== "number") return null;
  if (v.kind === "value" && (v.value === null || typeof v.value === "number")) return v as unknown as MetricResult;
  if (v.kind === "series" && Array.isArray(v.points)) return v as unknown as MetricResult;
  if (v.kind === "rows" && Array.isArray(v.rows) && Array.isArray(v.columns)) return v as unknown as MetricResult;
  return null;
}

/** A bound value as text, or null when it is not a single value. */
function valueText(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("en-US") : null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ");
  return null;
}

function metricSubtitle(m: MetricResult): string {
  return [METRIC_LABELS[m.spec.metric], WINDOW_LABELS[m.spec.window], countLabel(m)].filter(Boolean).join(" · ");
}

function Children({ nodes, depth }: { nodes: V2Node[]; depth: number }) {
  return (
    <>
      {nodes.map((n, i) => (
        <TreeNode key={i} node={n} depth={depth + 1} />
      ))}
    </>
  );
}

function TabsNode({ node, depth }: { node: Extract<V2Node, { type: "Tabs" }>; depth: number }) {
  const [selected, setSelected] = useState("0");
  const index = Number(selected);
  const current = node.tabs[index] ?? node.tabs[0];
  return (
    <div className="rf-tree-tabs" data-tree-node="Tabs">
      <SegmentedControl
        label="Sections"
        items={node.tabs.map((t, i) => ({ label: t.label, value: String(i) }))}
        value={selected}
        onChange={setSelected}
      />
      {current && (
        <div className="rf-tree-tabs__panel" role="region" aria-label={current.label}>
          <TreeNode node={current.child} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

function HeadingNode({ node }: { node: Extract<V2Node, { type: "Heading" }> }) {
  // The surface title is h2; tree headings start one level below it.
  const props = { className: `rf-tree-heading rf-tree-heading--${node.level}`, "data-tree-node": "Heading" };
  if (node.level === 1) return <h3 {...props}>{node.text}</h3>;
  if (node.level === 2) return <h4 {...props}>{node.text}</h4>;
  return <h5 {...props}>{node.text}</h5>;
}

function StatNode({ node }: { node: Extract<V2Node, { type: "Stat" }> }) {
  const { gathered } = useTree();
  const v = resolveBind(gathered, node.bind);
  const m = asMetric(v);
  const shown = m ? metricValue(m) : valueText(v);
  return (
    <dl className="rf-tree-stat" data-tree-node="Stat">
      <dt>{node.label}</dt>
      <dd className="rf-tree-stat__value">{shown ?? TREE_NA_TEXT}</dd>
    </dl>
  );
}

function TableNode({ node }: { node: Extract<V2Node, { type: "Table" }> }) {
  const { gathered } = useTree();
  const rows = resolveRowsBind(gathered, node.rowsBind);
  if (!Array.isArray(rows)) return <Na type="Table" />;
  return (
    <div className="rf-tree-table__scroll" data-tree-node="Table">
      <table className="rf-tree-table">
        <thead>
          <tr>
            {node.columns.map((c, k) => (
              <th key={k} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, TABLE_ROWS_MAX).map((row, r) => (
            <tr key={r}>
              {node.columns.map((c, k) => (
                <td key={k}>{valueText(resolveRowBind(row, c.bind)) ?? TREE_NA_TEXT}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartNode({ node }: { node: Extract<V2Node, { type: "Chart" }> }) {
  const { gathered } = useTree();
  const m = asMetric(resolveBind(gathered, node.bind));
  if (!m) return <Na type="Chart" />;
  return (
    <section className="rf-tree-chart" aria-label={node.title} data-tree-node="Chart">
      <div data-ui-visual="data-viz">
        <MetricVisual m={m} viz={node.viz} title={node.title} subtitle={metricSubtitle(m)} />
      </div>
    </section>
  );
}

const BUTTON_VARIANT = { primary: "primary", secondary: "outline", ghost: "ghost" } as const;

function ButtonNode({ node }: { node: Extract<V2Node, { type: "Button" }> }) {
  const { press } = useTree();
  return (
    <span className="rf-tree-button" data-tree-node="Button">
      <Button variant={BUTTON_VARIANT[node.variant] ?? "outline"} size="sm" onClick={() => press(node.action)}>
        {node.label}
      </Button>
    </span>
  );
}

function FieldNode({ node }: { node: Extract<V2Node, { type: "Field" }> }) {
  const { values, setValue } = useTree();
  const id = useId();
  return (
    <div className="rf-tree-field" data-tree-node="Field">
      <TextField
        id={id}
        label={node.label}
        type={node.kind === "number" ? "number" : "text"}
        inputMode={node.kind === "number" ? "decimal" : undefined}
        maxLength={ANSWER_MAX}
        value={values[node.id] ?? ""}
        onChange={(e) => setValue(node.id, e.target.value)}
      />
    </div>
  );
}

function SelectNode({ node }: { node: Extract<V2Node, { type: "Select" }> }) {
  const { values, setValue } = useTree();
  const id = useId();
  return (
    <div className="rf-tree-field" data-tree-node="Select">
      <SelectField id={id} label={node.label} value={values[node.id] ?? ""} onChange={(e) => setValue(node.id, e.target.value)}>
        <option value="">Choose one</option>
        {node.options.map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function JobTitleNode({ jobId }: { jobId: string }) {
  const { gathered } = useTree();
  const job = own(gathered.jobs, jobId);
  if (!job) return <Na type="JobTitle" />;
  return (
    <span className="rf-tree-atom rf-tree-atom--title" data-tree-node="JobTitle">
      {job.title}
    </span>
  );
}

function FitScoreNode({ jobId }: { jobId: string }) {
  const { gathered } = useTree();
  const fit = fitLabel(own(gathered.reviews, jobId)?.fitScore ?? null);
  if (!own(gathered.jobs, jobId) || !fit) return <Na type="FitScore" />;
  return (
    <span className="rf-tree-atom" data-tree-node="FitScore">
      <Badge tone="accent">{fit}</Badge>
    </span>
  );
}

function PayNode({ jobId }: { jobId: string }) {
  const { gathered } = useTree();
  const pay = payLabel(own(gathered.reviews, jobId));
  if (!own(gathered.jobs, jobId) || !pay) return <Na type="Pay" />;
  return (
    <span className="rf-tree-atom" data-tree-node="Pay">
      {pay}
    </span>
  );
}

function PostingLinkNode({ jobId }: { jobId: string }) {
  const { gathered } = useTree();
  const job = own(gathered.jobs, jobId);
  if (!job) return <Na type="PostingLink" />;
  return (
    <span className="rf-tree-atom" data-tree-node="PostingLink">
      <JobLink url={job.url}>
        View posting<span className="sr-only">: {job.title}</span>
      </JobLink>
    </span>
  );
}

/** One node and its subtree. Past the depth cap, or for an unknown type, the placeholder. */
export function TreeNode({ node, depth }: { node: V2Node; depth: number }): ReactNode {
  if (depth > TREE_RENDER_DEPTH_MAX || !isRecord(node)) return <Na />;
  switch (node.type) {
    case "Stack":
      return (
        <div className={`rf-tree-stack rf-tree-gap-${node.gap}`} data-tree-node="Stack">
          <Children nodes={node.children} depth={depth} />
        </div>
      );
    case "Grid":
      return (
        <div className={`rf-tree-grid rf-tree-grid--${node.columns}`} data-tree-node="Grid">
          <Children nodes={node.children} depth={depth} />
        </div>
      );
    case "Card":
      return (
        <Card padding="md" className={`rf-tree-card rf-tree-tone-${node.tone ?? "neutral"}`} data-tree-node="Card">
          <Children nodes={node.children} depth={depth} />
        </Card>
      );
    case "Tabs":
      return <TabsNode node={node} depth={depth} />;
    case "Divider":
      return <hr className="rf-tree-divider" data-tree-node="Divider" />;
    case "Heading":
      return <HeadingNode node={node} />;
    case "Text":
      return (
        <p className={`rf-tree-text rf-tree-text--${node.tone ?? "neutral"}`} data-tree-node="Text">
          {node.text}
        </p>
      );
    case "Badge":
      return (
        <span className="rf-tree-atom" data-tree-node="Badge">
          <Badge tone={node.tone}>{node.text}</Badge>
        </span>
      );
    case "List":
      return (
        <ul className="rf-tree-list" data-tree-node="List">
          {node.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "Stat":
      return <StatNode node={node} />;
    case "Table":
      return <TableNode node={node} />;
    case "Chart":
      return <ChartNode node={node} />;
    case "Button":
      return <ButtonNode node={node} />;
    case "Field":
      return <FieldNode node={node} />;
    case "Select":
      return <SelectNode node={node} />;
    case "JobTitle":
      return <JobTitleNode jobId={node.jobId} />;
    case "FitScore":
      return <FitScoreNode jobId={node.jobId} />;
    case "Pay":
      return <PayNode jobId={node.jobId} />;
    case "PostingLink":
      return <PostingLinkNode jobId={node.jobId} />;
    default:
      return <Na />;
  }
}
