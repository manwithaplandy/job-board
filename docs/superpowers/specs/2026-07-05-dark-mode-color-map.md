# Dark-mode color map — exhaustive hex → token audit (Task 6)

The canonical mapping every migration task (7–13) applies. **119 distinct hex
literals** are used inline across `dashboard/app/**` + `dashboard/components/**`
(excluding `*.test.*` and `app/globals.css`, which *defines* the tokens). Each
one appears exactly once in the master table below (a handful are **role-split**:
the same hex plays two roles and maps to two tokens depending on where it sits —
those rows say so explicitly).

Foundation tokens (Task 1) live in `app/globals.css` `:root` (light) +
`:root[data-theme="dark"]` (dark). Task 6 **added** the categorical families
listed under "New categorical tokens" — collapsing those into the generic
`--success`/`--warning`/`--danger` would erase categories the UI relies on
(chart series, pipeline-status traffic-lights, company avatars).

---

## How to apply (transformation rules)

Migration tasks replace inline hex with `var(--token)`. Apply **by role, not by
hex value** — the same hex can map to two tokens (see the role-split rows).

| Pattern in code | Transform |
|---|---|
| `color: "#6b7480"` | `color: "var(--text-secondary)"` |
| `background: "#fff"` (surface) | `background: "var(--bg-surface)"` |
| `color: "#fff"` (text on a colored fill) | `color: "var(--text-on-accent)"` |
| Conditional: `active ? "#1b2330" : "#5b6472"` | map **both** arms: `active ? "var(--text-primary)" : "var(--text-secondary)"` |
| Border shorthand: `"1px solid #e7eaf0"` | `"1px solid var(--border)"` |
| Tinted-chip trio `{ color:"#2f7d54", bg:"#e3f1e9", border:"#cfe6d8" }` | `{ color:"var(--success)", bg:"var(--success-bg)", border:"var(--success-border)" }` |
| Status map `{ warn:{bg:"#fdf3e6",color:"#8a5a12"} }` | `{ warn:{bg:"var(--warning-bg)",color:"var(--warning)"} }` |
| Chart series `color: "#3b6fd4"` (a data series) | `color: "var(--chart-stage)"` (NOT `--accent`) |
| Status dot `background: DOT[s]` (`#22c55e`…) | `var(--status-ok)` … (NOT `--success`) |
| Avatar tile `LOGO_COLORS = ["#3f6695", …]` | `["var(--logo-1)", …]` |
| rgba halo/shadow `rgba(59,111,212,.18)` | `var(--focus-halo)` (see rgba section) |
| Gradient `linear-gradient(180deg,#f4f6fa,#d7dce5)` | token each stop: `linear-gradient(180deg,var(--bg-page),var(--border-strong))` |

**Per-group verify:** `grep -rnE "#[0-9a-fA-F]{3,8}" <group files> | grep -v "// "`
→ no matches in `style`/value positions (a stray hex inside a comment is fine).

---

## New categorical tokens (defined by Task 6 in globals.css)

Light = the current in-code value. Dark = tuned for the `#12161e`/`#1a1f2a`
charcoal: hues lightened to read on the surface and stay mutually distinct; tint
backgrounds become low-alpha rgba of the hue (not a pale pastel). Text-bearing
tokens target WCAG AA (≥4.5:1) on `#1a1f2a`; graphical marks (dots, series,
borders) target ≥3:1.

### Chart series — `--chart-*` (6)
Data-viz palette (Chart / FunnelSection / TrendCharts / BreakdownsSection /
KpiStrip default). Must stay separable as adjacent bars/lines.

