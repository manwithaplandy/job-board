# Task 3 Fix Round 1 independent requirements / quality re-review

Spec verdict: **FAIL**  
Quality verdict: **CHANGES_REQUIRED**

Reviewed the complete forward fix from `6538fc70a8dc5d49d3a0812f18542730c49c381b`
to `3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061` in the lifecycle-recovery
worktree. HEAD was verified again before writing this report. Scope is the
original R1–R3 findings and Important/Critical regressions introduced by this
forward fix. This is not a new whole-task baseline review or a replacement for
the separate security review. No implementation or Git mutations were made.

## Finding

### FR1-R1 — P2 / Important: A failed weekly enrichment now suppresses its own retry for seven days

**Locations:** `company_discovery/worker.py:313`, `:316`, `:329`, `:330`, and
`:355`; the seven-day interval is defined at `:32`.

The new commit at line 329 correctly ends the company-write transaction before
HTTP enrichment, but also makes the newly inserted `discovery_runs` row durable
while it is still `running`. If enrichment persistence raises, or the worker
stops between that commit and the final completion write, the error handler's
rollback cannot remove this marker. The next cycle selects `max(started_at)`
without considering completion or status and returns for seven days. Pending
companies therefore remain unenriched after a transient failure, and the run is
left indefinitely marked `running`. Previously, that failure rolled back the
new run marker and the next cycle could retry. The existing isolation comment
at lines 345–352 still describes retrying failed ticks on subsequent cycles.

This is introduced by the fix to original R1, whose required correction
explicitly preserves retry, partial-result, accounting, and failure semantics.
It is not a request for a future lifecycle feature or a different scheduling
policy.

**Independent reproduction:** In a fresh owned PostgreSQL 17.11 harness, call the
real `_maybe_ingest` with one local synthetic candidate and a fake enrichment
fetch. The fetch asserts the real connection is IDLE. Wrap the real
`apply_enrichment` to perform its write and then raise once. Roll back as the
production `process_one` handler does, restore normal persistence, and invoke
`_maybe_ingest` again on the same database. No HTTP/provider operation occurs.
The completed diagnostic reports:

```json
{
  "after_transient_failure": [{"status": "running", "finished_at": null, "ingested": null}],
  "pending_after_failure": 1,
  "fetches_on_retry": 0,
  "after_retry": [{"status": "running", "finished_at": null, "ingested": null}],
  "pending_after_retry": 1
}
```

**Required correction:** Preserve the short transaction/network separation and
already committed enrichment batches while making an incomplete or failed weekly
tick retryable. Its newly durable start marker must not count as a successfully
completed weekly tick. Account for the interruption window as well as an ordinary
caught persistence exception, and keep run status/counts truthful. Add a regression
that fails persistence after the new pre-network commit and then invokes the next
cycle, proving pending enrichment is retried. The current successful-weekly test
(`tests/test_lifecycle_company_boundaries.py:116`) and separate helper batch-rollback
test (`:227`) do not exercise that composition.

## Disposition of original findings

| Original finding | Scoped assessment at Fix HEAD |
| --- | --- |
| R1: company HTTP/model/throttle transaction boundaries | The boundary defect is repaired in the inspected callers: `fetch_batches` completes each group of at most 50 results before exposing them to persistence; enrichment and both backfills close selection reads and commit/rollback bounded batches; company review and classification close no-result reads; SERP results commit before the next HTTP/throttle; client close/tracing follow transaction cleanup. Candidate patches occur only after a successful commit, and prior batches survive a later failed batch. The new weekly retry regression above prevents accepting this finding's full compatibility requirement. |
| R2: cached Greenhouse questions and false board failures | Resolved. `job_discovery/run.py:88` supplies only admissible IDs; `legacy_spool.py:58` excludes cached IDs and bounds the missing backlog query; persistence uses `overwrite=False` at `run.py:23` and `:113`, including a cache inserted during the fetch race. Optional row/byte/time exhaustion stops question work without marking complete source enumeration failed. Existing feed failure/overflow remains fail closed. The submitted real-run repeated-cache and all-three-budget tests cover the original failure modes. |
| R3: service sorted Job prelocks | Resolved for the original omissions. `job_discovery/db.py:186` enters the gate before selecting and locking the company's sorted Job keys for close/reopen; `job_discovery/locations.py:62` and `reviewer/backfill_floors.py:44` do the same before updates. Question persistence acquires its Job key. The expanded inventory also covers explicit account-erasure prelocks. Submitted tests inspect actual service SQL ordering; the global gate alone is not used to waive the sorted-key contract. |

