"use client";

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { Bar as BarDatum } from "@/lib/metrics";

export interface SeriesDef { key: string; name: string; color: string }

const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px",
  padding: "16px 18px 8px", marginBottom: "16px",
};
const TITLE: React.CSSProperties = {
  fontSize: "13.5px", fontWeight: 800, color: "#161d29", marginBottom: "12px", letterSpacing: "-.2px",
};
const EMPTY: React.CSSProperties = { fontSize: "12.5px", color: "#9aa3b0", padding: "28px 0" };
const AXIS = { fontSize: 11, fill: "#6b7480" } as const;

// Render ISO date ticks (e.g. "2026-06-05") as "M/D"; leave non-date categories
// (SimpleBarCard's string labels) untouched.
function formatDateTick(value: string | number): string {
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${Number(m[2])}/${Number(m[3])}` : s;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={CARD}><div style={TITLE}>{title}</div>{children}</div>;
}

export function BarsCard(
  { title, data, xKey, bars, empty = "No data yet." }:
  { title: string; data: Array<Record<string, string | number | null>>; xKey: string; bars: SeriesDef[]; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#f0f2f6" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e7eaf0" }} tickFormatter={formatDateTick} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e7eaf0" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[3, 3, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function LinesCard(
  { title, data, xKey, lines, percent = false, empty = "No data yet." }:
  { title: string; data: Array<Record<string, string | number | null>>; xKey: string; lines: SeriesDef[]; percent?: boolean; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#f0f2f6" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e7eaf0" }} tickFormatter={formatDateTick} />
          <YAxis
            tick={AXIS} tickLine={false} axisLine={false}
            domain={percent ? [0, 1] : undefined}
            tickFormatter={percent ? (v: number) => `${Math.round(v * 100)}%` : undefined}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e7eaf0" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                  dot={false} strokeWidth={2} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function SimpleBarCard(
  { title, data, color = "#3b6fd4", empty = "No data yet." }:
  { title: string; data: BarDatum[]; color?: string; empty?: string },
) {
  return <BarsCard title={title} data={data as unknown as Array<Record<string, string | number | null>>}
                   xKey="label" bars={[{ key: "count", name: "Count", color }]} empty={empty} />;
}

export function SimpleTableCard(
  { title, data, empty = "No data yet." }:
  { title: string; data: BarDatum[]; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <div style={{ paddingBottom: "8px" }}>
        {data.map((row, i) => (
          <div key={`${row.label}-${i}`} style={{
            display: "flex", justifyContent: "space-between", gap: "12px",
            fontSize: "12.5px", padding: "6px 2px",
            borderBottom: i < data.length - 1 ? "1px solid #f0f2f6" : "none",
          }}>
            <span style={{ color: "#5b6472", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.label}
            </span>
            <span style={{ color: "#161d29", fontWeight: 700, flexShrink: 0 }}>{row.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
