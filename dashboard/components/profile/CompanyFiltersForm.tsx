"use client";

import { saveCompanyFilters } from "@/app/actions/profileSettings";
import { COMPANY_SIZES, INDUSTRY_LABELS } from "@/lib/companyMeta";
// Canonical red-flag labels — the same map the companies surfaces render (extended via the
// schemas.py + llm.py + redFlags.ts enum checklist). Importing it here keeps the settings
// form and the companies page from showing one category under two different names.
import { RED_FLAG_LABELS } from "@/lib/redFlags";
import {
  EMPTY_EXCLUSIONS,
  EXCLUDABLE_INDUSTRIES,
  EXCLUDABLE_RED_FLAGS,
} from "@/lib/rolefit/companyExclusions";
import type { ProfileRow } from "@/lib/types";
import { Field } from "./Field";
import { SectionFormShell } from "./SectionFormShell";

type Option = { value: string; label: string };

const SIZE_LABELS: Record<string, string> = { unknown: "Unknown" };
const sizeLabel = (v: string): string =>
  SIZE_LABELS[v] ?? `${v.replace("-", "–")} employees`;

// Industries add an explicit "Unknown" entry: the classifier can leave a company
// unclassified (industry NULL / 'unknown'), and the codec treats "unknown" as a valid
// exclusion value. Sizes already carry "unknown" as their last COMPANY_SIZES bucket.
// Red flags do NOT get a synthetic "unknown" — no such red-flag category exists
// ("unknown_unverified" already covers the unverified case), and rendering a value the
// codec would silently drop is worse than omitting it.
const INDUSTRY_OPTIONS: Option[] = [
  ...EXCLUDABLE_INDUSTRIES.map((v) => ({ value: v, label: INDUSTRY_LABELS[v] })),
  { value: "unknown", label: INDUSTRY_LABELS.unknown },
];
const SIZE_OPTIONS: Option[] = COMPANY_SIZES.map((v) => ({ value: v, label: sizeLabel(v) }));
const RED_FLAG_OPTIONS: Option[] = EXCLUDABLE_RED_FLAGS.map((v) => ({
  value: v,
  label: RED_FLAG_LABELS[v],
}));

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: Option[];
  selected: Set<string>;
}) {
  return (
    <fieldset
      className="rf-field settings-field company-filter-group"
      data-ui-contract-composite="native checkbox group keeps keyboard/AT support; layout lives in shared CSS"
    >
      <legend className="rf-field__label">{legend}</legend>
      <div className="company-filter-options">
        {options.map((option) => (
          <label key={option.value} className="company-filter-option">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.has(option.value)}
              className="rf-focusable"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CompanyFiltersForm({ profile }: { profile: ProfileRow }) {
  const exclusions = profile.company_exclusions ?? EMPTY_EXCLUSIONS;
  return (
    <SectionFormShell action={saveCompanyFilters} submitLabel="Save company filters">
      <section
        className="rf-card rf-card--lg profile-form-section"
        aria-labelledby="company-filters-heading"
      >
        <h2 id="company-filters-heading">Company filters</h2>
        <p className="rf-field__description field-description">
          Excluded companies are removed from your board and never spend your review budget.
        </p>
        <CheckboxGroup
          legend="Industries to exclude"
          name="exclude_industries"
          options={INDUSTRY_OPTIONS}
          selected={new Set(exclusions.industries)}
        />
        <CheckboxGroup
          legend="Company sizes to exclude"
          name="exclude_sizes"
          options={SIZE_OPTIONS}
          selected={new Set(exclusions.sizes)}
        />
        <CheckboxGroup
          legend="Red flags to exclude"
          name="exclude_red_flags"
          options={RED_FLAG_OPTIONS}
          selected={new Set(exclusions.redFlagCategories)}
        />
        <Field
          id="exclude_countries"
          name="exclude_countries"
          label="Countries to exclude"
          description="Country codes to exclude, comma-separated — e.g. IN, unknown"
        >
          <input
            type="text"
            defaultValue={exclusions.countries.join(", ")}
            placeholder="IN, US"
          />
        </Field>
      </section>
    </SectionFormShell>
  );
}
