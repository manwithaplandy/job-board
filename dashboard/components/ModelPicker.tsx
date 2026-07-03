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
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor={inputId} style={{ fontSize: "13px", fontWeight: 600, color: "#5b6472" }}>{label}</label>
      <input type="hidden" name={name} value={selected} />
      <input
        id={inputId}
        type="text"
        className="rf-focusable rf-picker-input"
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          border: "1px solid #e3e7ee",
          padding: "11px 12px",
          fontSize: "13px",
          color: "#1f2430",
          fontFamily: "inherit",
        }}
        placeholder={placeholder}
        value={query}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && (
        <div style={{
          marginTop: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          alignSelf: "flex-start",
          borderRadius: "8px",
          background: "#eef3fc",
          padding: "4px 10px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#3b6fd4",
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
        <ul role="listbox" style={{
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
          {results.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === selected}>
              <button
                type="button"
                className="rf-picker-option"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  color: "inherit",
                }}
                onClick={() => { setSelected(m.id); setQuery(""); setOpen(false); }}
              >
                <span style={{ color: "#1f2430" }}>{m.name}</span>{" "}
                <span style={{ color: "#9aa3b0" }}>{m.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
