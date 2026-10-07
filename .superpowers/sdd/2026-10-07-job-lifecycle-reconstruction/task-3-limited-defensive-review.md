# Task 3 limited defensive source/configuration review

Result: limited review completed; **no full security approval and no Task 3 acceptance**.
Reviewed source implementation at `a17b6427ea06c60e801836e56114890441166842`,
with controller ledger HEAD `ea38893df332bf00c1c4f254eed399e36be58a1f`.
This is controller source/configuration inspection, not a fresh independent
security review. It follows Andrew’s explicit authorization for a genuinely
narrower permitted subset. No blocked review was retried or disguised, no
reviewer/model/tool substituted, and no refused probes were reproduced.

## Work actually performed

Read repository instructions; lifecycle control defaults and ordinary stage
reading; the declaration sections of both additive migrations; the new
dashboard stage/demand parsers; dependency manifests, committed npm lockfile
and CI configuration. Inspected existing scoped business review and actual
saved test stdout. Executed read-only Git comparisons and local manifest/schema
consistency checks, saved in `limited-defensive-review-evidence.json`.
No database execution, network request, package install, vulnerability scan,
production query, or adversarial test was performed for this limited review.

## Observations within scope

- `2026-10-03-01-lifecycle-core.sql:4–23` declares all new operational flags
  off, legacy safety stage, retirement dry-run, archive never activated and
  export disabled. `config.py` reads the persisted singleton and raises when
  missing. The safety migration’s control transition declaration retains
  readiness barriers and monotonic history. These are source declarations,
  not confirmation of deployed production state or proof against bypass.
- Core migration declarations enable RLS and revoke PUBLIC/anon/authenticated
  table access for its 12 new tables. Safety migration declarations repeat
  those settings for its six additional tables. Documented exceptions include
  authenticated read-only control projection, owner-filtered receipts, and
  owner-filtered demand SELECT/DELETE plus INSERT limited to user/job/kind
  columns. This records intended grants/policies; effective runtime permissions
  and adversarial authorization behavior were not revalidated.
- The two new `lifecycle_private` helper declarations use fixed `pg_catalog`
  search paths and explicit PUBLIC/anon/authenticated execute revocations.
  Existing public `resume_matching` and `submit_feedback` remain explicit
  authenticated APIs with their own declarations. This is not a blanket
  claim that every existing definer function is private or has been audited.
- The safety migration exactly matches the current `schema.sql` suffix.
  Ordinary dashboard lifecycle parsers accept unknown inputs, validate stage
  and demand shapes, and return null for invalid shapes; no new dependency
  or unvalidated boundary cast appears in this inspected module.
- Runtime dependency declarations, requirements.txt, dashboard/package.json
  and package-lock.json are unchanged from reconstruction base `a8c4b82d…`.
  pyproject adds only lifecycle package registration. The committed npm
  lockfile root dependencies agree with package.json and CI uses `npm ci`.
  Python runtime/build requirements remain pre-existing minimum-version
  ranges with no tracked Python dependency lockfile; CI installs from those
  ranges. This is a reproducibility limitation, not a newly identified CVE
  or evidence of malicious dependencies. No current advisory or dependency
  integrity assessment was performed. Existing GitHub Actions use version
  tags rather than immutable commit SHAs; unchanged by this work.
- CI retains PostgreSQL 16 and adds a required owned PostgreSQL 17 lane;
  workflow token permissions remain `contents: read`. No cloud privileges
  or deployment action was added by these tasks.

No additional correctness/configuration defect was identified in this narrow
inspection. That statement applies only to the declarations/files above.

## Existing evidence and its limits

Actual saved output reports Fix Round 1’s 344 Python tests and five dashboard
DB tests per major (17.11 / 16.15), then final business-only Fix Round 2’s
109 tests per major, all with zero skips. Existing TypeScript, ESLint and Ruff
outputs report success. These were inspected, not rerun. The 344-test lane
predates the subsequent business-only fix and is not a final whole-suite
claim. Aggregate lanes contain tests outside this limited scope; their counts
are not adopted as a security verdict or reproduced here. The non-adversarial
weekly retry/progress/interruption/overlap evidence is covered by the separately
completed scoped requirements review.

## Explicitly unreviewed

No renewed assessment of the refused security review’s commit-expiry guarantee,
reservation/JSON capacity enforcement, cross-subject isolation/erasure behavior,
or related bypass/concurrency probes was performed. The initial review’s
findings are author-addressed but have **no completed independent security
re-review verdict**. Runtime RLS/grant effectiveness, exhaustive writer
coverage, supply-chain advisories, production configuration and whole-branch
security approval also remain outside this review.

The platform’s exact refusal and access route remain recorded in BLOCKERS.md.
The prior confirmed recovery artifact
`libfile_f456c28e1bc0819190e70b5787de71e4` is preserved unchanged.

## Decision needed

The approved workflow requires independent full security acceptance before
Task 3 acceptance and Task 4. This reduced controller review does not meet that
requirement. Continue implementation only after a legitimate full gate becomes
available, or an explicit approved-plan amendment defines a reduced, permissible
review gate and knowingly records the unreviewed areas above. Such an amendment
would change the review requirement, not authorize any refused work or production
action. Until that decision, Task 3 remains unaccepted and Tasks 4–13 remain
blocked; no independent implementation currently bypasses that prerequisite.
