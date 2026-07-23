// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilterBar, type FilterBarProps } from "./FilterBar";

// The collapsed mobile summary is CSS-shown only ≤760px, but its state machine (the
// disclosure toggle + the active-facet count) is viewport-independent, so it's fully
// exercisable in jsdom. These tests pin: collapsed-by-default, the toggle's ARIA wiring
// (aria-expanded / aria-controls → strip id), and the active-facet count derivation
// (facets count; sort + the Active/Applied view never do).

const noop = () => {};

function baseProps(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    totalInView: 6,
    facets: { categories: {}, locations: {}, sources: {}, industries: {}, sizes: {}, countries: {} },
    cats: [],
    locs: [],
    sources: [],
    industries: [],
    sizes: [],
    countries: [],
    remote: "all",
    minFit: 0,
    payMin: 0,
    payMax: null,
    payIncludeUndisclosed: true,
    sort: "match",
    openMenu: null,
    visibleCount: 4,
    view: "all",
    appliedCount: 0,
    rejectedCount: 0,
    onToggleView: noop,
    onToggleMenu: noop,
    onToggleCat: noop,
    onToggleLoc: noop,
    onToggleSource: noop,
    onToggleIndustry: noop,
    onToggleSize: noop,
    onToggleCountry: noop,
    onSetRemote: noop,
    onSetMinFit: noop,
    onSetPayRange: noop,
    onTogglePayUndisclosed: noop,
    onSetSort: noop,
    ...overrides,
  };
}

const toggle = () => screen.getByRole("button", { name: /^Filters/ });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FilterBar — collapsed mobile summary", () => {
  test("renders collapsed by default: toggle aria-expanded=false, no data-filters-open", () => {
    const { container } = render(<FilterBar {...baseProps()} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".rf-board-filters")?.hasAttribute("data-filters-open")).toBe(false);
  });

  test("aria-controls points at the strip's id", () => {
    const { container } = render(<FilterBar {...baseProps()} />);
    const stripId = container.querySelector(".rf-board-filter-strip")?.id;
    expect(stripId).toBeTruthy();
    expect(toggle().getAttribute("aria-controls")).toBe(stripId);
  });

  test("clicking the toggle flips aria-expanded and the container's data-filters-open", () => {
    const { container } = render(<FilterBar {...baseProps()} />);
    const el = () => container.querySelector(".rf-board-filters")!;

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(el().hasAttribute("data-filters-open")).toBe(true);

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(el().hasAttribute("data-filters-open")).toBe(false);
  });

  test("the roles count is mirrored in the summary row", () => {
    const { container } = render(<FilterBar {...baseProps({ visibleCount: 4, totalInView: 6 })} />);
    expect(container.querySelector(".rf-board-filter-summary__count")?.textContent).toBe("4 of 6 roles");
  });
});

describe("FilterBar — active-facet count badge", () => {
  test("no active facets → bare 'Filters', no count", () => {
    render(<FilterBar {...baseProps()} />);
    expect(toggle().textContent).toBe("Filters");
  });

  test("a single active facet → '· 1'", () => {
    render(<FilterBar {...baseProps({ cats: ["engineering"] })} />);
    expect(toggle().textContent).toContain("Filters · 1");
  });

  test("category + remote → 2 (each active facet counts once)", () => {
    render(<FilterBar {...baseProps({ cats: ["engineering"], remote: "remote" })} />);
    expect(toggle().textContent).toContain("Filters · 2");
  });

  test("every facet kind is counted, none double-counted", () => {
    render(
      <FilterBar
        {...baseProps({
          cats: ["engineering", "design"], // 1 facet (multi-select ≠ multi-count)
          locs: ["Phoenix"],
          sources: ["greenhouse"],
          industries: ["fintech"],
          sizes: ["11-50"],
          countries: ["US"],
          payMin: 100,
          minFit: 75,
          remote: "hybrid",
        })}
      />,
    );
    // cats, locs, sources, industries, sizes, countries, pay, match, remote = 9
    expect(toggle().textContent).toContain("Filters · 9");
  });

  test("changing sort or the Active/Applied view does NOT change the count", () => {
    render(
      <FilterBar
        {...baseProps({ cats: ["engineering"], sort: "pay", view: "applied", appliedCount: 3 })}
      />,
    );
    // Only the one active facet is counted; sort=pay and view=applied are ignored.
    expect(toggle().textContent).toContain("Filters · 1");
  });
});
