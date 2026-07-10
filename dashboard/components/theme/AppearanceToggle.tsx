"use client";
import { useRef } from "react";
import { useTheme } from "./ThemeProvider";
import type { ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// The look each swatch previews. "system" resolves to whichever theme is active.
function swatch(value: ThemeChoice, resolvedDark: boolean): React.CSSProperties {
  const dark = value === "dark" || (value === "system" && resolvedDark);
  return dark
    ? { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }
    : { background: "#ffffff", color: "#3b6fd4", border: "1px solid #e3e7ee" };
}

export function AppearanceToggle() {
  const { choice, resolvedTheme, setChoice } = useTheme();
  const resolvedDark = resolvedTheme === "dark";
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % OPTIONS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + OPTIONS.length - 1) % OPTIONS.length;
    else return;
    e.preventDefault();
    setChoice(OPTIONS[next].value);
    // Roving tabindex: the newly-selected radio becomes the only tab-stop (tabIndex 0),
    // so move DOM focus with the selection — otherwise focus is stranded on the button
    // that just became tabIndex=-1. The buttons are keyed by value (stable DOM nodes),
    // so the ref is valid to focus synchronously before the re-render flips tabIndex.
    btnRefs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Theme"
         style={{ display: "inline-flex", gap: 5, padding: 4, borderRadius: 11,
                  background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
      {OPTIONS.map((o, i) => {
        const checked = choice === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={checked}
            className="rf-focusable"
            ref={(el) => { btnRefs.current[i] = el; }}
            tabIndex={checked ? 0 : -1} onClick={() => setChoice(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            style={{ ...swatch(o.value, resolvedDark), display: "inline-flex", alignItems: "center",
                     justifyContent: "center", minHeight: 44, boxSizing: "border-box",
                     padding: "9px 18px", borderRadius: 8,
                     fontSize: 12, fontWeight: 600, cursor: "pointer",
                     ...(checked ? {
                       background: "var(--accent-bg)",
                       border: "1px solid var(--accent-border)",
                     } : {}) }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
