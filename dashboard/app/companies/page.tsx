// dashboard/app/companies/page.tsx
import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getCompanyReviews, getCompanyVerdictCounts, getDiscoveryState }
  from "@/lib/queries";
import { setCompanyOverride, refreshCompanyDiscoveryStatus } from "@/app/actions/companies";
import { CompanyList } from "@/components/companies/CompanyList";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";
import { PageHeader } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Companies · Rolefit" };

const VALID_BUCKETS = ["include", "exclude", "unknown"] as const;
type Bucket = typeof VALID_BUCKETS[number];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Viewer-scoped: the companies board shows the signed-in user's own
  // company_reviews. Anonymous visitors are redirected to /login.
  const userId = await requireUserId();
  // Only admins may trigger the shared discovery-resume (unhalt); gate the button.
  const admin = isAdmin(await getUserClaims());

  const sp = await searchParams;
  const rawBucket = sp.bucket;
  const bucket: Bucket = VALID_BUCKETS.includes(rawBucket as Bucket)
    ? (rawBucket as Bucket)
    : "include";

  const rawQ = sp.q;
  const search = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "").trim();

  const [companies, counts, state]: [
    CompanyReviewRow[],
    { include: number; exclude: number; unknown: number },
    DiscoveryStateRow,
  ] = await Promise.all([
    getCompanyReviews(userId, bucket, 200, search),
    getCompanyVerdictCounts(userId),
    getDiscoveryState(userId),
  ]);

  const included = bucket === "include" ? companies : [];
  const excluded = bucket === "exclude" ? companies : [];
  const unknown = bucket === "unknown" ? companies : [];

  // A brand-new account has no company reviews yet (T6 first-run polish). Show an
  // explanatory empty state — not an empty table — matching the board's tone.
  const hasAnyReviews = counts.include + counts.exclude + counts.unknown > 0;

  return (
    <AppShell header={<SlimHeader current="companies" />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap">
          <PageHeader className="rf-secondary-header" title="Companies" description={<>
            AI-classified against your company preferences. Override any decision — it sticks.{" "}
            <a href="/profile" className="rf-secondary-link">
              Edit preferences
            </a>
          </>} />
          {hasAnyReviews || search ? (
            <CompanyList
              included={included} excluded={excluded} unknown={unknown}
              counts={counts} state={state} activeBucket={bucket} query={search}
              override={setCompanyOverride} refresh={refreshCompanyDiscoveryStatus} canRefresh={admin}
            />
          ) : (
            <EmptyState
              className="rf-secondary-empty"
              title="No companies classified yet"
              description={<>
                As your board is reviewed, the companies behind those roles are classified
                against your preferences and appear here. Set your{" "}
                <a href="/profile" className="rf-secondary-link">
                  company preferences
                </a>{" "}
                to steer which ones are surfaced.
              </>}
            />
          )}
        </div>
      </main>
    </AppShell>
  );
}
