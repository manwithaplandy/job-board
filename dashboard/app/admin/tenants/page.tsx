import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getTenantMetrics, type TenantMetric } from "@/lib/tenantMetrics";
import { PLAN_LABEL } from "@/lib/entitlements";
import { AdminNav } from "@/components/admin/AdminNav";
import { SlimHeader } from "@/components/rolefit/SlimHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tenants · Admin" };

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "var(--bg-page)", color: "var(--text-primary)", padding: "40px 20px 64px",
};
const wrapStyle: React.CSSProperties = { maxWidth: "1180px", margin: "0 auto" };
const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px",
  boxShadow: "0 12px 40px rgba(15,22,35,.06)", padding: "22px 24px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: ".4px", padding: "8px 10px",
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  fontSize: "12.5px", color: "var(--text-primary)", padding: "9px 10px",
  borderBottom: "1px solid var(--bg-muted)", whiteSpace: "nowrap",
};

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function Row({ t }: { t: TenantMetric }) {
  return (
    <tr>
      <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: "160px" }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.email ?? "—"}</div>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{t.userId.slice(0, 8)}</div>
      </td>
      <td style={tdStyle}>
        {t.plan ? PLAN_LABEL[t.plan] : "None"}
        {t.plan && t.invited && !t.subStatus && (
          <span style={{ color: "var(--accent)", fontSize: "10.5px" }}> comped</span>
        )}
      </td>
      <td style={tdStyle}>{t.subStatus ?? "—"}</td>
      <td style={tdStyle}>{fmtDate(t.currentPeriodEnd)}</td>
      <td style={{ ...tdStyle, textAlign: "right" }}>{t.reviewsToday.toLocaleString()}</td>
      <td style={{ ...tdStyle, textAlign: "right" }}>{t.reviews30d.toLocaleString()}</td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {t.resumeMonth} / {t.coverMonth}
      </td>
      <td style={tdStyle}>{fmtDate(t.lastRunAt)}</td>
      <td style={{ ...tdStyle, textAlign: "right", color: (t.lastRunErrors ?? 0) > 0 ? "var(--danger)" : undefined }}>
        {t.lastRunErrors ?? "—"}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {t.activeRequests}
        {t.failedRequests > 0 && <span style={{ color: "var(--danger)" }}> / {t.failedRequests}✗</span>}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>${t.estCost30dUsd.toFixed(2)}</td>
    </tr>
  );
}

export default async function AdminTenantsPage() {
  const claims = await getUserClaims();
  // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
  // existence is not advertised.
  if (!isAdmin(claims)) notFound();

  const tenants = await getTenantMetrics();

  return (
    <>
      <SlimHeader current="admin" />
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="tenants" />
          <div style={cardStyle}>
            <h1 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
              Tenants
            </h1>
            <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "18px" }}>
              Per-tenant plan, usage, pipeline health, and an estimated 30-day review cost.
            </div>

            {tenants.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "24px 4px" }}>
                No tenants yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "980px" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Tenant</th>
                      <th style={thStyle}>Plan</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Renews</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Rev today</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Rev 30d</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Résumé/Cover mo</th>
                      <th style={thStyle}>Last run</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Errors</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Req act/fail</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Est 30d $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <Row key={t.userId} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
