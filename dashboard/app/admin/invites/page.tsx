import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listInvites, type InviteCode } from "@/lib/invites";
import { AdminNav } from "@/components/admin/AdminNav";
import { InviteGenerator } from "@/components/admin/InviteGenerator";
import { CopyButton } from "@/components/admin/CopyButton";
import { SlimHeader } from "@/components/rolefit/SlimHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invites · Admin" };

// Style tokens mirror app/admin/tenants/page.tsx so the admin consoles read as one
// surface (narrower wrap — this table has 5 columns, not 11).
const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "40px 20px 64px",
};
const wrapStyle: React.CSSProperties = { maxWidth: "860px", margin: "0 auto" };
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #e7eaf0", borderRadius: "16px",
  boxShadow: "0 12px 40px rgba(15,22,35,.06)", padding: "22px 24px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#6b7480",
  textTransform: "uppercase", letterSpacing: ".4px", padding: "8px 10px",
  borderBottom: "1px solid #e7eaf0", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  fontSize: "12.5px", color: "#3a4150", padding: "9px 10px",
  borderBottom: "1px solid #f0f2f6", whiteSpace: "nowrap",
};

// UTC calendar date (YYYY-MM-DD). Deterministic on purpose: toLocaleDateString() in a
// server component would render in the server's timezone (UTC on Vercel), and ISO is
// unambiguous — it also matches how expiry is defined (UTC end-of-day) so the columns agree.
function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

// Plain (non-component) helper so the Date.now() read doesn't happen directly inside a
// component's render body — see components/analytics/PipelineDashboard's nowIso prop for
// the same house convention around impure reads during render.
function isExpired(expiresAt: Date | null): boolean {
  return expiresAt != null && new Date(expiresAt).getTime() <= Date.now();
}

function Row({ inv }: { inv: InviteCode }) {
  const exhausted = inv.uses >= inv.maxUses;
  const expired = isExpired(inv.expiresAt);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: 600,
          color: "#161d29",
        }}
      >
        <span style={{ marginRight: "8px" }}>{inv.code}</span>
        <CopyButton text={inv.code} />
      </td>
      <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: "140px" }}>{inv.note ?? "—"}</td>
      <td style={{ ...tdStyle, textAlign: "right", color: exhausted ? "#b23b3b" : undefined }}>
        {inv.uses}/{inv.maxUses}
      </td>
      <td style={{ ...tdStyle, color: expired ? "#b23b3b" : undefined }}>{fmtDate(inv.expiresAt)}</td>
      <td style={tdStyle}>{fmtDate(inv.createdAt)}</td>
    </tr>
  );
}

export default async function AdminInvitesPage() {
  const claims = await getUserClaims();
  // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
  // existence is not advertised. The createInviteAction re-gates independently.
  if (!isAdmin(claims)) notFound();

  const invites = await listInvites();

  return (
    <>
      <SlimHeader current="admin" />
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="invites" />

          <div style={{ ...cardStyle, marginBottom: "18px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "#161d29" }}>
              Invites
            </h1>
            <div style={{ fontSize: "12.5px", color: "#6b7480", marginBottom: "18px" }}>
              Generate invite codes for the invite-only beta and track how many uses each has left.
            </div>
            <InviteGenerator />
          </div>

          <div style={cardStyle}>
            {invites.length === 0 ? (
              <div style={{ fontSize: "13px", color: "#6b7480", padding: "24px 4px" }}>
                No invite codes yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "640px" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>Note</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Uses</th>
                      <th style={thStyle}>Expires</th>
                      <th style={thStyle}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <Row key={inv.code} inv={inv} />
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
