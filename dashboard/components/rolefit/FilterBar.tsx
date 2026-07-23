"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { atsLabel } from "@/lib/rolefit/ats";
import { COMPANY_SIZES, countryLabel, INDUSTRY_LABELS, type CompanySize } from "@/lib/companyMeta";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/Navigation";
import { fmtPayRange } from "@/lib/rolefit/filter";
import { PayRangeSlider } from "@/components/rolefit/PayRangeSlider";

// Static filter definitions — mirrored from reference design renderVals()
const MATCH_DEFS: [number, string][] = [
  [0, "Any match"],
  [60, "60%+"],
  [75, "75%+"],
  [90, "90%+"],
];

const SORT_DEFS: [BoardFilterState["sort"], string][] = [
  ["match", "Best match"],
  ["pay", "Highest pay"],
  ["newest", "Newest"],
  ["az", "Company A–Z"],
];

const REMOTE_DEFS: [BoardFilterState["remote"], string][] = [
  ["all", "All"],
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "Onsite"],
];

// Reset applied to <button> menu options so they carry the row styling without the
// browser's default button chrome. Options are removed from the tab order (tabIndex
// -1) and driven by roving focus from the listbox keydown handler below.
const optionReset: CSSProperties = {
  appearance: "none",
  width: "100%",
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  border: "none",
  background: "transparent",
};

function optionEls(el: HTMLElement | null): HTMLButtonElement[] {
  if (!el) return [];
  return Array.from(el.querySelectorAll<HTMLButtonElement>('[role="option"]'));
}

// A filter trigger + its listbox popup with full keyboard + screen-reader support:
// trigger carries aria-haspopup/aria-expanded; the popup is a role="listbox" whose
// role="option" children are reached with Arrow/Home/End (roving focus), selected
// with Enter/Space (native button click), and dismissed with Escape (focus returns
// to the trigger). Outside-click close stays handled by the board's document listener.
function FilterMenu({
  name,
  open,
  onToggle,
  trigger,
  triggerStyle,
  ariaLabel,
  multiselect = false,
  variant = "listbox",
  listboxStyle,
  align = "start",
  mobileAlign = align,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: (name: string) => void;
  trigger: ReactNode;
  triggerStyle: CSSProperties;
  ariaLabel: string;
  multiselect?: boolean;
  variant?: "listbox" | "dialog";
  listboxStyle: CSSProperties;
  align?: "start" | "end";
  mobileAlign?: "start" | "end";
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDialog = variant === "dialog";

  // On open, move focus to the selected option (listbox) or the first focusable (dialog).
  useEffect(() => {
    if (!open) return;
    if (isDialog) {
      listRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus();
      return;
    }
    const opts = optionEls(listRef.current);
    const sel = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
    opts[sel >= 0 ? sel : 0]?.focus();
  }, [open, isDialog]);

  // Radio-style listbox close returns focus to the trigger when the focused option unmounts.
  const prevOpen = useRef(open);
  useEffect(() => {
    const wasOpen = prevOpen.current;
    prevOpen.current = open;
    if (wasOpen && !open && document.activeElement === document.body) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const opts = optionEls(listRef.current);
    if (opts.length === 0) return;
    const cur = opts.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); opts[(cur + 1 + opts.length) % opts.length]?.focus(); break;
      case "ArrowUp": e.preventDefault(); opts[(cur - 1 + opts.length) % opts.length]?.focus(); break;
      case "Home": e.preventDefault(); opts[0]?.focus(); break;
      case "End": e.preventDefault(); opts[opts.length - 1]?.focus(); break;
      case "Escape": e.preventDefault(); onToggle(name); triggerRef.current?.focus(); break;
      case "Tab": onToggle(name); break;
    }
  };

  // Dialog popover: Escape closes + refocuses the trigger; Tab moves natively among the
  // inner controls. Closing on Tab-out is handled by onDialogBlur below.
  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onToggle(name); triggerRef.current?.focus(); }
  };
  // Close when focus lands on a focusable element outside this menu (e.g. Tab past the last
  // control, or clicking another trigger). A null relatedTarget (clicking the track or other
  // non-focusable chrome) is left to the board's document-level outside-click handler, so
  // clicking inside the popover never closes it.
  const onDialogBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !rootRef.current?.contains(next)) onToggle(name);
  };

  return (
    <div ref={rootRef} data-menuroot="" data-align={align} data-mobile-align={mobileAlign} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onToggle(name)}
        aria-haspopup={isDialog ? "dialog" : "listbox"}
        aria-expanded={open}
        className="rf-board-filter-trigger rf-focusable"
        onKeyDown={(e) => {
          if (!isDialog && !open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            onToggle(name);
          }
        }}
        style={triggerStyle}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          role={isDialog ? "dialog" : "listbox"}
          aria-label={ariaLabel}
          aria-multiselectable={!isDialog && multiselect ? true : undefined}
          onKeyDown={isDialog ? onDialogKeyDown : onListKeyDown}
          onBlur={isDialog ? onDialogBlur : undefined}
          style={listboxStyle}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface FilterBarProps {
  // Size of the active view's pool BEFORE search/facet filtering — the counter's
  // denominator, so Rejected/Applied read against their own totals (not the all-jobs total).
  totalInView: number;
  // Category/location counts, memoized by the board so they aren't recomputed per render.
  facets: {
    categories: Record<string, number>;
    locations: Record<string, number>;
    sources: Record<string, number>;
    industries: Record<string, number>;
    sizes: Record<string, number>;
    countries: Record<string, number>;
  };
  cats: string[];
  locs: string[];
  sources: string[];
  industries: string[];
  sizes: string[];
  countries: string[];
  remote: BoardFilterState["remote"];
  minFit: number;
  payMin: number;
  payMax: number | null;
  payIncludeUndisclosed: boolean;
  sort: BoardFilterState["sort"];
  openMenu: string | null;
  visibleCount: number;
  view?: "all" | "applied" | "rejected";
  appliedCount?: number;
  rejectedCount?: number;
  onToggleView?: (v: "all" | "applied" | "rejected") => void;
  onToggleMenu: (name: string) => void;
  onToggleCat: (cat: string) => void;
  onToggleLoc: (loc: string) => void;
  onToggleSource: (ats: string) => void;
  onToggleIndustry: (industry: string) => void;
  onToggleSize: (size: string) => void;
  onToggleCountry: (country: string) => void;
  onSetRemote: (r: BoardFilterState["remote"]) => void;
  onSetMinFit: (v: number) => void;
  onSetPayRange: (min: number, max: number | null) => void;
  onTogglePayUndisclosed: (next: boolean) => void;
  onSetSort: (s: BoardFilterState["sort"]) => void;
}

