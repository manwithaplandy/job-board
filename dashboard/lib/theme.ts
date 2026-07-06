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
