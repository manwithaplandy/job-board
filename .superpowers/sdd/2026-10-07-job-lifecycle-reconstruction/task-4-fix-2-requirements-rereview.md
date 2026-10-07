# Task 4 Fix Round 2 — scoped independent rereview

**Spec verdict: PASS. Quality verdict: APPROVED.**

These verdicts cover the permitted Task 4 requirements/code-quality scope and
this focused correction. R4-1a is addressed; the earlier R4-1 timing correction
and resolved R4-2 reconnect correction remain accepted. No Critical/Important
ordinary regression was found in the complete Fix 2 diff. These verdicts do not
supply the deliberately missing security approval or certify the entire upgrade.

BASE: `7825265abac2c2e32a61ace1caebd45563128faa`.
HEAD: `e67d4f4b62c1e2f8ab096e76cd8638856b5124a8`.

Reviewed the full `task-4-fix-2-review-package.md`, actual changed source/tests,
author Fix 2 appendix and final stdout, against the prior R4-1a report/diagnostic
and applicable brief/spec requirements, scope amendment and release authorization.
The complete package equals `git diff --unified=10 BASE HEAD`. All three changed
product/test files match HEAD byte-for-byte. `run.py`, schema and gate/claim/
capacity modules are unchanged from the accepted Fix 1 state. Their unchanged
contents were not subjected to another broad baseline or security review.

## R4-1a — addressed

`job_discovery/lifecycle/maintenance.py:101` introduces
`_lock_candidate_prefix`. It sorts and deduplicates candidate Job keys, allocates
half of the remaining phase work interval to acquisition, and stops before
attempting further keys once that allocation is consumed. It uses the existing
sorted gate/key protocol and returns the acquired prefix. This reserves time for
ordinary row reads and mutations rather than requiring every candidate lock to
finish before any useful work begins.

The three callers correctly restrict subsequent work:

- **Payloads (`:129`, `:133`, `:147`, `:174`):** the row-lock/protection reads and
  payload loop use only acquired IDs. No acquired IDs returns the existing
  cursor. An unfinished payload pair retains the preceding completed cursor,
  so a resumed sweep revisits the Job and sees the already-cleared field. Keys
  never acquired are not skipped. Protected/NULL entries can still advance the
  scan as already designed.
- **Versions (`:207`):** selected versions are filtered to acquired Job keys;
  logical retired bytes are recomputed after filtering. The returned retirement
  count is the selected/deleted count, not the original candidate count. The
  separate work-unit count remains the conservative scanned-candidate count,
  which can consume the run budget sooner but does not inflate retirement.
- **Terminal demands (`:281`):** deletion filters to acquired Job keys and returns
  the actual DELETE row count. Unprocessed rows remain eligible for later
  committed chunks.

The fix does not change the durable accounting publication point after commit,
phase rotation, statement-timeout wrapper or early renewal scheduling introduced
in Fix 1. It preserves the exact 2,000/20,000 row bounds, 64 MiB logical retirement
budget, 90-second deadline, 120-second lease, renewal within 30 seconds, two-second
lock and five-second statement limits. The reviewed correction is adaptive work
sizing, not a change to database-clock or security enforcement.

## Regression evidence and its limits

The new RED evidence reproduces all three intended cases before this fix:
**3 failed / 5 passed**, covering payload, version and terminal-demand lock
acquisition. Final recorded regression coverage now includes:

- The actual payload loop over **250 paired caches**, with successful per-Job
  lock costs of **0, 0.02 and 0.11 seconds** and **0.2 seconds per mutation**.
  It checks nonzero committed retirement without blocking, all later maintenance
  phases receiving a turn, deadline/renewal assertions, and no uncleared payload
  behind the saved cursor. It retires exactly **500 payloads within at most four
  fresh sweep invocations**, avoiding skips and duplicate retirement counts.
- The corresponding owned-DB ordinary test executes normal SQL while advancing
  only the worker monotonic scheduling clock. It checks persisted cursor progress,
  exact total retirement, all descriptions cleared and all question rows removed
  within the same four-invocation fixture bound.
- Separate version and terminal-demand fixtures with **250 distinct Job keys**
  and **0.11-second successful lock calls** check sorted acquisition, deletion
  only for acquired keys, nonempty committed chunks, and complete drainage
  within **four chunks**.

These are finite bounds for the declared fixtures. They are not guarantees for
arbitrary network latency, indefinitely failing SQL, or the future Task 6 source
scheduler. The version/demand slow-lock fixtures are offline doubles; the matching
real-SQL timing evidence is for payloads. No additional runtime diagnostic was
needed: the exact prior failure case is now covered directly, and the source
inspection raised no unresolved important issue justifying another run.

Actual final stdout was inspected directly:

| Evidence | Server | Result |
| --- | --- | --- |
| `task-4-evidence/fix2-final17.txt` | PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) | **101 passed, zero skipped**, 55.99 seconds |
| `task-4-evidence/fix2-final16.txt` | PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) | **101 passed, zero skipped**, 69.19 seconds |
| `task-4-evidence/fix2-ruff.txt` | Repository Ruff | `All checks passed!` |

The exact final commands agree with the author appendix:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/ruff check .
git diff --check
git diff --cached --check
```

Covered lanes were not rerun. This is independently reviewed author test evidence,
not a claim of new reviewer-executed DB tests. The new
`task-4-evidence/reviewer_fix2_source_evidence.txt` records source SHA-256 hashes,
package equality, unchanged-module checks and actual final stdout. Earlier review
reports/diagnostics remain historical evidence of the defects at their own pins;
they are superseded by this resolution only for the findings addressed here.

## Remaining scope and release limits

No ordinary implementation finding remains open from this Task 4 review sequence.
The existing independent expiry-enforcement, capacity-accounting, cross-user-
isolation, related adversarial, stale-callback and resurrection-review gaps remain
explicitly **unreviewed and not security-approved** under the amendment. Task 3
is not fully security-approved. Neither timing doubles, SQL fixture success nor
this requirements PASS establishes those missing guarantees. No refused review
or probe was retried, split, disguised or substituted.

No source/Git mutation, DB run, external call, shared database access or subagent
was used for this rereview. No new safeguard rejection occurred. Only the scoped
report and supporting source-evidence artifact were written.

The permitted development review gate is clear for controller Library 04
checkpoint and Task 5 continuation. `RELEASE-AUTHORIZATION.md` supersedes the old
permanent deployment hold only for the completed upgrade after all 13 tasks and
permitted verification, retaining applicable safety-floor confirmations. No
release action or all-contracts certification is granted by this review; the
controller owns that later workflow.
