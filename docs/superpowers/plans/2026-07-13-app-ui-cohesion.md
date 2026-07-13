# App UI Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan phase-by-phase. Each phase requires a separate adversarial code-and-browser reviewer and must iterate until no Critical or Important findings remain.

**Goal:** Make every Rolefit screen visually cohesive, responsive, accessible, and resistant to future style drift while preserving the existing product workflows and semantic color palette.

**Architecture:** Extend the existing `components/ui` layer into a small design system, introduce one responsive authenticated app shell, and migrate screen families incrementally. Keep product logic and server data flow unchanged; visual behavior is expressed through shared components, CSS classes, and semantic tokens rather than page-local inline styles.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS custom properties, Vitest/Testing Library, the Codex in-app browser for live screenshot review.

## Global Constraints

- Preserve all existing workflows, copy, URLs, server actions, data mutations, authentication, authorization, and theme semantics unless this plan explicitly changes presentation.
- Use TDD for every behavior or regression: add a failing test, record the expected failure, implement, and run it green.
- The standard interactive target is at least 44 by 44 CSS pixels. A documented compact density may use a 36-pixel visual control only when its surrounding hit target remains 44 pixels or the surface is desktop-only tabular data.
- Support light and dark themes with the existing semantic color variables; no raw color literals in product components.
- Use a single internal SVG icon component set with 16/18/20-pixel sizes. Unicode control glyphs are forbidden for arrows, carets, edit, sparkle, close, check, warning, or disclosure icons.
- No document-level horizontal overflow at 390, 768, 1024, or 1440 CSS pixels.
- Every authenticated route uses the shared app shell. Mobile profile section navigation uses one compact section selector/menu rather than the current three-row tab wrap.
- Raw `<button>` elements are permitted only inside `components/ui` primitives or documented composite widgets whose semantic behavior cannot be expressed by a primitive; every exception is covered by a guardrail allowlist.
- Each phase ends with focused tests, full typecheck, lint, a production build when environment permits, desktop and mobile browser screenshots in both themes where relevant, and an adversarial review loop.

---

### Task 1: Phase 1 — Design tokens and foundational primitives

**Files:**
- Modify: `dashboard/app/globals.css`
- Modify: `dashboard/components/ui/Button.tsx`
- Modify: `dashboard/components/ui/Panel.tsx`
- Modify: `dashboard/components/ui/Chip.tsx`
- Create: `dashboard/components/ui/Icon.tsx`
- Create: `dashboard/components/ui/Action.tsx`
- Create: `dashboard/components/ui/FormControls.tsx`
- Create: `dashboard/components/ui/Navigation.tsx`
- Create: `dashboard/components/ui/ui.css`
- Create/modify focused `*.test.tsx` files beside the primitives

**Produces:** shared typography, spacing, radius, control-height, width, elevation, and motion tokens; `Button`, `ButtonLink`, `IconButton`, `Icon`, `TextField`, `TextArea`, `SelectField`, `FileUpload`, `Card`, `Badge`, `Tabs`, `SegmentedControl`, `BackLink`, `PageHeader`, and `FormActions` contracts.

- [ ] Add tests asserting variants, sizes, disabled/loading states, anchor semantics, 44-pixel target contracts, focus classes, icon accessibility, and form labeling.
- [ ] Run focused tests and record that they fail because the new contracts do not exist.
- [ ] Add the smallest token and primitive implementation that satisfies the tests without changing product screens.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Capture a local primitive-gallery fixture or existing consumer screenshots in light/dark at desktop/mobile widths.
- [ ] Commit with `feat(ui): establish cohesive design primitives`.

### Task 2: Phase 2 — Shared authenticated app shell and navigation

**Files:**
- Create: `dashboard/components/shell/AppShell.tsx`
- Create: `dashboard/components/shell/AppHeader.tsx`
- Create: `dashboard/components/shell/ProfileSectionNav.tsx`
- Modify: `dashboard/components/rolefit/Header.tsx`
- Modify: `dashboard/components/rolefit/SlimHeader.tsx`
- Modify authenticated layouts/pages to consume the shell
- Add shell/navigation tests

**Produces:** one logo, header geometry, top-level navigation, account affordance, active-route treatment, responsive mobile menu, and profile desktop/mobile navigation contract.

