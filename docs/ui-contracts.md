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

Exceptions are scoped to the smallest component or render function, never an entire file,
directory, or pattern. The TypeScript AST audit still checks unrelated and newly added
components that share an exception's file. Raw controls are limited to exact shared
composite classes or an explicitly marked semantic composite wrapper. Numeric inline
geometry is limited to named, established board/data-visualization composites.
`JobDetail`'s exact `data-fit-score-ring` SVG and SVG descendants of an exact
`data-ui-visual="data-viz"` wrapper are the only non-control SVG exceptions.
`FunnelSection`'s process-flow arrow is prose, not a control. Any new exception requires
a code-review rationale and a purpose-built fixture proving the rule still rejects code
outside the narrow scope.

## Screenshot regression suite

Playwright's canonical inventory is `tests/visual/routes.ts`; the spec runs every entry
at 1440x1000 and 390x844 in light and dark. Auth-independent fixture routes provide
deterministic coverage for selected, filtered-empty, rejected, applied, loading,
error/retry, generation, application-package, empty, data-visualization, disabled, focus,
and destructive states. These fixtures complement rather than replace real authenticated
route screenshots. Before every comparison the spec checks document overflow,
browser-default styling, both dimensions of the 44px target, shell count, and exact SVG
provenance. Committed comparisons use a 0.5% maximum differing-pixel ratio and a 0.2
per-pixel threshold; dynamic regions must use an explicit, reviewed mask instead of a
broader global tolerance. Baselines in `tests/visual/__screenshots__` are committed.
Traces, diff output, and HTML reports are disposable and ignored through `.gitignore`.

Commands:

```bash
npm run test:visual:public       # committed, always-on public CI subset
npm run test:visual:update       # intentionally refresh public baselines after review
VISUAL_AUTH_STATE_JSON="$(cat /secure/storage-state.json)" npm run test:visual
```

`VISUAL_AUTH_STATE_JSON` is Playwright storage-state JSON and must never be committed.
The full command fails explicitly when state is missing; authenticated coverage is never
silently skipped. CI is fail-closed: it unconditionally validates the repository secret,
runs the public/deterministic gate, and then runs the complete authenticated matrix. A
missing or malformed `VISUAL_AUTH_STATE_JSON` therefore fails the dashboard job instead
of downgrading coverage. Until that secret and real authenticated baselines exist, this
phase remains externally blocked even when the deterministic 96-screenshot gate passes.

Baseline changes are review artifacts: update only after intentional UI changes, inspect
every changed PNG, and commit the PNGs with the implementation. Never use
`--update-snapshots` merely to make a failing comparison green.
