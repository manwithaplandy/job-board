"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { atsLabel } from "@/lib/rolefit/ats";
import { Icon } from "@/components/ui/Icon";

// Static filter definitions — mirrored from reference design renderVals()
const PAY_DEFS: [number, string][] = [
  [0, "Any pay"],
  [120, "$120k+"],
  [150, "$150k+"],
  [180, "$180k+"],
  [220, "$220k+"],
];

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
  listboxStyle,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: (name: string) => void;
  trigger: ReactNode;
  triggerStyle: CSSProperties;
  ariaLabel: string;
  multiselect?: boolean;
  listboxStyle: CSSProperties;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // On open, move focus to the selected option (or the first) so arrow keys work at once.
  useEffect(() => {
    if (!open) return;
    const opts = optionEls(listRef.current);
    const sel = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
    opts[sel >= 0 ? sel : 0]?.focus();
  }, [open]);

  // When a radio-style menu (Pay/Match/Sort) closes on selection, the Enter/Space/click
  // unmounts the focused option and focus falls to <body> — the next Tab would restart at
  // the top of the page. Return focus to the trigger. Escape already refocuses it, and Tab
  // moves focus to the next control, so in both of those cases activeElement is off <body>
  // and this no-ops — it fires only for the selection-close case.
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
      case "ArrowDown":
        e.preventDefault();
        opts[(cur + 1 + opts.length) % opts.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        opts[(cur - 1 + opts.length) % opts.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        opts[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        opts[opts.length - 1]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        onToggle(name);
        triggerRef.current?.focus();
        break;
      case "Tab":
        // Let focus leave to the next control, but don't leave an orphaned open menu.
        onToggle(name);
        break;
    }
  };

  return (
    <div data-menuroot="" style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onToggle(name)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
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
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable={multiselect || undefined}
          onKeyDown={onListKeyDown}
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
  onSetPayMin: (v: number) => void;
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
  onSetPayMin,
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
  const pb = activeBtn(payMin > 0);
  const mb = activeBtn(minFit > 0);

  const catBadge = cats.length ? ` · ${cats.length}` : "";
  const locBadge = locs.length ? ` · ${locs.length}` : "";
  const srcBadge = sources.length ? ` · ${sources.length}` : "";
  const payBadge = payMin > 0 ? ` · ${PAY_DEFS.find(([v]) => v === payMin)?.[1] ?? ""}` : "";
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
    boxShadow: "0 16px 40px rgba(20,28,45,.17)",
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
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "10px 22px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
        zIndex: 15,
        position: "relative",
      }}
    >
      {/* Category */}
      <FilterMenu
        name="category"
        open={openMenu === "category"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by category"
        multiselect
        trigger={<>Category{catBadge}{caret}</>}
        triggerStyle={triggerStyle(cb.bg, cb.border)}
        listboxStyle={{ ...dropdownBase, left: 0, width: "248px", maxHeight: "320px", overflow: "auto" }}
      >
        {catItems.map(({ cat, count, boxBg, boxBorder, check }) => (
          <button
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
        open={openMenu === "pay"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by minimum pay"
        trigger={<>Pay{payBadge}{caret}</>}
        triggerStyle={triggerStyle(pb.bg, pb.border)}
        listboxStyle={{ ...dropdownBase, left: 0, width: "190px" }}
      >
        {PAY_DEFS.map(([v, label]) => {
          const r = radio(payMin === v);
          return (
            <button
              type="button"
              role="option"
              aria-selected={payMin === v}
              tabIndex={-1}
              key={v}
              onClick={() => onSetPayMin(v)}
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

      {/* Match */}
      <FilterMenu
        name="match"
        open={openMenu === "match"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by minimum match"
        trigger={<>Match{matchBadge}{caret}</>}
        triggerStyle={triggerStyle(mb.bg, mb.border)}
        listboxStyle={{ ...dropdownBase, left: 0, width: "190px" }}
      >
        {MATCH_DEFS.map(([v, label]) => {
          const r = radio(minFit === v);
          return (
            <button
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
        listboxStyle={{ ...dropdownBase, left: 0, width: "230px", maxHeight: "320px", overflow: "auto" }}
      >
        {locItems.map(({ loc, count, boxBg, boxBorder, check }) => (
          <button
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
        listboxStyle={{ ...dropdownBase, left: 0, width: "230px", maxHeight: "320px", overflow: "auto" }}
      >
        {sourceItems.map(({ ats, label, count, boxBg, boxBorder, check }) => (
          <button
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
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginLeft: "4px" }}>
        <span
          style={{
            fontSize: "11.5px",
            color: "var(--text-secondary)",
            fontWeight: 700,
            letterSpacing: ".2px",
          }}
        >
          REMOTE
        </span>
        <div
          role="group"
          aria-label="Remote filter"
          style={{
            display: "inline-flex",
            background: "var(--bg-muted)",
            borderRadius: "9px",
            padding: "2px",
          }}
        >
          {REMOTE_DEFS.map(([v, label]) => {
            const on = remote === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => onSetRemote(v)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "12px",
                  padding: "5px 11px",
                  borderRadius: "7px",
                  background: on ? "var(--bg-surface)" : "transparent",
                  // Inactive label sits on the --bg-muted track, where --text-muted is only 4.18:1
                  // in light; --text-secondary (5.28:1) clears AA — hence the off arm below.
                  color: on ? "var(--text-primary)" : "var(--text-secondary)",
                  // One-off toggle-knob elevation (unique geometry, no shared token); reads weakly
                  // on dark — a dark-mode deepening is deferred to the later visual pass.
                  boxShadow: on ? "0 1px 3px rgba(20,28,40,.12)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Applied/Rejected view toggles */}
      {onToggleView && (
        <>
          <button
            type="button"
            aria-pressed={view === "applied"}
            onClick={() => onToggleView(view === "applied" ? "all" : "applied")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontWeight: 600,
              fontSize: "12.5px",
              color: view === "applied" ? "var(--success)" : "var(--text-primary)",
              background: view === "applied" ? "var(--success-bg)" : "var(--bg-surface)",
              border: `1px solid ${view === "applied" ? "var(--success-border)" : "var(--border)"}`,
              borderRadius: "9px",
              padding: "7px 11px",
              cursor: "pointer",
            }}
          >
            Applied{appliedCount ? ` · ${appliedCount}` : ""}
          </button>
          {(rejectedCount ?? 0) > 0 && (
            <button
              type="button"
              aria-pressed={view === "rejected"}
              onClick={() => onToggleView(view === "rejected" ? "all" : "rejected")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontWeight: 600,
                fontSize: "12.5px",
                color: view === "rejected" ? "var(--danger)" : "var(--text-primary)",
                background: view === "rejected" ? "var(--danger-bg)" : "var(--bg-surface)",
                border: `1px solid ${view === "rejected" ? "var(--danger-border)" : "var(--border)"}`,
                borderRadius: "9px",
                padding: "7px 11px",
                cursor: "pointer",
              }}
            >
              Rejected · {rejectedCount}
            </button>
          )}
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Result count — fixed, right-aligned slot so its width is constant regardless of the
          digit counts. Toggling Applied/Rejected changes totalInView (e.g. "247 of 6382" →
          "3 of 12"); without a reserved width that shifted the flex-wrap point and made the
          Sort control jump between rows. 128px comfortably fits "6382 of 6382 roles". */}
      <div
        style={{
          fontSize: "12.5px",
          color: "var(--text-secondary)",
          fontWeight: 700,
          whiteSpace: "nowrap",
          minWidth: "128px",
          textAlign: "right",
        }}
      >
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
        listboxStyle={{ ...dropdownBase, right: 0, width: "188px" }}
      >
        {SORT_DEFS.map(([v, label]) => {
          const r = radio(sort === v);
          return (
            <button
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
  );
}