export function FilterBar({
  totalInView,
  facets,
  cats,
  locs,
  sources,
  industries,
  sizes,
  countries,
  remote,
  minFit,
  payMin,
  payMax,
  payIncludeUndisclosed,
  sort,
  openMenu,
  visibleCount,
  view,
  appliedCount,
  rejectedCount,
  onToggleView,
  onToggleMenu,
  onToggleCat,
  onToggleLoc,
  onToggleSource,
  onToggleIndustry,
  onToggleSize,
  onToggleCountry,
  onSetRemote,
  onSetMinFit,
  onSetPayRange,
  onTogglePayUndisclosed,
  onSetSort,
}: FilterBarProps) {
  const {
    categories,
    locations,
    sources: sourceCounts,
    industries: industryCounts,
    sizes: sizeCounts,
    countries: countryCounts,
  } = facets;

  // Ephemeral, per-mount disclosure state for the collapsed mobile summary — always
  // starts closed so the server HTML (collapsed) matches the initial client render and
  // the anon ISR twin / authed board hydrate without a flash. Deliberately NOT persisted
  // (no BoardFilterState / /api/board-filters involvement). Visibility is CSS-driven
  // (board.css, ≤760px only); this state just reflects onto the container + toggle.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stripId = useId();

  const activeBtn = (on: boolean) => ({
    bg: on ? "var(--accent-bg)" : "var(--bg-surface)",
    border: on ? "var(--accent-border)" : "var(--border)",
  });
  // Per-facet "active" booleans — the single source of truth shared by each trigger's
  // activeBtn(...) styling AND the collapsed summary's active-facet count, so the two can
  // never drift. Every facet that carries a filter is counted; Sort and the Active/Applied
  // view are excluded on purpose (they reorder/scope the list, they don't filter it).
  const catsActive = cats.length > 0;
  const locsActive = locs.length > 0;
  const sourcesActive = sources.length > 0;
  const industriesActive = industries.length > 0;
  const sizesActive = sizes.length > 0;
  const countriesActive = countries.length > 0;
  const payActive = payMin > 0 || payMax !== null;
  const matchActive = minFit > 0;
  const remoteActive = remote !== "all";
  const cb = activeBtn(catsActive);
  const lb = activeBtn(locsActive);
  const sb = activeBtn(sourcesActive);
  const ib = activeBtn(industriesActive);
  const zb = activeBtn(sizesActive);
  const yb = activeBtn(countriesActive);
  const pb = activeBtn(payActive);
  const mb = activeBtn(matchActive);

  const activeFacetCount = [
    catsActive, payActive, matchActive, locsActive, sourcesActive,
    industriesActive, sizesActive, countriesActive, remoteActive,
  ].filter(Boolean).length;

  const catBadge = cats.length ? ` · ${cats.length}` : "";
  const locBadge = locs.length ? ` · ${locs.length}` : "";
  const srcBadge = sources.length ? ` · ${sources.length}` : "";
  const indBadge = industries.length ? ` · ${industries.length}` : "";
  const sizeBadge = sizes.length ? ` · ${sizes.length}` : "";
  const countryBadge = countries.length ? ` · ${countries.length}` : "";
  const payLabel = fmtPayRange(payMin, payMax);
  const payBadge = payLabel ? ` · ${payLabel}` : "";
  const matchBadge = minFit > 0 ? ` · ${MATCH_DEFS.find(([v]) => v === minFit)?.[1] ?? ""}` : "";
  const sortLabel = SORT_DEFS.find(([v]) => v === sort)?.[1] ?? "Best match";

  const box = (on: boolean) => ({
    boxBg: on ? "var(--accent)" : "var(--bg-surface)",
    boxBorder: on ? "var(--accent)" : "var(--border-strong)",
    check: on,
  });
  const radio = (on: boolean) => ({
    bg: on ? "var(--accent-bg)" : "transparent",
    weight: on ? 700 : 500,
    check: on,
  });

  const catItems = Object.entries(categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, count]) => ({ cat, count, ...box(cats.includes(cat)) }));

  const locItems = Object.entries(locations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([loc, count]) => ({ loc, count, ...box(locs.includes(loc)) }));

  const sourceItems = Object.entries(sourceCounts)
    .map(([ats, count]) => ({ ats, label: atsLabel(ats), count, ...box(sources.includes(ats)) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Industry facet: humanized labels from the shared INDUSTRY_LABELS map (unrecognized
  // stored values fall back to the raw key), sorted by label.
  const industryItems = Object.entries(industryCounts)
    .map(([key, count]) => ({
      key,
      label: INDUSTRY_LABELS[key as keyof typeof INDUSTRY_LABELS] ?? key,
      count,
      ...box(industries.includes(key)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Size facet: ordered by the headcount bucket sequence (NOT alphabetical — "1001-5000"
  // must not sort before "11-50"); the synthetic "unknown" bucket renders as "Unknown".
  const sizeItems = Object.entries(sizeCounts)
    .map(([key, count]) => ({
      key,
      label: key === "unknown" ? "Unknown" : key,
      count,
      ...box(sizes.includes(key)),
    }))
    .sort((a, b) => COMPANY_SIZES.indexOf(a.key as CompanySize) - COMPANY_SIZES.indexOf(b.key as CompanySize));

  // Country facet: Intl region names via countryLabel ("US" -> "United States"), sorted by label.
  const countryItems = Object.entries(countryCounts)
    .map(([key, count]) => ({ key, label: countryLabel(key), count, ...box(countries.includes(key)) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const dropdownBase = {
    position: "absolute" as const,
    top: "calc(100% + 7px)",
    zIndex: 50,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "13px",
    // One-off dropdown elevation (unique geometry, no shared token); reads weakly on
    // dark charcoal — a dark-mode deepening is deferred to the later visual pass.
    boxShadow: "var(--shadow-menu)",
    padding: "7px",
  };

  const triggerStyle = (bg: string, border: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: 600,
    fontSize: "12.5px",
    color: "var(--text-primary)",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "9px",
    padding: "7px 11px",
    cursor: "pointer",
  });
  const caret = <Icon name="chevron-down" size={16} />;

  return (
    <div className="rf-board-filters" data-filters-open={filtersOpen ? "" : undefined}>
      {/* Mobile-only collapsed summary (board.css shows it ≤760px, hides it on desktop).
          Collapsed by default so the job list is the first thing on a phone; the whole
          strip below it stays in the DOM and is display:none'd when closed. */}
      <div className="rf-board-filter-summary">
        <Button
          variant="ghost"
          className="rf-board-filter-summary__toggle"
          aria-expanded={filtersOpen}
          aria-controls={stripId}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filters{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
          <Icon name="chevron-down" size={16} className="rf-board-filter-summary__caret" />
        </Button>
        {/* Roles count stays visible while collapsed. On mobile the strip's own count is
            hidden (board.css), so exactly one role="status" live region is in the a11y
            tree here; on desktop this summary is display:none and the strip's count is
            the live one. */}
        <span className="rf-board-filter-summary__count" role="status" aria-live="polite">
          {visibleCount} of {totalInView} roles
        </span>
      </div>
      <div className="rf-board-filter-strip" id={stripId}>
      {/* Category */}
      <FilterMenu
        name="category"
        open={openMenu === "category"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by category"
        multiselect
        trigger={<>Category{catBadge}{caret}</>}
        triggerStyle={triggerStyle(cb.bg, cb.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "248px", maxHeight: "320px", overflow: "auto" }}
      >
        {catItems.map(({ cat, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={cats.includes(cat)}
            tabIndex={-1}
            key={cat}
            onClick={() => onToggleCat(cat)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {cat}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Pay */}
      <FilterMenu
        name="pay"
        variant="dialog"
        open={openMenu === "pay"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by pay range"
        trigger={<>Pay{payBadge}{caret}</>}
        triggerStyle={triggerStyle(pb.bg, pb.border)}
        align="start"
        mobileAlign="end"
        listboxStyle={{ ...dropdownBase, width: "268px" }}
      >
        <PayRangeSlider
          min={payMin}
          max={payMax}
          includeUndisclosed={payIncludeUndisclosed}
          onChange={onSetPayRange}
          onToggleUndisclosed={onTogglePayUndisclosed}
        />
      </FilterMenu>

      {/* Match */}
      <FilterMenu
        name="match"
        open={openMenu === "match"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by minimum match"
        trigger={<>Match{matchBadge}{caret}</>}
        triggerStyle={triggerStyle(mb.bg, mb.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "190px" }}
      >
        {MATCH_DEFS.map(([v, label]) => {
          const r = radio(minFit === v);
          return (
            <button
              className="rf-board-filter-option rf-focusable"
              type="button"
              role="option"
              aria-selected={minFit === v}
              tabIndex={-1}
              key={v}
              onClick={() => onSetMinFit(v)}
              style={{
                ...optionReset,
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "8px",
                borderRadius: "8px",
                cursor: "pointer",
                background: r.bg,
              }}
            >
              <span style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "var(--text-primary)" }}>
                {label}
              </span>
              <span style={{ color: "var(--accent)", fontWeight: 800, fontSize: "12px" }}>
                {r.check && <Icon name="check" size={16} />}
              </span>
            </button>
          );
        })}
      </FilterMenu>

      {/* Location */}
      <FilterMenu
        name="location"
        open={openMenu === "location"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by location"
        multiselect
        trigger={<>Location{locBadge}{caret}</>}
        triggerStyle={triggerStyle(lb.bg, lb.border)}
        align="start"
        mobileAlign="end"
        listboxStyle={{ ...dropdownBase, width: "230px", maxHeight: "320px", overflow: "auto" }}
      >
        {locItems.map(({ loc, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={locs.includes(loc)}
            tabIndex={-1}
            key={loc}
            onClick={() => onToggleLoc(loc)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {loc}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Source */}
      <FilterMenu
        name="source"
        open={openMenu === "source"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by source"
        multiselect
        trigger={<>Source{srcBadge}{caret}</>}
        triggerStyle={triggerStyle(sb.bg, sb.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "230px", maxHeight: "320px", overflow: "auto" }}
      >
        {sourceItems.map(({ ats, label, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={sources.includes(ats)}
            tabIndex={-1}
            key={ats}
            onClick={() => onToggleSource(ats)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {label}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Industry */}
      <FilterMenu
        name="industry"
        open={openMenu === "industry"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by industry"
        multiselect
        trigger={<>Industry{indBadge}{caret}</>}
        triggerStyle={triggerStyle(ib.bg, ib.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "248px", maxHeight: "320px", overflow: "auto" }}
      >
        {industryItems.map(({ key, label, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={industries.includes(key)}
            tabIndex={-1}
            key={key}
            onClick={() => onToggleIndustry(key)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {label}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Size */}
      <FilterMenu
        name="size"
        open={openMenu === "size"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by company size"
        multiselect
        trigger={<>Size{sizeBadge}{caret}</>}
        triggerStyle={triggerStyle(zb.bg, zb.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "200px", maxHeight: "320px", overflow: "auto" }}
      >
        {sizeItems.map(({ key, label, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={sizes.includes(key)}
            tabIndex={-1}
            key={key}
            onClick={() => onToggleSize(key)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {label}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Country */}
      <FilterMenu
        name="country"
        open={openMenu === "country"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by HQ country"
        multiselect
        trigger={<>Country{countryBadge}{caret}</>}
        triggerStyle={triggerStyle(yb.bg, yb.border)}
        align="start"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "248px", maxHeight: "320px", overflow: "auto" }}
      >
        {countryItems.map(({ key, label, count, boxBg, boxBorder, check }) => (
          <button
            className="rf-board-filter-option rf-focusable"
            type="button"
            role="option"
            aria-selected={countries.includes(key)}
            tabIndex={-1}
            key={key}
            onClick={() => onToggleCountry(key)}
            style={{
              ...optionReset,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 8px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "5px",
                border: `1.5px solid ${boxBorder}`,
                background: boxBg,
                color: "var(--text-on-accent)",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check && <Icon name="check" size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              {label}
            </span>
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 700 }}>
              {count}
            </span>
          </button>
        ))}
      </FilterMenu>

      {/* Remote segmented toggle */}
      <div className="rf-board-filter-group">
        <span className="rf-board-filter-label">Remote</span>
        <SegmentedControl
          label="Remote filter"
          items={REMOTE_DEFS.map(([value, label]) => ({ value, label }))}
          value={remote}
          onChange={(value) => onSetRemote(value as BoardFilterState["remote"])}
          className="rf-board-filter-segments"
        />
      </div>

      {/* Applied/Rejected view toggles */}
      {onToggleView && (
        <SegmentedControl
          label="Job status view"
          value={view ?? "all"}
          onChange={(value) => onToggleView(value as "all" | "applied" | "rejected")}
          items={[
            { value: "all", label: "Active" },
            { value: "applied", label: `Applied${appliedCount ? ` · ${appliedCount}` : ""}` },
            ...((rejectedCount ?? 0) > 0
              ? [{ value: "rejected", label: `Rejected · ${rejectedCount}` }]
              : []),
          ]}
          className="rf-board-view-segments"
        />
      )}

      <div className="rf-board-filter-spacer" />

      {/* Result count — fixed, right-aligned slot so its width is constant regardless of the
          digit counts. Toggling Applied/Rejected changes totalInView (e.g. "247 of 6382" →
          "3 of 12"); without a reserved width that shifted the flex-wrap point and made the
          Sort control jump between rows. 128px comfortably fits "6382 of 6382 roles". */}
      <div className="rf-board-result-count" role="status" aria-live="polite">
        {visibleCount} of {totalInView} roles
      </div>

      {/* Sort */}
      <FilterMenu
        name="sort"
        open={openMenu === "sort"}
        onToggle={onToggleMenu}
        ariaLabel="Sort roles"
        trigger={<>Sort: {sortLabel}{caret}</>}
        triggerStyle={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          fontWeight: 600,
          fontSize: "12.5px",
          color: "var(--text-primary)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "9px",
          padding: "7px 11px",
          cursor: "pointer",
        }}
        align="end"
        mobileAlign="start"
        listboxStyle={{ ...dropdownBase, width: "188px" }}
      >
        {SORT_DEFS.map(([v, label]) => {
          const r = radio(sort === v);
          return (
            <button
              className="rf-board-filter-option rf-focusable"
              type="button"
              role="option"
              aria-selected={sort === v}
              tabIndex={-1}
              key={v}
              onClick={() => onSetSort(v)}
              style={{
                ...optionReset,
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "8px",
                borderRadius: "8px",
                cursor: "pointer",
                background: r.bg,
              }}
            >
              <span style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "var(--text-primary)" }}>
                {label}
              </span>
              <span style={{ color: "var(--accent)", fontWeight: 800, fontSize: "12px" }}>
                {r.check && <Icon name="check" size={16} />}
              </span>
            </button>
          );
        })}
      </FilterMenu>
      </div>
    </div>
  );
}
