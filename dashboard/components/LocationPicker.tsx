"use client";

import { useEffect, useRef, useState } from "react";

type LocationOption = { location: string; count: number };

// Multi-select type-to-filter picker, modeled on ModelPicker. Selected values
// render as removable chips (from state, so they persist even if a value drops
// out of `options` because its jobs closed). The picks are submitted as a JSON
// string array in a hidden field — JSON, not CSV, because locations contain commas.
export function LocationPicker({
  name, options, defaultValue,
}: {
  name: string;
  options: LocationOption[];
  defaultValue: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Roving keyboard-active option index into `results` (-1 = none). Reset on every query
  // change so it can never point past the freshly filtered list.
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = `location-picker-${name}`;
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

  const add = (loc: string) => {
    setSelected((prev) => (prev.includes(loc) ? prev : [...prev, loc]));
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };
  const remove = (loc: string) =>
    setSelected((prev) => prev.filter((l) => l !== loc));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(0); return; }
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? 0 : i - 1));
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        add(results[activeIndex].location);
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
      <label htmlFor={inputId} style={{ fontSize: "13px", fontWeight: 600, color: "#5b6472" }}>
        Locations to include (blank = all; remote always included)
      </label>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
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
            <li key={loc} style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "8px",
              background: "#eef3fc",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#3b6fd4",
            }}>
              <span>{loc}</span>
              <button
                type="button"
                aria-label={`Remove ${loc}`}
                className="rf-picker-clear"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  margin: 0,
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }}
                onClick={() => remove(loc)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        type="text"
        className="rf-focusable rf-picker-input"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          border: "1px solid #e3e7ee",
          padding: "11px 12px",
          fontSize: "13px",
          color: "#1f2430",
          fontFamily: "inherit",
        }}
        placeholder="Type to filter locations…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul id={listboxId} role="listbox" style={{
          margin: 0,
          marginTop: "8px",
          padding: 0,
          listStyle: "none",
          maxHeight: "224px",
          overflow: "auto",
          borderRadius: "10px",
          border: "1px solid #e3e7ee",
          background: "#fff",
          fontSize: "13px",
          boxShadow: "0 8px 24px rgba(15,22,35,.1)",
        }}>
          {results.map((o, idx) => (
            <li key={o.location} id={optionId(idx)} role="option" aria-selected={false}>
              <button
                type="button"
                tabIndex={-1}
                className="rf-picker-option"
                style={{
                  display: "flex",
                  width: "100%",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  color: "inherit",
                  background: idx === activeIndex ? "#eef3fc" : undefined,
                }}
                onClick={() => add(o.location)}
              >
                <span style={{ color: "#1f2430" }}>{o.location}</span>
                <span style={{ color: "#9aa3b0" }}>{o.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
