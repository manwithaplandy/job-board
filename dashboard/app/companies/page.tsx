// dashboard/app/companies/page.tsx
import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getCompaniesBrowse, getCompanyOverrideCounts, getDiscoveryState }
  from "@/lib/queries";
import { INDUSTRY_LABELS } from "@/lib/companyMeta";
import { setCompanyOverride, refreshCompanyDiscoveryStatus } from "@/app/actions/companies";
import { CompanyList } from "@/components/companies/CompanyList";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import type { CompanyBrowseRow, DiscoveryStateRow } from "@/lib/types";
import { PageHeader } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Companies · Rolefit" };

const VALID_BUCKETS = ["all", "included", "excluded"] as const;
type Bucket = typeof VALID_BUCKETS[number];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Viewer-scoped: the browse surface shows the GLOBAL company corpus with the signed-in
  // user's own overrides (company_overrides) layered on. Anonymous visitors → /login.
  const userId = await requireUserId();
  // Only admins may trigger the shared discovery-resume (unhalt) or launch classification.
  const admin = isAdmin(await getUserClaims());

  const sp = await searchParams;
  const rawBucket = sp.bucket;
  const bucket: Bucket = VALID_BUCKETS.includes(rawBucket as Bucket)
    ? (rawBucket as Bucket)
    : "all";

  const rawQ = sp.q;
  const search = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "").trim();

  // Industry facet: accept only a known taxonomy key (incl. "unknown"); anything else → all.
  // Object.hasOwn (not `in`) so prototype keys like "constructor"/"toString" can't slip
  // through user-controlled URL input.
  const rawIndustry = Array.isArray(sp.industry) ? sp.industry[0] : sp.industry ?? "";
  const industry = Object.hasOwn(INDUSTRY_LABELS, rawIndustry) ? rawIndustry : "";

  const [companies, counts, state]: [
    CompanyBrowseRow[],
    { all: number; included: number; excluded: number },
    DiscoveryStateRow,
  ] = await Promise.all([
    getCompaniesBrowse(userId, { bucket, industry: industry || undefined, q: search || undefined, limit: 200 }),
    getCompanyOverrideCounts(userId),
    getDiscoveryState(userId),
  ]);

  // Empty corpus (fresh DB, nothing classified/ingested yet): show an explanatory empty
  // state instead of empty tabs. Admins get a direct link to launch a classification job.
  const hasAnyCompanies = counts.all > 0;

  return (
    <AppShell header={<SlimHeader current="companies" />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap">
          <PageHeader className="rf-secondary-header" title="Companies" description={<>
            Every company in the corpus, with your own include/exclude overrides. Override any
            company — it sticks and re-scopes your board.{" "}
            <a href="/profile" className="rf-secondary-link">
              Edit preferences
            </a>
          </>} />
          {hasAnyCompanies ? (
            <CompanyList
              companies={companies} counts={counts} state={state}
              activeBucket={bucket} industry={industry} query={search}
              override={setCompanyOverride} refresh={refreshCompanyDiscoveryStatus} canRefresh={admin}
            />
          ) : (
            <EmptyState
              className="rf-secondary-empty"
              title="No companies yet"
              description={admin ? <>
                The classification corpus is empty.{" "}
                <a href="/admin/classification" className="rf-secondary-link">
                  Run a classification job
                </a>{" "}
                to populate it.
              </> : <>
                Companies appear here as the corpus is classified. Set your{" "}
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
