# Task 1 Fix Round 2 scoped security re-review

Verdict: **APPROVED**

Reviewed base `a288a9ad290d45d557953c9133bc61482d571f08` through head
`204eea6ac9be1e1fd3263708577d1483f26969fb`, limited to the two residual
original security findings and Critical/Important regressions introduced by
their fixes. Read the complete 889-line pinned fix package, appended report,
and prior scoped security re-review. No whole-task rediscovery was performed.

## Prior findings

**Prior-harness name collision: resolved.** At
`tools/lifecycle_test_db.py:273`, the random container name and invocation
identity now use independent random draws. The ownership marker has 192 bits
of randomness and is no longer the name suffix. A failed same-name creation
therefore does not match the earlier harness's marker. The existing cleanup
still verifies the marker and immutable container ID before removal.
`tests/test_lifecycle_test_db.py:135` covers the exact previous representation
and failed-create path; `tests/test_lifecycle_test_db.py:587` creates a real
database through one harness, forces a second invocation to reuse its name,
and verifies the first immutable ID survives. The successful/ambiguous-create
and unrelated-name-conflict checks remain present.

**Cancellation during active inner timeout cleanup: resolved.**
`tools/lifecycle_test_db.py:125` installs temporary handlers that record
SIGTERM/SIGINT without raising during cleanup. At line 181 the process-group
cleanup uses that deferral and immediately shortens its remaining grace on
cancellation; it then escalates as needed, waits for the direct child, and
checks for live group members before propagating cancellation. Repeated
signals do not restart the grace or escape the active cleanup body. The
caller's handlers are restored. Container cleanup is likewise protected at
line 317, while retaining bounded Docker operations and identity checks.

`tests/test_lifecycle_test_db.py:218` reproduces the specific previously missed
phase: the inner command expires first, an Event acknowledges entry into its
actual group cleanup, outer cancellation follows, and a second real SIGTERM
is delivered during signal handling. The test requires the SIGTERM-ignoring
worker to have disappeared after its inner parent reaps it. This covers the
original sibling-exception-handler failure rather than merely ordinary
cancellation while waiting for the command.

## Evidence and regression assessment

- Verified current HEAD matches the reviewed head, and the package's complete
  diff exactly equals `git diff --unified=10 BASE HEAD`. There are no uncommitted
  changes in the reviewed `tools` or `tests` paths.
- The three precise new regressions are recorded failing before implementation
  (**3 failed**) and passing afterward (**3 passed**), including the real
  two-harness collision and repeated-signal process cleanup.
- Reviewed the first covering run's startup-phase failure and the retained
  diagnostic script/phase evidence. The separate observation measured creation
  at 4.777 seconds and readiness at 6.943 seconds; it did not claim to measure
  the failed run's individual probes. The ordinary nested test now acknowledges
  its running child before actual cancellation (`tests/test_lifecycle_test_db.py:480`).
  A separate real owned-container startup cancellation test at line 537 asserts
  the command never starts and the acknowledged container is removed. This
  preserves startup and running-command coverage without changing production
  deadlines or cleanup constants.
- Current committed affected-lane evidence records **86 passed, zero skipped**
  on PostgreSQL **17.11** (53.97 seconds) and **16.15** (63.40 seconds), with
  exit 0, plus passing lint and diff checks. The old full-suite results remain
  labeled as earlier-commit evidence. No claim is made that the full suite was
  repeated for this fix.
- Confirmed the catalog helper, migration tests, frozen SQL and inventory are
  unchanged from the previous reviewed fix. The previously resolved global
  default ACL and NULL-ACL ownership coverage therefore remains intact. The
  frozen SQL SHA-256 is still
  `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6`.

No remaining original security finding or Critical/Important regression was
identified within this scoped fix. No approval blockers remain for this
security re-review.

This re-review used read-only code, Git, and evidence inspection; covered tests
were not repeated. No agents, Docker/DB mutations, production/shared-resource
access, provider calls, or secret reads occurred. Only this report was written.
