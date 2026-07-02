"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { JobRow } from "@/lib/types";
import type { BoardFilterState } from "@/lib/rolefit/filter";

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
  jobs: JobRow[];
  // Category/location counts, memoized by the board so they aren't recomputed per render.
  facets: { categories: Record<string, number>; locations: Record<string, number> };
  cats: string[];
  locs: string[];
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
  onSetRemote: (r: BoardFilterState["remote"]) => void;
  onSetMinFit: (v: number) => void;
  onSetPayMin: (v: number) => void;
  onSetSort: (s: BoardFilterState["sort"]) => void;
}

export function FilterBar({
  jobs,
  facets,
  cats,
  locs,
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
  onSetRemote,
  onSetMinFit,
  onSetPayMin,
  onSetSort,
}: FilterBarProps) {
  const { categories, locations } = facets;

  const activeBtn = (on: boolean) => ({
    bg: on ? "#eef3fc" : "#ffffff",
    border: on ? "#bcd0f2" : "#dfe3ea",
  });
  const cb = activeBtn(cats.length > 0);
  const lb = activeBtn(locs.length > 0);
  const pb = activeBtn(payMin > 0);
  const mb = activeBtn(minFit > 0);

  const catBadge = cats.length ? ` · ${cats.length}` : "";
  const locBadge = locs.length ? ` · ${locs.length}` : "";
  const payBadge = payMin > 0 ? ` · ${PAY_DEFS.find(([v]) => v === payMin)?.[1] ?? ""}` : "";
  const matchBadge = minFit > 0 ? ` · ${MATCH_DEFS.find(([v]) => v === minFit)?.[1] ?? ""}` : "";
  const sortLabel = SORT_DEFS.find(([v]) => v === sort)?.[1] ?? "Best match";

  const box = (on: boolean) => ({
    boxBg: on ? "#3b6fd4" : "#ffffff",
    boxBorder: on ? "#3b6fd4" : "#cdd5e0",
    check: on ? "✓" : "",
  });
  const radio = (on: boolean) => ({
    bg: on ? "#eef3fc" : "transparent",
    weight: on ? 700 : 500,
    check: on ? "✓" : "",
  });

  const catItems = Object.entries(categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, count]) => ({ cat, count, ...box(cats.includes(cat)) }));

  const locItems = Object.entries(locations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([loc, count]) => ({ loc, count, ...box(locs.includes(loc)) }));

  const dropdownBase = {
    position: "absolute" as const,
    top: "calc(100% + 7px)",
    zIndex: 50,
    background: "#fff",
    border: "1px solid #e3e7ee",
    borderRadius: "13px",
    boxShadow: "0 16px 40px rgba(20,28,45,.17)",
    padding: "7px",
  };

  const triggerStyle = (bg: string, border: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: 600,
    fontSize: "12.5px",
    color: "#39424f",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "9px",
    padding: "7px 11px",
    cursor: "pointer",
  });
  const caret = <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>;

  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "10px 22px",
        background: "#fff",
        borderBottom: "1px solid #e7eaf0",
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
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
              {cat}
            </span>
            <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
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
              <span style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}>
                {label}
              </span>
              <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                {r.check}
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
              <span style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}>
                {label}
              </span>
              <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                {r.check}
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
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {check}
            </span>
            <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
              {loc}
            </span>
            <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
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
            color: "#6b7480",
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
            background: "#eef1f5",
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
                  background: on ? "#ffffff" : "transparent",
                  color: on ? "#1b2330" : "#6b7480",
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
              color: view === "applied" ? "#2f7d54" : "#39424f",
              background: view === "applied" ? "#e3f1e9" : "#ffffff",
              border: `1px solid ${view === "applied" ? "#cfe6d8" : "#dfe3ea"}`,
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
                color: view === "rejected" ? "#a05f5f" : "#39424f",
                background: view === "rejected" ? "#f8eded" : "#ffffff",
                border: `1px solid ${view === "rejected" ? "#ecd6d6" : "#dfe3ea"}`,
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

      {/* Result count */}
      <div
        style={{
          fontSize: "12.5px",
          color: "#6b7480",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {visibleCount} of {jobs.length} roles
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
          color: "#39424f",
          background: "#fff",
          border: "1px solid #dfe3ea",
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
              <span style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}>
                {label}
              </span>
              <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                {r.check}
              </span>
            </button>
          );
        })}
      </FilterMenu>
    </div>
  );
}
