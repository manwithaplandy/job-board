export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "rolefit-theme";

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

export function parseThemeChoice(raw: unknown): ThemeChoice {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

// Injected verbatim into <head> and executed before first paint, so it must be
// self-contained (no imports) and never throw. Mirrors resolveTheme(); the
// lib/theme.script.test.ts pins the two to agree.
export const THEME_INIT_SCRIPT = `(function(){try{
  var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if(c!=="light"&&c!=="dark"&&c!=="system")c="system";
  var d=c==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:c==="dark";
  var t=d?"dark":"light";
  document.documentElement.setAttribute("data-theme",t);
  var m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute("content",t==="dark"?"#12161e":"#f4f6fa");
}catch(e){}})();`;