## Review coverage and evidence

Read the complete `task-3-fix-1-review-package.md`, the Fix Round 1 report appendix,
the original requirements report/probe, and the approved Task 3 contract context.
Inspected the full forward source/test diff and refreshed caller inventory,
including company orchestration, both backfills, legacy question spooling,
Job writers, dashboard transaction tests, and the forward SQL changes. Verified
the package's full diff exactly equals `git diff -U10 FIX_BASE FIX_HEAD`
(308,321 characters), rather than reviewing a final hunk alone. Confirmed the
complete safety migration remains the exact `schema.sql` suffix. Compared the
complete refreshed catalog with the earlier inventory: 43 gate installations,
42 FK entries, 63 table-grant entries, and 63 column-grant entries remain
accounted for; controls remain unchanged. These are scope/consistency checks,
not a new security-gate verdict.

The forward validator deliberately permits receipt-bearing commits only at a
canonical standalone `COMMIT`/`END` boundary. Its stated exclusions include early
constraint checks, autocommit, compound/commented commit SQL, prepared transactions,
and `COMMIT AND CHAIN`. The report explicitly records that limitation, and the
actual supported psycopg explicit-commit and postgres.js transaction paths have
submitted tests, including a reserved authenticated dashboard write. No actual
supported-caller break from that boundary was identified in this requirements
review. This observation does not waive the approved commit-expiry contract or
approve arbitrary future callers; the independent security gate remains required.
No blocked security-review work was taken over or bypassed.

Inspected the actual final stdout, not only the author's summary:

- `fix1-final17.txt`: **344 passed, zero skipped**, PostgreSQL **17.11
  (Debian 17.11-1.pgdg13+2)**, 142.97 seconds.
- `fix1-final16.txt`: **344 passed, zero skipped**, PostgreSQL **16.15
  (Debian 16.15-1.pgdg13+2)**, 188.54 seconds.
- `fix1-dashboard17.txt` and `fix1-dashboard16.txt`: **5 passed each**, zero
  skipped, on the corresponding owned major versions (541 ms / 789 ms).
- `fix1-typecheck.txt`, `fix1-eslint.txt`, and `fix1-ruff.txt` record successful
  typecheck, silent ESLint success, and Ruff success. Historical failed attempts
  and corrected fixtures are retained and distinguished from final passing runs.

Those lanes were not rerun. They do not cover the failed weekly-tick retry
composition demonstrated above. The fresh targeted diagnostic is the only new
DB execution in this re-review and completed with exit status 0; that means
reproduction completed, not that the behavior passed.

## Independent artifacts and command

- `task-3-evidence/fix1-requirements-review-probe.py`
- `task-3-evidence/fix1-requirements-review-probe17.txt`

Executed with `/bin/bash`, `login:false`, in the reviewed worktree:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_fix1_requirements_probe.py
```

The saved script is identical to the executed temporary file and can be rerun
using its evidence path. It uses the owned random-port harness, validates the test
DSN and connection before installing the schema, and substitutes all external
fetches locally. The harness finished and cleaned up. No shared port 55432,
production/cloud/provider/paid calls, baseline-suite rerun, source edit, or Git
mutation was used.

Task 3 and Task 4 progression remain blocked: FR1-R1 requires author correction
and scoped re-review, and the independent security gate is separately pending.
