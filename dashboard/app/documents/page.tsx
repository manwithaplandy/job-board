import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getProfile } from "@/lib/queries";
import { listDocuments } from "@/lib/workspaces/documents";
import { listGeneratedDocuments } from "@/lib/workspaces/generatedDocuments";
import { listResumeVersions } from "@/lib/workspaces/resumeVersions";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { DocumentsPage } from "@/components/workspaces/DocumentsPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents · Rolefit" };

// The documents library (plan Task 1.11). Every read is the signed-in user's, under
// RLS, and the render writes nothing: uploads go to /api/agent/upload, and replacing the
// résumé, restoring a version and deleting go through the documents actions.

export default async function DocumentsRoute() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const email = claims?.email ?? null;

  const [profile, versions, documents, generated] = await Promise.all([
    getProfile(userId),
    listResumeVersions(userId),
    listDocuments(userId),
    listGeneratedDocuments(userId),
  ]);

  return (
    <AppShell header={<AppHeader email={email} isAdmin={isAdmin(claims)} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader
            title="Documents"
            description="Your résumé and its earlier versions, the files you have uploaded, and what was generated for each job."
          />
          <div className="rf-workspace-live">
            <DocumentsPage
              resume={{ text: profile?.resume_text ?? null, updatedAt: profile?.updated_at ?? null }}
              versions={versions}
              documents={documents}
              generated={generated}
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
