# UI cohesion Task 9 report — regression guardrails

## RED

- Added purpose-built violating fixtures for raw controls, Unicode control icons,
  inline geometry, theme drift, undersized targets, fixed-width overflow, missing
  shell composition, raw SVGs/actions, and undocumented compact density.
- `npm test -- app/ui-contract.test.ts` initially failed because the requested
  `@/lib/uiContract` audit did not exist.
- After the first scanner implementation, the production gate failed on the KPI
  trend triangles (`▲`/`▼`), proving the Unicode rule also catches real source.

## GREEN

- Added the production UI source audit with exact, documented file allowlists for
  semantic composite widgets. Replaced the KPI triangles with internal `Icon`
  chevrons; the Funnel process arrow is an exact prose-only exception.
- Added a canonical 21-entry route/state inventory and Playwright matrix covering
  light/dark at 1440x1000 and 390x844 (84 cases total). Before each screenshot the
  spec checks default-control styling, 44px targets, overflow, shell count, and SVG
  provenance.
- Committed 28 public/gallery screenshot baselines. Full authenticated execution
  requires uncommitted `VISUAL_AUTH_STATE_JSON` storage state and fails explicitly
  when it is absent. CI always runs the public subset and runs the full matrix only
  when the repository secret is configured.
- Added package/CI commands, ignored disposable Playwright output, and documented
  token, density, allowlist, baseline, artifact, and authenticated-state policy in
  `docs/ui-contracts.md`.
- Excluded intentional contract fixtures from the older raw-hex production scan and
  made Vitest disable Node's experimental web-storage global so jsdom localStorage
  remains deterministic.

## Verification

- Fixture/route contracts: 2 files, 13 tests passed.
- Playwright inventory: 84 cases listed.
- Fresh public screenshot comparison: 28 passed, 56 explicit authenticated-scope
  skips; zero visual diffs and all runtime assertions passed.
- Full Vitest: 182 files passed, 2 skipped; 1,314 tests passed, 6 skipped.
- Typecheck passed.
- Lint: 0 errors, 9 pre-existing warnings.
- Production build passed with the standard dummy `DATABASE_URL`; the first build
  attempt documented the expected missing-database environment failure.
- Representative login error, signup, legal, and primitive/state baseline PNGs were
  visually inspected after generation.

## Controller/reviewer gate still required

- Authenticated Playwright baselines were not generated because no exportable
  Playwright storage state was available to this implementer. The controller owns the
  live authenticated browser matrix and independent adversarial review; this report
  does not claim the final Phase 9/definition-of-done gate has passed.
