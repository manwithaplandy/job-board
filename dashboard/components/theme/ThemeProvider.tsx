"use client";
import { createContext, useContext, useEffect, useState } from "react";
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
    const stored = parseThemeChoice(safeGet());
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

  useEffect(() => { applyResolved(resolvedTheme); }, [resolvedTheme]);

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
