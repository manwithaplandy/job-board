"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { atsLabel } from "@/lib/rolefit/ats";
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
  facets: { categories: Record<string, number>; locations: Record<string, number>; sources: Record<string, number> };
  cats: string[];
  locs: string[];
  sources: string[];
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
  onSetRemote,
  onSetMinFit,
  onSetPayRange,
  onTogglePayUndisclosed,
  onSetSort,
}: FilterBarProps) {
  const { categories, locations, sources: sourceCounts } = facets;

  const activeBtn = (on: boolean) => ({
    bg: on ? "var(--accent-bg)" : "var(--bg-surface)",
    border: on ? "var(--accent-border)" : "var(--border)",
  });
  const cb = activeBtn(cats.length > 0);
  const lb = activeBtn(locs.length > 0);
  const sb = activeBtn(sources.length > 0);
  const pb = activeBtn(payMin > 0 || payMax !== null);
  const mb = activeBtn(minFit > 0);

  const catBadge = cats.length ? ` · ${cats.length}` : "";
  const locBadge = locs.length ? ` · ${locs.length}` : "";
  const srcBadge = sources.length ? ` · ${sources.length}` : "";
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
    <div className="rf-board-filters">
      <div className="rf-board-filter-strip">
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
