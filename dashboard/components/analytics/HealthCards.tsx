"use client";
import type { PipelineHealth } from "@/lib/metrics";
import { derivePipelineStatus, type PipelineStatus } from "@/lib/status";
import { SCHEDULES, nextRun, type Schedule } from "@/lib/schedules";

const DOT: Record<PipelineStatus, string> = {
  ok: "#22c55e", warn: "#f59e0b", running: "#3b82f6", failed: "#ef4444", stale: "#9aa3b0",
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

function Card({
  name, status, when, scheduleLine, banner, stats, totals,
}: {
  name: string;
  status: PipelineStatus;
  when: string;
  scheduleLine: string;
  banner?: string;
  stats: [string, number | null | undefined][];
  totals: string;
}) {
  return (
    <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: DOT[status] }} title={status} />
        <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#161d29" }}>{name}</span>
        <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "#7a8494" }}>{when}</span>
      </div>
      <div style={{ fontSize: "11px", color: "#9aa3b0", marginBottom: "4px" }}>{scheduleLine}</div>
      {banner && (
        <div style={{ margin: "8px 0", padding: "7px 10px", background: "#fdf3e6", border: "1px solid #f3d9ad",
          borderRadius: "9px", color: "#8a5a12", fontSize: "11.5px", fontWeight: 600 }}>{banner}</div>
      )}
      <div style={{ fontSize: "11px", color: "#9aa3b0", marginTop: "10px", marginBottom: "4px", fontWeight: 600 }}>
        Last successful run
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ color: "#6b7480" }}>{k}</span>
            <span style={{ color: "#1f2430", fontWeight: 700 }}>{v ?? "—"}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "11px", color: "#9aa3b0", marginTop: "10px" }}>{totals}</div>
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

  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      <Card
        name="Job Discovery"
        status={jobDiscoveryStatus}
        when={`last run · ${rel(nowIso, poll?.started_at ?? null)}`}
        scheduleLine={`next run ${relFuture(now, nextJobDiscovery)} · ${utcTime(nextJobDiscovery)}`}
        banner={jobDiscoveryBanner}
        stats={[
          ["companies ok", pollSuccess?.companies_ok],
          ["failed", pollSuccess?.companies_failed],
          ["new jobs", pollSuccess?.new_jobs],
          ["closed", pollSuccess?.closed_jobs],
        ]}
        totals={`All-time: ${pollTotals.runs} runs · ${pollTotals.new_jobs} new · ${pollTotals.closed_jobs} closed`}
      />
      <Card
        name="Reviewer"
        status={reviewerStatus}
        when={`last run · ${rel(nowIso, review?.started_at ?? null)}`}
        scheduleLine={`next cycle ~${utcTime(nextReviewer)}`}
        banner={reviewerBanner}
        stats={[
          ["reviewed", reviewSuccess?.reviewed],
          ["gate-rejected", reviewSuccess?.gate_rejected],
          ["approved", reviewSuccess?.approved],
          ["denied", reviewSuccess?.denied],
          ["errors", reviewSuccess?.errors],
        ]}
        totals={`All-time: ${reviewTotals.runs} runs · ${reviewTotals.reviewed} reviewed (${reviewTotals.gate_rejected} gate-rejected · ${reviewTotals.approved} approved · ${reviewTotals.denied} denied) · ${reviewTotals.errors} errors`}
      />
      <Card
        name="Company Discovery"
        status={companyDiscoveryStatus}
        when={`last run · ${rel(nowIso, disc?.started_at ?? null)}`}
        scheduleLine={`next ${utcWeekdayTime(nextCompanyDiscovery)}`}
        banner={companyDiscoveryBanner}
        stats={[
          ["ingested", discSuccess?.ingested],
          ["included", discSuccess?.included],
          ["excluded", discSuccess?.excluded],
          ["unknown", discSuccess?.unknown],
          ["errors", discSuccess?.errors],
          ["backlog", discSuccess?.backlog],
        ]}
        totals={`All-time: ${discTotals.runs} runs · ${discTotals.ingested} ingested · ${discTotals.included} included · ${discTotals.excluded} excluded`}
      />
    </div>
  );
}