- [ ] Write failing tests for shared route navigation, active states, mobile collapse, account access, and the single-control mobile profile section selector.
- [ ] Implement the shared shell while retaining board-specific search/filter slots.
- [ ] Migrate Profile, Companies, Analytics, Billing, and Admin routes to the shell.
- [ ] Verify keyboard navigation and no overflow at all four widths.
- [ ] Capture browser screenshots for board, profile, analytics, companies, billing, and admin at 1440 and 390 pixels.
- [ ] Commit with `feat(ui): unify authenticated app shell`.

### Task 3: Phase 3 — Critical native-control and icon regressions

**Files:**
- Modify: `dashboard/components/profile/ResumeSettingsForm.tsx`
- Modify: `dashboard/components/profile/SectionFormShell.tsx`
- Modify: `dashboard/components/LocationPicker.tsx`
- Modify: `dashboard/components/ModelPicker.tsx`
- Modify profile route pages containing raw back links
- Modify board components containing Unicode controls
- Add focused regression tests

**Produces:** no browser-default résumé disclosure, file input, back link, close button, caret, edit, sparkle, success, or disclosure affordance.

- [ ] Add failing tests that identify the current native résumé button, raw back links, and Unicode control glyphs.
- [ ] Replace them with Phase 1 primitives and icons without changing actions.
- [ ] Verify résumé upload, extracted-text disclosure, picker clearing, save/cancel, and back navigation in the browser.
- [ ] Capture résumé and job-detail screenshots in both themes at desktop/mobile widths.
- [ ] Commit with `fix(ui): remove native controls and glyph icons`.

### Task 4: Phase 4 — Profile and settings visual convergence

**Files:**
- Modify: `dashboard/app/profile/profile-settings.css`
- Modify: all `dashboard/components/profile/*.tsx`
- Modify: all `dashboard/app/profile/**/page.tsx`
- Modify: `dashboard/components/account/DangerZone.tsx`
- Modify: `dashboard/components/theme/AppearanceToggle.tsx`
- Add/update profile tests

**Produces:** consistent page headers, cards, fields, labels, help/error copy, action bars, statuses, appearance controls, and danger-zone presentation.

- [ ] Add failing component/route tests for primitive usage, typography roles, card/action structure, error summaries, and mobile navigation.
- [ ] Migrate every profile section and remove redundant local geometry.
- [ ] Preserve dirty-state, validation, résumé recovery, appearance, export, billing, and deletion behavior.
- [ ] Browser-review every profile route in light/dark at 1440 and 390 pixels.
- [ ] Commit with `refactor(profile): converge settings on design system`.

### Task 5: Phase 5 — Job-board workspace and responsive reconstruction

