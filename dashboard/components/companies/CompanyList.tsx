"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanyBrowseRow, DiscoveryStateRow } from "@/lib/types";
import { INDUSTRY_LABELS } from "@/lib/companyMeta";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreditBanner } from "@/components/companies/CreditBanner";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { Tabs } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/SystemStates";

type Bucket = "all" | "included" | "excluded";

// Build a ?bucket=…&industry=…&q=… href, dropping empty facets so a plain bucket link stays
// clean. Preserving all three across tab clicks / search / industry keeps the surface
// stateful (a tab switch doesn't drop your industry filter or search term).
function buildHref(bucket: Bucket, industry: string, q: string): string {
  const params = new URLSearchParams({ bucket });
  if (industry) params.set("industry", industry);
  if (q.trim()) params.set("q", q.trim());
  return `?${params.toString()}`;
}

export function CompanyList({
  companies, counts, state, activeBucket, industry, override, refresh, canRefresh, query,
}: {
  companies: CompanyBrowseRow[];
  counts: { all: number; included: number; excluded: number };
  state: DiscoveryStateRow;
  activeBucket: Bucket;
  // Active server-side industry facet ("" = all industries).
  industry: string;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
  refresh: () => Promise<void>;
  // Whether the viewer may trigger the SHARED discovery-resume (admins only — the
  // server action enforces this; this just hides the button from non-admins).
  canRefresh: boolean;
  // Server-provided seed: the current ?q= term already applied to `companies` by the query.
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query);

  // Debounced SERVER search: the filter runs in the SQL query (all rows), not client-side over
  // the first 200. Navigate ~300ms after typing stops, preserving the bucket + industry facet.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (text === query) return; // already in sync with the URL
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => router.replace(buildHref(activeBucket, industry, text), { scroll: false }));
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, query, activeBucket, industry, router]);

  const q = query.trim();
  const truncated = companies.length >= 200; // hit the LIMIT — there may be more
  const bucketTotal = counts[activeBucket];
  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "included", label: "Included", n: counts.included },
    { key: "excluded", label: "Excluded", n: counts.excluded },
  ];

  const onIndustry = (next: string) =>
    startTransition(() => router.replace(buildHref(activeBucket, next, text), { scroll: false }));

  const filtered = Boolean(q) || Boolean(industry);

  return (
    <div className="rf-secondary-stack">
      <CreditBanner state={state} refresh={refresh} canRefresh={canRefresh} />
      <div className="rf-company-toolbar">
        <Tabs
          label="Company overrides"
          className="rf-company-tabs"
          items={tabs.map((t) => ({
            label: `${t.label} ${t.n}`,
            href: buildHref(t.key, industry, text),
            active: activeBucket === t.key,
          }))}
        />
        <SelectField
          label="Filter by industry"
          value={industry}
          onChange={(e) => onIndustry(e.target.value)}
        >
          <option value="">All industries</option>
          {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </SelectField>
        <TextField
          label="Search by company name"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by company name…"
          className="rf-company-search"
        />
      </div>
      {companies.length === 0 ? (
        <EmptyState
          title={filtered ? "No companies match those filters." : "No companies here yet."}
          description={filtered
            ? "Try a different industry, a different name, or clear the filters."
            : "Classified companies appear here as the corpus is classified."}
        />
      ) : (
        <>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
            {filtered
              ? `${companies.length}${truncated ? "+" : ""} ${companies.length === 1 ? "match" : "matches"}${truncated ? " — refine to narrow further" : ""}${pending ? " · searching…" : ""}`
              : truncated
                ? `Showing first ${companies.length} of ${bucketTotal} — search or filter to narrow${pending ? " · searching…" : ""}`
                : `${companies.length} ${companies.length === 1 ? "company" : "companies"}${pending ? " · searching…" : ""}`}
          </div>
          <div className="rf-secondary-card-list">
            {companies.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
          </div>
        </>
      )}
    </div>
  );
}
