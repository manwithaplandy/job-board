import { ButtonLink } from "@/components/ui/Button";
import type { CompanyExclusions } from "@/lib/rolefit/companyExclusions";

function count(n: number, one: string, many: string): string | null {
  return n === 0 ? null : `${n} ${n === 1 ? one : many}`;
}

/**
 * The structured search settings beside the memo (plan Task 1.8). They stay columns
 * with their own writers: the job-preferences page edits them through its existing
 * saveJobPreferences and saveCompanyFilters actions, so this shows them and links there.
 */
export function MemoStructured({ locations, exclusions }: { locations: string[]; exclusions: CompanyExclusions }) {
  const excluded = [
    count(exclusions.industries.length, "industry", "industries"),
    count(exclusions.sizes.length, "company size", "company sizes"),
    count(exclusions.redFlagCategories.length, "red-flag category", "red-flag categories"),
    count(exclusions.countries.length, "country", "countries"),
  ].filter((s): s is string => s !== null);
  return (
    <div className="rf-ws-structured">
      <dl className="rf-ws-row__brief">
        <div>
          <dt>Locations</dt>
          <dd>{locations.length > 0 ? locations.join("; ") : "None chosen yet"}</dd>
        </div>
        <div>
          <dt>Company filters</dt>
          <dd>{excluded.length > 0 ? `${excluded.join(", ")} excluded` : "No company filters"}</dd>
        </div>
      </dl>
      <div className="rf-ws-row__actions">
        <ButtonLink href="/profile/job-preferences" variant="outline" size="sm">
          Edit locations and company filters
        </ButtonLink>
      </div>
    </div>
  );
}
