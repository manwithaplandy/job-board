"use client";

import { useEffect, useRef, useState } from "react";
import { filterModels, type ORModel } from "@/lib/openrouter";

export function ModelPicker({
  label, name, models, curated, defaultValue, placeholder, hint,
  id, ariaInvalid, ariaDescribedBy,
}: {
  label: string;
  name: string;
  models: ORModel[];
  curated: string[];
  defaultValue: string | null;
  placeholder: string;
  hint?: string;
  id?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Roving keyboard-active option index into `results` (-1 = none). Reset on every query
  // change so it can never point past the freshly filtered list.
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const results = filterModels(models, curated, query).slice(0, 50);
  const inputId = id ?? `model-picker-${name}`;
  const listboxId = `${inputId}-listbox`;
  const optionId = (i: number) => `${inputId}-opt-${i}`;

  // Keep the keyboard-active option scrolled into view as arrows move it.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  const choose = (m: ORModel) => {
    if (hiddenRef.current) {
      hiddenRef.current.value = m.id;
      hiddenRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setSelected(m.id);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
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
        if (activeIndex >= 0 && activeIndex < results.length) choose(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
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
          setQuery("");
          setActiveIndex(-1);
        }
      }}
    >
      <label htmlFor={inputId} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
      {hint && (
        <span style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", marginTop: "3px" }}>{hint}</span>
      )}
      <input ref={hiddenRef} type="hidden" name={name} value={selected} />
      <input
        id={inputId}
        type="text"
        className="rf-focusable"
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
          fontSize: "13px",
          color: "var(--text-primary)",
          fontFamily: "inherit",
        }}
        placeholder={`Default: ${placeholder}`}
        // Idle (menu closed) shows the current selection as a filled value; while searching it
        // shows the query. The hidden input above always carries `selected`, so this is purely visual.
        value={open ? query : selected}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={onKeyDown}
      />
      {/* Chip appears only while searching (menu open): idle, the input itself is the filled
          value, so the chip would be redundant. Open, it reminds you of the current selection
          and offers the "×" clear. */}
      {selected && open && (
        <div style={{
          marginTop: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          alignSelf: "flex-start",
          borderRadius: "8px",
          background: "var(--accent-bg)",
          padding: "4px 10px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--accent)",
        }}>
          <span>{selected}</span>
          <button
            type="button"
            aria-label="Clear model (use default)"
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
            onClick={() => setSelected("")}
          >
            ×
          </button>
        </div>
      )}
      {open && results.length > 0 && (
        <ul id={listboxId} role="listbox" style={{
          margin: 0,
          marginTop: "8px",
          padding: 0,
          listStyle: "none",
          maxHeight: "224px",
          overflow: "auto",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          fontSize: "13px",
          boxShadow: "0 8px 24px rgba(15,22,35,.1)",
        }}>
          {results.map((m, idx) => (
            <li
              key={m.id}
              id={optionId(idx)}
              role="option"
              aria-selected={m.id === selected}
              className="rf-picker-option"
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                boxSizing: "border-box",
                cursor: "pointer",
                color: "inherit",
                background: idx === activeIndex ? "var(--accent-bg)" : undefined,
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(m);
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{m.name}</span>{" "}
              <span style={{ color: "var(--text-secondary)" }}>{m.id}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <span role="status" aria-live="polite" className="sr-only">
          {results.length === 0
            ? "No matching models"
            : `${results.length} matching model${results.length === 1 ? "" : "s"}`}
        </span>
      )}
    </div>
  );
}
