# Phase 6 implementation report — secondary app surfaces

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `304cbe3` (`refactor(ui): converge secondary app surfaces`)

## Scope delivered

- Added one responsive secondary-surface stylesheet for Companies, Billing, Analytics, and Admin. It provides shared page/wrap/card geometry, min-content guards, local table scrolling, and mobile stacking without adding new theme colors.
- Documented the compact data-density contract in source: Analytics and Admin may use 36px visual data rows and 12–13px utility type, while standalone actions remain on the shared 44px control contract.
- Migrated Companies to `PageHeader`, `Card`, `Tabs`, `TextField`, `Badge`, `Button`, and the internal `Icon` set. Company headers and metadata now wrap, tabs scroll locally, action groups shrink correctly, and the prior 415px document overflow path is structurally removed.
- Migrated Billing plan/current-status presentation to shared cards, badges, and loading/error-aware actions while preserving Stripe checkout/portal routes and all entitlement/renewal semantics.
- Migrated Analytics page heading, section navigation, daily/weekly and 30/90-day toggles, focusable information triggers, and chart shells to the compact contract. Recharts measurements, series colors, caching, scroll-spy, chart data, and reduced-motion behavior remain unchanged.
- Migrated Admin navigation, invite form fields/actions, copy feedback/icons, status badges, and both tables. Wide tables are keyboard-focusable and scroll only inside labelled containers; no document-level width is introduced.
- Removed raw buttons from all Phase 6 product sources and replaced the warning emoji and failure glyph with semantic text/internal SVG icons.

## TDD evidence

### RED

Added `dashboard/app/secondary-surfaces-ui-contract.test.ts`. The first run failed all five intended contracts:

```text
Test Files  1 failed (1)
Tests       5 failed (5)
```

Failures covered the absent compact-density/overflow CSS contract and missing primitive migrations for each of Companies, Billing, Analytics, and Admin.

### GREEN

```text
npm test -- app/secondary-surfaces-ui-contract.test.ts \
  components/admin/AdminNav.test.tsx \
  components/admin/InviteGenerator.test.tsx \
  app/admin/tenants/page.test.ts app/admin/invites/page.test.ts

Test Files  5 passed (5)
Tests       21 passed (21)
```

## Required verification

```text
NODE_OPTIONS=--localstorage-file=/tmp/job-board-vitest-localstorage npm test

Test Files  170 passed | 2 skipped (172)
Tests       1258 passed | 6 skipped (1264)
```

- The initial plain full-suite run passed 1,238 tests; the same 20 theme/toast tests failed before render because Node 26 exposed no `localStorage`. The required Node local-storage backing file produced the clean result above.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- Production build with approved font network access and a non-secret placeholder `DATABASE_URL`: passed; every route compiled and all eight static pages generated. Earlier attempts stopped only at blocked Google Fonts and the intentionally absent local build-time database URL.
- `git diff --check`: passed.

## Root browser acceptance matrix

This worker has no browser backend. The controller/reviewer must deploy `304cbe3`, inspect the console, and record `scrollWidth === clientWidth` at both 1440 and 390 CSS pixels in light and dark themes for every row below.

| Route/state | Desktop assertions | Mobile assertions | Interaction assertions |
| --- | --- | --- | --- |
| `/companies?bucket=include` | shared header, locally contained tabs, neutral cards, semantic verdict badges | no 415px overflow; names/meta/tags/actions wrap; two actions remain usable | search debounce updates URL; Include/Exclude preserve override behavior |
| `/companies?bucket=exclude` and `unknown` | active tab and counts remain clear | tab strip scrolls locally only | switching buckets intentionally clears `q`; empty/search-result copy remains correct |
| Companies halted-credit state | warning icon/banner uses semantic tokens | Refresh stacks full-width without clipping | admin sees Refresh/loading; non-admin sees information only |
| `/billing` active/comped/no-plan variants | current plan/status/renewal hierarchy and two equal plan cards | plan cards stack; every CTA is 44px and full width | checkout, portal, disabled current-plan, loading and error states preserve semantics |
| `/analytics` overview plus each anchor | compact KPI/chart cards, sticky section nav, distinct chart palette | nav scrolls locally; charts and legends remain within viewport | section links, Top, daily/weekly, 30/90-day, tooltip hover/focus/Escape and reduced motion |
| `/analytics` empty and warning annotations | no-review state and warning notes remain legible | long annotations wrap with no document overflow | scroll-spy updates `aria-current`; console stays clean while toggling charts |
| `/admin/tenants` populated/empty | compact table hierarchy, plan/status badges | page stays 390px; only labelled table container scrolls horizontally | keyboard focus exposes visible ring; all metrics/cost/date semantics unchanged |
| `/admin/invites` populated/empty/error/success | shared tabs/card/form/table, aligned fields and copy actions | form collapses to one column; table scroll remains local | generate/reset, custom-code disclosure, error alert, copy feedback and refresh all work |

## Concern

Live light/dark desktop/mobile screenshots and interaction measurements remain controller-owned. Source contracts, focused/full tests, typecheck, lint, production build, and diff validation are green; an independent adversarial code-and-browser reviewer must clear the phase before Phase 7.
