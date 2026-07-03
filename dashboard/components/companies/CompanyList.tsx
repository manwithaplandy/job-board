"use client";

import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreditBanner } from "@/components/companies/CreditBanner";

type Bucket = "include" | "exclude" | "unknown";

export function CompanyList({
  included, excluded, unknown, counts, state, activeBucket, override, refresh,
}: {
  included: CompanyReviewRow[];
  excluded: CompanyReviewRow[];
  unknown: CompanyReviewRow[];
  counts: { include: number; exclude: number; unknown: number };
  state: DiscoveryStateRow;
  activeBucket: Bucket;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const rows = activeBucket === "include" ? included : activeBucket === "exclude" ? excluded : unknown;
  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "include", label: "Included", n: counts.include },
    { key: "exclude", label: "Excluded", n: counts.exclude },
    { key: "unknown", label: "Unknown", n: counts.unknown },
  ];

  return (
    <div>
      <CreditBanner state={state} refresh={refresh} />
      <div style={{ display: "inline-flex", background: "#eef1f5", borderRadius: "10px",
        padding: "3px", marginBottom: "16px" }}>
        {tabs.map((t) => {
          const active = activeBucket === t.key;
          return (
            <a key={t.key} href={`?bucket=${t.key}`} style={{
              textDecoration: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              padding: "8px 16px", borderRadius: "8px",
              background: active ? "#fff" : "transparent",
              color: active ? "#1f2430" : "#6b7480",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}>
              {t.label} <span style={{ color: "#9aa3b0" }}>{t.n}</span>
            </a>
          );
        })}
      </div>
      {rows.length === 0
        ? <div style={{ fontSize: "13px", color: "#9aa3b0", padding: "20px 0" }}>No companies here yet.</div>
        : rows.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
    </div>
  );
}
