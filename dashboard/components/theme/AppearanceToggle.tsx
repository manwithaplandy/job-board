"use client";
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

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault(); setChoice(OPTIONS[(i + 1) % OPTIONS.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault(); setChoice(OPTIONS[(i + OPTIONS.length - 1) % OPTIONS.length].value);
    }
  };

  return (
    <div role="radiogroup" aria-label="Theme"
         style={{ display: "inline-flex", gap: 5, padding: 4, borderRadius: 11,
                  background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
      {OPTIONS.map((o, i) => {
        const checked = choice === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={checked}
            tabIndex={checked ? 0 : -1} onClick={() => setChoice(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            style={{ ...swatch(o.value, resolvedDark), padding: "9px 18px", borderRadius: 8,
                     fontSize: 12, fontWeight: 600, cursor: "pointer",
                     boxShadow: checked ? "0 0 0 2px var(--focus-ring)" : "none" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
