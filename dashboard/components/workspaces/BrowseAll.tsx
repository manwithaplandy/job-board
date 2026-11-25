"use client";

import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { Badge } from "@/components/ui/Panel";
import { Alert } from "@/components/ui/SystemStates";
import { JobLink } from "@/components/workspaces/JobLink";
import { ageLabel, fitLabel } from "@/components/workspaces/ShortlistRowCard";

/** One reviewed, open job in the reduced Browse all list. */
export interface BrowseRow {
  jobId: string;
  title: string;
  company: string;
  url: string;
  fitScore: number | null;
  pay: string | null;
  ageDays: number;
}

export interface BrowseFilters {
  verdict: "approve" | "deny" | null;
  minFit: number | null;
  remote: boolean;
}

/**
 * Every reviewed, open job (the board's open test and company gate), as a reduced list:
 * title, company, fit, pay and age. The filters are a plain GET form, so the page
 * re-reads with them and writes nothing.
 */
export function BrowseAll({
  rows,
  filters,
  error,
  onShortlist,
  pending,
}: {
  rows: BrowseRow[];
  filters: BrowseFilters;
  error: boolean;
  onShortlist: (jobId: string) => void;
  pending: boolean;
}) {
  return (
    <div className="rf-ws-browse">
      <form className="rf-ws-browse__filters" method="get" action="/shortlist">
        <SelectField id="browse-verdict" name="verdict" label="Verdict" defaultValue={filters.verdict ?? ""}>
          <option value="">Any</option>
          <option value="approve">Approved</option>
          <option value="deny">Denied</option>
        </SelectField>
        <TextField
          id="browse-min-fit"
          name="minFit"
          label="Minimum fit"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          defaultValue={filters.minFit === null ? "" : String(filters.minFit)}
        />
        <SelectField id="browse-remote" name="remote" label="Arrangement" defaultValue={filters.remote ? "1" : ""}>
          <option value="">Any</option>
          <option value="1">Remote only</option>
        </SelectField>
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>
      {error ? (
        <Alert tone="warning">Browse all could not load. Reload the page to try again.</Alert>
      ) : rows.length === 0 ? (
        <p className="rf-ws-section__empty">No reviewed jobs match. Loosen the filters to see more.</p>
      ) : (
        <div className="rf-ws-list">
          {rows.map((row) => {
            const fit = fitLabel(row.fitScore);
            const titleId = `ws-browse-${row.jobId.replace(/[^\w-]/g, "-")}`;
            return (
              <article key={row.jobId} className="rf-ws-row rf-ws-row--browse" aria-labelledby={titleId}>
                <div className="rf-ws-row__head">
                  <div className="rf-ws-row__title">
                    <JobLink id={titleId} url={row.url}>
                      {row.title}
                    </JobLink>
                    <p className="rf-ws-row__meta">
                      <span>{row.company}</span>
                      {row.pay && <span>{row.pay}</span>}
                      <span>{ageLabel(row.ageDays)}</span>
                    </p>
                  </div>
                  <div className="rf-ws-row__badges">{fit && <Badge tone="accent">{fit}</Badge>}</div>
                </div>
                <div className="rf-ws-row__actions">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => onShortlist(row.jobId)}>
                    Add to shortlist
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