**Files:**
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx`
- Modify: `dashboard/components/rolefit/FilterBar.tsx`
- Modify: `dashboard/components/rolefit/JobList.tsx`
- Modify: `dashboard/components/rolefit/JobCard.tsx`
- Modify: `dashboard/components/rolefit/JobDetail.tsx`
- Modify application/resume/review panels under `dashboard/components/rolefit`
- Add/update board tests

**Produces:** intentional compact density, coherent filters and actions, one selected-job signal, responsive list/detail behavior, and zero 390-pixel overflow.

- [ ] Add failing tests for primitive use, responsive header/filter contracts, selected/rejected/applied states, and no-overflow structural classes.
- [ ] Normalize filters, segmented controls, job cards, fit/status badges, detail actions, and generation panels.
- [ ] Replace the current stacked green/yellow selected treatment with one accessible selection treatment while preserving fit scores and status meaning.
- [ ] At narrow widths render list and detail as distinct full-width states with a reliable Back action.
- [ ] Browser-test empty, loading, filtering, selected, rejected, applied, error, generation, and application states.
- [ ] Commit with `refactor(board): unify responsive job workspace`.

### Task 6: Phase 6 — Companies, Billing, Analytics, and Admin convergence

**Files:**
- Modify components/pages under `dashboard/components/companies`, `dashboard/components/billing`, `dashboard/components/analytics`, and `dashboard/components/admin`
- Modify corresponding `dashboard/app/**/page.tsx` files
- Add/update focused tests

**Produces:** consistent cards/actions in Companies and Billing plus a documented compact data-density mode for Analytics and Admin.

- [ ] Add failing tests for shared primitives, action sizes, tabs, search, table overflow containers, tooltip triggers, and plan/status semantics.
- [ ] Migrate Companies cards and remove the 415-pixel mobile overflow.
- [ ] Migrate Billing plan/current-status actions.
- [ ] Migrate Analytics section navigation, toggles, information triggers, charts, and KPI cards to the compact contract.
- [ ] Migrate Admin tabs, forms, copy actions, and table containers.
- [ ] Browser-review every screen at desktop/mobile widths in both themes.
- [ ] Commit with `refactor(ui): converge secondary app surfaces`.

### Task 7: Phase 7 — Authentication, onboarding, legal, empty, loading, and error surfaces

**Files:**
- Modify auth/onboarding/legal/error pages under `dashboard/app`
- Modify `dashboard/components/OnboardingForm.tsx`
- Create/use shared `Alert`, `EmptyState`, `LoadingState`, and `ErrorState` primitives
- Add/update tests

**Produces:** entry and exceptional states that visibly belong to the same application and provide specific next actions.

- [ ] Add failing tests for shared shell/card/form primitives, action wording, error/status roles, and responsive behavior.
- [ ] Migrate login, signup, reset-password, onboarding, error, privacy, and terms surfaces without changing authentication behavior.
- [ ] Standardize empty/loading/error presentation across board and secondary pages.
- [ ] Browser-review public routes in a separate unauthenticated context and protected routes in the authenticated context.
- [ ] Commit with `refactor(ui): unify entry and system states`.

### Task 8: Phase 8 — Accessibility, interaction polish, and responsive acceptance

**Files:**
- Modify affected UI/shell/screen components
- Add accessibility and responsive contract tests

**Produces:** consistent focus, hover, pressed, selected, disabled, loading, reduced-motion, and error behavior with no route-level overflow.

- [ ] Add failing tests for accessible names, `aria-current`, disclosure state, keyboard operation, focus visibility classes, reduced-motion CSS, status text, and minimum target sizing.
- [ ] Fix every failure without changing business behavior.
- [ ] Run automated DOM measurements at 390, 768, 1024, and 1440 pixels for every route.
- [ ] Perform keyboard-only browser walkthroughs of representative workflows in both themes.
- [ ] Commit with `fix(ui): complete accessibility and responsive polish`.

### Task 9: Phase 9 — Regression guardrails and final definition-of-done audit

**Files:**
- Create: `dashboard/app/ui-contract.test.ts`
- Add browser/visual regression configuration and screenshot specs in the repository's established test location
- Modify CI/package scripts only as required to run guardrails
- Update developer documentation

**Produces:** automated prevention of raw controls, Unicode icons, unapproved inline geometry, missing theme parity, undersized targets, route overflow, and visual regressions.

- [ ] Add guardrail tests and verify each fails against a purpose-built violating fixture before enabling it on production sources.
- [ ] Add allowlists only for documented semantic composite widgets.
- [ ] Add light/dark desktop/mobile screenshot coverage for every route family and major state.
- [ ] Run the full test suite, typecheck, lint, production build, and browser acceptance matrix.
- [ ] Confirm: no browser-default controls; no document overflow; one shell; one icon system; shared action primitives; documented compact density; consistent typography/spacing/radii; accessible interaction states.
- [ ] Commit with `test(ui): enforce cohesive interface contracts`.

## Per-Phase Adversarial Gate

After each phase, the controller must record the pre-phase SHA, generate a full diff package, and dispatch a reviewer who did not implement the phase. The reviewer must inspect the diff, run targeted code checks as needed, open the deployed or local app in the in-app browser, capture desktop/mobile and light/dark screenshots, and report Critical, Important, and Minor findings. Critical and Important findings return to an implementer/fixer; the same independent reviewer (or another fresh reviewer) re-reviews the complete phase range. The next phase may start only after the gate is clean.

## Definition of Done

- No browser-default controls remain.
- Board and Companies have zero document-level mobile overflow.
- All actions use shared primitives or documented composite exceptions.
- All control icons use the internal SVG icon system.
- Every authenticated route uses the shared shell.
- Typography, spacing, radii, widths, density, and control heights follow documented tokens.
- Light/dark screenshots pass across desktop/mobile route and state coverage.
- Keyboard, focus, hover, pressed, selected, error, loading, empty, disabled, and destructive states are visually and semantically consistent.
- CI rejects new raw controls, Unicode control glyphs, theme-token drift, undersized targets, overflow, and screenshot regressions.
