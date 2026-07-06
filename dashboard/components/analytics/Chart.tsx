"use client";

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import type { Bar as BarDatum } from "@/lib/metrics";

export interface SeriesDef { key: string; name: string; color: string }
export interface RefLine { y: number; label: string }

const CARD: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
  padding: "16px 18px 8px", marginBottom: "16px",
};
const TITLE: React.CSSProperties = {
  fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.2px",
};
const SUBTITLE: React.CSSProperties = {
  fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "3px", lineHeight: 1.4,
};
const EMPTY: React.CSSProperties = { fontSize: "12.5px", color: "var(--text-muted)", padding: "28px 0" };
const AXIS = { fontSize: 11, fill: "var(--text-secondary)" } as const;

// Compact Y-axis ticks: 120000 → "120K", 28000 → "28K" — keeps the axis narrow and
// readable instead of showing raw "120000" (audit R5-P2). Small values pass through
// unchanged; tooltips still show the full locale-formatted number.
const COMPACT_NUM = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compactTick = (v: number): string =>
  Number.isFinite(v) && Math.abs(v) >= 1000 ? COMPACT_NUM.format(v) : String(v);

// Render ISO date ticks (e.g. "2026-06-05") as "M/D"; leave non-date categories
// (SimpleBarCard's string labels) untouched.
function formatDateTick(value: string | number): string {
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${Number(m[2])}/${Number(m[3])}` : s;
}

function Head({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={TITLE}>{title}</div>
      {subtitle && <div style={SUBTITLE}>{subtitle}</div>}
    </div>
  );
}

function Card(
  { title, subtitle, children, style }:
  { title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties },
) {
  return <div style={{ ...CARD, ...style }}><Head title={title} subtitle={subtitle} />{children}</div>;
}

// recharts 3 sorts the built-in Legend payload alphabetically, which desyncs the
// legend order from the series-definition order (title says "found vs closed" but
// legend read "Closed, New"). Render our own legend straight from the bars/lines
// array so swatch order always matches the code and the chart title (audit F15/R2-4).
function LegendList({ items }: { items: SeriesDef[] }) {
  return (
    <ul style={{
      display: "flex", flexWrap: "wrap", gap: "5px 14px", justifyContent: "center",
      listStyle: "none", margin: "8px 0 0", padding: 0,
    }}>
      {items.map((it) => (
        <li key={it.key} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: 12, color: "var(--text-secondary)" }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: "inline-block", flex: "0 0 auto" }} />
          {it.name}
        </li>
      ))}
    </ul>
  );
}

// A dot renderer that only marks ISOLATED non-null points (both neighbors missing).
// Dense lines stay clean, but a series with a single run in the window (common for
// the weekly Company Discovery pipeline) renders as a visible dot instead of an
// invisible zero-length segment (audit R2-2).
function makeIsolatedDot(
  data: Array<Record<string, string | number | null>>, key: string, color: string,
) {
  const IsolatedDot = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy } = props;
    const i = props.index ?? -1;
    const val = i >= 0 ? data[i]?.[key] : null;
    if (typeof cx !== "number" || typeof cy !== "number" || val == null) return <g key={`dot-${i}`} />;
    const prev = i > 0 ? data[i - 1]?.[key] : null;
    const next = i < data.length - 1 ? data[i + 1]?.[key] : null;
    if (prev != null || next != null) return <g key={`dot-${i}`} />;
    return <circle key={`dot-${i}`} cx={cx} cy={cy} r={3} fill={color} stroke="var(--bg-surface)" strokeWidth={1} />;
  };
  // Named + displayName so the recharts `dot` render-prop isn't an anonymous
  // component (react/display-name, enforced as error on main).
  IsolatedDot.displayName = "IsolatedDot";
  return IsolatedDot;
}

function refLineNode(refLine?: RefLine) {
  if (!refLine) return null;
  return (
    <ReferenceLine
      y={refLine.y}
      stroke="var(--chart-amber)"
      strokeDasharray="4 4"
      label={{ value: refLine.label, position: "insideTopRight", fontSize: 10, fill: "var(--warning)" }}
    />
  );
}

export function BarsCard(
  { title, subtitle, data, xKey, bars, empty = "No data yet.", refLine, valueFormatter, allTicks = false, weekly = false }:
  {
    title: string; subtitle?: string;
    data: Array<Record<string, string | number | null>>; xKey: string; bars: SeriesDef[];
    empty?: string; refLine?: RefLine; valueFormatter?: (v: number) => string; allTicks?: boolean; weekly?: boolean;
  },
) {
  if (data.length === 0) return <Card title={title} subtitle={subtitle}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title} subtitle={subtitle}>
      <div role="img" aria-label={`${title} — bar chart`}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid stroke="var(--bg-muted)" vertical={false} />
            {/* type="category" is explicit on purpose: recharts 3 dropped XAxis defaultProps, so the
                implicit category/band scale the bar-positioning path relied on is no longer applied —
                without it, weekly/90-day series (mostly-zero buckets) render bars on a wrong band scale
                (spike lands ~a month early). See lib/trend.test.ts for the (correct) binning it feeds.
                allTicks angles the labels (−30°) so adjacent ordinal ranges ("0-9","10-19") don't touch. */}
            <XAxis
              dataKey={xKey} type="category"
              tick={allTicks ? { ...AXIS, fontSize: 10 } : AXIS}
              interval={allTicks ? 0 : undefined}
              angle={allTicks ? -30 : undefined}
              textAnchor={allTicks ? "end" : undefined}
              height={allTicks ? 48 : undefined}
              tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={formatDateTick}
            />
            <YAxis
              tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false}
              tickFormatter={valueFormatter ? (v: number) => valueFormatter(v) : compactTick}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }}
              labelFormatter={(label) => (weekly ? "Week of " : "") + formatDateTick(label as string | number)}
              itemSorter={(item) => bars.findIndex((b) => b.key === item.dataKey)}
              // Locale-format the raw value so tooltips read "10,608" like every other
              // number on the page, not "10608" (audit R4-P2).
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : (v) => Number(v).toLocaleString()}
            />
            {bars.length > 1 && <Legend content={() => <LegendList items={bars} />} />}
            {refLineNode(refLine)}
            {/* isAnimationActive={false}: without it, toggling Daily→Weekly leaves bars on the
                previous data array's band scale (the final interpolation frame between arrays of
                different lengths) until a hover forces a re-render — misattributing the backfill
                spike to the wrong week (audit R3-2). */}
            {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function LinesCard(
  { title, subtitle, data, xKey, lines, percent = false, empty = "No data yet.", refLine, valueFormatter, weekly = false }:
  {
    title: string; subtitle?: string;
    data: Array<Record<string, string | number | null>>; xKey: string; lines: SeriesDef[];
    percent?: boolean; empty?: string; refLine?: RefLine; valueFormatter?: (v: number) => string; weekly?: boolean;
  },
) {
  if (data.length === 0) return <Card title={title} subtitle={subtitle}><div style={EMPTY}>{empty}</div></Card>;
  const yTickFmt = percent
    ? (v: number) => `${Math.round(v * 100)}%`
    : valueFormatter
      ? (v: number) => valueFormatter(v)
      : compactTick;
  const tipFmt = percent
    ? (v: unknown) => `${Math.round(Number(v) * 100)}%`
    : valueFormatter
      ? (v: unknown) => valueFormatter(Number(v))
      // Locale-format the raw value so tooltips match the rest of the page (audit R4-P2).
      : (v: unknown) => Number(v).toLocaleString();
  return (
    <Card title={title} subtitle={subtitle}>
      <div role="img" aria-label={`${title} — line chart`}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid stroke="var(--bg-muted)" vertical={false} />
            <XAxis dataKey={xKey} type="category" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={formatDateTick} />
            <YAxis
              tick={AXIS} tickLine={false} axisLine={false}
              domain={percent ? [0, 1] : undefined}
              tickFormatter={yTickFmt}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }}
              labelFormatter={(label) => (weekly ? "Week of " : "") + formatDateTick(label as string | number)}
              itemSorter={(item) => lines.findIndex((l) => l.key === item.dataKey)}
              formatter={tipFmt}
            />
            {lines.length > 1 && <Legend content={() => <LegendList items={lines} />} />}
            {refLineNode(refLine)}
            {lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                    dot={makeIsolatedDot(data, l.key, l.color)} activeDot={{ r: 4 }} strokeWidth={2}
                    connectNulls={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// A compact "benign zero" card — keeps the metric discoverable while reclaiming the
// ~240px a full chart of pure zeros would waste (audit F7).
export function StateCard({ title, subtitle, note }: { title: string; subtitle?: string; note: string }) {
  return (
    // alignSelf:'start' keeps a benign-zero card at its own content height instead
    // of stretching to a neighbouring 240px chart's row height (audit P2).
    <Card title={title} subtitle={subtitle} style={{ alignSelf: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "40px", color: "var(--success)", fontSize: "12.5px", fontWeight: 600 }}>
        <span aria-hidden="true" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--chart-good)", flex: "0 0 auto" }} />
        {note}
      </div>
    </Card>
  );
}

// Horizontal HTML bar list for top-N categorical breakdowns — every label stays
// legible (recharts vertical bars drop every other tick on 10-item lists). Same
// row pattern as the funnel. (audit F8)
export function HBarCard(
  { title, subtitle, data, color = "var(--chart-stage)", empty = "No data yet." }:
  { title: string; subtitle?: string; data: Array<BarDatum & { title?: string }>; color?: string; empty?: string },
) {
  if (data.length === 0) return <Card title={title} subtitle={subtitle}><div style={EMPTY}>{empty}</div></Card>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card title={title} subtitle={subtitle}>
      <div role="img" aria-label={`${title} — ranked bar list`} style={{ display: "flex", flexDirection: "column", gap: "7px", paddingBottom: "8px" }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              title={d.title ?? d.label}
              style={{
                flex: "0 0 140px", width: "140px", fontSize: "12px", color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </div>
            <div style={{ flex: 1, minWidth: "40px", height: "14px", background: "var(--bg-muted)", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ width: `${Math.round((d.count / max) * 100)}%`, height: "100%", background: color, borderRadius: "5px", minWidth: d.count > 0 ? "2px" : 0 }} />
            </div>
            <div style={{ width: "56px", textAlign: "right", fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
              {d.count.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SimpleBarCard(
  { title, subtitle, data, color = "var(--chart-stage)", empty = "No data yet.", allTicks = false }:
  { title: string; subtitle?: string; data: BarDatum[]; color?: string; empty?: string; allTicks?: boolean },
) {
  return <BarsCard title={title} subtitle={subtitle} data={data as unknown as Array<Record<string, string | number | null>>}
                   xKey="label" bars={[{ key: "count", name: "Count", color }]} empty={empty} allTicks={allTicks} />;
}

export function SimpleTableCard(
  { title, subtitle, data, empty = "No data yet." }:
  { title: string; subtitle?: string; data: BarDatum[]; empty?: string },
) {
  if (data.length === 0) return <Card title={title} subtitle={subtitle}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title} subtitle={subtitle}>
      <div style={{ paddingBottom: "8px" }}>
        {data.map((row, i) => (
          <div key={`${row.label}-${i}`} style={{
            display: "flex", justifyContent: "space-between", gap: "12px",
            fontSize: "12.5px", padding: "6px 2px",
            borderBottom: i < data.length - 1 ? "1px solid var(--bg-muted)" : "none",
          }}>
            <span
              title={row.label}
              style={{
                color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}
            >
              {row.label}
            </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700, flexShrink: 0 }}>{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
