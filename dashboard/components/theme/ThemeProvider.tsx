"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  parseThemeChoice, resolveTheme, THEME_STORAGE_KEY,
  type ResolvedTheme, type ThemeChoice,
} from "@/lib/theme";

type ThemeCtx = { choice: ThemeChoice; resolvedTheme: ResolvedTheme; setChoice: (c: ThemeChoice) => void };
const Ctx = createContext<ThemeCtx | null>(null);

function prefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolved(t: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", t);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "dark" ? "#12161e" : "#f4f6fa");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from "system" for a stable SSR/first-render; the <head> script already
  // painted the right theme, and the mount effect syncs React state to storage.
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    // Post-mount sync from the external store (localStorage + matchMedia): the server
    // rendered the stable "system"/"light" default, and only after mount can we read
    // the client's real stored choice / OS preference. This is a genuine external-store
    // sync, not a derived-state anti-pattern — it can't be a lazy useState initializer
    // (a client-only initial value would hydration-mismatch the server render and the
    // AppearanceToggle's aria-checked / System swatch). useSyncExternalStore is out of
    // scope. Hence the deliberate setState-in-effect.
    const stored = parseThemeChoice(safeGet());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setChoiceState(stored);
    setResolvedTheme(resolveTheme(stored, prefersDark()));
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (choice === "system") setResolvedTheme(resolveTheme("system", e.matches));
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [choice]);

  const firstApply = useRef(true);
  useEffect(() => {
    // The head-script already set the correct data-theme before first paint, and
    // our initial resolvedTheme matches the server "light" default — applying on the
    // first commit would clobber it (flash for dark users) / fight hydration. Apply
    // only on genuine post-mount changes (mount sync, user toggle, OS flip).
    if (firstApply.current) { firstApply.current = false; return; }
    applyResolved(resolvedTheme);
  }, [resolvedTheme]);

  const setChoice = (c: ThemeChoice) => {
    safeSet(c);
    setChoiceState(c);
    setResolvedTheme(resolveTheme(c, prefersDark()));
  };

  return <Ctx.Provider value={{ choice, resolvedTheme, setChoice }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}

function safeGet(): string | null {
  try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
}
function safeSet(v: string) {
  try { localStorage.setItem(THEME_STORAGE_KEY, v); } catch { /* storage blocked */ }
}