| token | light | dark | role | dark contrast note |
|---|---|---|---|---|
| `--chart-stage` | `#3b6fd4` | `#5b8def` | pipeline-stage / primary series (blue) | matches `--accent` dark; ~4.8:1 |
| `--chart-good` | `#22a06b` | `#46b17e` | good / approved / included (green) | ~5:1 |
| `--chart-bad` | `#e0607e` | `#ea7389` | bad / denied / excluded (rose) | ~5.5:1 |
| `--chart-amber` | `#f59e0b` | `#e6a53c` | gate-reject / warn series (amber) | ~7:1 |
| `--chart-muted` | `#9aa3b0` | `#808b9d` | unknown / errors / muted (slate) | graphical ≥3:1 |
| `--chart-violet` | `#7c6cd4` | `#9a8bec` | company-discovery series (violet) | ~5:1 |

`--chart-muted` also absorbs TrendCharts' `slate` (`#7a8699`) — a near-duplicate
muted series that never co-occurs with `#9aa3b0` in one chart, so they collapse.

### Pipeline status dots — `--status-*` (5)
Traffic-lights (HealthCards `DOT`, Header `HEALTH_DOT`). Deliberately more vivid
than semantic success/danger so they read at 8–9px. A self-contained family so a
`DOT` map tokenizes cleanly; `warn`/`stale` intentionally share the amber/slate
hues but stay their own tokens (independently tunable).

| token | light | dark | state |
|---|---|---|---|
| `--status-ok` | `#22c55e` | `#3ecf74` | on schedule (green) |
| `--status-warn` | `#f59e0b` | `#e6a53c` | high failure rate (amber) |
| `--status-running` | `#3b82f6` | `#5b93f5` | running (blue) |
| `--status-failed` | `#ef4444` | `#f0665f` | failed (red) |
| `--status-stale` | `#9aa3b0` | `#808b9d` | overdue (slate) |

### Status chips — `--status-running-*`, `--status-failed-*` (4)
HealthCards worded-status chip bg/text with **no core equivalent**. (The other
three states reuse core: `ok`→`--success-bg`/`--success`, `warn`→`--warning-bg`/
`--warning`, `stale`→`--bg-muted`/`--text-secondary`.)

| token | light | dark | note |
|---|---|---|---|
| `--status-running-bg` | `#eaf1fc` | `rgba(91,147,245,.16)` | low-alpha blue |
| `--status-running-text` | `#2f5cc0` | `#8fb2f5` | AA on dark |
| `--status-failed-bg` | `#fdecf1` | `rgba(224,96,126,.16)` | low-alpha magenta |
| `--status-failed-text` | `#b23a5b` | `#ec89a4` | AA; kept pink (distinct from `--danger`) |

### Tinted-chip borders — `--*-border` (4)
The green/gold/red/blue tint chips each carry a border the core `{bg,text}` pair
doesn't cover. Each token absorbs several near-duplicate border hexes.

| token | light | dark | absorbs (light) |
|---|---|---|---|
| `--success-border` | `#cfe6d8` | `rgba(70,177,126,.32)` | `#cfe6d8` `#d3e7da` `#c7e6d3` |
| `--warning-border` | `#f3d9ad` | `rgba(215,162,76,.32)` | `#f3d9ad` `#f3dfb5` `#ecdcb8` |
| `--danger-border` | `#ecd6d6` | `rgba(223,111,111,.30)` | `#ecd6d6` `#e2c9c9` `#f3d5c9` `#f0d9d0` `#e3c9be` |
| `--accent-border` | `#d8e2f6` | `rgba(91,141,239,.32)` | `#d8e2f6` `#d7e0f2` `#bcd0f2` `#e0e8f5` `#9db6e2` |

### Inverted toasts — `--toast-*` (4)
RolefitBoard's fixed bottom toasts are dark chips over the light board. In dark
mode a `#1b2330` chip on `#12161e` would vanish, so the bg becomes an *elevated*
charcoal that floats; the accent links stay light and read on either.

| token | light | dark | role |
|---|---|---|---|
| `--toast-bg` | `#1b2330` | `#2b333f` | reject/apply toast surface |
| `--toast-link` | `#9ec1ff` | `#9ec1ff` | Undo link (light blue) |
| `--toast-danger-bg` | `#7a2e22` | `#5a2a20` | action-error toast surface |
| `--toast-danger-link` | `#ffd2c8` | `#ffd2c8` | Dismiss link (peach) |

