"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreditBanner } from "@/components/companies/CreditBanner";

type Bucket = "include" | "exclude" | "unknown";

export function CompanyList({
  included, excluded, unknown, counts, state, activeBucket, override, refresh, canRefresh, query,
}: {
  included: CompanyReviewRow[];
  excluded: CompanyReviewRow[];
  unknown: CompanyReviewRow[];
  counts: { include: number; exclude: number; unknown: number };
  state: DiscoveryStateRow;
  activeBucket: Bucket;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
  refresh: () => Promise<void>;
  // Whether the viewer may trigger the SHARED discovery-resume (admins only — the
  // server action enforces this; this just hides the button from non-admins).
  canRefresh: boolean;
  // Server-provided seed: the current ?q= term already applied to `rows` by the query.
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query);
  const rows = activeBucket === "include" ? included : activeBucket === "exclude" ? excluded : unknown;
  const bucketTotal = counts[activeBucket];

  // Debounced SERVER search: the filter runs in the SQL query (all rows), not client-side over
  // the first 200. Navigate to ?bucket=…&q=… ~300ms after typing stops; the page re-queries.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (text === query) return; // already in sync with the URL
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams({ bucket: activeBucket });
      if (text.trim()) params.set("q", text.trim());
      startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, query, activeBucket, router]);

  const q = query.trim();
  const truncated = rows.length >= 200; // hit the LIMIT — there may be more
  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "include", label: "Included", n: counts.include },
    { key: "exclude", label: "Excluded", n: counts.exclude },
    { key: "unknown", label: "Unknown", n: counts.unknown },
  ];

  return (
    <div>
      <CreditBanner state={state} refresh={refresh} canRefresh={canRefresh} />
      <div style={{ display: "inline-flex", background: "var(--bg-muted)", borderRadius: "10px",
        padding: "3px", marginBottom: "16px" }}>
        {tabs.map((t) => {
          const active = activeBucket === t.key;
          return (
            // Switching bucket drops ?q= (search clears) — intentional; these links omit it.
            <a key={t.key} href={`?bucket=${t.key}`} aria-current={active ? "page" : undefined} style={{
              textDecoration: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              padding: "8px 16px", borderRadius: "8px",
              background: active ? "var(--bg-surface)" : "transparent",
              // Inactive tabs sit on the #eef1f5 tab bar, where #6b7480 is only 4.18:1 —
              // below AA for 13px text. Use the darker #5b6472 (5.28:1) there; the active
              // tab keeps its dark label on white. The count matches the label so they
              // don't split contrast on the inactive tab.
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: active ? "var(--shadow-toggle)" : "none",
            }}>
              {t.label} <span style={{ color: active ? "var(--text-secondary)" : "var(--text-secondary)" }}>{t.n}</span>
            </a>
          );
        })}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search by company name…"
        aria-label="Search by company name"
        className="rf-focusable"
        style={{
          display: "block", width: "100%", maxWidth: "320px", marginBottom: "10px",
          padding: "8px 12px", fontSize: "13px", color: "var(--text-primary)", background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "8px", outline: "none",
        }}
      />
      {rows.length === 0 ? (
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "20px 0" }}>
          {q ? `No companies match “${q}”.` : "No companies here yet."}
        </div>
      ) : (
        <>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
            {q
              ? `${rows.length}${truncated ? "+" : ""} ${rows.length === 1 ? "match" : "matches"} for “${q}”${truncated ? " — refine to narrow further" : ""}${pending ? " · searching…" : ""}`
              : truncated
                ? `Showing first ${rows.length} of ${bucketTotal} — search by name to find any company${pending ? " · searching…" : ""}`
                : `${rows.length} ${rows.length === 1 ? "company" : "companies"}${pending ? " · searching…" : ""}`}
          </div>
          {rows.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
        </>
      )}
    </div>
  );
}
