"use client";

import { useState } from "react";
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
  const [query, setQuery] = useState("");
  const rows = activeBucket === "include" ? included : activeBucket === "exclude" ? excluded : unknown;
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((c) => c.name.toLowerCase().includes(q)) : rows;
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
            <a key={t.key} href={`?bucket=${t.key}`} aria-current={active ? "page" : undefined} style={{
              textDecoration: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              padding: "8px 16px", borderRadius: "8px",
              background: active ? "#fff" : "transparent",
              // Inactive tabs sit on the #eef1f5 tab bar, where #6b7480 is only 4.18:1 —
              // below AA for 13px text. Use the darker #5b6472 (5.28:1) there; the active
              // tab keeps its dark label on white. The count matches the label so they
              // don't split contrast on the inactive tab.
              color: active ? "#1f2430" : "#5b6472",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}>
              {t.label} <span style={{ color: active ? "#6b7480" : "#5b6472" }}>{t.n}</span>
            </a>
          );
        })}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by company name…"
        aria-label="Filter by company name"
        className="rf-focusable"
        style={{
          display: "block", width: "100%", maxWidth: "320px", marginBottom: "16px",
          padding: "8px 12px", fontSize: "13px", color: "#1f2430", background: "#fff",
          border: "1px solid #dce1e8", borderRadius: "8px", outline: "none",
        }}
      />
      {filtered.length === 0
        ? <div style={{ fontSize: "13px", color: "#6b7480", padding: "20px 0" }}>
            {q ? "No companies match your filter." : "No companies here yet."}
          </div>
        : filtered.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
    </div>
  );
}
