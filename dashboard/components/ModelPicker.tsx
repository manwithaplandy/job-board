"use client";

import { useState } from "react";
import { filterModels, type ORModel } from "@/lib/openrouter";

export function ModelPicker({
  label, name, models, curated, defaultValue, placeholder,
}: {
  label: string;
  name: string;
  models: ORModel[];
  curated: string[];
  defaultValue: string | null;
  placeholder: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = filterModels(models, curated, query).slice(0, 50);

  return (
    <div className="flex flex-col text-sm text-gray-700">
      <span>{label}</span>
      <input type="hidden" name={name} value={selected} />
      <input
        type="text"
        className="mt-1 rounded border px-2 py-1 text-sm"
        placeholder={selected || placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && (
        <span className="mt-1 text-xs text-gray-500">
          selected: {selected}{" "}
          <button type="button" className="underline"
            onClick={() => setSelected("")}>
            clear (use default)
          </button>
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-auto rounded border bg-white text-sm shadow">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button"
                className="block w-full px-2 py-1 text-left hover:bg-gray-100"
                onClick={() => { setSelected(m.id); setQuery(""); setOpen(false); }}>
                <span>{m.name}</span>{" "}
                <span className="text-gray-400">{m.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
