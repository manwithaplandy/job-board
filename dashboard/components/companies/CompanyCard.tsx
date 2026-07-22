"use client";

import { useTransition } from "react";
import type { CompanyBrowseRow } from "@/lib/types";
import { redFlagLabel } from "@/lib/redFlags";
import { INDUSTRY_LABELS, countryLabel } from "@/lib/companyMeta";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Panel";

// A card on the /companies browse surface. The facts (industry / size / country / red flags
// / tech tags / about) are the GLOBAL company classification; the Include/Exclude state is
// the VIEWER's own override (override_verdict, null = no override yet).
export function CompanyCard({
  company, override,
}: {
  company: CompanyBrowseRow;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const verdict = company.override_verdict; // "include" | "exclude" | null — the viewer's own
  const classified = company.classified_at != null;

  const industryLabel = company.industry
    ? INDUSTRY_LABELS[company.industry as keyof typeof INDUSTRY_LABELS] ?? company.industry
    : null;
  const facts = [
    industryLabel,
    company.size && company.size !== "unknown" ? company.size : null,
    // Omit the country sentinel like the size sentinel — seeded rows start hq_country
    // 'unknown', and a bare "Unknown" badge conveys nothing (and collides with the
    // industry "Unknown" label).
    company.hq_country && company.hq_country !== "unknown" ? countryLabel(company.hq_country) : null,
  ].filter((f): f is string => Boolean(f));

  const act = (v: "include" | "exclude") =>
    start(async () => { await override(company.id, v); });

  return (
    <Card className="rf-secondary-card rf-company-card" padding="sm">
      <div className="rf-company-card__header">
        <div className="rf-company-card__name">{company.name}</div>
        {verdict && (
          <Badge tone={verdict === "include" ? "success" : "danger"}>
            {verdict === "include" ? "Included" : "Excluded"} · you
          </Badge>
        )}
        {!classified && <Badge tone="warning">Not yet classified</Badge>}
        <span className="rf-company-card__meta">
          {company.ats} · {company.token}
        </span>
      </div>
      {(facts.length > 0 || (company.red_flags?.length ?? 0) > 0) && (
        <div className="rf-company-card__tags">
          {facts.map((f, i) => (
            <Badge key={`fact-${i}`} tone="accent">{f}</Badge>
          ))}
          {(company.red_flags ?? []).map((rf, i) => (
            <Badge key={`flag-${i}`} tone="danger">{redFlagLabel(rf)}</Badge>
          ))}
        </div>
      )}
      {company.about && (
        <div className="rf-company-card__reason">
          {company.about}
        </div>
      )}
      {(company.tech_tags?.length ?? 0) > 0 && (
        <div className="rf-company-card__tags">
          {(company.tech_tags ?? []).map((t, i) => (
            <Badge key={`tag-${i}`}>{t}</Badge>
          ))}
        </div>
      )}
      <div className="rf-company-card__actions">
        <Button size="sm" variant={verdict === "include" ? "primary" : "outline"} onClick={() => act("include")} disabled={pending}>
          Include
        </Button>
        <Button size="sm" variant={verdict === "exclude" ? "destructive" : "outline"} onClick={() => act("exclude")} disabled={pending}>
          Exclude
        </Button>
      </div>
    </Card>
  );
}
