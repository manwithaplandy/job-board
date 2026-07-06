# Dark Mode — Design

- **Date:** 2026-07-05
- **Status:** Approved (design); implementation plan to follow
- **Scope:** `dashboard/` (Next.js App Router)

## Summary

Add a dark theme to the Rolefit dashboard. It auto-detects the OS
`prefers-color-scheme` setting and offers a manual override (System / Light /
Dark) in a new **Appearance** section on the Profile page. Because the codebase
styles everything with **inline hex literals** and no token layer, the bulk of
the work is introducing a semantic **CSS-variable token layer** and migrating
the existing colors onto it. Theme switches by flipping one `data-theme`
attribute on `<html>`.

## Background & constraints

- No Tailwind, no CSS-modules, no CSS variables today. Every color is an inline
  hex literal, e.g. `style={{ color: "#6b7480" }}`. **121 distinct hex colors
  across 54 files.** The only stylesheet is `dashboard/app/globals.css`
  (base + a handful of `.rf-*` pseudo-state rules).
- **Inline styles cannot respond to a theme** — they can't hold media queries
  and their specificity beats author stylesheets. So the color values
  themselves must become theme-aware. CSS custom properties are the one
  mechanism that works *inside* inline `style={{}}` (`color: "var(--x)"`) **and**
  re-themes server-rendered markup with no React re-render.
- The inline-style approach is the deliberate house style (Tailwind was removed
  in the design-system consolidation). The design works *with* it, not against.

## Goals

- System auto-detection via `prefers-color-scheme`, updating live when the OS
  flips.
- Manual override (System / Light / Dark), persisted per-device.
- Full coverage: every surface — board, job detail, analytics/charts,
  companies, billing, admin, profile, onboarding, and the public
  login/signup/reset/privacy/terms/error pages.
- No flash of the wrong theme on first paint (FOUC-free), including SSR.
- Palette **A · Soft Charcoal** (slate-blue-tinted, medium contrast) for dark.

## Non-goals

- Per-account / cross-device sync (localStorage only; see Persistence).
- Any layout redesign or component restructuring beyond the color migration.
- Additional named themes beyond Light and Dark-A.

## Decisions (resolved during brainstorming)

| Question | Decision |
|---|---|
| Persistence | **Per-device via `localStorage`** + no-flash inline script. No DB, no migration. |
| Coverage | **Everything, all at once** (~54 files). |
| Dark aesthetic | **A · Soft Charcoal.** |
| Toggle model | **3-way segmented control** (System / Light / Dark), System = default, resolves to the OS setting live. |
| Toggle visuals | Theme-colored swatches (no emoji): Light = blue-on-white; Dark = dark chip; System renders as the *resolved* OS theme (identical to Dark when OS is dark); blue ring marks the active choice. |
| Toggle location | New **Appearance** section on the Profile page. |
| Architecture | **Approach 1 — CSS custom properties.** (Rejected: JS theme-object-via-context — forces client components + prop-threading + re-renders + harder FOUC. Rejected: re-introducing Tailwind/`dark:` classes — a far larger rewrite that fights the house style.) |

## Design

### 1. Token taxonomy

The 121 hex literals collapse to ~22 semantic tokens, mapped **by role**, not by
hex value — the same hex can be a border in one place and text in another, so
the migration keys off *what the color is doing*, not its literal value. Light
values are today's palette; dark values are palette **A · Soft Charcoal**.

