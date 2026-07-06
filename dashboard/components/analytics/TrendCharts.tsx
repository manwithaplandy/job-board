"use client";

import { useMemo, useState } from "react";
import type { RunSeries } from "@/lib/metrics";
import { fillDays, toWeekly, sliceWindow, rate, weekStart } from "@/lib/trend";
import { JOB_DISCOVERY_FAILURE_WARN_RATE } from "@/lib/status";
import { LinesCard, BarsCard, StateCard } from "@/components/analytics/Chart";

type Gran = "day" | "week";
type Win = 30 | 90;

const COLORS = {
  blue: "var(--chart-stage)", green: "var(--chart-good)", red: "var(--chart-bad)", amber: "var(--chart-amber)",
  slate: "var(--chart-muted)", violet: "var(--chart-violet)",
};

const DAY_MS = 86_400_000;

const GRID: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: "16px",
};

const GROUP_LABEL: React.CSSProperties = {
  fontSize: "12px", fontWeight: 800, color: "var(--text-secondary)", letterSpacing: ".4px", margin: 0,
};

function fmtMD(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${Number(m[2])}/${Number(m[3])}` : day;
}

/** Humanize a duration in seconds for the run-time axis/tooltip. */
function fmtDuration(s: number): string {
  if (!isFinite(s) || s <= 0) return "0s";
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 90 * 60) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

// Note when one DAY dwarfs the rest (> 10× the median of nonzero values). Always
// computed on the pre-bucketing DAILY rows so the annotation survives the Weekly
// toggle — a bucketed week has too few nonzero values to trip the detector, yet the
// weekly bar is exactly where a hidden one-day backfill is most misleading (audit
// R4-P4). In weekly view the wording points at the containing week.
function outlierNote<T extends { day: string }>(dailyRows: T[], key: keyof T, weekly: boolean): string | undefined {
  const nonzero = dailyRows.map((r) => r[key] as unknown as number).filter((v) => v > 0).sort((a, b) => a - b);
  if (nonzero.length < 3) return undefined;
  const median = nonzero[Math.floor(nonzero.length / 2)];
  if (median <= 0) return undefined;
  let maxV = -Infinity, maxDay = "";
  for (const r of dailyRows) {
    const v = r[key] as unknown as number;
    if (v > maxV) { maxV = v; maxDay = r.day; }
  }
  if (maxV > 10 * median) {
    return weekly
      ? `The week of ${fmtMD(weekStart(maxDay))} includes a one-day ${fmtMD(maxDay)} backfill of ${maxV.toLocaleString()} — the rest of that week is far smaller.`
      : `One-day spike on ${fmtMD(maxDay)} (${maxV.toLocaleString()}) compresses this scale — other days are much smaller.`;
  }
  return undefined;
}

function allZero<T>(rows: T[], key: keyof T): boolean {
  return rows.every((r) => ((r[key] as unknown as number) ?? 0) === 0);
}

function Toggle<T extends string | number>(
  { value, onChange, options, label }:
  { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string },
) {
  return (
    <div role="group" aria-label={label} style={{ display: "inline-flex", background: "var(--bg-muted)", borderRadius: "9px", padding: "3px" }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            aria-pressed={active}
            onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--focus-ring)"; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = active ? "var(--shadow-toggle)" : "none"; }}
            style={{
              border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12.5px", padding: "6px 14px",
              borderRadius: "7px", background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: active ? "var(--shadow-toggle)" : "none",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

export function TrendCharts({ series, nowIso }: { series: RunSeries; nowIso: string }) {
  const [gran, setGran] = useState<Gran>("day");
  const [win, setWin] = useState<Win>(30);

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

  // Pre-bucketing DAILY poll rows (window-sliced but never weekly-aggregated), used only
  // to detect the one-day backfill spike so its annotation survives the Weekly toggle
  // (audit R4-P4).
  const pollDaily = useMemo(
    () => sliceWindow(fillDays(series.jobDiscovery, 90, nowIso, ["new_jobs", "closed_jobs"]), win, nowIso),
    [series, win, nowIso],
  );
  const pollDailyNet = pollDaily.map((p) => ({ day: p.day, net_growth: p.new_jobs - p.closed_jobs }));

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

  const ops = poll.map((p, i) => ({
    day: p.day,
    poll_runs: p.run_count,
    review_runs: review[i]?.run_count ?? 0,
    discovery_runs: companyDiscovery[i]?.run_count ?? 0,
    poll_latency: rate(p.total_duration_seconds, p.run_count),
    review_latency: rate(review[i]?.total_duration_seconds ?? 0, review[i]?.run_count ?? 0),
    discovery_latency: rate(companyDiscovery[i]?.total_duration_seconds ?? 0, companyDiscovery[i]?.run_count ?? 0),
  }));

  // Data-start annotation: the raw series only has rows for days that ran, so the
  // earliest such day is the true first-active day (audit F5).
  const firstActiveDay = useMemo(() => {
    const firsts = [series.jobDiscovery, series.review, series.companyDiscovery]
      .map((s) => s[0]?.day)
      .filter(Boolean) as string[];
    return firsts.length ? firsts.sort()[0] : undefined;
  }, [series]);
  const windowStartMs = Date.parse(nowIso.slice(0, 10) + "T00:00:00Z") - (win - 1) * DAY_MS;
  // Show whenever run data starts after the window's left edge — including the default
  // Daily/30d view, where the empty left third was previously unexplained (audit R4-P3).
  const dataBeginsNote =
    firstActiveDay && Date.parse(firstActiveDay + "T00:00:00Z") > windowStartMs
      ? `Run data begins ${fmtMD(firstActiveDay)} — earlier days in this ${win}-day window are empty.`
      : undefined;

  const foundNote = outlierNote(pollDaily, "new_jobs", gran === "week");
  const netNote = outlierNote(pollDailyNet, "net_growth", gran === "week");

  const haltsZero = allZero(companyDiscoveryDerived, "halt_count");
  const backlogZero = allZero(companyDiscoveryDerived, "backlog");
  const winLabel = win === 30 ? "30 days" : "90 days";

  // In weekly view the final bucket only covers this week so far, so its shorter bars
  // read as a throughput drop to a non-technical reader. Flag it (audit R3-P4).
  const weekly = gran === "week";
  const partialWeekNote = weekly
    ? "The last bar is the current week so far — its lower values aren't a real drop."
    : undefined;

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <Toggle value={gran} onChange={setGran} label="Granularity"
          options={[{ v: "day", label: "Daily" }, { v: "week", label: "Weekly" }]} />
        <Toggle value={win} onChange={setWin} label="Time window"
          options={[{ v: 30, label: "30 days" }, { v: 90, label: "90 days" }]} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", margin: "4px 0 10px" }}>
        <h3 style={GROUP_LABEL}>VOLUME</h3>
        {dataBeginsNote && <span style={{ fontSize: "11.5px", color: "var(--warning)", fontWeight: 600 }}>{dataBeginsNote}</span>}
        {partialWeekNote && <span style={{ fontSize: "11.5px", color: "var(--warning)", fontWeight: 600 }}>{partialWeekNote}</span>}
      </div>
      <div style={GRID}>
        <BarsCard title="Jobs found vs closed" subtitle={foundNote} weekly={weekly} data={poll as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "new_jobs", name: "New", color: COLORS.green }, { key: "closed_jobs", name: "Closed", color: COLORS.red }]} />
        <BarsCard title="Job Discovery — companies ok vs failed" weekly={weekly} data={poll as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "companies_ok", name: "OK", color: COLORS.blue }, { key: "companies_failed", name: "Failed", color: COLORS.red }]} />
        <BarsCard title="Review outcomes" weekly={weekly} data={review as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "approved", name: "Approved", color: COLORS.green }, { key: "denied", name: "Denied", color: COLORS.red },
                 { key: "gate_rejected", name: "Gate-rejected", color: COLORS.amber }, { key: "errors", name: "Errors", color: COLORS.slate }]} />
        <BarsCard title="Company Discovery outcomes" weekly={weekly} data={companyDiscovery as unknown as Array<Record<string, string | number | null>>} xKey="day"
          bars={[{ key: "included", name: "Included", color: COLORS.green }, { key: "excluded", name: "Excluded", color: COLORS.red },
                 { key: "unknown", name: "Unknown", color: COLORS.slate }, { key: "errors", name: "Errors", color: COLORS.amber }]} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", margin: "18px 0 10px" }}>
        <h3 style={GROUP_LABEL}>RATES &amp; OPERATIONS</h3>
        {partialWeekNote && <span style={{ fontSize: "11.5px", color: "var(--warning)", fontWeight: 600 }}>{partialWeekNote}</span>}
      </div>
      <div style={GRID}>
        <LinesCard title="Review rates" subtitle="High gate-reject is normal — the gate filters obvious non-fits before full review." weekly={weekly} data={reviewDerived} xKey="day" percent
          lines={[{ key: "approval_rate", name: "Approval", color: COLORS.green }, { key: "gate_rate", name: "Gate-reject", color: COLORS.amber }]} />
        <LinesCard title="Company Discovery inclusion rate" subtitle="Share of newly screened companies accepted for tracking." weekly={weekly} data={companyDiscoveryDerived} xKey="day" percent
          lines={[{ key: "inclusion_rate", name: "Inclusion", color: COLORS.blue }]} />
        <LinesCard title="Job Discovery failure rate" subtitle="Share of companies whose ATS poll failed. Lower is better; the dashed line is the 60% warn threshold." weekly={weekly} data={pollDerived} xKey="day" percent
          refLine={{ y: JOB_DISCOVERY_FAILURE_WARN_RATE, label: "warn threshold" }}
          lines={[{ key: "failure_rate", name: "Failure", color: COLORS.red }]} />
        <BarsCard title="Net job growth (new − closed)" subtitle={netNote} weekly={weekly} data={pollDerived} xKey="day"
          bars={[{ key: "net_growth", name: "Net", color: COLORS.blue }]} />
        {backlogZero
          ? <StateCard title="Company Discovery backlog" note={`Backlog stayed at 0 across the last ${winLabel} — the pipeline is caught up.`} />
          : <LinesCard title="Company Discovery backlog" subtitle="Companies awaiting classification at each run's end." weekly={weekly} data={companyDiscoveryDerived} xKey="day"
              lines={[{ key: "backlog", name: "Backlog", color: COLORS.violet }]} />}
        <BarsCard title="Run cadence (runs per period)" subtitle="Runs completed per bucket — should track each pipeline's cron schedule." weekly={weekly} data={ops} xKey="day"
          bars={[{ key: "poll_runs", name: "Job Discovery", color: COLORS.blue }, { key: "review_runs", name: "Reviewer", color: COLORS.green },
                 { key: "discovery_runs", name: "Company Discovery", color: COLORS.violet }]} />
        <LinesCard title="Average run time — Job Discovery & Reviewer" subtitle="Wall-clock time per run." weekly={weekly} data={ops} xKey="day" valueFormatter={fmtDuration}
          lines={[{ key: "poll_latency", name: "Job Discovery", color: COLORS.blue }, { key: "review_latency", name: "Reviewer", color: COLORS.green }]} />
        <LinesCard title="Average run time — Company Discovery" subtitle="Plotted separately — its weekly deep scan runs far longer than the other two." weekly={weekly} data={ops} xKey="day" valueFormatter={fmtDuration}
          lines={[{ key: "discovery_latency", name: "Company Discovery", color: COLORS.violet }]} />
        {haltsZero
          ? <StateCard title="Credit-halt frequency" note={`No credit halts in the last ${winLabel} — the LLM provider stayed funded.`} />
          : <BarsCard title="Credit-halt frequency" subtitle="Times discovery paused for lack of LLM credits." weekly={weekly} data={companyDiscoveryDerived} xKey="day"
              bars={[{ key: "halt_count", name: "Halts", color: COLORS.amber }]} />}
      </div>
    </div>
  );
}
