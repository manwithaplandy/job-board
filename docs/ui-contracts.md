# UI cohesion contracts

The dashboard UI uses one authenticated shell, one internal SVG icon set, shared
action/form primitives, semantic light/dark tokens, and a 44px minimum interaction
target. Analytics and Admin are the only route families using the documented
`rf-secondary-density--compact` surface contract; compact visual rows remain inside
44px targets or desktop overflow containers.

## Source guardrails

Run `npm run test:ui-contract` from `dashboard/`. The scanner rejects browser-default
controls, Unicode control glyphs, unapproved inline geometry, raw theme values,
undersized targets, overflow-prone route containers, missing authenticated shells,
non-system SVG icons, raw actions, and undocumented compact density. Its intentionally
bad fixtures live in `app/__fixtures__/ui-contract`; every rule must continue to reject
its matching fixture.

Exceptions are exact file paths exported from `lib/uiContract.ts`, never directory or
pattern exemptions. Raw controls are limited to semantic composite widgets that need
native listbox/menu/file/server-form behavior. Inline geometry is limited to established
board/data-visualization composites. `JobDetail`'s fit-score ring is the only non-control
SVG exception. `FunnelSection`'s process-flow arrow is prose, not a control. Any new
exception requires a code-review rationale here and a purpose-built fixture proving the
rule still rejects non-allowlisted code.

## Screenshot regression suite

Playwright's canonical inventory is `tests/visual/routes.ts`; the spec runs every entry
at 1440x1000 and 390x844 in light and dark. It also checks document overflow,
browser-default styling, target sizes, shell count, and icon provenance before comparing
the screenshot. Public baselines in `tests/visual/__screenshots__` are committed. Traces,
diff output, and HTML reports are disposable and ignored through `.gitignore`.

Commands:

```bash
npm run test:visual:public       # committed, always-on public CI subset
npm run test:visual:update       # intentionally refresh public baselines after review
VISUAL_AUTH_STATE_JSON="$(cat /secure/storage-state.json)" npm run test:visual
```

`VISUAL_AUTH_STATE_JSON` is Playwright storage-state JSON and must never be committed.
The full command fails explicitly when it is missing; authenticated coverage is not
silently skipped. CI always rejects public screenshot drift and runs the complete
authenticated matrix when the `VISUAL_AUTH_STATE_JSON` repository secret is configured.
Until that secret exists, the PR/release controller must run the complete authenticated
light/dark desktop/mobile matrix and record the evidence in the phase report.

Baseline changes are review artifacts: update only after intentional UI changes, inspect
every changed PNG, and commit the PNGs with the implementation. Never use
`--update-snapshots` merely to make a failing comparison green.
