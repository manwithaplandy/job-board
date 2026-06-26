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
    <div className="flex flex-col">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-[#5b6472]">
        Locations to include (blank = all; remote always included)
      </label>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((loc) => (
            <li key={loc}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#eef3fc] px-2.5 py-1 text-[12px] font-semibold text-[#3b6fd4]">
              <span>{loc}</span>
              <button type="button" aria-label={`Remove ${loc}`}
                className="text-[#6f97dd] hover:text-[#3b6fd4]"
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
        className="mt-2 rounded-[10px] border border-[#e3e7ee] px-3 py-[11px] text-[13px] text-[#1f2430] outline-none placeholder:text-[#9aa3b0] focus:border-[#3b6fd4]"
        placeholder="Type to filter locations…"
        value={query}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul role="listbox"
          className="mt-2 max-h-56 overflow-auto rounded-[10px] border border-[#e3e7ee] bg-white text-[13px] shadow-[0_8px_24px_rgba(15,22,35,.1)]">
          {results.map((o) => (
            <li key={o.location} role="option" aria-selected={false}>
              <button type="button"
                className="flex w-full justify-between px-3 py-2 text-left hover:bg-[#eef3fc]"
                onClick={() => add(o.location)}>
                <span className="text-[#1f2430]">{o.location}</span>
                <span className="text-[#9aa3b0]">{o.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
