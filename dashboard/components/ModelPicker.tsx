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
  const inputId = `model-picker-${name}`;

  return (
    <div className="flex flex-col">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-[#5b6472]">{label}</label>
      <input type="hidden" name={name} value={selected} />
      <input
        id={inputId}
        type="text"
        className="mt-2 rounded-[10px] border border-[#e3e7ee] px-3 py-[11px] text-[13px] text-[#1f2430] outline-none placeholder:text-[#9aa3b0] focus:border-[#3b6fd4]"
        placeholder={placeholder}
        value={query}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && (
        <div className="mt-2 flex items-center gap-1.5 self-start rounded-[8px] bg-[#eef3fc] px-2.5 py-1 text-[12px] font-semibold text-[#3b6fd4]">
          <span>{selected}</span>
          <button type="button" aria-label="Clear model (use default)"
            className="text-[#6f97dd] hover:text-[#3b6fd4]"
            onClick={() => setSelected("")}>
            ×
          </button>
        </div>
      )}
      {open && results.length > 0 && (
        <ul role="listbox" className="mt-2 max-h-56 overflow-auto rounded-[10px] border border-[#e3e7ee] bg-white text-[13px] shadow-[0_8px_24px_rgba(15,22,35,.1)]">
          {results.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === selected}>
              <button type="button"
                className="block w-full px-3 py-2 text-left hover:bg-[#eef3fc]"
                onClick={() => { setSelected(m.id); setQuery(""); setOpen(false); }}>
                <span className="text-[#1f2430]">{m.name}</span>{" "}
                <span className="text-[#9aa3b0]">{m.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