| Token | Role | Light | Dark (A) |
|---|---|---|---|
| `--bg-page` | app background | `#f4f6fa` | `#12161e` |
| `--bg-surface` | cards, header, panels | `#ffffff` / `#f7f9fc` | `#1a1f2a` |
| `--bg-raised` | selected card, popovers, menus | `#ffffff` | `#212734` |
| `--bg-muted` | inset wells, input fills | `#eef1f5` / `#f0f2f6` | `#161b24` |
| `--border` | default borders | `#e7eaf0` / `#e3e7ee` / `#dfe3ea` | `#2c3444` |
| `--border-strong` | dividers, stronger edges | `#d7dce5` | `#3a4150` |
| `--text-primary` | headings, body | `#1f2430` / `#161d29` / `#1b2330` | `#e7eaf1` |
| `--text-secondary` | labels, meta | `#5b6472` / `#6b7480` / `#414b59` | `#98a1b1` |
| `--text-muted` | placeholders, hints | `#8b94a3` / `#9aa3b0` / `#8a93a0` | `#6b7585` |
| `--accent` | brand blue, links, primary button | `#3b6fd4` | `#5b8def` |
| `--accent-hover` | hover state | `#2f57a8` | `#7aa4f2` |
| `--accent-bg` | active-pill / tint fill | `#eef3fc` / `#d8e2f6` | `rgba(91,141,239,.15)` |
| `--text-on-accent` | text on filled blue | `#ffffff` | `#ffffff` |
| `--success` | good / applied / positive | `#2f7d54` / `#22a06b` | `#46b17e` |
| `--success-bg` | success tint fill | `#e3f1e9` / `#cfe6d8` | `rgba(70,177,126,.16)` |
| `--warning` | warn / caution | `#8a5a12` / `#b25a36` | `#d7a24c` |
| `--warning-bg` | warning tint fill | `#fdf3e6` | `rgba(215,162,76,.15)` |
| `--danger` | error / destructive | `#b23b3b` / `#c0392b` / `#a05f5f` | `#df6f6f` |
| `--danger-bg` | danger tint fill | `#fdf6f5` / `#ecd6d6` | `rgba(223,111,111,.15)` |
| `--focus-ring` | keyboard focus | `#3b6fd4` | `#5b8def` |
| `--scrollbar-thumb` | custom scrollbars | `#d3d9e2` | `#2c3444` |

**Chart / data-viz subset** — `Chart.tsx`, `FunnelSection.tsx`, `HealthCards.tsx`
carry their own palette (`stage`, `good`, `bad`, `amber`, `muted`). These get a
parallel token set (`--chart-stage`, `--chart-good`, `--chart-bad`,
`--chart-amber`, `--chart-muted`) tuned separately for each theme because
data-viz colors have their own contrast/legibility requirements against the two
backgrounds (light categorical hues wash out on dark).

> The **exhaustive hex→token mapping table** (all 121 literals → their token,
> with the ambiguous/computed cases flagged) is produced as implementation
> step 1 (the audit) and appended to this spec. The table above is the
> semantic target the audit maps onto.

### 2. `globals.css` structure

```css
:root {
  --bg-page: #f4f6fa;
  --text-primary: #1f2430;
  /* …all light values… */
}
:root[data-theme="dark"] {
  --bg-page: #12161e;
  --text-primary: #e7eaf1;
  /* …all dark values… */
}
```

`:root` holds the **light** defaults (so no-JS and pre-hydration both render
light). `:root[data-theme="dark"]` overrides with dark values. Every inline
`color: "#6b7480"` becomes `color: "var(--text-secondary)"`. The existing
`.rf-*` pseudo-state rules and `body` / `input::placeholder` / scrollbar rules
in `globals.css` also move to tokens.

### 3. Theme controller

- **State:** `choice ∈ {"system","light","dark"}`, stored in
  `localStorage["rolefit-theme"]`. Unset / invalid / storage-blocked ⇒ treated
  as `"system"`.
- **Resolve (pure function, single source of truth):**
  ```
  resolveTheme(choice, prefersDark) =
    choice === "system" ? (prefersDark ? "dark" : "light") : choice
  ```
  We always set `<html data-theme={resolved}>` to the *resolved* value
  (`"dark"` | `"light"`), so all CSS keys off two states only — never
  `"system"`.
- **Live OS changes:** when `choice === "system"`, a
  `matchMedia("(prefers-color-scheme: dark)")` `change` listener updates
  `data-theme`.
- **No-flash script:** a small **synchronous inline `<script>` in `<head>`**
  (injected in `app/layout.tsx` via `dangerouslySetInnerHTML`) reads
  localStorage + `matchMedia` and sets `data-theme` **before first paint**. It
  inlines the same `resolveTheme` logic the React provider uses (kept in sync by
  sharing the source string / a tested helper), so there is one definition of
  "resolved theme."
- **React surface:** a `'use client'` `ThemeProvider` wrapping the app exposes
  `useTheme() → { choice, resolvedTheme, setChoice }`. `setChoice` writes
  localStorage, updates `data-theme`, and (de)registers the matchMedia listener.
  The provider is the **only** thing that re-renders on a theme change; every
  other element re-themes purely through the CSS variable swap.
