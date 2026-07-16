"use client";

import { useTransition } from "react";
import type { CompanyReviewRow } from "@/lib/types";
import { verdictMeta } from "@/lib/companies/format";
import { redFlagLabel } from "@/lib/redFlags";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Panel";

export function CompanyCard({
  company, override,
}: {
  company: CompanyReviewRow;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const meta = verdictMeta(company.effective_verdict);
  const tags = [...(company.tech_tags ?? []), ...(company.red_flags ?? []).map(redFlagLabel)];

  const act = (verdict: "include" | "exclude") =>
    start(async () => { await override(company.id, verdict); });

  return (
    <Card className="rf-secondary-card rf-company-card" padding="sm">
      <div className="rf-company-card__header">
        <div className="rf-company-card__name">{company.name}</div>
        <Badge tone={company.effective_verdict === "include" ? "success" : company.effective_verdict === "exclude" ? "danger" : "neutral"}>{meta.label}{company.human_override ? " · you" : ""}</Badge>
        <span className="rf-company-card__meta">
          {company.ats} · {company.token}
        </span>
      </div>
      {company.reasoning && (
        <div className="rf-company-card__reason">
          {company.reasoning}
        </div>
      )}
      {tags.length > 0 && (
        <div className="rf-company-card__tags">
          {tags.map((t, i) => (
            <Badge key={`${t}-${i}`}>{t}</Badge>
          ))}
        </div>
      )}
      <div className="rf-company-card__actions">
        <Button size="sm" variant={company.effective_verdict === "include" ? "primary" : "outline"} onClick={() => act("include")} disabled={pending}>
          Include
        </Button>
        <Button size="sm" variant={company.effective_verdict === "exclude" ? "destructive" : "outline"} onClick={() => act("exclude")} disabled={pending}>
          Exclude
        </Button>
      </div>
    </Card>
  );
}