Toast text `#fff` → `--text-on-accent` (white on dark, both themes).

### Company logo/avatar palette — `--logo-1 … --logo-16` (16)
Hash-assigned tiles (`JobCard`/`JobDetail` `LOGO_COLORS`). **Opaque tiles with
white initials**, so they're theme-independent by design: dark values are
**identical** to light, which preserves the already-validated white-text
contrast (lightening them for dark would drop it). Browns/purples/teals/pinks/
golds/blues kept mutually distinct as a hash palette.

| token | value (light=dark) | | token | value (light=dark) |
|---|---|---|---|---|
| `--logo-1` | `#3f6695` | | `--logo-9` | `#586b8c` |
| `--logo-2` | `#4f8a7e` | | `--logo-10` | `#5f8f6a` |
| `--logo-3` | `#8a6da3` | | `--logo-11` | `#9c6a4a` |
| `--logo-4` | `#a9663f` | | `--logo-12` | `#5e7e9e` |
| `--logo-5` | `#4a7a52` | | `--logo-13` | `#8a7d52` |
| `--logo-6` | `#b08a3e` | | `--logo-14` | `#7a6aa0` |
| `--logo-7` | `#6f88a8` | | `--logo-15` | `#4f8a86` |
| `--logo-8` | `#9a5b6e` | | `--logo-16` | `#a05f5f` |

---

## Master hex → token map (all 119 usage hexes)

Sorted. **Role-split** rows list both target tokens with the deciding condition.

