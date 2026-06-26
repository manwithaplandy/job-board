"use client";

import { useState } from "react";

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
  const inputId = `location-picker-${name}`;

  const selectedSet = new Set(selected);
  const q = query.trim().toLowerCase();
  const results = options
    .filter((o) => !selectedSet.has(o.location))
    .filter((o) => !q || o.location.toLowerCase().includes(q))
    .slice(0, 50);

  const add = (loc: string) => {
    setSelected((prev) => (prev.includes(loc) ? prev : [...prev, loc]));
    setQuery("");
    setOpen(false);
  };
  const remove = (loc: string) =>
    setSelected((prev) => prev.filter((l) => l !== loc));

  return (
    <div className="flex flex-col text-sm text-gray-700">
      <label htmlFor={inputId}>
        Locations to include (blank = all; remote always included)
      </label>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {selected.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {selected.map((loc) => (
            <li key={loc}
              className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs">
              <span>{loc}</span>
              <button type="button" aria-label={`Remove ${loc}`}
                className="text-gray-500 hover:text-gray-900"
                onClick={() => remove(loc)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        type="text"
        className="mt-1 rounded border px-2 py-1 text-sm"
        placeholder="Type to filter locations…"
        value={query}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul role="listbox"
          className="mt-1 max-h-56 overflow-auto rounded border bg-white text-sm shadow">
          {results.map((o) => (
            <li key={o.location} role="option" aria-selected={false}>
              <button type="button"
                className="flex w-full justify-between px-2 py-1 text-left hover:bg-gray-100"
                onClick={() => add(o.location)}>
                <span>{o.location}</span>
                <span className="text-gray-400">{o.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
