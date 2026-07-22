import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listClassificationJobs, countTargets } from "@/lib/classificationJobs";
import { getStructuredModels } from "@/lib/openrouter";
import { AdminNav } from "@/components/admin/AdminNav";
import { ClassificationLauncher } from "@/components/admin/ClassificationLauncher";
import { ClassificationJobsPanel } from "@/components/admin/ClassificationJobsPanel";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/Navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Classification · Admin" };

// Global company-classification console. Style tokens mirror app/admin/invites so the
// admin surfaces read as one system. classification_jobs is service/admin-only (RLS
// deny-all, no authenticated grant) — the launcher/panel read + write through the
// serviceSql data layer and both server actions re-gate on isAdmin independently.

export default async function AdminClassificationPage() {
  const claims = await getUserClaims();
  // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
  // existence is not advertised. The launch/cancel actions re-gate independently.
  if (!isAdmin(claims)) notFound();

  const [jobs, counts, models] = await Promise.all([
    listClassificationJobs(20),
    countTargets(),
    getStructuredModels(),
  ]);

  return (
    <AppShell header={<SlimHeader current="admin" />}>
      <main className="rf-secondary-page rf-secondary-density--compact">
        <div className="rf-secondary-wrap rf-secondary-wrap--admin">
          <AdminNav active="classification" />

          <Card className="rf-secondary-stack">
            <PageHeader
              title="Company classification"
              description="Launch a global, cost-capped classification run. Facts are written once to the shared companies table — every tenant's board reads them, no per-user LLM spend."
            />
            <ClassificationLauncher models={models} counts={counts} />
          </Card>

          <Card style={{ marginTop: "var(--space-4)" }}>
            <PageHeader
              title="Runs"
              description="The most recent classification jobs. This table auto-refreshes while a run is in progress."
            />
            <ClassificationJobsPanel initial={jobs} />
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