| hex | role | token |
|---|---|---|
| `#12161e` | dark page bg (ThemeProvider `theme-color` meta) | `--bg-page` (dark endpoint — may stay literal, see notes) |
| `#161d29` | headings / big numbers / titles | `--text-primary` |
| `#1b2330` | section titles **·** toast surface | text → `--text-primary` **·** toast bg → `--toast-bg` |
| `#1d7a4f` | vivid success text (up-delta, ok-chip, StateCard note) | `--success` |
| `#1f2430` | primary text / input text | `--text-primary` |
| `#22a06b` | chart good series / StateCard dot | `--chart-good` |
| `#22c55e` | status "ok" dot | `--status-ok` |
| `#2b333f` | dropdown option label text | `--text-primary` |
| `#2b52a0` | selected score text (dark blue) | `--accent-hover` |
| `#2f3845` | body-strong text (requirement/cover/reasoning) | `--text-primary` |
| `#2f5cc0` | status "running" chip text | `--status-running-text` |
| `#2f6f4f` | success text (login) | `--success` |
| `#2f7d54` | success text/chip (applied, met, un-reject) | `--success` |
| `#39424f` | control label text (filter triggers/toggles) | `--text-primary` |
| `#3a4150` | dark label text (DangerZone row / legal pages) | `--text-primary` |
| `#3b4250` | bold scale label (ResumeScorePanel) | `--text-primary` |
| `#3b6fd4` | accent (brand, links, primary btn) **·** chart series | `--accent` **·** chart series → `--chart-stage` |
| `#3b82f6` | status "running" dot | `--status-running` |
| `#3f6695` | avatar tile 1 | `--logo-1` |
| `#3f6b50` | benefit chip text (green) | `--success` |
| `#414b59` | chip / tag label text | `--text-primary` |
| `#4a7a52` | avatar tile 5 | `--logo-5` |
| `#4f8a7e` | avatar tile 2 | `--logo-2` |
| `#4f8a86` | avatar tile 15 | `--logo-15` |
| `#566` | legacy Chip default text (→ `#5d6673`) | `--text-secondary` |
| `#586b8c` | avatar tile 9 | `--logo-9` |
| `#5b6472` | secondary/body text | `--text-secondary` |
| `#5d6673` | Chip default text | `--text-secondary` |
| `#5e7e9e` | avatar tile 12 | `--logo-12` |
| `#5f8f6a` | avatar tile 10 | `--logo-10` |
| `#6b7480` | secondary/label text (very common) | `--text-secondary` |
| `#6b7585` | secondary text (Header operator, CompanyCard ATS) | `--text-secondary` |
| `#6f88a8` | avatar tile 7 | `--logo-7` |
| `#7a2e22` | action-error toast surface (dark red) | `--toast-danger-bg` |
| `#7a6aa0` | avatar tile 14 | `--logo-14` |
| `#7a8699` | chart muted series (TrendCharts slate) | `--chart-muted` |
| `#7c6cd4` | chart violet series (backlog / experience-match) | `--chart-violet` |
| `#8a5a12` | warning text | `--warning` |
| `#8a6da3` | avatar tile 3 | `--logo-3` |
| `#8a7d52` | avatar tile 13 | `--logo-13` |
| `#8a93a0` | muted uppercase labels / annotations | `--text-muted` |
| `#8a93a3` | muted text (unknown verdict, CompanyList) | `--text-muted` |
| `#8b94a3` | muted text | `--text-muted` |
| `#9a5b6e` | avatar tile 8 | `--logo-8` |
| `#9a6a1e` | warning text (skill gaps) | `--warning` |
| `#9a6b1e` | warning text (stale badge) | `--warning` |
| `#9a7b3e` | warning text (sample-profile note) | `--warning` |
| `#9aa2b1` | muted text (admin tenants) | `--text-muted` |
| `#9aa3b0` | muted text **·** chart muted series **·** stale dot | text → `--text-muted` **·** series → `--chart-muted` **·** dot → `--status-stale` |
| `#9c6a4a` | avatar tile 11 | `--logo-11` |
| `#9db6e2` | disabled primary-button fill (faded blue) | `--accent-border` |
| `#9ec1ff` | toast Undo link | `--toast-link` |
| `#a05f5f` | avatar tile 16 **·** "rejected · you" text (dusty rose) | tile → `--logo-16` **·** rejected text → `--danger` |
| `#a64b2a` | DangerZone legend text (dark terracotta) | `--danger` |
| `#a9663f` | avatar tile 4 | `--logo-4` |
| `#aab2be` | faint text ("AI analysis pending") | `--text-muted` |
| `#b07a2e` | warning text (req-unmet, "Required"/"Needs answer") | `--warning` |
| `#b08a3e` | avatar tile 6 | `--logo-6` |
| `#b23a5b` | status "failed" chip text | `--status-failed-text` |
| `#b23b3b` | danger text/fill (delete, admin, errors) | `--danger` |
| `#b25a36` | error text (generation fail, terracotta) | `--danger` |
| `#bcd0f2` | active-filter border (blue) | `--accent-border` |
| `#c0392b` | hard-error text (billing, review-now) | `--danger` |
| `#c0456a` | down-delta text (metric fell) | `--danger` |
| `#c2683f` | red-flag arrow (terracotta) | `--danger` |
| `#c7e6d3` | success chip border (resume-check pass) | `--success-border` |
| `#cdd4df` | strong grey border (DangerZone link) | `--border-strong` |
| `#cdd5e0` | strong grey border (unchecked filter box) | `--border-strong` |
| `#cfe6d8` | success chip border | `--success-border` |
| `#d3e7da` | success chip border (benefits) | `--success-border` |
| `#d7dce5` | strong border (select/textarea) | `--border-strong` |
| `#d7e0f2` | accent chip border (JD toggle, correct-btn) | `--accent-border` |
| `#d8dee8` | dashed divider (ResumeScorePanel) | `--border` |
| `#d8e2f6` | accent chip border (skills chip, badge, back-btn) | `--accent-border` |
| `#dce1e8` | border (CompanyList) | `--border` |
| `#dcefe2` | success chip bg (✓ badge) | `--success-bg` |
| `#dfe3ea` | button/secondary border | `--border` |
| `#e0607e` | chart bad series / top-red-flags | `--chart-bad` |
| `#e0a03a` | bright-gold accent (ProfileFormShell) | `--chart-amber` |
| `#e0a83b` | bright-gold accent (ReviewNowPanel) | `--chart-amber` |
| `#e0e8f5` | spinner-ring track (pale blue) | `--accent-border` |
| `#e2c9c9` | danger chip border (reject-outline) | `--danger-border` |
| `#e3c9be` | danger input border (DangerZone) | `--danger-border` |
| `#e3e7ee` | input / editor border | `--border` |
| `#e3f1e9` | success chip bg (applied) | `--success-bg` |
| `#e6f4ec` | success chip bg (resume-check pass) | `--success-bg` |
| `#e7eaf0` | border (cards, dividers, tooltips, axis lines) | `--border` |
| `#e7f6ee` | status "ok" chip bg | `--success-bg` |
| `#eaf1fc` | status "running" chip bg | `--status-running-bg` |
| `#eaf4ee` | success chip bg (benefits) | `--success-bg` |
| `#ecd6d6` | danger chip border (rejected, prepare-fail) | `--danger-border` |
| `#ecdcb8` | warning chip border (skill gaps) | `--warning-border` |
| `#eef1f5` | muted surface / bar-track / stale-chip bg | `--bg-muted` |
| `#eef3fc` | accent bg (chips, hover, back-btn) | `--accent-bg` |
| `#ef4444` | status "failed" dot | `--status-failed` |
| `#f0d9d0` | danger card border (DangerZone) | `--danger-border` |
| `#f0f2f6` | chart gridline / bar-track / table divider | `--bg-muted` |
| `#f2f4f8` | muted chip bg (JobDetail meta chips) | `--bg-muted` |
| `#f3d5c9` | danger chip border (resume-check fail) | `--danger-border` |
| `#f3d9ad` | warning chip/card border (banner, credit) | `--warning-border` |
| `#f3dfb5` | warning chip border (stale badge) | `--warning-border` |
| `#f3f5f9` | muted surface (search pill, tag chip) | `--bg-muted` |
| `#f4f6fa` | page bg | `--bg-page` |
| `#f59e0b` | chart amber series / refLine **·** status "warn" dot | series → `--chart-amber` **·** dot → `--status-warn` |
| `#f6edda` | warning chip bg (req-unmet, "Required") | `--warning-bg` |
| `#f6faf7` | pale-green panel bg (résumé/cover "done") | `--success-bg` |
| `#f7f9fc` | muted panel bg (idle/busy states) | `--bg-muted` |
| `#f8eded` | danger chip bg (rejected) | `--danger-bg` |
| `#f8efdd` | warning chip bg (skill gaps) | `--warning-bg` |
| `#f9fbfd` | subtle muted bg (profile/billing) | `--bg-muted` |
| `#fdecf1` | status "failed" chip bg | `--status-failed-bg` |
| `#fdf0ec` | danger chip bg (resume-check fail) | `--danger-bg` |
| `#fdf3e0` | warning chip bg (stale badge) | `--warning-bg` |
| `#fdf3e6` | warning chip/banner bg | `--warning-bg` |
| `#fdf6f5` | danger panel bg (error states) | `--danger-bg` |
| `#fdf7f4` | danger card bg (DangerZone) | `--danger-bg` |
| `#ffd2c8` | toast Dismiss link (peach) | `--toast-danger-link` |
| `#fff` | surface bg **·** text on colored fill | bg → `--bg-surface` **·** text → `--text-on-accent` |
| `#ffffff` | surface bg (selected card, toggle) **·** checkbox check text | bg → `--bg-surface` **·** text → `--text-on-accent` |

