"use client";

import { useMemo, useState } from "react";
import type { RunSeries } from "@/lib/metrics";
import { fillDays, toWeekly, sliceWindow, rate } from "@/lib/trend";
import { LinesCard, BarsCard } from "@/components/analytics/Chart";

type Gran = "day" | "week";
type Win = 30 | 90;

const COLORS = {
  blue: "#3b6fd4", green: "#22a06b", red: "#e0607e", amber: "#f59e0b",
  slate: "#7a8699", violet: "#7c6cd4",
};

// Two-up on wide screens, single-column on narrow. The track minimum is raised to ~460px
// (min(100%, …) so a narrow container still collapses to one column) specifically so three
// columns can't fit in the ~1040px analytics container — a third ~336px column left these
// 4-series bar charts + legends cramped.
const GRID: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: "16px",
};

function Toggle<T extends string | number>(
  { value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] },
) {
  return (
    <div style={{ display: "inline-flex", background: "#eef1f5", borderRadius: "9px", padding: "3px" }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12.5px", padding: "6px 14px",
            borderRadius: "7px", background: active ? "#fff" : "transparent",
            color: active ? "#1f2430" : "#6b7480", boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export function TrendCharts({ series, nowIso }: { series: RunSeries; nowIso: string }) {
  const [gran, setGran] = useState<Gran>("day");
  const [win, setWin] = useState<Win>(30);

  // Re-bucket one pipeline's rows through fill → (weekly) → slice. lastKeys
  // carry "take latest in week" fields (e.g. backlog); everything else sums.
  // All three pipelines fill over the same 90-day window ending nowIso, so the
  // resulting day (or week) sequences are identical and index-aligned — which is
  // what lets the merged `ops` array below zip them together by index.
  function prep<T extends { day: string }>(rows: T[], sumKeys: (keyof T)[], lastKeys: (keyof T)[] = []): T[] {
    const dense = fillDays(rows, 90, nowIso, [...sumKeys, ...lastKeys]);
    const bucketed = gran === "week" ? toWeekly(dense, sumKeys, lastKeys) : dense;
    return sliceWindow(bucketed, win, nowIso);
  }

  const poll = useMemo(
    () => prep(series.jobDiscovery,
      ["new_jobs", "closed_jobs", "companies_ok", "companies_failed", "run_count", "total_duration_seconds"]),
    [series, gran, win, nowIso],
  );
  const review = useMemo(
    () => prep(series.review,
      ["reviewed", "gate_rejected", "approved", "denied", "errors", "run_count", "total_duration_seconds"]),
    [series, gran, win, nowIso],
  );
  const companyDiscovery = useMemo(
    () => prep(series.companyDiscovery,
      ["ingested", "reviewed", "included", "excluded", "unknown", "errors", "run_count", "total_duration_seconds", "halt_count"],
      ["last_backlog"]),
    [series, gran, win, nowIso],
  );

  // Derived rate/net series (null on zero-denominator → gap in the line).
  const pollDerived = poll.map((p) => ({
    day: p.day,
    net_growth: p.new_jobs - p.closed_jobs,
    failure_rate: rate(p.companies_failed, p.companies_ok + p.companies_failed),
  }));
  const reviewDerived = review.map((p) => ({
    day: p.day,
    approval_rate: rate(p.approved, p.reviewed),
    gate_rate: rate(p.gate_rejected, p.reviewed),
  }));
  const companyDiscoveryDerived = companyDiscovery.map((p) => ({
    day: p.day,
    inclusion_rate: rate(p.included, p.reviewed),
    backlog: p.last_backlog,
    halt_count: p.halt_count,
  }));

  // Cross-pipeline cadence + latency (index-aligned per the prep note above).
  const ops = poll.map((p, i) => ({
    day: p.day,
    poll_runs: p.run_count,
    review_runs: review[i]?.run_count ?? 0,
    discovery_runs: companyDiscovery[i]?.run_count ?? 0,
    poll_latency: rate(p.total_duration_seconds, p.run_count),
    review_latency: rate(review[i]?.total_duration_seconds ?? 0, review[i]?.run_count ?? 0),
    discovery_latency: rate(companyDiscovery[i]?.total_duration_seconds ?? 0, companyDiscovery[i]?.run_count ?? 0),
  }));

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
        <Toggle value={gran} onChange={setGran}
          options={[{ v: "day", label: "Daily" }, { v: "week", label: "Weekly" }]} />
        <Toggle value={win} onChange={setWin}
          options={[{ v: 30, label: "30 days" }, { v: 90, label: "90 days" }]} />
      </div>

      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7480", letterSpacing: ".4px", margin: "4px 0 10px" }}>VOLUME</div>
      <div style={GRID}>
        <BarsCard title="Jobs found vs closed" data={poll as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "new_jobs", name: "New", color: COLORS.green }, { key: "closed_jobs", name: "Closed", color: COLORS.red }]} />
        <BarsCard title="Job Discovery — companies ok vs failed" data={poll as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "companies_ok", name: "OK", color: COLORS.blue }, { key: "companies_failed", name: "Failed", color: COLORS.red }]} />
        <BarsCard title="Review outcomes" data={review as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "approved", name: "Approved", color: COLORS.green }, { key: "denied", name: "Denied", color: COLORS.red },
                 { key: "gate_rejected", name: "Gate-rejected", color: COLORS.amber }, { key: "errors", name: "Errors", color: COLORS.slate }]} />
        <BarsCard title="Company Discovery outcomes" data={companyDiscovery as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "included", name: "Included", color: COLORS.green }, { key: "excluded", name: "Excluded", color: COLORS.red },
                 { key: "unknown", name: "Unknown", color: COLORS.slate }, { key: "errors", name: "Errors", color: COLORS.amber }]} />
      </div>

      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7480", letterSpacing: ".4px", margin: "18px 0 10px" }}>RATES &amp; OPERATIONS</div>
      <div style={GRID}>
        <LinesCard title="Review rates" data={reviewDerived} xKey="day" percent
          lines={[{ key: "approval_rate", name: "Approval", color: COLORS.green }, { key: "gate_rate", name: "Gate-reject", color: COLORS.amber }]} />
        <LinesCard title="Company Discovery inclusion rate" data={companyDiscoveryDerived} xKey="day" percent
          lines={[{ key: "inclusion_rate", name: "Inclusion", color: COLORS.blue }]} />
        <LinesCard title="Job Discovery failure rate" data={pollDerived} xKey="day" percent
          lines={[{ key: "failure_rate", name: "Failure", color: COLORS.red }]} />
        <BarsCard title="Net job growth (new − closed)" data={pollDerived} xKey="day"
          bars={[{ key: "net_growth", name: "Net", color: COLORS.blue }]} />
        <LinesCard title="Company Discovery backlog" data={companyDiscoveryDerived} xKey="day"
          lines={[{ key: "backlog", name: "Backlog", color: COLORS.violet }]} />
        <BarsCard title="Run cadence (runs per period)" data={ops} xKey="day"
          bars={[{ key: "poll_runs", name: "Job Discovery", color: COLORS.blue }, { key: "review_runs", name: "Reviewer", color: COLORS.green },
                 { key: "discovery_runs", name: "Company Discovery", color: COLORS.violet }]} />
        <LinesCard title="Avg run latency (seconds)" data={ops} xKey="day"
          lines={[{ key: "poll_latency", name: "Job Discovery", color: COLORS.blue }, { key: "review_latency", name: "Reviewer", color: COLORS.green },
                  { key: "discovery_latency", name: "Company Discovery", color: COLORS.violet }]} />
        <BarsCard title="Credit-halt frequency" data={companyDiscoveryDerived} xKey="day"
          bars={[{ key: "halt_count", name: "Halts", color: COLORS.amber }]} />
      </div>
    </div>
  );
}
