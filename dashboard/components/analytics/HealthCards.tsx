"use client";

import type { LatestRuns } from "@/lib/metrics";
import { computeHealth, type Health } from "@/lib/status";
import { STALE_HEALTH_HOURS } from "@/lib/config";

const DOT: Record<Health, string> = { ok: "#22c55e", warn: "#f59e0b", stale: "#9aa3b0" };

function rel(nowIso: string, iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function Card(
  { name, health, when, stats, banner }:
  { name: string; health: Health; when: string; stats: [string, number | null | string][]; banner?: string },
) {
  return (
    <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: DOT[health] }} title={health} />
        <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#161d29" }}>{name}</span>
        <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "#9aa3b0" }}>{when}</span>
      </div>
      {banner && (
        <div style={{ margin: "8px 0", padding: "7px 10px", background: "#fdf3e6", border: "1px solid #f3d9ad",
          borderRadius: "9px", color: "#8a5a12", fontSize: "11.5px", fontWeight: 600 }}>{banner}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px", marginTop: "8px" }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ color: "#8a93a3" }}>{k}</span>
            <span style={{ color: "#1f2430", fontWeight: 700 }}>{v ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthCards({ latest, nowIso }: { latest: LatestRuns; nowIso: string }) {
  const now = new Date(nowIso);
  const { poll, review, discovery, discoveryState } = latest;
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      <Card
        name="Poller" when={rel(nowIso, poll?.finished_at ?? null)}
        health={computeHealth(poll ? { finished_at: poll.finished_at, failures: poll.companies_failed } : null, now, STALE_HEALTH_HOURS)}
        stats={[["companies ok", poll?.companies_ok ?? null], ["failed", poll?.companies_failed ?? null],
                ["new jobs", poll?.new_jobs ?? null], ["closed", poll?.closed_jobs ?? null]]}
      />
      <Card
        name="Reviewer" when={rel(nowIso, review?.finished_at ?? null)}
        health={computeHealth(review ? { finished_at: review.finished_at, failures: review.errors } : null, now, STALE_HEALTH_HOURS)}
        stats={[["reviewed", review?.reviewed ?? null], ["gate-rejected", review?.gate_rejected ?? null],
                ["approved", review?.approved ?? null], ["denied", review?.denied ?? null],
                ["errors", review?.errors ?? null]]}
      />
      <Card
        name="Discovery" when={rel(nowIso, discovery?.finished_at ?? null)}
        health={computeHealth(discovery ? { finished_at: discovery.finished_at, failures: discovery.errors } : null, now, STALE_HEALTH_HOURS)}
        banner={discoveryState.halted_no_credits ? "⚠️ Paused — OpenRouter out of credits" : undefined}
        stats={[["ingested", discovery?.ingested ?? null], ["included", discovery?.included ?? null],
                ["excluded", discovery?.excluded ?? null], ["unknown", discovery?.unknown ?? null],
                ["errors", discovery?.errors ?? null], ["backlog", discovery?.backlog ?? null]]}
      />
    </div>
  );
}
