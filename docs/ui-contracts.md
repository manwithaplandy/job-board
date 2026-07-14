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
and destructive states. Board stories render the production `JobDetail`/`JobList`
components with representative typed data, and analytics uses the production chart
component, so production-surface changes affect their baselines. These stories complement
rather than replace real authenticated route screenshots. A filesystem contract requires
every real page (including `/reset-password/update`) in the manifest. Before every comparison the spec checks document overflow,
browser-default styling, both dimensions of the 44px target, shell count, and exact SVG
provenance. Committed comparisons use a 0.5% maximum differing-pixel ratio and a 0.2
per-pixel threshold; dynamic regions must use an explicit, reviewed mask instead of a
broader global tolerance. Baselines in `tests/visual/__screenshots__` are committed.
Traces, diff output, and HTML reports are disposable and ignored through `.gitignore`.

Commands:

```bash
VISUAL_BASE_URL="https://your-preview.vercel.app" \
VISUAL_AUTH_EMAIL="..." \
VISUAL_AUTH_PASSWORD="..." \
VISUAL_ONBOARDING_EMAIL="..." \
VISUAL_ONBOARDING_PASSWORD="..." \
npm run test:visual
npm run test:visual:public       # committed, always-on public CI subset
npm run test:visual:update       # intentionally refresh public baselines after review
```

The four credential variables belong to dedicated synthetic test identities and must never
be committed. The established identity must render the board and profile routes; the
profile-less identity must render `/onboarding` without redirecting. The full local command
creates isolated, disposable Playwright storage states beneath
`test-results/visual-auth/`, fails explicitly when any credential or expected redirect is
wrong, runs the comparisons, and leaves the ignored state files available only for local
cleanup. Delete them after use.

Ordinary pull-request CI continues to run the public/deterministic gate without secrets.
Authenticated coverage is a separate `deployment_status` workflow for successful Vercel
Preview deployments. It checks out the exact deployed SHA, validates the HTTPS
`*.vercel.app` URL as the first executable step after checkout, rejecting userinfo and
non-default ports before any installation, and uses the protected GitHub Environment
`visual-test`. That environment must define `VISUAL_AUTH_EMAIL`, `VISUAL_AUTH_PASSWORD`,
`VISUAL_ONBOARDING_EMAIL`, and `VISUAL_ONBOARDING_PASSWORD`; a boolean-only presence
preflight runs before installation, while raw credentials are exposed only to the
authentication setup step. The comparison step receives only the deployment URL, and an
`always()` cleanup removes both generated state files. Authentication setup, authenticated
comparison, and the aggregate credential-bearing command disable Playwright tracing so
session material cannot enter `trace.zip`; public-only comparisons still retain failure
traces. The authenticated failure artifact explicitly excludes every `trace.zip` as a
second boundary. Do not restore the obsolete storage-state JSON secrets.

The first authenticated run is expected to fail when reviewed baselines do not yet exist.
Download the `authenticated-visual-results` failure artifact, confirm it contains only files
from `dashboard/test-results/visual/` with no auth JSON or `trace.zip`, inspect every actual
PNG at both viewports and themes, and copy only approved images into
`tests/visual/__screenshots__`. Commit those reviewed baselines normally and rerun the
deployment workflow. CI never updates snapshots automatically.

Baseline changes are review artifacts: update only after intentional UI changes, inspect
every changed PNG, and commit the PNGs with the implementation. Never use
`--update-snapshots` merely to make a failing comparison green.
