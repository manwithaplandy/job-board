# UI cohesion Task 9 report — regression guardrails

## RED

- Added purpose-built violating fixtures for raw controls, Unicode control icons,
  inline geometry, theme drift, undersized targets, fixed-width overflow, missing
  shell composition, raw SVGs/actions, and undocumented compact density.
- `npm test -- app/ui-contract.test.ts` initially failed because the requested
  `@/lib/uiContract` audit did not exist.
- After the first scanner implementation, the production gate failed on the KPI
  trend triangles (`▲`/`▼`), proving the Unicode rule also catches real source.

## GREEN — initial implementation

- Added the production UI source audit. Replaced the KPI triangles with internal `Icon`
  chevrons; the Funnel process arrow is an exact prose-only exception.
- Added a canonical 21-entry route/state inventory and Playwright matrix covering
  light/dark at 1440x1000 and 390x844 (84 cases total). Before each screenshot the
  spec checks default-control styling, 44px targets, overflow, shell count, and SVG
  provenance.
- Committed 28 public/gallery screenshot baselines. Full authenticated execution
  requires uncommitted `VISUAL_AUTH_STATE_JSON` storage state and fails explicitly
  when it is absent.
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

## Adversarial review follow-up

- Replaced broad scanner file exemptions and regex-only TSX checks with a TypeScript
  AST audit, exact shared classes/markers, and component/render-function geometry scopes.
  A mutation test proves that a new raw control inside a formerly exempt file is rejected;
  isolated fixtures also cover HSL values, numeric geometry, generic CTA sizing, and
  generic fixed-width containers. The production audit reports zero violations.
- Made authenticated CI fail closed with an unconditional, validated
  `VISUAL_AUTH_STATE_JSON` preflight and unconditional full visual gate. No secrets or
  fabricated state are committed.
- Expanded the canonical inventory with 17 deterministic major-state fixtures and exact
  route-specific shell/source contracts. The matrix now contains 152 cases: 96 committed
  public/deterministic comparisons and 56 explicit real-auth cases.
- Tightened screenshot tolerance to 0.5% differing pixels with a 0.2 per-pixel threshold,
  and documented explicit masks as the only policy for legitimate dynamic content.
- Replaced broad runtime SVG exceptions with exact fit-score/data-viz markers, fixed KPI
  icon spacing, migrated remaining raw overlay/shadow values to semantic light/dark
  tokens, and enforced 44px link hit targets on both axes.
- Clean comparison: 96 passed, 56 explicit real-auth skips, zero diffs. All 68 new
  deterministic protected-state images were generated; representative board selected,
  board error/retry, analytics data-viz, and profile destructive screenshots were
  visually inspected across desktop/mobile and light/dark.

## Controller/reviewer gate still required

## Second adversarial remediation

- Added permanent adversarial probes for a raw button inside `Field`, an
  `rf-control-bypass` lookalike class, a 30px base `.cta`, static `calc()` overflow, and
  a new `RolefitBoard` geometry mutation. Exact class tokens, tag-specific Field handling,
  action-class CSS recognition, static CSS-expression parsing, and exact-node board
  geometry annotations now reject all five while the production scan remains clean.
- Replaced the eight generic board-state branches with deterministic stories around the
  production `JobDetail` and `JobList` components using representative typed job,
  résumé, cover-letter, and application-package data. The analytics story now uses the
  production `HBarCard`; generic gallery primitives remain supplemental.
- Selected and rejected stories render the production two-pane composition: `JobList`
  supplies the real selected `JobCard`, while the adjacent `JobDetail` supplies the real
  rejected status/actions. A structural contract locks the selected id and rejected view
  wiring rather than accepting a gallery approximation.
- Runtime review of the production-backed applied story exposed a short Undo action below
  the two-axis 44px target. The production `Button` contract guaranteed only minimum
  height; the applied chip's intentional zero inline padding exposed the missing width.
  Shared `.rf-button` now guarantees both minimum width and height, with a focused test
  tied to the real `JobDetail` Undo action. No fixture-only override was introduced.
- Manual mobile review then exposed two production flex-shrink failures: generation
  instructions could collapse into a word column beside a fixed CTA, and artifact action
  labels could shrink into several cramped lines. Production Resume/Application state
  headers now use a shared responsive row class; generation instructions and artifact
  actions stack and stretch below 520px, with full-width non-shrinking themed actions that
  retain 44px targets. A focused structural/style contract covers the actual components.
- Adversarial runtime review found the deterministic generation story supplied `loading`,
  while production `ResumePanel` recognizes `busy`. The story now supplies the real state;
  a rendered test requires the production “Tailoring…” copy, responsive busy row, and
  Cancel action, while a structural guard rejects a return to the unsupported key.
- Added `/reset-password/update` and a filesystem-to-manifest completeness contract.
- Split authenticated execution into established-user `VISUAL_AUTH_STATE_JSON` and
  profile-less-user `VISUAL_ONBOARDING_AUTH_STATE_JSON`. Each route selects its declared
  state; CI validates and requires both before its unconditional full matrix.
- Focused scanner/route contracts and typecheck pass. Updated production-component PNGs
  still require regeneration and inspection: the browser command was rejected by the
  execution platform's usage-limit gate, so no stale baseline is being presented as
  current evidence.

- Real authenticated Playwright baselines were not generated because no exportable
  Playwright storage states were available to this implementer. The controller owns the
  live authenticated browser matrix and independent adversarial review; this report
  does not claim the final Phase 9/definition-of-done gate has passed.
