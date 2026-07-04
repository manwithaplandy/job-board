// dashboard/app/companies/page.tsx
import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getCompanyReviews, getCompanyVerdictCounts, getDiscoveryState }
  from "@/lib/queries";
import { setCompanyOverride, refreshCompanyDiscoveryStatus } from "@/app/actions/companies";
import { CompanyList } from "@/components/companies/CompanyList";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Companies · Rolefit" };

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "40px 20px 64px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: "780px", margin: "0 auto",
};

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
    <>
      <SlimHeader current="companies" />
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
            Companies
          </h1>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#8a93a3", marginBottom: "22px" }}>
            AI-classified against your company preferences. Override any decision — it sticks.{" "}
            <a href="/profile" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
              Edit preferences →
            </a>
          </div>
          {hasAnyReviews || search ? (
            <CompanyList
              included={included} excluded={excluded} unknown={unknown}
              counts={counts} state={state} activeBucket={bucket} query={search}
              override={setCompanyOverride} refresh={refreshCompanyDiscoveryStatus} canRefresh={admin}
            />
          ) : (
            <div style={{
              background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px",
              padding: "40px 30px", textAlign: "center", color: "#5b6472",
            }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
                No companies classified yet
              </div>
              <div style={{ fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                As your board is reviewed, the companies behind those roles are classified
                against your preferences and appear here. Set your{" "}
                <a href="/profile" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
                  company preferences
                </a>{" "}
                to steer which ones are surfaced.
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
