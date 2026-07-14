# Credential-based authenticated visual CI

**Date:** 2026-07-14  
**Status:** Approved design

## Goal

Replace long-lived Playwright storage-state secrets with fresh authenticated sessions created for every visual-regression run. The authenticated suite must test the exact Vercel deployment for the commit, keep credentials out of logs and artifacts, preserve separate established-user and onboarding states, and fail closed when trusted credentials are unavailable.

## Chosen architecture

Authenticated visual coverage moves from the ordinary `pull_request` dashboard job to a dedicated workflow triggered by a successful Vercel `deployment_status` event. The event supplies the deployed commit SHA and environment URL, so the suite exercises the deployed application rather than a local server with production database credentials.

The ordinary dashboard job continues to run typecheck, lint, Vitest, and the public/deterministic Playwright matrix. It no longer requires authenticated storage-state secrets and therefore remains a useful PR gate before deployment.

The deployment workflow:

1. Accepts only successful Vercel Preview deployments for this repository.
2. Checks out `github.event.deployment.sha`.
3. Uses a protected GitHub Environment named `visual-test`.
4. Exactly validates the deployment URL as the first executable step after checkout,
   before credential use or dependency/browser installation.
5. Validates four environment secrets through boolean presence expressions without
   exposing or printing their values:
   - `VISUAL_AUTH_EMAIL`
   - `VISUAL_AUTH_PASSWORD`
   - `VISUAL_ONBOARDING_EMAIL`
   - `VISUAL_ONBOARDING_PASSWORD`
6. Runs a Playwright setup project against `github.event.deployment_status.environment_url`.
7. Signs in through the real `/login` form twice using isolated browser contexts.
8. Verifies the established account lands on the board and can render profile routes.
9. Verifies the profile-less account lands on `/onboarding`.
10. Writes both storage states under ignored, ephemeral `test-results/visual-auth/` paths.
11. Runs the full authenticated route/theme/viewport matrix using those files.
12. Uploads traces, diffs, and missing-snapshot actual images on failure, but never uploads storage-state files.
13. Deletes the temporary states in an `always()` cleanup step.

## Playwright structure

Authentication setup is a dedicated setup project, not code inside every visual test. A small helper validates required credential variables and exports only file paths to the test configuration. The visual projects depend on setup and select the established or onboarding state according to each route's existing `authState` contract.

Local authenticated use follows the same path:

```bash
VISUAL_BASE_URL="https://preview.example" \
VISUAL_AUTH_EMAIL="..." \
VISUAL_AUTH_PASSWORD="..." \
VISUAL_ONBOARDING_EMAIL="..." \
VISUAL_ONBOARDING_PASSWORD="..." \
npm run test:visual
```

Credentials remain environment variables; generated state files remain ignored and disposable. The public command continues to skip the authentication setup and authenticated projects explicitly.

## Initial authenticated baselines

The workflow never updates committed screenshots automatically. On the first credential-backed run, missing authenticated baselines will fail and the workflow will upload only the generated actual PNGs, traces, and diff artifacts. Those images are downloaded, inspected, copied into `tests/visual/__screenshots__`, and committed through the normal adversarial review loop. Subsequent runs compare against those reviewed baselines.

## Security boundaries

- Both accounts are dedicated visual-test identities containing synthetic data only.
- Neither account is an administrator or connected to billing, production email, or real applicant data.
- Secrets live in the protected `visual-test` GitHub Environment, not in repository files.
- The environment should require approval for non-default branches before credentials are released.
- The job guard checks deployment success, creator, environment, and an HTTPS/Vercel-host
  heuristic before entering the protected job. The first executable workflow step after
  checkout then performs exact URL validation, rejecting non-HTTPS/non-Vercel hosts,
  userinfo, and non-default ports before credential use or dependency/browser installation.
- Credential presence is checked before installation using boolean secret expressions;
  raw secret values remain scoped only to the authentication setup step.
- Workflow logs must not echo environment values, form values, cookies, or storage-state contents.
- Storage-state paths are excluded from artifacts and removed even after failure.
- Fork or otherwise untrusted deployments do not receive the protected environment and cannot silently downgrade authenticated coverage.

## Failure handling

- Missing credential: fail before installing or launching the authenticated suite with the missing variable's name only.
- Login error: fail with the visible safe error message, without including submitted credentials.
- Established user redirected to onboarding: fail setup as incorrect fixture identity.
- Onboarding user redirected to the board: fail setup as incorrect fixture identity.
- Deployment URL missing, non-HTTPS, or not an approved Vercel host: fail before authentication.
- Missing baseline or visual mismatch: retain Playwright traces/diffs/actual PNGs, excluding auth state.
- Cleanup runs with `always()` and treats state deletion as mandatory.

## Testing

Tests are written before implementation and cover:

- credential validation and redacted errors;
- URL/deployment validation;
- established and onboarding state-path selection;
- public scope not requiring credentials or setup;
- authenticated scope requiring both generated states;
- CI workflow no longer reading `VISUAL_AUTH_STATE_JSON` values;
- CI workflow requiring the four credential secrets in the protected deployment job;
- artifact paths excluding the authentication-state directory;
- cleanup running under `always()`;
- route inventory preserving separate onboarding authentication.

Verification includes focused contract tests, full Vitest, typecheck, lint, production build, public visual comparison, a credential-backed deployment run, inspection and commit of initial authenticated baselines, and a final green rerun.

## Rollout

1. Implement and verify the workflow and Playwright setup using test-first development.
2. Create the protected `visual-test` GitHub Environment.
3. Add the four dedicated test-account credentials as environment secrets.
4. Trigger or rerun the Vercel deployment workflow.
5. Review and commit the first authenticated baseline set.
6. Rerun until public, authenticated, unit, and deployment checks are green.
7. Remove the obsolete storage-state secret documentation and repository secrets after confirming no workflow references them.

## Non-goals

- Creating or mutating test users from CI.
- Giving GitHub Actions the production database connection string or Supabase service-role key.
- Automatically approving screenshot changes.
- Reusing a developer's browser session.
