// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EMPTY_EXCLUSIONS } from "@/lib/rolefit/companyExclusions";
import type { ProfileRow } from "@/lib/types";
import { CompanyFiltersForm } from "./CompanyFiltersForm";

const mocks = vi.hoisted(() => ({ saveCompanyFilters: vi.fn() }));
vi.mock("@/app/actions/profileSettings", () => ({
  saveCompanyFilters: mocks.saveCompanyFilters,
}));

afterEach(cleanup);

const profile = { company_exclusions: EMPTY_EXCLUSIONS } as ProfileRow;

describe("CompanyFiltersForm", () => {
  test("renders every facet group, the country field, and the budget copy", () => {
    const { container } = render(<CompanyFiltersForm profile={profile} />);
    expect(container.textContent).toContain(
      "Excluded companies are removed from your board and never spend your review budget.",
    );
    for (const name of [
      "exclude_industries",
      "exclude_sizes",
      "exclude_red_flags",
      "exclude_countries",
    ]) {
      expect(container.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
  });

  test("checking a facet box + save calls the action with that value and shows Changes saved", async () => {
    mocks.saveCompanyFilters.mockResolvedValue({
      status: "success",
      savedAt: "2026-07-21T00:00:00Z",
    });
    const { container } = render(<CompanyFiltersForm profile={profile} />);

    const industry = container.querySelector<HTMLInputElement>(
      'input[name="exclude_industries"][value="software_internet"]',
    );
    expect(industry).not.toBeNull();
    fireEvent.click(industry!);

    fireEvent.click(screen.getByRole("button", { name: "Save company filters" }));
    await screen.findByText("Changes saved");

    expect(mocks.saveCompanyFilters).toHaveBeenCalledTimes(1);
    const fd = mocks.saveCompanyFilters.mock.calls[0][1] as FormData;
    expect(fd.getAll("exclude_industries")).toContain("software_internet");
  });

  test("renders a field-level error for exclude_countries with aria-invalid + working skip link", async () => {
    mocks.saveCompanyFilters.mockResolvedValue({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        exclude_countries: "Unrecognized country codes: USA",
      },
    });
    const { container } = render(<CompanyFiltersForm profile={profile} />);

    const country = container.querySelector<HTMLInputElement>(
      'input[name="exclude_countries"]',
    );
    expect(country).not.toBeNull();
    // Dirty the form so Save enables, then submit.
    fireEvent.change(country!, { target: { value: "USA" } });
    fireEvent.click(screen.getByRole("button", { name: "Save company filters" }));

    // Inline error renders adjacent to the input, not only in the summary banner.
    const inlineError = await screen.findByText(
      "Unrecognized country codes: USA",
      { selector: "#exclude_countries-error" },
    );
    expect(country!.closest(".rf-field")).toContain(inlineError);

    // Field-level a11y affordances the summary banner alone can't provide.
    expect(country!.getAttribute("aria-invalid")).toBe("true");
    expect(country!.getAttribute("aria-describedby")).toContain(
      "exclude_countries-error",
    );
    expect(country!.id).toBe("exclude_countries");

    // The error-summary skip link resolves to the input's real id.
    const link = container.querySelector<HTMLAnchorElement>(
      '.section-error-summary a[href="#exclude_countries"]',
    );
    expect(link).not.toBeNull();
  });

  test("pre-checks boxes and fills the country field for already-excluded facets", () => {
    const withExclusions = {
      company_exclusions: {
        industries: ["fintech_finance"],
        countries: ["US", "IN"],
        sizes: ["5000+"],
        redFlagCategories: ["defense_military"],
      },
    } as ProfileRow;
    const { container } = render(<CompanyFiltersForm profile={withExclusions} />);

    const box = container.querySelector<HTMLInputElement>(
      'input[name="exclude_industries"][value="fintech_finance"]',
    );
    expect(box?.checked).toBe(true);
    const unchecked = container.querySelector<HTMLInputElement>(
      'input[name="exclude_industries"][value="software_internet"]',
    );
    expect(unchecked?.checked).toBe(false);
    const country = container.querySelector<HTMLInputElement>('input[name="exclude_countries"]');
    expect(country?.value).toBe("US, IN");
  });
});