---

## rgba / gradient / oklch (not hex literals — handled inline by migration)

The `{3,8}` hex grep does not catch these; migration tasks tokenize them by the
same role rules:

- **Focus halo/ring** — `rgba(59,111,212,.18)` → `var(--focus-halo)`;
  `rgba(91,141,239,.30)` is its dark value (already a token).
- **Accent button shadow** — `rgba(59,111,212,.28)` / `.26` / `.32` (Button,
  Header, ResumePanel, ApplicationPanel): a blue drop-shadow → keep as an accent
  glow; dark can drop to a lower-alpha or a neutral shadow. No token yet — a
  `--shadow-accent` may be introduced by a migration task if repetition warrants.
- **Neutral card/toast shadow** — `rgba(20,28,40,.045)` (JobCard), `.12`
  (FilterBar remote toggle), `.17` (JobCard selected halo), `.22` (toasts),
  `rgba(20,28,45,.17)` (FilterBar dropdown), `rgba(0,0,0,.1)` (TrendCharts):
  soft elevation shadows — on dark, shadows read weakly; migration should deepen
  alpha or swap to a subtle light-inset. Candidate `--shadow-card` if repeated.
- **JobCard reject-× bg** — `rgba(20,28,40,.06)`: a faint neutral overlay → a
  low-alpha neutral; dark wants `rgba(255,255,255,.08)`-style inversion.
