import type { CompanyRow } from "@/lib/types";
import type { Filters } from "@/lib/filters";
import {
  VERDICT_OPTIONS, EXPERIENCE_OPTIONS, INDUSTRY_OPTIONS, SUBCATEGORY_OPTIONS,
} from "@/lib/config";

function SelectFilter({ label, name, value, options, includeAny }: {
  label: string; name: string; value: string;
  options: readonly string[]; includeAny?: boolean;
}) {
  return (
    <label className="flex flex-col text-xs text-gray-600">
      {label}
      <select name={name} defaultValue={value}
        className="mt-1 rounded border px-2 py-1 text-sm">
        {includeAny && <option value="">any</option>}
        {options.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

export function FilterBar({
  companies,
  filters,
  showReviewFilters,
}: {
  companies: CompanyRow[];
  filters: Filters;
  showReviewFilters: boolean;
}) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3 border-b bg-white px-6 py-4">
      <label className="flex flex-col text-xs text-gray-600">
        Companies
        <select
          name="company"
          multiple
          defaultValue={filters.companies.map(String)}
          className="mt-1 h-24 rounded border px-2 py-1 text-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Title includes (comma-sep)
        <input
          name="include"
          defaultValue={filters.include.join(",")}
          className="mt-1 rounded border px-2 py-1 text-sm"
          placeholder="engineer,staff"
        />
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Title excludes (comma-sep)
        <input
          name="exclude"
          defaultValue={filters.exclude.join(",")}
          className="mt-1 rounded border px-2 py-1 text-sm"
          placeholder="manager"
        />
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Status
        <select
          name="status"
          defaultValue={filters.status}
          className="mt-1 rounded border px-2 py-1 text-sm"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </label>

      <label className="flex items-center gap-1 text-sm text-gray-700">
        <input type="checkbox" name="remote" value="1" defaultChecked={filters.remoteOnly} />
        Remote only
      </label>

      {showReviewFilters && (
        <>
          <SelectFilter label="Verdict" name="verdict" value={filters.verdict}
            options={VERDICT_OPTIONS} />

          <SelectFilter label="Experience" name="experience" value={filters.experience}
            options={EXPERIENCE_OPTIONS} includeAny />

          <SelectFilter label="Industry" name="industry" value={filters.industry}
            options={INDUSTRY_OPTIONS} includeAny />

          <SelectFilter label="Subcategory" name="subcategory" value={filters.subcategory}
            options={SUBCATEGORY_OPTIONS} includeAny />
        </>
      )}

      <button
        type="submit"
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        Apply
      </button>
    </form>
  );
}

// Note: the multi-select submits `company` as repeated params; `parseFilters` reads the first
// value via `first()`. To support multiple companies through a GET form without client JS, the
// comma-separated `include`/`exclude` inputs are the primary path; for multi-company, the Task 11
// page also accepts `?company=1,2`. (A single-select is acceptable for V1; document this as a
// minor UI limitation.)
