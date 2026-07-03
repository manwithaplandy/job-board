// dashboard/app/companies/page.tsx
import type { Metadata } from "next";
import { getBoardOwnerId, getCompanyReviews, getCompanyVerdictCounts, getDiscoveryState }
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
  const userId = await getBoardOwnerId();
  if (!userId) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <a href="/" style={{ fontSize: "12.5px", fontWeight: 600, color: "#5b6472", textDecoration: "none" }}>← Back</a>
          <h1 style={{ margin: "16px 0 0", fontSize: "22px", fontWeight: 800 }}>Companies</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#8a93a3" }}>
            Set up a profile with company preferences to start discovering companies.
          </p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const rawBucket = sp.bucket;
  const bucket: Bucket = VALID_BUCKETS.includes(rawBucket as Bucket)
    ? (rawBucket as Bucket)
    : "include";

  const [companies, counts, state]: [
    CompanyReviewRow[],
    { include: number; exclude: number; unknown: number },
    DiscoveryStateRow,
  ] = await Promise.all([
    getCompanyReviews(userId, bucket),
    getCompanyVerdictCounts(userId),
    getDiscoveryState(userId),
  ]);

  const included = bucket === "include" ? companies : [];
  const excluded = bucket === "exclude" ? companies : [];
  const unknown = bucket === "unknown" ? companies : [];

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
          <CompanyList
            included={included} excluded={excluded} unknown={unknown}
            counts={counts} state={state} activeBucket={bucket}
            override={setCompanyOverride} refresh={refreshCompanyDiscoveryStatus}
          />
        </div>
      </main>
    </>
  );
}