- **fit.ts oklch()** — `JobCard`/`JobDetail` fit tints (`c.tint`, `c.tintVivid`,
  `c.tintBorder`, `c.strong`) are computed `oklch(...)` strings in
  `lib/rolefit/fit.ts` (out of this app/components hex scope). The pale
  `oklch(0.975 …)` tints will read near-white on charcoal — a **separate dark-mode
  fix in fit.ts** (lower the tint L for dark), tracked outside this map.
- **fit.ts textOn** — `#2a2410` / `#ffffff` (badge text) live in `lib/` (out of
  scope here).

---

## globals.css — token definitions (source of truth, NOT migrated)

These hexes appear only inside `app/globals.css` as the light/dark **values** of
the tokens. They are the source the map points at; migration never rewrites them.
(ThemeProvider's `#12161e`/`#f4f6fa` `theme-color` literals mirror `--bg-page`'s
dark/light endpoints and likewise stay literal, since a `setAttribute` string
can't cheaply read a CSS var and must be the resolved per-theme color.)

Light values: `#f4f6fa` `#ffffff` `#eef1f5` `#e7eaf0` `#d7dce5` `#1f2430`
`#5b6472` `#8b94a3` `#3b6fd4` `#2f57a8` `#eef3fc` `#2f7d54` `#e3f1e9` `#8a5a12`
`#fdf3e6` `#b23b3b` `#fdf6f5` `#d3d9e2` `#bcc4d1` + all categorical light values above.

Dark values: `#12161e` `#1a1f2a` `#212734` `#161b24` `#2c3444` `#3a4150`
`#e7eaf1` `#98a1b1` `#6b7585` `#5b8def` `#7aa4f2` `#46b17e` `#d7a24c` `#df6f6f`
`#3ecf74` `#5b93f5` `#f0665f` `#8fb2f5` `#ec89a4` `#e6a53c` `#ea7389` `#808b9d`
`#9a8bec` `#2b333f` `#5a2a20` + logo values (identical to light).

---

## Coverage summary

- **119** distinct usage hexes → all mapped (this table).
- **~78** map to **core semantic** tokens (bg/text/border/accent/success/
  warning/danger, by role).
- **~25** map to **categorical** tokens (16 logo + chart series + status +
  status-chip).
- **~16** are the **tinted-chip / toast** extension tokens added by Task 6
  (`--*-border`, `--toast-*`, `--status-*-bg/-text`).
- **6** hexes are **role-split** (two tokens): `#3b6fd4`, `#9aa3b0`, `#f59e0b`,
  `#a05f5f`, `#1b2330`, `#fff`/`#ffffff`.
- **39** new tokens defined in globals.css (6 chart + 5 status-dot + 4
  status-chip + 4 tint-border + 4 toast + 16 logo), each with light **and** dark
  values (parity test green).
