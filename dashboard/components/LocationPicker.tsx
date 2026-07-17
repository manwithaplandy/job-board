"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Action";

type LocationOption = { location: string; count: number };

// Multi-select type-to-filter picker, modeled on ModelPicker. Selected values
// render as removable chips (from state, so they persist even if a value drops
// out of `options` because its jobs closed). The picks are submitted as a JSON
// string array in a hidden field — JSON, not CSV, because locations contain commas.
export function LocationPicker({
  name, options, defaultValue, id, ariaInvalid, ariaDescribedBy,
  // The picker owns its own visible <label> (kept associated with the input via htmlFor so
  // it's the combobox's accessible name). Locations are mandatory everywhere the picker is
  // used (onboarding + /profile both reject an empty selection), hence the default copy.
  label = "Locations to include (required — add \"Remote\" to include remote roles)",
  onSelectionChange,
}: {
  name: string;
  options: LocationOption[];
  defaultValue: string[];
  id?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  label?: string;
  onSelectionChange?: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Roving keyboard-active option index into `results` (-1 = none). Reset on every query
  // change so it can never point past the freshly filtered list.
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? `location-picker-${name}`;
  const listboxId = `${inputId}-listbox`;
  const optionId = (i: number) => `${inputId}-opt-${i}`;

  const selectedSet = new Set(selected);
  const q = query.trim().toLowerCase();
  const results = options
    .filter((o) => !selectedSet.has(o.location))
    .filter((o) => !q || o.location.toLowerCase().includes(q))
    .slice(0, 50);

  // Keep the keyboard-active option scrolled into view as arrows move it.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  const announceSelection = (next: string[]) => {
    if (!hiddenRef.current) return;
    hiddenRef.current.value = JSON.stringify(next);
    hiddenRef.current.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const add = (loc: string) => {
    if (selected.includes(loc)) return;
    const next = [...selected, loc];
    setSelected(next);
    onSelectionChange?.(next);
    announceSelection(next);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };
  const remove = (loc: string) => {
    const next = selected.filter((l) => l !== loc);
    if (next.length === selected.length) return;
    setSelected(next);
    onSelectionChange?.(next);
    announceSelection(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(results.length ? 0 : -1); return; }
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? 0 : i - 1));
    } else if (e.key === "Enter") {
      // Enter in an OPEN combobox must never fall through to implicit form submission
      // (which would save the whole profile mid-edit). Commit the highlighted option if
      // one is active; otherwise swallow the key and do nothing.
      if (open) {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) add(results[activeIndex].location);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      style={{ display: "flex", flexDirection: "column" }}
      // Close only when focus leaves the whole component — not on the 150ms timeout the
      // keyboard path can't survive (Tabbing to an option unmounts it mid-timer). A click
      // on an option keeps focus inside rootRef, so the list stays up until onClick closes it.
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label className="rf-picker-label" htmlFor={inputId} style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input ref={hiddenRef} type="hidden" name={name} value={JSON.stringify(selected)} />
      {selected.length > 0 && (
        <ul style={{
          margin: 0,
          marginTop: "8px",
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}>
          {selected.map((loc) => (
            <li key={loc} className="rf-picker-chip" style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "8px",
              background: "var(--accent-bg)",
              padding: "4px 10px",
              fontWeight: 600,
              color: "var(--accent)",
            }}>
              <span>{loc}</span>
              <IconButton
                label={`Remove ${loc}`}
                icon="close"
                size="sm"
                className="location-chip-remove"
                onClick={() => remove(loc)}
              />
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        type="text"
        className="rf-focusable rf-picker-input"
        role="combobox"
        // Only reference the listbox while it's actually rendered (open with results) —
        // aria-controls/activedescendant pointing at an absent element confuses AT.
        aria-controls={open && results.length > 0 ? listboxId : undefined}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          padding: "11px 12px",
          color: "var(--text-primary)",
          fontFamily: "inherit",
        }}
        placeholder="Type to filter locations…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul id={listboxId} role="listbox" className="rf-picker-listbox" style={{
          margin: 0,
          marginTop: "8px",
          padding: 0,
          listStyle: "none",
          maxHeight: "224px",
          overflow: "auto",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-popover)",
        }}>
          {results.map((o, idx) => (
            <li
              key={o.location}
              id={optionId(idx)}
              role="option"
              aria-selected={false}
              className="rf-picker-option"
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                padding: "8px 12px",
                boxSizing: "border-box",
                cursor: "pointer",
                color: "inherit",
                background: idx === activeIndex ? "var(--accent-bg)" : undefined,
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                add(o.location);
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{o.location}</span>
              <span style={{ color: "var(--text-secondary)" }}>{o.count}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <span role="status" aria-live="polite" className="sr-only">
          {results.length === 0
            ? "No matching locations"
            : `${results.length} matching location${results.length === 1 ? "" : "s"}`}
        </span>
      )}
    </div>
  );
}