- **`<meta name="theme-color">`** is updated to match the resolved theme
  (address-bar / PWA chrome).

### 4. Toggle UI (Profile → Appearance)

A new **Appearance** section on the Profile page containing the confirmed
segmented control:

- Three swatch segments: **System**, **Light**, **Dark** — no emoji.
- **Light** = blue-on-white (`--accent` text on white); **Dark** = dark chip;
  **System** renders using the *resolved* theme's colors (identical to the Dark
  swatch when the OS is dark, identical to Light when the OS is light).
- The active `choice` carries a blue selection ring (`--focus-ring`).
- Helper copy: "System follows your device and updates live; Light / Dark pin an
  override. Saved on this device."
- Implemented as a `'use client'` component reading `useTheme()`. Accessible:
  `role="radiogroup"`, arrow-key navigation, visible focus, `aria-checked`.

### 5. Migration of the 54 files

1. **Audit** — enumerate all 121 hex literals with their usage context; build
   the complete hex→token map, resolving each occurrence **by role**. Flag the
   non-mechanical cases: conditionals (`active ? "#1b2330" : "#3b6fd4"`),
   `rgba()` halos/shadows, gradients, and derived-color helpers
   (`c.tintBorder`-style computed values). Append the table to this spec.
2. **Apply** — mechanical `var(--token)` swaps for 1:1 cases; hand-edit the
   flagged cases. Keep diffs per surface group for reviewability.
3. **Dark values** — fill the `[data-theme="dark"]` block and the chart subset;
   tune contrast (target WCAG AA for text; verify fit-score/semantic tints stay
   legible).
4. **Verify** — walk every surface group in **both** themes:
   board · job detail · analytics + charts · companies · billing · admin ·
   profile · onboarding · auth/marketing (login/signup/reset/privacy/terms) ·
   error page.

### 6. Edge cases

- **No JS** → light (the `:root` default renders).
- **localStorage blocked or invalid value** → `"system"` (never throw; the
  no-flash script is wrapped in try/catch).
- **SSR** → server renders with `:root` light defaults; the `<head>` script
  corrects to the resolved theme before paint.
- **Focus rings, scrollbars, `input::placeholder`** (in `globals.css`) → tokens.
- **Shadows** softened for dark (lower alpha / darker base).
- **Print** stays light.
- **Images / logos** — audit for any that assume a light background; swap or add
  a surface behind them if needed.

### 7. Testing

- **Unit:** `resolveTheme(choice, prefersDark)` across the full matrix;
  localStorage read/write with malformed and blocked-storage inputs.
- **Component (jsdom):** the toggle renders three options, reflects `choice`,
  calls `setChoice`, and drives `data-theme`. Follows the repo's jsdom
  component-test conventions (assert state/attributes, not pixels).
- **Manual/visual:** each surface group in light + dark via the local
  authed-page dev shim (over the real prod DB), driven in the browser.

## Rollout / verification

Frontend-only; **no migrations, no env changes**. Ships via the normal
push-to-main → Vercel auto-deploy. Verification is the surface-by-surface
light+dark walk in §5.4 plus the automated tests in §7.

## Appendix — file inventory (surface groups)

- **Board:** `components/rolefit/*` (Header, SlimHeader, FilterBar, JobCard,
  JobList, JobDetail, RolefitBoard, ApplicationPanel, Resume/Review panels,
  ProfileModal, AccountMenu, DetailErrorBoundary).
- **Analytics/charts:** `components/analytics/*` (Chart, FunnelSection,
  HealthCards, PipelineDashboard, …) — includes the chart palette subset.
- **Other authed:** `app/profile`, `app/onboarding`, `app/companies`,
  `app/billing`, `app/admin/*`, `app/analytics`.
- **Public/marketing:** `app/login`, `app/signup`, `app/reset-password`,
  `app/privacy`, `app/terms`, `app/error.tsx`.
- **Shared:** `app/globals.css`, `app/layout.tsx` (no-flash script + provider),
  new `ThemeProvider` / `useTheme` / `resolveTheme` module, new Appearance
  toggle component.
