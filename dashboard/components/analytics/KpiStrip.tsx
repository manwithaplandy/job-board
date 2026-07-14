"use client";

import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { GLOSSARY } from "@/lib/analyticsLabels";
import { InfoTip } from "@/components/analytics/InfoTip";
import { Card } from "@/components/ui/Panel";

const DAY_MS = 86_400_000;

// Sum a numeric field over rows whose UTC day falls in [endMs - startAgo*DAY, endMs - endAgo*DAY).
// Rows are sparse (only days with runs), so a filter+reduce is enough.
function sumWindow<T extends { day: string }>(
  rows: T[], field: keyof T, endMs: number, startAgo: number, endAgo: number,
): number {
  const lo = endMs - startAgo * DAY_MS;
  const hi = endMs - endAgo * DAY_MS;
  let acc = 0;
  for (const r of rows) {
    const t = Date.parse(r.day + "T00:00:00Z");
    if (t >= lo && t < hi) acc += (r[field] as unknown as number) ?? 0;
  }
  return acc;
}

function fmtMD(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${Number(m[2])}/${Number(m[3])}` : day;
}

// If the prior window is dominated by a one-day backfill spike (> 10× the median of
// nonzero days across the whole series), comparing against it produces an alarming,
// meaningless red drop — return the spike's date so the tile can annotate instead of
// alarm (audit P1). Mirrors TrendCharts' outlier detection.
function priorSpikeDay<T extends { day: string }>(
  rows: T[], field: keyof T, endMs: number, startAgo: number, endAgo: number,
): string | undefined {
  const nonzero = rows.map((r) => (r[field] as unknown as number) ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  if (nonzero.length < 3) return undefined;
  const median = nonzero[Math.floor(nonzero.length / 2)];
  if (median <= 0) return undefined;
  const lo = endMs - startAgo * DAY_MS;
  const hi = endMs - endAgo * DAY_MS;
  let maxV = -Infinity, maxDay = "";
  for (const r of rows) {
    const t = Date.parse(r.day + "T00:00:00Z");
    if (t >= lo && t < hi) {
      const v = (r[field] as unknown as number) ?? 0;
      if (v > maxV) { maxV = v; maxDay = r.day; }
    }
  }
  return maxV > 10 * median ? maxDay : undefined;
}

function Delta({ current, prior, noun, spikeDay }: { current: number; prior: number; noun: string; spikeDay?: string }) {
  if (current === 0 && prior === 0) return null;
  const up = current >= prior;
  const pctChange = prior > 0 ? Math.abs(current - prior) / prior : 1;
  // Neutral (gray) when the prior week is a backfill outlier or the change is trivial
  // (< 15%); otherwise green-up / red-down. Arrow + words carry direction so hue is
  // never the only signal (colorblind-safe).
  const muted = spikeDay != null || pctChange < 0.15;
  const color = muted ? "var(--text-secondary)" : up ? "var(--success)" : "var(--danger)";
  return (
    <div style={{ fontSize: "11px", fontWeight: 700, color, marginTop: "5px" }}>
      {/* value+noun is one non-breaking unit so "found this week" never splits as "this / week" */}
      <span style={{ whiteSpace: "nowrap" }}>
        {!spikeDay && <span aria-hidden="true">{up ? "▲" : "▼"} </span>}
        {current.toLocaleString()} {noun}
      </span>
      {spikeDay ? (
        // The long backfill annotation gets its own wrapping block line so it never
        // hard-clips at the ~163px tile edge (audit R3-1 / REG2-1).
        <span style={{ display: "block", color: "var(--text-muted)", fontWeight: 500, marginTop: "2px", lineHeight: 1.35 }}>
          prior week includes one-time {fmtMD(spikeDay)} backfill
        </span>
      ) : (
        // Own block line (no nowrap) so a long value+noun line like "217 approved this
        // week" doesn't push this suffix past the ~163px tile edge and hard-clip the
        // prior-week numeral (audit R4-1). Matches the spike-annotation branch's look.
        <span style={{ display: "block", color: "var(--text-muted)", fontWeight: 500, marginTop: "2px", lineHeight: 1.35 }}>
          prior 7d {prior.toLocaleString()}
        </span>
      )}
    </div>
  );
}

function Tile({
  value, label, gloss, glossTerm, delta,
}: {
  value: number;
  label: string;
  gloss?: string;
  glossTerm?: string;
  delta?: React.ReactNode;
}) {
  return (
    <Card
      role="group"
      aria-label={`${label}: ${value.toLocaleString()}`}
      className="rf-analytics-kpi"
      padding="sm"
    >
      <div className="rf-analytics-kpi__value">
        {value.toLocaleString()}
      </div>
      <div className="rf-analytics-kpi__label">
        {gloss ? (
          <InfoTip term={glossTerm ?? label} gloss={gloss} labelStyle={{ color: "var(--text-secondary)" }}>
            {label}
          </InfoTip>
        ) : (
          label
        )}
      </div>
      {delta}
    </Card>
  );
}

export function KpiStrip({ snapshot, series, nowIso }: { snapshot: PipelineSnapshot; series: RunSeries; nowIso: string }) {
  const { funnel } = snapshot;
  const j = funnel.jobs;
  const c = funnel.companies;

  const endMs = Date.parse(nowIso.slice(0, 10) + "T00:00:00Z");
  // "last 7d" = today + previous 6 UTC days; "prior 7d" = the 7 days before that.
  const newJobs7 = sumWindow(series.jobDiscovery, "new_jobs", endMs, 6, -1);
  const newJobsPrior7 = sumWindow(series.jobDiscovery, "new_jobs", endMs, 13, 6);
  const newJobsPriorSpike = priorSpikeDay(series.jobDiscovery, "new_jobs", endMs, 13, 6);
  const approved7 = sumWindow(series.review, "approved", endMs, 6, -1);
  const approvedPrior7 = sumWindow(series.review, "approved", endMs, 13, 6);
  const approvedPriorSpike = priorSpikeDay(series.review, "approved", endMs, 13, 6);

  return (
    <div id="overview" className="rf-analytics-overview">
      <div className="rf-analytics-kpi-grid">
        <Tile
          value={j.open}
          label="Open jobs"
          gloss="Jobs currently open across every tracked company — the live pool the reviewer works through."
          glossTerm="Open jobs"
          delta={<Delta current={newJobs7} prior={newJobsPrior7} noun="found this week" spikeDay={newJobsPriorSpike} />}
        />
        <Tile
          value={j.unreviewed}
          label="Awaiting review"
          gloss={GLOSSARY.unreviewed.gloss}
          glossTerm={GLOSSARY.unreviewed.label}
        />
        <Tile
          value={j.approved}
          label="Approved matches"
          gloss={GLOSSARY.approved.gloss}
          glossTerm={GLOSSARY.approved.label}
          delta={<Delta current={approved7} prior={approvedPrior7} noun="approved this week" spikeDay={approvedPriorSpike} />}
        />
        <Tile
          value={j.applied}
          label="Applied"
          gloss={GLOSSARY.applied.gloss}
          glossTerm={GLOSSARY.applied.label}
        />
        <Tile
          value={c.include}
          label="Companies tracked"
          gloss={GLOSSARY.included.gloss}
          glossTerm="Companies tracked"
        />
      </div>

      <p className="rf-analytics-summary">
        Rolefit is tracking <strong style={{ color: "var(--text-primary)" }}>{j.open.toLocaleString()}</strong> open jobs at{" "}
        <strong style={{ color: "var(--text-primary)" }}>{c.include.toLocaleString()}</strong> companies;{" "}
        <strong style={{ color: "var(--text-primary)" }}>{j.reviewed.toLocaleString()}</strong> have been reviewed,{" "}
        <strong style={{ color: "var(--text-primary)" }}>{j.approved.toLocaleString()}</strong> look like a fit, and{" "}
        <strong style={{ color: "var(--text-primary)" }}>{j.applied.toLocaleString()}</strong>{" "}
        {j.applied === 1 ? "has" : "have"} been applied to.
      </p>
    </div>
  );
}
