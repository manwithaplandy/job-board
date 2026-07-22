import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listInvites, type InviteCode } from "@/lib/invites";
import { loadAppSettings } from "@/lib/appSettings";
import { AdminNav } from "@/components/admin/AdminNav";
import { InviteGenerator } from "@/components/admin/InviteGenerator";
import { InviteSettings } from "@/components/admin/InviteSettings";
import { CopyButton } from "@/components/admin/CopyButton";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invites · Admin" };

// Style tokens mirror app/admin/tenants/page.tsx so the admin consoles read as one
// surface: this page shares the --admin wide wrap with the other consoles so its
// 7-column invite table fits without horizontal scroll on wide windows.

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
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        <span style={{ marginRight: "8px" }}>{inv.code}</span>
        <CopyButton text={inv.code} />
      </td>
      <td style={{ whiteSpace: "normal", minWidth: "140px" }}>{inv.note ?? "—"}</td>
      <td>{inv.createdBy ? (inv.creatorEmail ?? inv.createdBy.slice(0, 8)) : "Operator"}</td>
      <td>{inv.recipientEmail ?? "—"}</td>
      <td style={{ textAlign: "right", color: exhausted ? "var(--danger)" : undefined }}>
        {inv.uses}/{inv.maxUses}
      </td>
      <td style={{ color: expired ? "var(--danger)" : undefined }}>{fmtDate(inv.expiresAt)}</td>
      <td>{fmtDate(inv.createdAt)}</td>
    </tr>
  );
}

export default async function AdminInvitesPage() {
  const claims = await getUserClaims();
  // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
  // existence is not advertised. The createInviteAction re-gates independently.
  if (!isAdmin(claims)) notFound();

  const invites = await listInvites();
  const settings = await loadAppSettings();

  return (
    <AppShell header={<SlimHeader current="admin" />}>
      <main className="rf-secondary-page rf-secondary-density--compact">
        <div className="rf-secondary-wrap rf-secondary-wrap--admin">
          <AdminNav active="invites" />

          <Card className="rf-secondary-stack">
            <PageHeader title="Invites" description="Generate invite codes for the invite-only beta and track how many uses each has left." />
            <InviteGenerator />
          </Card>

          <Card style={{ marginTop: "var(--space-4)" }}>
            <PageHeader title="Invite settings" description="What invited users are comped, and how many invites each user gets." />
            <InviteSettings
              initialCompPlan={settings.inviteCompPlan}
              initialDefaultAllowance={settings.inviteDefaultAllowance}
            />
          </Card>

          <Card style={{ marginTop: "var(--space-4)" }}>
            {invites.length === 0 ? (
              <EmptyState compact title="No invite codes yet." />
            ) : (
              <div className="rf-secondary-table-scroll rf-focusable" tabIndex={0} aria-label="Invite codes table, horizontally scrollable">
                <table className="rf-secondary-table" style={{ minWidth: "860px" }}>
                  <thead>
                    <tr>
                      <th>Code</th><th>Note</th><th>Created by</th><th>Sent to</th><th>Uses</th><th>Expires</th><th>Created</th>
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
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
