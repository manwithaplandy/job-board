import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getTenantMetrics, type TenantMetric } from "@/lib/tenantMetrics";
import { loadAppSettings } from "@/lib/appSettings";
import { PLAN_LABEL } from "@/lib/entitlements";
import { AdminNav } from "@/components/admin/AdminNav";
import { AllowanceEditor } from "@/components/admin/AllowanceEditor";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import { Badge, Card } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tenants · Admin" };

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function Row({ t, defaultAllowance }: { t: TenantMetric; defaultAllowance: number }) {
  return (
    <tr>
      <td style={{ whiteSpace: "normal", minWidth: "160px" }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.email ?? "—"}</div>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{t.userId.slice(0, 8)}</div>
      </td>
      <td>
        {t.plan ? PLAN_LABEL[t.plan] : "None"}
        {t.plan && t.invited && !t.subStatus && (
          <> <Badge tone="accent">Comped</Badge></>
        )}
      </td>
      <td>{t.subStatus ? <Badge tone={t.subStatus === "active" ? "success" : "warning"}>{t.subStatus}</Badge> : "—"}</td>
      <td>{fmtDate(t.currentPeriodEnd)}</td>
      <td style={{ textAlign: "right" }}>{t.reviewsToday.toLocaleString()}</td>
      <td style={{ textAlign: "right" }}>{t.reviews30d.toLocaleString()}</td>
      <td style={{ textAlign: "right" }}>
        {t.resumeMonth} / {t.coverMonth}
      </td>
      <td style={{ textAlign: "right" }}>
        <AllowanceEditor userId={t.userId} remaining={t.invitesRemaining} defaultAllowance={defaultAllowance} />
      </td>
      <td>{fmtDate(t.lastRunAt)}</td>
      <td style={{ textAlign: "right", color: (t.lastRunErrors ?? 0) > 0 ? "var(--danger)" : undefined }}>
        {t.lastRunErrors ?? "—"}
      </td>
      <td style={{ textAlign: "right" }}>
        {t.activeRequests}
        {t.failedRequests > 0 && <span style={{ color: "var(--danger)" }}> / {t.failedRequests} failed</span>}
      </td>
      <td style={{ textAlign: "right", fontWeight: 600 }}>${t.estCost30dUsd.toFixed(2)}</td>
    </tr>
  );
}

export default async function AdminTenantsPage() {
  const claims = await getUserClaims();
  // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
  // existence is not advertised.
  if (!isAdmin(claims)) notFound();

  const tenants = await getTenantMetrics();
  const settings = await loadAppSettings();

  return (
    <AppShell header={<SlimHeader current="admin" />}>
      <main className="rf-secondary-page rf-secondary-density--compact">
        <div className="rf-secondary-wrap rf-secondary-wrap--admin">
          <AdminNav active="tenants" />
          <Card>
            <PageHeader className="rf-secondary-header" title="Tenants" description="Per-tenant plan, usage, pipeline health, and an estimated 30-day review cost." />

            {tenants.length === 0 ? (
              <EmptyState compact title="No tenants yet." />
            ) : (
              <div className="rf-secondary-table-scroll rf-focusable" tabIndex={0} aria-label="Tenant metrics table, horizontally scrollable">
                <table className="rf-secondary-table" style={{ minWidth: "1080px" }}>
                  <thead>
                    <tr>
                      <th>Tenant</th><th>Plan</th><th>Status</th><th>Renews</th>
                      <th>Rev today</th><th>Rev 30d</th><th>Résumé/Cover mo</th>
                      <th>Invites left</th>
                      <th>Last run</th><th>Errors</th><th>Req act/fail</th><th>Est 30d $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <Row key={t.userId} t={t} defaultAllowance={settings.inviteDefaultAllowance} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
