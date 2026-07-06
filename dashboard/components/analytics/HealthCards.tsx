"use client";
import type { PipelineHealth } from "@/lib/metrics";
import { derivePipelineStatus, type PipelineStatus } from "@/lib/status";
import { SCHEDULES, nextRun, type Schedule } from "@/lib/schedules";
import { GLOSSARY } from "@/lib/analyticsLabels";
import { InfoTip } from "@/components/analytics/InfoTip";

const DOT: Record<PipelineStatus, string> = {
  ok: "var(--status-ok)", warn: "var(--status-warn)", running: "var(--status-running)", failed: "var(--status-failed)", stale: "var(--status-stale)",
};

// Worded status chip — text + color so it's colorblind-safe (audit F9). The chip
// labels the schedule state; it does NOT alarm on benign no-op runs (that rule stays).
const CHIP: Record<PipelineStatus, { bg: string; color: string }> = {
  ok:      { bg: "var(--success-bg)", color: "var(--success)" },
  running: { bg: "var(--status-running-bg)", color: "var(--status-running-text)" },
  warn:    { bg: "var(--warning-bg)", color: "var(--warning)" },
  failed:  { bg: "var(--status-failed-bg)", color: "var(--status-failed-text)" },
  stale:   { bg: "var(--bg-muted)", color: "var(--text-secondary)" },
};

