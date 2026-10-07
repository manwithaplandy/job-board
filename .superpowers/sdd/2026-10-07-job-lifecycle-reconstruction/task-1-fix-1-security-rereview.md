# Task 1 Fix Round 1 scoped security re-review

Verdict: **CHANGES_REQUIRED**

Scope: original security findings and Critical/Important regressions in their
fixes only. Reviewed `241ba32c1b5a815659c215b017b3d3afc304a6e0` through
`a288a9ad290d45d557953c9133bc61482d571f08`. Read the original security review,
task brief, appended implementation report, and complete 957-line fix package.
Verified current HEAD and exact complete package diff against those pins.

## [P2 / Important] Outer cancellation can interrupt an inner timeout cleanup

Location: `tools/lifecycle_test_db.py:216` (related lines 219–223).

Original descendant-cleanup finding remains open. A nested runner first times
out its own command and enters `_stop_command_group` inside the
`except subprocess.TimeoutExpired` suite. If the outer timeout sends SIGTERM
while that cleanup is waiting, `_termination_handlers` raises
`_HarnessTermination` from inside this exception handler. The sibling
`except BaseException` cannot catch an exception raised from another handler,
so its one-second cancellation cleanup is bypassed. The inner runner exits,
but its command is in a separate session/process group and survives the outer
group cleanup.

This is the same original resource-lifetime concern, with the new signal
handler creating a still-uncovered cancellation point. The recorded nested
regression leaves the nested command deadline at 1,800 seconds and expires the
outer runner at eight seconds; it never enters the inner timeout handler before
cancellation.

Independent offline real-process reproduction used synthetic loopback DSNs
without making any DB connection. An inner runner had a 0.2-second deadline and
a 20-second grace; its worker acknowledged its PID, ignored SIGTERM, and waited.
The outer runner had a one-second deadline and a 0.5-second grace. An observation
wrapper confirmed entry into the real inner cleanup; no cleanup behavior was
mocked. Output:

```text
inner_timeout_cleanup_started True
outer_returncode 124
inner_worker_alive_after_outer_return True
synthetic_worker_cleaned_and_reaped True
```

The reviewer process temporarily adopted descendants, killed and reaped the
single synthetic survivor, and restored its subreaper state. No process or
container was left behind by this probe.

Required correction: make cleanup survive cancellation while already executing
the timeout/error cleanup path, with a bounded escalation deadline. Ensure a
second signal cannot simply escape that path. Add a regression that waits for
inner timeout cleanup to start before triggering outer cancellation, and checks
the nested command is terminated and reaped. Keep the existing ordinary nested
container timeout coverage.

## [P2 / Important] A prior harness name collision also collides with its marker

Location: `tools/lifecycle_test_db.py:237` (cleanup acceptance at line 182).

Original conflicting-container ownership finding remains open for a collision
with another invocation of this same harness. `owner` is the generated name
suffix, and the identical value becomes `poller.lifecycle-test.owner`. Thus an
already-existing harness container with the same name necessarily has the same
marker. After `docker run` rejects that name, cleanup looks up the existing
container, accepts its marker, and removes its immutable ID. Immutable-ID
removal prevents a name replacement race but does not establish which
invocation created this pre-existing object.

The new negative tests use an existing container with a deliberately different
marker (`someone-else` / `sentinel-...`). They cover an unrelated manually named
object, but not an earlier harness invocation with the colliding suffix. The
96-bit collision remains extremely unlikely; this is the original exceptional
ownership invariant, not evidence of an actual collision in the recorded runs.

Independent offline reproduction forced a synthetic name suffix, made Docker
`run` raise exit 125, and made `inspect` return the prior harness's marker (the
same suffix) with a synthetic 64-character immutable ID. All Docker operations
were replaced by a double. Output:

```text
prior_harness_conflict_returncode 2
prior_harness_container_removal_requested True
```

Required correction: distinguish invocation ownership from the reusable name
(for example, an independently generated marker), and avoid removal when a
failed create refers to a prior invocation. Add a conflict regression modeled
on an existing container created by the harness itself. Retain the successful
and ambiguous-create ID/marker checks.

## Resolved finding and reviewed evidence

**Global default privileges: resolved.** `tests/lifecycle_helpers.py:119`
uses a left namespace join and explicitly includes `defaclnamespace=0`, with
role, scope, object type, and ACL preserved. `bootstrap_schema` rejects
inherited global default ACLs before dropping public. Real regression tests
cover a migration changing only a global default grant and bootstrap rejection
without changing the existing jobs table OID; their cleanup restores the
changed defaults. The adjacent ownership comparison changes retain stable
table/sequence/function/schema owner names and have four NULL-ACL owner-change
regressions. No Important regression was found in these catalog changes.

The current fix evidence records **82 passed, zero skipped** on PostgreSQL
**17.11** and **16.15**, plus passing lint/diff checks. These affected lanes
cover the ordinary conflict, successful/ambiguous creation, forced descendant,
nested timeout, global-default and owner-drift paths. They were not rerun;
the two independent offline probes above address specific missing adversarial
cases. The initial 899-test full-suite results were correctly labeled as
pre-fix evidence and were not treated as a post-fix run.

No whole-task rediscovery, production/cloud/provider calls, secret reads,
Docker mutations, or PostgreSQL connections were performed. Only this report
was written. Approval remains blocked by the two original findings above.
