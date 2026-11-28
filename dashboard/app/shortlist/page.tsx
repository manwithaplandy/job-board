import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { emptyGathered } from "@/lib/agent/gathered";
import { searchJobs } from "@/lib/agent/tools/read";
import type { ToolCtx } from "@/lib/agent/tools";
import { listAgentMarkers } from "@/lib/workspaces/agentMarkers";
import { listTrackedStages } from "@/lib/workspaces/applications";
import { listShortlist } from "@/lib/workspaces/shortlist";
import { fmtPay } from "@/lib/rolefit/fit";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { ShortlistBoard, type BrowseFilters, type BrowseRow } from "@/components/workspaces/ShortlistBoard";
import { ActivityPanel } from "@/components/workspaces/ActivityPanel";
import { readActivity } from "@/lib/workspaces/activity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shortlist · Rolefit" };

// The shortlist workspace (plan Task 1.5). Every read is the signed-in user's, under
// RLS. The render writes nothing: preview deployments read the production database, so
// suggestions are filled only by refreshSuggestedAction (the "Refresh suggestions"
// button) and, later, by a finished review.

const BROWSE_LIMIT = 25;

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function parseFilters(sp: Record<string, string | string[] | undefined>): BrowseFilters {
  const verdict = one(sp.verdict);
  const minFitRaw = one(sp.minFit);
  const minFit = minFitRaw !== null && minFitRaw.trim() !== "" ? Number(minFitRaw) : Number.NaN;
  return {
    verdict: verdict === "approve" || verdict === "deny" ? verdict : null,
    minFit: Number.isFinite(minFit) && minFit >= 0 && minFit <= 100 ? Math.round(minFit) : null,
    remote: one(sp.remote) === "1",
  };
}

/** A read-only context for the browse query (the agent's search_jobs reader, run by the page). */
function browseCtx(userId: string, email: string | null): ToolCtx {
  return {
    userId,
    email,
    threadId: null,
    runId: "00000000-0000-0000-0000-000000000000",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 0 },
    views: { used: 0 }, fromView: false,
  };
}

async function readBrowse(userId: string, email: string | null, filters: BrowseFilters): Promise<BrowseRow[] | null> {
  try {
    const result = await searchJobs(browseCtx(userId, email), {
      verdict: filters.verdict ?? undefined,
      minFit: filters.minFit ?? undefined,
      remoteOnly: filters.remote,
      sort: "fit",
      limit: BROWSE_LIMIT,
    });
    return result.rows.map((r) => ({
      jobId: r.jobId,
      title: r.title,
      company: r.company,
      url: r.url,
      fitScore: r.fitScore,
      pay: fmtPay({ pay_min: r.payMin, pay_max: r.payMax, pay_currency: r.payCurrency, pay_period: r.payPeriod }),
      ageDays: r.ageDays,
    }));
  } catch {
    return null;
  }
}

export default async function ShortlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const filters = parseFilters(await searchParams);
  const email = claims?.email ?? null;

  const [rows, markers, browse, stages, activity] = await Promise.all([
    listShortlist(userId),
    listAgentMarkers(userId, "shortlist.set"),
    readBrowse(userId, email, filters),
    listTrackedStages(userId),
    readActivity(userId),
  ]);

  return (
    <AppShell header={<AppHeader current="shortlist" email={email} isAdmin={isAdmin(claims)} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader
            title="Shortlist"
            description="Triage your reviewed jobs: shortlist, save for later, or skip with a reason."
          />
          <div className="rf-workspace-live">
            <ShortlistBoard
              rows={rows}
              markers={markers}
              stages={stages}
              browse={browse ?? []}
              filters={filters}
              browseError={browse === null}
            />
          </div>
          <ActivityPanel items={activity} />
        </div>
      </main>
    </AppShell>
  );
}