function rel(nowIso: string, iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000);
  if (mins <= 0) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function relFuture(now: Date, future: Date): string {
  const mins = Math.round((future.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ~${mins}m`;
  if (mins < 1440) return `in ~${Math.round(mins / 60)}h`;
  return `in ~${Math.round(mins / 1440)}d`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const utcTime = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const utcWeekdayTime = (d: Date) => `${WEEKDAYS[d.getUTCDay()]} ${utcTime(d)}`;
const intervalHoursOf = (s: Schedule): number => s.kind === "interval" ? s.everyHours : 7 * 24;

const num = (v: number | null | undefined): string => (v == null ? "—" : v.toLocaleString());

interface Stat { label: React.ReactNode; value: string }

/** A stat key optionally carrying a plain-language tooltip. */
function Key({ glossKey, children }: { glossKey?: keyof typeof GLOSSARY; children: React.ReactNode }) {
  if (!glossKey) return <span style={{ color: "var(--text-secondary)" }}>{children}</span>;
  const g = GLOSSARY[glossKey];
  return (
    <InfoTip term={g.label} gloss={g.gloss} labelStyle={{ color: "var(--text-secondary)" }}>
      {children}
    </InfoTip>
  );
}

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
      {stats.map((s, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px" }}>
          <span>{s.label}</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 700, whiteSpace: "nowrap" }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function statusText(status: PipelineStatus, staleRel: string): string {
  switch (status) {
    case "ok": return "On schedule";
    case "running": return "Running";
    case "warn": return "High failure rate";
    case "failed": return "Failed";
    case "stale": return `Overdue — last success ${staleRel}`;
  }
}

function Card({
  name, status, staleRel, when, scheduleLine, banner, stats, allTime,
}: {
  name: string;
  status: PipelineStatus;
  staleRel: string;
  when: string;
  scheduleLine: string;
  banner?: string;
  stats: Stat[];
  allTime: Stat[];
}) {
  const chip = CHIP[status];
  return (
    <div style={{ flex: "1 1 260px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ width: "9px", height: "9px", borderRadius: "50%", background: DOT[status], flex: "0 0 auto" }} />
        <span style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)" }}>{name}</span>
        <span
          style={{
            fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "8px",
            background: chip.bg, color: chip.color,
          }}
        >
          {statusText(status, staleRel)}
        </span>
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{when}</div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>{scheduleLine}</div>
      {banner && (
        <div style={{ margin: "8px 0", padding: "7px 10px", background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
          borderRadius: "9px", color: "var(--warning)", fontSize: "11.5px", fontWeight: 600 }}>{banner}</div>
      )}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 800, letterSpacing: ".3px", textTransform: "uppercase", marginTop: "12px", marginBottom: "5px" }}>
        Last successful run
      </div>
      <StatGrid stats={stats} />
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 800, letterSpacing: ".3px", textTransform: "uppercase", marginTop: "12px", marginBottom: "5px" }}>
        All-time
      </div>
      <StatGrid stats={allTime} />
    </div>
  );
}

export function HealthCards({ health, nowIso }: { health: PipelineHealth; nowIso: string }) {
  const now = new Date(nowIso);

  const jobDiscoveryStatus = derivePipelineStatus({
    latest: health.jobDiscovery.latest, lastSuccess: health.jobDiscovery.lastSuccess,
    now, intervalHours: intervalHoursOf(SCHEDULES.jobDiscovery),
  });
  const reviewerStatus = derivePipelineStatus({
    latest: health.reviewer.latest, lastSuccess: health.reviewer.lastSuccess,
    now, intervalHours: intervalHoursOf(SCHEDULES.reviewer),
  });
  const companyDiscoveryStatus = derivePipelineStatus({
    latest: health.companyDiscovery.latest, lastSuccess: health.companyDiscovery.lastSuccess,
    now, intervalHours: intervalHoursOf(SCHEDULES.companyDiscovery),
  });

  const nextJobDiscovery = nextRun(SCHEDULES.jobDiscovery, now);
  const nextReviewer = nextRun(SCHEDULES.reviewer, now);
  const nextCompanyDiscovery = nextRun(SCHEDULES.companyDiscovery, now);

  const { latest: poll, lastSuccess: pollSuccess, totals: pollTotals } = health.jobDiscovery;
  const { latest: review, lastSuccess: reviewSuccess, totals: reviewTotals } = health.reviewer;
  const { latest: disc, lastSuccess: discSuccess, totals: discTotals, state } = health.companyDiscovery;

  // Job Discovery banner
  let jobDiscoveryBanner: string | undefined;
  if (jobDiscoveryStatus === "running") {
    jobDiscoveryBanner = `Last run started ${rel(nowIso, poll!.started_at)}, still running`;
  } else if (jobDiscoveryStatus === "failed") {
    jobDiscoveryBanner = "Last run didn't finish";
  } else if (jobDiscoveryStatus === "warn" && poll) {
    const total = (poll.companies_ok ?? 0) + (poll.companies_failed ?? 0);
    const pct = total > 0 ? Math.round((poll.companies_failed ?? 0) / total * 100) : 0;
    jobDiscoveryBanner = `High failure rate: ${pct}% of companies failed last run`;
  } else if (!poll) {
    jobDiscoveryBanner = "No runs yet";
  }

  // Reviewer banner
  let reviewerBanner: string | undefined;
  if (reviewerStatus === "running") {
    reviewerBanner = `Last run started ${rel(nowIso, review!.started_at)}, still running`;
  } else if (reviewerStatus === "failed") {
    reviewerBanner = "Last run didn't finish";
  } else if (!review) {
    reviewerBanner = "No runs yet";
  }
  // A no-op run (finished cleanly but did no work) shows no banner — the status
  // dot + last-successful-run numbers already convey the state; a banner there
  // reads as a failure.

  // Company Discovery banner (credit-halt has top priority)
  let companyDiscoveryBanner: string | undefined;
  if (state.halted_no_credits) {
    companyDiscoveryBanner = "Paused — OpenRouter out of credits";
  } else if (companyDiscoveryStatus === "running") {
    companyDiscoveryBanner = `Last run started ${rel(nowIso, disc!.started_at)}, still running`;
  } else if (companyDiscoveryStatus === "failed") {
    companyDiscoveryBanner = disc?.status === "error" ? "Last run errored" : "Last run didn't finish";
  } else if (!disc) {
    companyDiscoveryBanner = "No runs yet";
  }
  // No-op runs (e.g. the weekly company discovery cron finding 0 new candidates)
  // show no banner — a clean run that did no work is not a failure.

  // Job Discovery last-run failure rate (audit F10)
  const jdOk = pollSuccess?.companies_ok ?? 0;
  const jdFailed = pollSuccess?.companies_failed ?? 0;
  const jdTotal = jdOk + jdFailed;
  const jdFailedValue =
    pollSuccess == null
      ? "—"
      : jdTotal > 0
        ? `${jdFailed.toLocaleString()} (${Math.round((jdFailed / jdTotal) * 100)}%)`
        : jdFailed.toLocaleString();

  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      <Card
        name="Job Discovery"
        status={jobDiscoveryStatus}
        staleRel={rel(nowIso, health.jobDiscovery.lastSuccess?.finished_at ?? null)}
        when={`last run · ${rel(nowIso, poll?.started_at ?? null)}`}
        scheduleLine={`next run ${relFuture(now, nextJobDiscovery)} · ${utcTime(nextJobDiscovery)}`}
        banner={jobDiscoveryBanner}
        stats={[
          { label: <Key>companies ok</Key>, value: num(pollSuccess?.companies_ok) },
          { label: <Key>failed</Key>, value: jdFailedValue },
          { label: <Key>new jobs</Key>, value: num(pollSuccess?.new_jobs) },
          { label: <Key>closed</Key>, value: num(pollSuccess?.closed_jobs) },
        ]}
        allTime={[
          { label: <Key>runs</Key>, value: num(pollTotals.runs) },
          { label: <Key>new jobs</Key>, value: num(pollTotals.new_jobs) },
          { label: <Key>closed</Key>, value: num(pollTotals.closed_jobs) },
          { label: <Key>companies ok</Key>, value: num(pollTotals.companies_ok) },
          { label: <Key>failed</Key>, value: num(pollTotals.companies_failed) },
        ]}
      />
      <Card
        name="Reviewer"
        status={reviewerStatus}
        staleRel={rel(nowIso, health.reviewer.lastSuccess?.finished_at ?? null)}
        when={`last run · ${rel(nowIso, review?.started_at ?? null)}`}
        scheduleLine={`next cycle ~${utcTime(nextReviewer)}`}
        banner={reviewerBanner}
        stats={[
          { label: <Key>reviewed</Key>, value: num(reviewSuccess?.reviewed) },
          { label: <Key glossKey="gate-rejected">gate-rejected</Key>, value: num(reviewSuccess?.gate_rejected) },
          { label: <Key glossKey="approved">approved</Key>, value: num(reviewSuccess?.approved) },
          { label: <Key glossKey="denied">denied</Key>, value: num(reviewSuccess?.denied) },
          { label: <Key glossKey="errors">errors</Key>, value: num(reviewSuccess?.errors) },
        ]}
        allTime={[
          { label: <Key>runs</Key>, value: num(reviewTotals.runs) },
          { label: <Key>reviewed</Key>, value: num(reviewTotals.reviewed) },
          { label: <Key glossKey="gate-rejected">gate-rejected</Key>, value: num(reviewTotals.gate_rejected) },
          { label: <Key glossKey="approved">approved</Key>, value: num(reviewTotals.approved) },
          { label: <Key glossKey="denied">denied</Key>, value: num(reviewTotals.denied) },
          { label: <Key glossKey="errors">errors</Key>, value: num(reviewTotals.errors) },
        ]}
      />
      <Card
        name="Company Discovery"
        status={companyDiscoveryStatus}
        staleRel={rel(nowIso, health.companyDiscovery.lastSuccess?.finished_at ?? null)}
        when={`last run · ${rel(nowIso, disc?.started_at ?? null)}`}
        scheduleLine={`next ${utcWeekdayTime(nextCompanyDiscovery)}`}
        banner={companyDiscoveryBanner}
        stats={[
          { label: <Key glossKey="ingested">ingested</Key>, value: num(discSuccess?.ingested) },
          { label: <Key glossKey="included">included</Key>, value: num(discSuccess?.included) },
          { label: <Key glossKey="excluded">excluded</Key>, value: num(discSuccess?.excluded) },
          { label: <Key glossKey="unknown">unknown</Key>, value: num(discSuccess?.unknown) },
          { label: <Key glossKey="errors">errors</Key>, value: num(discSuccess?.errors) },
          { label: <Key glossKey="backlog-run">run-end backlog</Key>, value: num(discSuccess?.backlog) },
        ]}
        allTime={[
          { label: <Key>runs</Key>, value: num(discTotals.runs) },
          { label: <Key glossKey="ingested">ingested</Key>, value: num(discTotals.ingested) },
          { label: <Key glossKey="included">included</Key>, value: num(discTotals.included) },
          { label: <Key glossKey="excluded">excluded</Key>, value: num(discTotals.excluded) },
          { label: <Key glossKey="errors">errors</Key>, value: num(discTotals.errors) },
        ]}
      />
    </div>
  );
}
