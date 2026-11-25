// The design tokens the variant 3 kit gives the frame (plan Task 2.5): a subset of
// app/globals.css, light and dark. A srcdoc frame cannot read the app's stylesheet, so the
// values travel with the kit. They are generated from globals.css, not chosen here:
// kit.test.ts parses globals.css and fails if any value below differs from it, so update
// them from there (the test names the token that moved).
//
// lib/ is outside the UI contract's raw-colour scan on purpose: these values are the
// tokens themselves, for a document the app's stylesheet does not reach.

export const KIT_TOKEN_NAMES = [
  "--font-size-small", "--font-size-caption", "--font-size-help", "--font-size-control", "--font-size-body",
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-8",
  "--radius-badge", "--radius-control", "--radius-card", "--target-size", "--control-height",
  "--bg-page", "--bg-surface", "--bg-muted", "--border", "--border-strong",
  "--text-primary", "--text-secondary", "--text-muted",
  "--accent", "--accent-hover", "--accent-bg", "--text-on-accent",
  "--success", "--success-bg", "--warning", "--warning-bg", "--danger", "--danger-bg",
  "--focus-ring", "--focus-halo",
  "--chart-stage", "--chart-good", "--chart-bad", "--chart-amber", "--chart-muted", "--chart-violet",
] as const;

export type KitTokenName = (typeof KIT_TOKEN_NAMES)[number];

const SHARED = {
  "--font-size-small": "11px",
  "--font-size-caption": "13px",
  "--font-size-help": "14px",
  "--font-size-control": "14px",
  "--font-size-body": "16px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-8": "32px",
  "--radius-badge": "999px",
  "--radius-control": "11px",
  "--radius-card": "16px",
  "--target-size": "44px",
  "--control-height": "44px",
} as const;

export const KIT_TOKENS: { light: Record<KitTokenName, string>; dark: Record<KitTokenName, string> } = {
  light: {
    ...SHARED,
    "--bg-page": "#f4f6fa",
    "--bg-surface": "#ffffff",
    "--bg-muted": "#eef1f5",
    "--border": "#e7eaf0",
    "--border-strong": "#d7dce5",
    "--text-primary": "#1f2430",
    "--text-secondary": "#5b6472",
    "--text-muted": "#8b94a3",
    "--accent": "#3b6fd4",
    "--accent-hover": "#2f57a8",
    "--accent-bg": "#eef3fc",
    "--text-on-accent": "#ffffff",
    "--success": "#2f7d54",
    "--success-bg": "#e3f1e9",
    "--warning": "#8a5a12",
    "--warning-bg": "#fdf3e6",
    "--danger": "#b23b3b",
    "--danger-bg": "#fdf6f5",
    "--focus-ring": "#3b6fd4",
    "--focus-halo": "rgba(59,111,212,.18)",
    "--chart-stage": "#3b6fd4",
    "--chart-good": "#22a06b",
    "--chart-bad": "#e0607e",
    "--chart-amber": "#f59e0b",
    "--chart-muted": "#9aa3b0",
    "--chart-violet": "#7c6cd4",
  },
  dark: {
    ...SHARED,
    "--bg-page": "#12161e",
    "--bg-surface": "#1a1f2a",
    "--bg-muted": "#161b24",
    "--border": "#2c3444",
    "--border-strong": "#3a4150",
    "--text-primary": "#e7eaf1",
    "--text-secondary": "#98a1b1",
    "--text-muted": "#6b7585",
    "--accent": "#5b8def",
    "--accent-hover": "#7aa4f2",
    "--accent-bg": "rgba(91,141,239,.15)",
    "--text-on-accent": "#ffffff",
    "--success": "#46b17e",
    "--success-bg": "rgba(70,177,126,.16)",
    "--warning": "#d7a24c",
    "--warning-bg": "rgba(215,162,76,.15)",
    "--danger": "#df6f6f",
    "--danger-bg": "rgba(223,111,111,.15)",
    "--focus-ring": "#5b8def",
    "--focus-halo": "rgba(91,141,239,.30)",
    "--chart-stage": "#5b8def",
    "--chart-good": "#46b17e",
    "--chart-bad": "#ea7389",
    "--chart-amber": "#e6a53c",
    "--chart-muted": "#808b9d",
    "--chart-violet": "#9a8bec",
  },
};
