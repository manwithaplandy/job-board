import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listAgentMarkers } from "@/lib/workspaces/agentMarkers";
import { listApplications } from "@/lib/workspaces/applications";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { TrackerBoard } from "@/components/workspaces/TrackerBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Applications · Rolefit" };

// The application tracker (plan Task 1.6). Every read is the signed-in user's, under
// RLS, and the render writes nothing; moves, notes and dates go through the tracker's
// server actions from the client rows.

export default async function ApplicationsPage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const email = claims?.email ?? null;

  const [rows, markers] = await Promise.all([listApplications(userId), listAgentMarkers(userId, "application.set_stage")]);

  return (
    <AppShell header={<AppHeader email={email} isAdmin={isAdmin(claims)} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader
            title="Applications"
            description="Track where each application stands, with its history, notes and next step."
          />
          <div className="rf-workspace-live">
            <TrackerBoard rows={rows} markers={markers} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
