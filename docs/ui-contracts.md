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

The agent page has seven fixture states (`/ui-gallery/states/agent-page-*`: empty,
conversation, surface, failed, blocks, layout, code) that render the production page
layout and chat with fixed data. They run in the shared matrix above. Three of them
(conversation, surface, failed) also run at 1024, 1280 and 2000 wide in
`tests/visual/agent-page-widths.spec.ts`, which adds a check that the conversation list,
toolbar, transcript, composer and surface column never overlap; its baselines are named
`<route id>-w<width>-<theme>.png`. Both specs share the runtime checks in
`tests/visual/runtime-contracts.ts`.
The canonical screenshot baseline platform is the pinned Playwright Linux container
(`mcr.microsoft.com/playwright:v<version>-noble` on `ubuntu-24.04`, where `<version>` is the
exact `@playwright/test` pin in `dashboard/package.json`). Both public and authenticated CI
comparisons run in it so committed screenshots are never evaluated with a different font
rasterizer. Upgrading Playwright means bumping the pin and the image tag together and
regenerating every baseline. `playwright.config.ts` refuses `--update-snapshots` on any
platform other than Linux.

Commands:

```bash
VISUAL_BASE_URL="https://your-preview.vercel.app" \
VISUAL_AUTH_EMAIL="..." \
VISUAL_AUTH_PASSWORD="..." \
VISUAL_ONBOARDING_EMAIL="..." \
VISUAL_ONBOARDING_PASSWORD="..." \
VERCEL_AUTOMATION_BYPASS_SECRET="..." \
npm run test:visual
npm run test:visual:public       # committed, always-on public CI subset
npm run test:visual:update       # Linux only; use scripts/visual-baselines-docker.sh elsewhere
```

The four identity credential variables belong to dedicated synthetic test identities and
must never be committed. The established identity must render the board and profile routes; the
profile-less identity must render `/onboarding` without redirecting. The full local command
creates isolated, disposable Playwright storage states beneath
`test-results/visual-auth/`, fails explicitly when any credential or expected redirect is
wrong, runs the comparisons, and leaves the ignored state files available only for local
cleanup. Delete them after use.

Ordinary pull-request CI continues to run the public/deterministic gate without secrets.
Authenticated coverage is a separate workflow, `Authenticated visual`, started by Vercel's
`repository_dispatch` event (`vercel.deployment.success`) for successful Preview
deployments, so it always runs the workflow file from `main`. A secret-free first job
runs only when the deployed commit belongs to an open pull request from this repository
whose author is a person, not a bot, and posts the commit status `Authenticated visual`
(pending, then success or failure) on that commit. The comparison job checks out the exact
deployed SHA, validates the HTTPS `*.vercel.app` URL as the first executable step after
checkout, rejecting userinfo and non-default ports before any installation, and uses the
GitHub Environment `visual-test`, which exists to scope the secrets below to this job.
That environment must define `VISUAL_AUTH_EMAIL`, `VISUAL_AUTH_PASSWORD`,
`VISUAL_ONBOARDING_EMAIL`, `VISUAL_ONBOARDING_PASSWORD`, and
`VERCEL_AUTOMATION_BYPASS_SECRET`; a boolean-only presence
preflight runs before installation, while raw credentials are exposed only to the
browser steps that need them. Identity credentials remain exclusive to authentication setup;
the setup and comparison steps receive the deployment URL and Vercel bypass secret. Following
[Vercel's Protection Bypass for Automation guidance](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation),
Playwright sends `x-vercel-protection-bypass` and
`x-vercel-set-bypass-cookie: true` as HTTP headers so navigation and follow-up browser requests
reach the protected preview. Never put the bypass secret in the preview URL. An `always()`
cleanup removes both generated state files. Authentication setup, authenticated
comparison, and the aggregate credential-bearing command disable Playwright tracing so
session material cannot enter `trace.zip`; video is also disabled and credential-bearing CI
does not generate an HTML report. Public-only comparisons still retain failure traces. The
authenticated failure artifact uploads PNG comparison evidence only, excluding error context,
headers, traces, and authentication state. Do not restore the obsolete storage-state JSON secrets.

Baseline changes are review artifacts: update only after intentional UI changes, inspect
every changed PNG, and commit the PNGs with the implementation. Never use
`--update-snapshots` merely to make a failing comparison green.
Generate baseline updates with the `Visual baselines` workflow: dispatch it from `main`,
name the pull request's branch, and pick the `public` or `authenticated` scope (the
authenticated scope also needs the branch's Vercel Preview URL and uses the `visual-test`
secrets). It renders in the pinned container and commits only PNGs under
`dashboard/tests/visual/__screenshots__` to that branch; it never writes to `main` and never
force-pushes. Its commit does not start CI by itself, so CI results appear with your next
push to the branch. For public screens you can also run
`dashboard/scripts/visual-baselines-docker.sh` locally with Docker. Before merging,
inspect every changed PNG at both viewports and themes in the pull request diff and approve
it through normal review. Comparison CI never updates snapshots automatically.
Never loosen screenshot tolerances to absorb a platform mismatch; investigate the runner or
create separately reviewed baselines.
