"use client";

import { Button } from "@/components/ui/Button";
import { BarsCard, HBarCard, LinesCard, SimpleTableCard } from "@/components/analytics/Chart";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import type { TileSpec } from "@/lib/workspaces/analyticsTiles";
import type { MetricResult, MetricSpec } from "@/lib/workspaces/types";
import { METRIC_GONE_TEXT, METRIC_LABELS, WINDOW_LABELS, metricValue, sampleLabel } from "./metricLabels";
import { BlockFrame } from "./shared";
import type { OnIntent } from "./types";

type MetricChart = Extract<V1Block, { type: "MetricChart" }>;
type Viz = MetricChart["viz"];

const SERIES_COLOR = "var(--chart-stage)";

/** FNV-1a, base 36: a short, stable tile id for the same metric drawn the same way. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * The analytics tile a "Pin to Analytics" press asks for: the metric request exactly as
 * the turn read it, the block's viz and title. The id depends only on the metric and the
 * viz, so pinning the same chart twice is caught by the analytics.pin handler.
 */
export function pinTile(spec: MetricSpec, viz: Viz, title: string): TileSpec {
  const key = JSON.stringify([spec.metric, spec.groupBy ?? null, spec.filter?.stage ?? null, spec.window, viz]);
  return {
    id: `chart-${shortHash(key)}`,
    metric: spec.metric,
    ...(spec.groupBy === undefined ? {} : { groupBy: spec.groupBy }),
    ...(spec.filter === undefined ? {} : { filter: spec.filter }),
    window: spec.window,
    viz,
    size: viz === "stat" ? "small" : "medium",
    title,
  };
}

function rowBars(m: Extract<MetricResult, { kind: "rows" }>) {
  return m.rows
    .map((r) => ({ label: String(r[0] ?? ""), count: Number(r[1]) }))
    .filter((d) => d.label !== "" && Number.isFinite(d.count));
}

/** The chart for one metric, drawn with the analytics page's own cards. */
function Chart({ m, viz, title, subtitle }: { m: MetricResult; viz: Viz; title: string; subtitle: string }) {
  if (m.kind === "value" || viz === "stat") {
    return (
      <div className="rf-block-chart__stat">
        <p className="rf-block-chart__stat-title">{title}</p>
        <p className="rf-block-stats__value">{metricValue(m)}</p>
        <p className="rf-block-stats__meta">{subtitle}</p>
      </div>
    );
  }
  if (m.kind === "series") {
    const data = m.points.map((p) => ({ x: p.x, y: p.y }));
    const series = [{ key: "y", name: METRIC_LABELS[m.spec.metric], color: SERIES_COLOR }];
    const weekly = m.spec.groupBy === "week";
    if (viz === "line" || viz === "sparkline") return <LinesCard title={title} subtitle={subtitle} data={data} xKey="x" lines={series} weekly={weekly} />;
    return <BarsCard title={title} subtitle={subtitle} data={data} xKey="x" bars={series} weekly={weekly} />;
  }
  const bars = rowBars(m);
  if (viz === "table" || viz === "list") return <SimpleTableCard title={title} subtitle={subtitle} data={bars} />;
  return <HBarCard title={title} subtitle={subtitle} data={bars} />;
}

/**
 * One chart of a metric the turn read (spec 5(d)), by index into gathered.metrics. The
 * agent picks the viz (validated against the metric's kind) and writes the title, which
 * renders as plain text; the subtitle and its n are fixed. "Pin to Analytics" emits
 * analytics.pin with the tile.
 */
export function MetricChartBlock({ block, gathered, onIntent }: { block: MetricChart; gathered: GatheredData; onIntent: OnIntent }) {
  const m = gathered.metrics[block.metricRef];
  if (!m) {
    return (
      <BlockFrame title="Chart" className="rf-block-chart">
        <p className="rf-block__unavailable">{METRIC_GONE_TEXT}</p>
      </BlockFrame>
    );
  }
  const subtitle = `${METRIC_LABELS[m.spec.metric]} · ${WINDOW_LABELS[m.spec.window]} · ${sampleLabel(m.n)}`;
  return (
    <section className="rf-block rf-block-chart" aria-label={block.title}>
      <div className="rf-block-chart__visual" data-ui-visual="data-viz">
        <Chart m={m} viz={block.viz} title={block.title} subtitle={subtitle} />
      </div>
      <div className="rf-block__actions">
        <Button variant="outline" size="sm" onClick={() => onIntent({ name: "analytics.pin", tile: pinTile(m.spec, block.viz, block.title) })}>
          Pin to Analytics
        </Button>
      </div>
    </section>
  );
}
