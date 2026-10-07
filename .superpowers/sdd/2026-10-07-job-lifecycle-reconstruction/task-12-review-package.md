# Full pinned review package

BASE: 0f87454e965f3ef8d06b18ce93d23ea621d53b6f

HEAD: 5ac3beebffcc2d37eb506610015e40ce5f3c7b99

## Commits

5ac3beebffcc2d37eb506610015e40ce5f3c7b99 docs: record Task12 projection verification and limits
a6dd9193076dad21017bf53b49965c7df168452d feat: project public archive with terminal retention gaps


## Files

 .../task-12-evidence/collection.txt                |  50 ++
 .../task-12-evidence/commands.md                   |  21 +
 .../task-12-evidence/dev1.exit                     |   1 +
 .../task-12-evidence/dev1.raw.txt.gz               | Bin 0 -> 52 bytes
 .../task-12-evidence/dev1.txt                      |   2 +
 .../task-12-evidence/dev2.exit                     |   1 +
 .../task-12-evidence/dev2.raw.txt.gz               | Bin 0 -> 633 bytes
 .../task-12-evidence/dev2.txt                      |  23 +
 .../task-12-evidence/dev3.exit                     |   1 +
 .../task-12-evidence/dev3.raw.txt.gz               | Bin 0 -> 52 bytes
 .../task-12-evidence/dev3.txt                      |   2 +
 .../task-12-evidence/dev4.exit                     |   1 +
 .../task-12-evidence/dev4.raw.txt.gz               | Bin 0 -> 52 bytes
 .../task-12-evidence/dev4.txt                      |   2 +
 .../task-12-evidence/final-before.sha256           |   8 +
 .../task-12-evidence/final-hash-verification.txt   |   8 +
 .../task-12-evidence/green.exit                    |   1 +
 .../task-12-evidence/green.raw.txt.gz              | Bin 0 -> 52 bytes
 .../task-12-evidence/green.txt                     |   2 +
 .../task-12-evidence/inventory.md                  |  12 +
 .../task-12-evidence/red.exit                      |   1 +
 .../task-12-evidence/red.raw.txt.gz                | Bin 0 -> 447 bytes
 .../task-12-evidence/red.txt                       |  16 +
 .../task-12-evidence/ruff.txt                      |   1 +
 .../task-12-evidence/utc-red.exit                  |   1 +
 .../task-12-evidence/utc-red.raw.txt.gz            | Bin 0 -> 515 bytes
 .../task-12-evidence/utc-red.txt                   |  23 +
 .../task-12-evidence/utc-red2.exit                 |   1 +
 .../task-12-evidence/utc-red2.raw.txt.gz           | Bin 0 -> 514 bytes
 .../task-12-evidence/utc-red2.txt                  |  23 +
 .../task-12-evidence/versions.txt                  |   5 +
 .../task-12-report.md                              |  83 ++++
 job_discovery/archive/replay.py                    | 501 +++++++++++++++++++++
 job_discovery/archive/schema.py                    |  17 +
 job_discovery/archive/types.py                     |  41 ++
 tests/test_archive_replay.py                       | 421 +++++++++++++++++
 36 files changed, 1269 insertions(+)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt
new file mode 100644
index 0000000..27c55da
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt
@@ -0,0 +1,50 @@
+tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times
+tests/test_archive_replay.py::test_conflicting_exact_id_fails_closed_even_after_good_fact
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes0]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes1]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes2]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes3]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes4]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes5]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes6]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes7]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes8]
+tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes9]
+tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only
+tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries
+tests/test_archive_replay.py::test_later_baseline_does_not_invent_earlier_history
+tests/test_archive_replay.py::test_authorized_suppression_dominates_current_noncurrent_and_later_epochs
+tests/test_archive_replay.py::test_suppressed_endpoint_invalidates_dependent_facts
+tests/test_archive_replay.py::test_expired_duplicate_does_not_invalidate_eligible_authorized_reseal
+tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon
+tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[canonical_data]
+tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[compressed_data]
+tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[manifest_data]
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits0]
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits1]
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits2]
+tests/test_archive_replay.py::test_deadline_fails_closed
+tests/test_archive_replay.py::test_depth_limits_json_and_predecessor_walk
+tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs0]
+tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs1]
+tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs2]
+tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs3]
+tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs4]
+tests/test_archive_replay.py::test_explicit_admin_policy_and_aware_time_required
+tests/test_archive_replay.py::test_pure_projection_has_zero_application_or_external_calls
+tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal
+tests/test_archive_replay.py::test_missing_prefix_cannot_project_relationship_or_lifespan
+tests/test_archive_replay.py::test_prefix_dependent_fact_expires_with_earliest_baseline
+tests/test_archive_replay.py::test_predecessor_walk_stops_at_depth_with_normal_json
+tests/test_archive_replay.py::test_disjoint_retained_ranges_never_claim_missing_revisions
+tests/test_archive_replay.py::test_complete_relation_assertion_retracts_without_identity_inference
+tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True]
+tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-2]
+tests/test_archive_replay.py::test_invalid_iterable_member_returns_sanitized_error
+tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
+tests/test_archive_codec.py::test_canonical_utf8_sorted_jsonl_and_zero_time_gzip
+tests/test_archive_codec.py::test_total_public_schema_rejects_private_or_oversize_data
+tests/test_archive_codec.py::test_schema_enforces_complete_relation_endpoints_and_version_identity
+tests/test_archive_codec.py::test_body_is_bounded_and_gzip_single_event_boundary
+
+48 tests collected in 0.10s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md
new file mode 100644
index 0000000..ec74881
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md
@@ -0,0 +1,21 @@
+# Exact verification commands and outputs
+
+Working directory: /workspace/job-board/.claude/worktrees/lifecycle-recovery. Shell /bin/bash, login:false. Commands below used .venv/bin/python explicitly. Each pytest stdout/stderr was redirected to its named .txt and `$?` written to its matching .exit. Readable outputs normalize trailing whitespace only; deterministic .raw.txt.gz preserves each exact original output.
+
+- red.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
+- dev1.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
+- dev2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
+- dev3.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
+- dev4.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
+- utc-red.txt and utc-red2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days -q`
+- green.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
+- collection.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py --collect-only -q`
+- formatting before GREEN: `.venv/bin/python -m ruff format job_discovery/archive/replay.py tests/test_archive_replay.py`
+- ruff.txt: `.venv/bin/python -m ruff check job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`
+- final-before.sha256: `sha256sum job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py job_discovery/archive/batches.py job_discovery/archive/codec.py job_discovery/archive/s3.py pyproject.toml`
+- final-hash-verification.txt: `sha256sum -c .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256`
+- versions.txt: `.venv/bin/python` printing sys.version and importlib.metadata.version for pytest, ruff, psycopg; explicitly records no PostgreSQL run.
+- source whitespace: `git diff --cached --check` after staging exactly the four owned files; exit0/no output.
+- upstream: `git ls-remote origin refs/heads/main` -> a8c4b82d95b35c0259600c19c1506faae807c3fc; `git merge-base --is-ancestor a8c4b82d95b35c0259600c19c1506faae807c3fc HEAD` -> exit0.
+
+Source forward commit: `git add job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`; `git commit -m "feat: project public archive with terminal retention gaps"` -> a6dd9193076dad21017bf53b49965c7df168452d. No source changes after final GREEN. Report/evidence have a separate forward documentation commit.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz
new file mode 100644
index 0000000..2be75c1
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt
new file mode 100644
index 0000000..640eb92
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt
@@ -0,0 +1,2 @@
+....................................                                     [100%]
+36 passed in 0.19s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz
new file mode 100644
index 0000000..7336726
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt
new file mode 100644
index 0000000..b1b5723
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt
@@ -0,0 +1,23 @@
+........................................F..                              [100%]
+=================================== FAILURES ===================================
+_ test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True] _
+
+field = 'serializer_version', value = True
+
+    @pytest.mark.parametrize("field,value", [("serializer_version", True), ("serializer_version", 2)])
+    def test_total_manifest_rejects_unknown_or_boolean_serializer(field, value):
+        item = manifest(event())
+        # A total reader also rejects the boolean/1 equality ambiguity.
+        ref = replace(item.seal.batch, **{field: value})
+        seal = replace(item.seal, batch=ref)
+        if value is True:
+            seal = seal_batch(ref)
+        result = project(replace(item, seal=seal))
+>       assert result.errors and not result.facts
+E       AssertionError: assert (())
+E        +  where () = ProjectionResult(applied_event_ids=(UUID('05a808bb-f2dc-502a-a1d9-2d428b4aa161'),), ignored_event_ids=(), facts=(Proje...omplete_history=False),), gaps=(), retained_revision_ranges=(('jobs', 'job-1', 1, 1),), errors=(), suppression_epoch=0).errors
+
+tests/test_archive_replay.py:258: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True]
+1 failed, 42 passed in 0.35s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz
new file mode 100644
index 0000000..1a59847
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt
new file mode 100644
index 0000000..aa61483
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt
@@ -0,0 +1,2 @@
+...............................................                          [100%]
+47 passed in 0.26s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz
new file mode 100644
index 0000000..c8dedd3
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt
new file mode 100644
index 0000000..300e10f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt
@@ -0,0 +1,2 @@
+...............................................                          [100%]
+47 passed in 0.23s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256
new file mode 100644
index 0000000..1152643
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256
@@ -0,0 +1,8 @@
+0d6e3998760a5b6e05f49186c42c71fe8388afe7b7f9c8ea1fd83aa8317355be  job_discovery/archive/replay.py
+1d5e19a3bd937b51f34f16fcd56a1354d46c34c13370c2f69517ac19f2dd5ff5  job_discovery/archive/schema.py
+3bb96646d2e9225a9b65a821af7612c69d2a118b13738e180c97c71171862330  job_discovery/archive/types.py
+629b2518a264c2daacd6788148d5cd74a0bf44bce8c5d7696aa61dc68a794ba7  tests/test_archive_replay.py
+ec3b17f1cf76526ff22adcaf21648719ac6901479785e4cd4162a8d69dfd45d6  job_discovery/archive/batches.py
+4c9075ec074c2b8896a8c575ee61f4cf1401bfb0e0335dc9e69ad0218403230b  job_discovery/archive/codec.py
+24fa2a2fd6ea996208fb60c8ded22fed701f6c2c7862657235aa62431a295233  job_discovery/archive/s3.py
+e7396bb84fdd2f4bb67e3dbcd7a4576e1350e1573c6409de323125b3efe90459  pyproject.toml
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt
new file mode 100644
index 0000000..6d300f8
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt
@@ -0,0 +1,8 @@
+job_discovery/archive/replay.py: OK
+job_discovery/archive/schema.py: OK
+job_discovery/archive/types.py: OK
+tests/test_archive_replay.py: OK
+job_discovery/archive/batches.py: OK
+job_discovery/archive/codec.py: OK
+job_discovery/archive/s3.py: OK
+pyproject.toml: OK
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz
new file mode 100644
index 0000000..5a8afb9
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt
new file mode 100644
index 0000000..35814cb
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt
@@ -0,0 +1,2 @@
+................................................                         [100%]
+48 passed in 1.11s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md
new file mode 100644
index 0000000..0fb3b93
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md
@@ -0,0 +1,12 @@
+# Pre-execution Task12 inventory
+Only tests/test_archive_replay.py executes in RED and development. Synthetic seal_batch inputs with in-memory fixture suppression snapshots; no DB fixture, SDK, network, providers, file deletion, activation or old security suites. Exact ordinary contents before execution: ID/hash duplicate and conflict; shuffled/stale revisions and timestamp provenance; ten malformed/unknown-envelope cases; archive-only 730-day baseline retention gap and independent fields; missing predecessor unknown terminal cause; activation baseline revision5; whole-scope suppression across current/noncurrent copies and snapshot epochs; dependent scope invalidation; expired duplicate versus eligible reseal; whole projection archive horizon; three seal byte corruption cases; three finite budget cases; deterministic deadline; finite JSON/chain depth; five invalid limit cases; explicit trusted admin boundary; external/DB/subprocess call blockers. The only proposed integration regression is tests/test_archive_codec.py (all four ordinary codec/schema tests), read in full before execution. No DB behavior changes expected. No broad pytest. Test-driven skill's broad-suite suggestion is superseded by explicit task/review restrictions.
+
+Intended RED: missing job_discovery.archive.replay import. Command: .venv/bin/python -m pytest tests/test_archive_replay.py -q.
+
+Before implementation: add explicit outside-declared-coverage case and complete typed relationship-with-missing-prefix case proving no edge is projected. Correct malformed aggregate-ID fixture from unhashable list to None so accepted seal constructor can build the synthetic invalid envelope; the projector still rejects it. These cases remain blocked at the same missing-module RED boundary.
+
+Pre-execution extension: earliest-prefix eligibility (then independent-only recomputation); predecessor-depth cap with valid JSON nesting; exact disjoint revision ranges; complete explicit identity assertion changed to retracted without inference; serializer unknown and bool/1 total-type checks; malformed iterable member sanitized error. These are ordinary synthetic projection/interpretation cases, not old expiry/lease or adversarial security work.
+
+Before final verification: strengthen the existing zero-side-effects case with Python call tracing of reviewer/provider/lifecycle/current-state DB module boundaries, in addition to socket/psycopg/subprocess guards. Dashboard-only generation/notification code has no import or process/network bridge in this pure projection. No new external module execution is introduced by tracing.
+
+Final boundary concern before execution: accepted sealing records UTC times, so add a synthetic aware-timezone fixture requiring exactly730 elapsed UTC days, not730 wall-clock days across a DST offset. This examines only the new replay seal-window interpreter, not Task3 claim expiry.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit
new file mode 100644
index 0000000..0cfbf08
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit
@@ -0,0 +1 @@
+2
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz
new file mode 100644
index 0000000..f83213c
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt
new file mode 100644
index 0000000..576469c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt
@@ -0,0 +1,16 @@
+
+==================================== ERRORS ====================================
+________________ ERROR collecting tests/test_archive_replay.py _________________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_replay.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_archive_replay.py:13: in <module>
+    from job_discovery.archive.replay import (
+E   ModuleNotFoundError: No module named 'job_discovery.archive.replay'
+=========================== short test summary info ============================
+ERROR tests/test_archive_replay.py
+!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
+1 error in 0.35s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz
new file mode 100644
index 0000000..8b3a4c3
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt
new file mode 100644
index 0000000..059b2c5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt
@@ -0,0 +1,23 @@
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_____________ test_retention_window_requires_730_elapsed_utc_days ______________
+
+    def test_retention_window_requires_730_elapsed_utc_days():
+        from zoneinfo import ZoneInfo
+        item = manifest(event())
+        london = ZoneInfo("Europe/London")
+        # The same wall time crosses a DST offset; it is one hour short of730days.
+        start = datetime(2024, 3, 31, 1, 30, tzinfo=london)
+        end = datetime(2026, 3, 31, 1, 30, tzinfo=london)
+        ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
+        result = project(replace(item, seal=seal_batch(ref)))
+>       assert result.errors == ("invalid_seal_window",)
+E       AssertionError: assert () == ('invalid_seal_window',)
+E
+E         Right contains one more item: 'invalid_seal_window'
+E         Use -v to get more diff
+
+tests/test_archive_replay.py:420: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
+1 failed in 0.20s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz
new file mode 100644
index 0000000..a8252fb
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt
new file mode 100644
index 0000000..824026b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt
@@ -0,0 +1,23 @@
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_____________ test_retention_window_requires_730_elapsed_utc_days ______________
+
+    def test_retention_window_requires_730_elapsed_utc_days():
+        from zoneinfo import ZoneInfo
+        item = manifest(event())
+        london = ZoneInfo("Europe/London")
+        # The same wall time crosses a DST offset; it is one hour short of730days.
+        start = datetime(2024, 3, 31, 0, 30, tzinfo=london)
+        end = datetime(2026, 3, 31, 0, 30, tzinfo=london)
+        ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
+        result = project(replace(item, seal=seal_batch(ref)))
+>       assert result.errors == ("invalid_seal_window",)
+E       AssertionError: assert () == ('invalid_seal_window',)
+E
+E         Right contains one more item: 'invalid_seal_window'
+E         Use -v to get more diff
+
+tests/test_archive_replay.py:420: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
+1 failed in 0.20s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt
new file mode 100644
index 0000000..4d7a53c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt
@@ -0,0 +1,5 @@
+3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
+pytest 9.1.1
+ruff 0.15.20
+psycopg 3.3.6
+No PostgreSQL server used: pure Python only; no DB behavior change.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md
new file mode 100644
index 0000000..817ad89
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md
@@ -0,0 +1,83 @@
+# Task12 author report — bounded optional public archive projection
+
+Status: implemented and locally verified; controller-dispatched independent permitted requirements/code-quality review is pending. This is not security approval, production restoration, archive activation or release readiness.
+
+Base: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`. Source commit: **`a6dd9193076dad21017bf53b49965c7df168452d`**. Accepted Task11 source `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`, report `c91efc6`, review through `7c43e19` and checkpoint `11libfile_c221028586448191a44b35e1b8baee42` were preserved. Sole author; no helpers/subagents/reviewers were spawned.
+
+## Implemented behavior and compatibility ruling
+
+`job_discovery/archive/replay.py` adds `project_archive(manifests, policy, limits) -> ProjectionResult`, a synchronous pure optional admin projection. `Manifest` wraps an in-memory accepted immutable `SealedBatch` and opaque current/noncurrent object-version label. No loader, destination discovery, S3 access, SQL connection, bootstrap or runtime invocation is added. Only synthetic local test projections were executed.
+
+Before editing established interfaces, the author reported that Task10's `ProjectionResult` had only `applied_event_ids` and `ignored_event_ids`, and that Manifest/policy/limits types did not exist. The controller explicitly approved replay-local wrapper/policy/limits and additive defaulted result metadata following the two existing fields. Existing positional constructors remain compatible. Added metadata: facts, coverage, gaps, exact disjoint retained revision ranges, sanitized errors and suppression snapshot epoch. New fact/coverage/gap records remain in accepted archive/types.py. Existing producer/codec/seal/export behavior is unchanged.
+
+The total reader checks exact version1 envelope fields, exact deterministic event identity and predecessor, strict integer revisions/schema/serializer fields, typed allowlisted public bodies, aware occurrence/observation/record times, and accepted public provenance. It validates canonical JSON and reconstructs the complete accepted immutable seal to compare manifest/content/keys/counts/digests/membership. Unknown schema, malformed inputs, content/seal changes, conflicting event hashes or exhausted work budgets fail the whole run closed with no facts; diagnostics contain fixed error codes, never input bodies or URLs. This reuses `seal_batch` without changing accepted batching or serialization.
+
+Exact same-ID/same-hash objects deduplicate, including current/noncurrent copies. A conflicting hash fails closed regardless of ordering. Duplicates, expired objects and rejected input bytes consume the bounded input budget. An eligible explicitly resealed copy can contribute the unchanged event when an older copy has expired; suppression still overrides both. Supersession/reseal authorization itself belongs to accepted Task11; this pure reader does not grant it.
+
+Per-aggregate revisions are interpreted independently of object order and global timestamps. The latest retained event supplies projected fields, so stale arrivals cannot overwrite it. A retained baseline anchors coverage from that revision only, including activation baselines above revision1; `complete_history` is always false because pre-activation history is not established. `history_complete` on a fact means contiguous history **from its declared baseline**, not all posting history. Retained ranges are disjoint and never bridge missing revisions. Output applied IDs represent eligible interpreted events; duplicate/excluded IDs appear in ignored IDs and these can overlap when the same ID has both an excluded/duplicate copy and an eligible contributing copy.
+
+A missing predecessor is considered only within this finite run. The result reports terminal `retention_gap` with known cause `expired`, `removed`, `outside_declared_coverage` or `depth_limit`; absent evidence remains `unknown`. There is no automatic prefix fetch/retry. With an unavailable prefix, only version1 `INDEPENDENT_FACT_FIELDS` in schema.py can contribute: public descriptive identity/metadata fields, no closure/discovery/lifespan fields, foreign endpoints, inferred identity or relationships. Relationship schemas have no independent-field allowance. A complete explicit assertion can retain or retract its stated status and provenance, without inference or transitive merging. No lifespan calculation or inferred/derived relationship engine exists.
+
+Every fact includes source event ID/hash, revision, distinct occurrence/observation/recorded times, public provenance, incomplete-history flag and eligibility boundary. A prefix-dependent fact expires at the earliest seal expiry among its dependencies. Recomputing after that boundary removes expired input and changes remaining later events to independent-only facts. Pure output is not stored or maintained automatically: consumers must discard/recompute at eligibility and suppression snapshot changes. All seal windows require exactly730 elapsed UTC days, not wall-clock arithmetic across daylight-saving offsets.
+
+## Suppression precedence and trusted boundary
+
+The actual accepted service-only `public_archive_suppressions` table contains `(aggregate_type, aggregate_id, suppressed_at, reason)` and has a whole-scope primary key. It has no event epoch column. The controller approved preserving permanent whole-scope precedence across all revisions/timestamps/object versions; no schema or enforcement mechanism changed. `Suppression` fixtures mirror that snapshot. A policy `suppression_epoch` labels the trusted snapshot used; it cannot lift suppression, reinterpret an event epoch or authorize reopening. The reader does not fabricate a persisted epoch mechanism.
+
+Supplied markers win regardless of whether object copies are current/noncurrent, whether events are newer, or whether the snapshot label increases. Explicit endpoint references propagate suppression conservatively, within the depth bound, so dependent facts cannot retain removed endpoints; unfinished suppression closure fails closed. No object deletion/removal command, database marker mutation or lifecycle provisioning exists. Tests use authorized **in-memory** suppression fixtures only; no PostgreSQL tests were needed because no DB behavior changed.
+
+`ProjectionPolicy(admin_authorized=True, as_of=<aware current snapshot>, suppressions=<complete service snapshot>, ...)` is a trusted internal caller contract, not authentication infrastructure. The caller must obtain authorized read access, supply a complete current service-owned suppression snapshot and current time, and enforce output disposal. There is no end-user endpoint or current-PG bootstrap. Historical arbitrary-time access, authentication, marker retrieval, cloud object loading and serving/persisting projections are not implemented. Suppression snapshot freshness cannot be independently proved by a pure function; a future adapter must establish it before calling. This is an explicit integration limit, not a claim that a caller boolean secures external access.
+
+## Exact finite limits
+
+| Limit | Default | Maximum accepted |
+| --- | --- | --- |
+| Event occurrences, including duplicates/expired copies |10,000|100,000|
+| Input byte accounting |64MiB|128MiB|
+| Deadline |30seconds|120seconds|
+| JSON/prefix/suppression depth |64|256|
+| Input manifests |2,000|10,000|
+| Suppression/coverage snapshot entries |bounded tuple|100,000 each|
+
+Byte accounting charges canonical, compressed, manifest and member-event byte representations, including duplicate copies; it is deliberately stricter than expanded-only accounting. Every individual seal retains accepted caps of2,000 events,16MiB compressed,8MiB canonical/expanded and1MiB manifest. Each event envelope is capped at16KiB before JSON parsing; accepted body validation remains8KiB. Positive finite values only; boolean integer ambiguity and NaN/infinity are rejected. JSON nesting is scanned before recursive decoding. Predecessor traversal and suppression propagation terminate at the depth cap. Deadline checks surround bounded CPU units and occur during event/scope walks; the caller-supplied iterable must be local and nonblocking. A cooperative deadline cannot interrupt an arbitrary blocking Python iterator, OS suspension or an already-running bounded codec unit; no hard process sandbox is claimed.
+
+## Actual verification and chronology
+
+Pre-execution ordinary-case inventory is `task-12-evidence/inventory.md`, including subsequent test extensions before each execution. Final source/dependency hashes were recorded **before** final verification and verified unchanged afterward. Full output, exits, collection inventory, versions and commands are retained. No broad pytest or old security/activation suite ran.
+
+| Phase | Exact selection | Result |
+| --- | --- | --- |
+| Initial RED |new replay file|missing replay module,1 collection error,exit2,0.35s|
+| First implementation |new replay file|36 passed,exit0,0.19s|
+| Extended interpretation RED |new replay file|1 failed/42 passed,exit1,0.35s; boolean serializer accepted as integer1|
+| Corrected integration |replay + four codec cases|47 passed,exit0,0.26s|
+| Stronger side-effect assertion |same files|47 passed,exit0,0.23s|
+| UTC arithmetic RED |exact new elapsed-UTC node|1 failed,exit1,0.20s|
+| Corrected valid-local-time UTC RED fixture |same node|1 failed,exit1,0.20s|
+| **Final GREEN** |**44 replay +4 codec cases**|**48 passed,exit0,1.11s; no skips/deselections**|
+
+Final command:
+
+```text
+.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q
+```
+
+The initial malformed aggregate-ID fixture changed from an unhashable list to None so the existing synthetic seal builder could construct the envelope and the new reader could reject it. This happened before the first implementation run. The first UTC RED used01:30 at a DST transition; it was refined to valid00:30 local times and failed identically before correcting production UTC arithmetic. Both outputs are preserved. The admin/time test was renamed to describe its actual assertions; bootstrap absence is an implementation/integration fact, not claimed as a dedicated test.
+
+Final ordinary coverage includes exact-ID/hash duplicates/conflicts; stale/shuffled ordering; malformed/unknown schema/envelope fields; baseline expiry with eligible later event; terminal unknown/outside-coverage gaps; non-reconstructed lifespan/relationship fields; activation baseline revision5; current/noncurrent removed copies; snapshot labels unable to unsuppress; dependent endpoint suppression; eligible reseal after old-copy expiry; projection expiry and earliest-prefix eligibility; seal-byte corruption; finite infinite-iterator input stopping on event/byte/manifest budgets; cooperative deterministic deadline; JSON and predecessor depth; invalid finite limits; explicit admin/time contract; complete identity assertion retraction without inference; exact disjoint revision ranges; strict serializer types; elapsed UTC seal horizon.
+
+The side-effect test installs socket/psycopg/subprocess fail guards and traces Python calls at reviewer, provider, lifecycle and current-state database module boundaries: zero calls during actual projection. Dashboard generation/notification code has no import or process/network bridge. This establishes ordinary pure execution; no production system was contacted to prove a negative. It is not a substitute security test.
+
+Python3.12.14, pytest9.1.1, Ruff0.15.20 and psycopg3.3.6 recorded. Ruff passes for all four owned source/test files. Scoped staged whitespace check passes. No PostgreSQL server ran: existing PG17/16 evidence remains historical Task11 evidence, not re-attributed to Task12. No DB/RLS/claim/capacity behavior changes require a DB rerun here. No source changed after final GREEN and source commit.
+
+## Integration inventory and deliberately omitted work
+
+Owned implementation: new replay.py and test_archive_replay.py; additive result records/default fields in archive/types.py; additive independent-field constant in archive/schema.py. Existing schema validator code is unchanged. Accepted seal/codec/export/S3 modules, migration/schema.sql, dependency registration and runtime entrypoints are unchanged. No dashboard, reviewer/model/pricing settings, identity/private FKs, legacy timestamps or RLS changes. Four controller ledger files remain unstaged and excluded from author commits.
+
+Live read-only `git ls-remote origin refs/heads/main` returned `a8c4b82d95b35c0259600c19c1506faae807c3fc`, matching Task11's accepted upstream; `git merge-base --is-ancestor` verified it is already in the base. The local origin/main cache is stale (`73ce118`); it was not mistaken for live main. No upstream delta needed integration. No fetch/reset/rewrite/push/PR/merge/deploy/activation occurred.
+
+Flags remain default off, retirement dry-run, archive producer/export inactive without approved destination/readiness. No real archive objects, destination coordinates, credentials/IAM/provider/S3/production access, paid/model calls, app DB restore, current-state reopening, automatic merges, graph product or Parquet engine were used/added. No permanent deletion/removal/lifecycle-provisioning command exists. Optional current-PG bootstrap is explicitly unimplemented.
+
+Task3 expiry/physical-capacity/cross-user/adversarial reviews/probes remain deliberately omitted under the amendment. New expiry checks concern only Task12's archive-replay retention horizon, not old claims or physical accounting. No independent security verdict is inferred from these passes. Independent permitted Task12 review, all13 completion, final review and any release remain the controller's responsibility. Combined production resource sizing, approved destination validation and fresh suppression snapshot integration remain prerequisites for future use. Existing Task11/Task3 limitations are not resolved by this pure feature.
+
+No platform safeguard rejection occurred. A skill ancillary-resource read returned `failed to read skill resource`; no bypass or missing task requirement followed. The TDD skill's generic broad-suite recommendation was superseded by explicit task/review-scope restrictions. All implementation was completed within the permitted ordinary offline scope.
diff --git a/job_discovery/archive/replay.py b/job_discovery/archive/replay.py
new file mode 100644
index 0000000..538754b
--- /dev/null
+++ b/job_discovery/archive/replay.py
@@ -0,0 +1,501 @@
+"""Optional offline public projection; no I/O, restoration or runtime integration.
+
+The trusted admin caller supplies a complete service-owned suppression snapshot
+and already loaded seals from an approved archive. This module grants no read
+capability. Snapshot epochs label outputs; they can never unsuppress a scope.
+Recompute/discard projections at their eligibility boundary and on suppression
+snapshot changes. Current-PostgreSQL bootstrap is deliberately unimplemented.
+"""
+
+from dataclasses import dataclass
+from datetime import UTC, datetime, timedelta
+import hashlib
+import json
+import math
+import time
+from typing import Iterable
+from uuid import UUID
+
+from .batches import seal_batch
+from .codec import MAX_COMPRESSED, MAX_EXPANDED, MAX_MANIFEST, canonical_json
+from .schema import (
+    AggregateType,
+    ChangeKind,
+    PublicChange,
+    INDEPENDENT_FACT_FIELDS,
+    event_id,
+    validate_change,
+)
+from .types import (
+    SealedBatch,
+    ProjectionResult,
+    ProjectedFact,
+    ProjectionCoverage,
+    ProjectionGap,
+)
+
+
+@dataclass(frozen=True)
+class Manifest:
+    """In-memory exact persisted seal plus an opaque current/noncurrent label."""
+
+    seal: SealedBatch
+    object_version: str = "current"
+
+
+@dataclass(frozen=True)
+class ReplayLimits:
+    max_events: int = 10000
+    max_bytes: int = 64 * 1024**2
+    deadline_seconds: float = 30
+    max_depth: int = 64
+    max_manifests: int = 2000
+
+    def __post_init__(self):
+        for value, maximum in (
+            (self.max_events, 100000),
+            (self.max_bytes, 128 * 1024**2),
+            (self.max_depth, 256),
+            (self.max_manifests, 10000),
+        ):
+            if type(value) is not int or not 1 <= value <= maximum:
+                raise ValueError("invalid finite replay limits")
+        if (
+            type(self.deadline_seconds) not in {int, float}
+            or not math.isfinite(self.deadline_seconds)
+            or not 0 < self.deadline_seconds <= 120
+        ):
+            raise ValueError("invalid finite replay deadline")
+
+
+def _aware(value):
+    return (
+        isinstance(value, datetime)
+        and value.tzinfo is not None
+        and value.utcoffset() is not None
+    )
+
+
+def _scope(kind, identity):
+    if (
+        not isinstance(kind, str)
+        or kind not in AggregateType
+        or not isinstance(identity, str)
+        or not 1 <= len(identity.encode()) <= 2048
+    ):
+        raise ValueError("invalid projection scope")
+
+
+@dataclass(frozen=True)
+class Suppression:
+    """Trusted service snapshot of public_archive_suppressions; never a grant."""
+
+    aggregate_type: str
+    aggregate_id: str
+    suppressed_at: datetime
+    reason: str
+
+    def __post_init__(self):
+        _scope(self.aggregate_type, self.aggregate_id)
+        if (
+            not _aware(self.suppressed_at)
+            or not isinstance(self.reason, str)
+            or not 1 <= len(self.reason) <= 256
+        ):
+            raise ValueError("invalid suppression snapshot")
+
+
+@dataclass(frozen=True)
+class ProjectionPolicy:
+    admin_authorized: bool
+    as_of: datetime
+    suppressions: tuple[Suppression, ...] = ()
+    suppression_epoch: int = 0
+    coverage_starts: tuple[tuple[str, str, int], ...] = ()
+
+    def __post_init__(self):
+        if self.admin_authorized is not True or not _aware(self.as_of):
+            raise ValueError(
+                "explicit admin authorization and aware projection time required"
+            )
+        if type(self.suppression_epoch) is not int or self.suppression_epoch < 0:
+            raise ValueError("invalid suppression snapshot epoch")
+        if (
+            not isinstance(self.suppressions, tuple)
+            or len(self.suppressions) > 100000
+            or not all(isinstance(s, Suppression) for s in self.suppressions)
+        ):
+            raise ValueError("bounded suppression snapshot required")
+        if (
+            not isinstance(self.coverage_starts, tuple)
+            or len(self.coverage_starts) > 100000
+        ):
+            raise ValueError("bounded coverage declaration required")
+        seen = set()
+        for entry in self.coverage_starts:
+            if not isinstance(entry, tuple) or len(entry) != 3:
+                raise ValueError("invalid coverage declaration")
+            kind, identity, first = entry
+            _scope(kind, identity)
+            if type(first) is not int or first < 1 or (kind, identity) in seen:
+                raise ValueError("invalid coverage declaration")
+            seen.add((kind, identity))
+
+
+class _Invalid(ValueError):
+    pass
+
+
+def _json(raw, depth):
+    """Bound JSON nesting before the recursive standard decoder sees input."""
+    level, quoted, escaped = 0, False, False
+    for byte in raw:
+        if quoted:
+            if escaped:
+                escaped = False
+            elif byte == 92:
+                escaped = True
+            elif byte == 34:
+                quoted = False
+        elif byte == 34:
+            quoted = True
+        elif byte in (91, 123):
+            level += 1
+            if level > depth:
+                raise _Invalid("depth_limit")
+        elif byte in (93, 125):
+            level -= 1
+    value = json.loads(raw)
+    if canonical_json(value) != raw:
+        raise _Invalid("noncanonical_json")
+    return value
+
+
+_FIELDS = frozenset(
+    "event_id aggregate_type aggregate_id revision predecessor_id kind body occurred_at observed_at recorded_at provenance schema_version".split()
+)
+
+
+def _event(raw, depth):
+    value = _json(raw, depth)
+    if not isinstance(value, dict) or set(value) != _FIELDS:
+        raise _Invalid("invalid_envelope")
+    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
+        raise _Invalid("unknown_schema")
+    _scope(value["aggregate_type"], value["aggregate_id"])
+    revision = value["revision"]
+    if type(revision) is not int or not 1 <= revision <= 9223372036854775807:
+        raise _Invalid("invalid_revision")
+    expected = str(event_id(value["aggregate_type"], value["aggregate_id"], revision))
+    previous = (
+        str(event_id(value["aggregate_type"], value["aggregate_id"], revision - 1))
+        if revision > 1
+        else None
+    )
+    if value["event_id"] != expected or value["predecessor_id"] != previous:
+        raise _Invalid("invalid_lineage")
+    if value["provenance"] not in (
+        "current_baseline",
+        "database_change",
+        "source_observation",
+    ):
+        raise _Invalid("invalid_provenance")
+    for name in ("occurred_at", "observed_at", "recorded_at"):
+        item = value[name]
+        if name == "observed_at" and item is None:
+            continue
+        if not isinstance(item, str) or not _aware(datetime.fromisoformat(item)):
+            raise _Invalid("invalid_timestamp")
+    validate_change(
+        PublicChange(
+            AggregateType(value["aggregate_type"]),
+            value["aggregate_id"],
+            ChangeKind(value["kind"]),
+            value["body"],
+            datetime.fromisoformat(value["occurred_at"]),
+        )
+    )
+    return value
+
+
+# Direct public endpoints only: no inferred identity or transitive graph merging.
+_ENDPOINTS = {
+    "company_id": "companies",
+    "legacy_company_id": "companies",
+    "job_id": "jobs",
+    "source_account_id": "source_accounts",
+    "source_listing_id": "source_listings",
+    "job_version_id": "job_versions",
+    "current_version_id": "job_versions",
+    "brand_id": "brands",
+    "skill_id": "skills",
+    "location_id": "locations",
+    "left_listing_id": "source_listings",
+    "right_listing_id": "source_listings",
+}
+
+
+def project_archive(
+    manifests: Iterable[Manifest], policy: ProjectionPolicy, limits: ReplayLimits
+) -> ProjectionResult:
+    """All errors fail the run closed; gaps remain terminal partial evidence.
+
+    Iterators must be local/nonblocking. The deadline is cooperative between
+    bounded CPU units, not a process sandbox for a caller's blocking iterator.
+    Exact bytes include duplicates/expired objects in budgets and conflict checks.
+    """
+    if not isinstance(policy, ProjectionPolicy) or not isinstance(limits, ReplayLimits):
+        raise ValueError("typed policy and limits required")
+    deadline = time.monotonic() + limits.deadline_seconds
+    seen, retained, excluded = {}, {}, {}
+    ignored, applied = set(), set()
+    count = byte_count = 0
+
+    def check():
+        if time.monotonic() >= deadline:
+            raise _Invalid("deadline")
+
+    try:
+        blocked = {(s.aggregate_type, s.aggregate_id) for s in policy.suppressions}
+        starts = {(t, i): n for t, i, n in policy.coverage_starts}
+        iterator = iter(manifests)
+        for position in range(limits.max_manifests + 1):
+            check()
+            try:
+                item = next(iterator)
+            except StopIteration:
+                break
+            if position == limits.max_manifests:
+                raise _Invalid("manifest_limit")
+            if not isinstance(item, Manifest) or not isinstance(item.seal, SealedBatch):
+                raise _Invalid("invalid_manifest")
+            seal = item.seal
+            ref = seal.batch
+            if (
+                type(ref.serializer_version) is not int
+                or ref.serializer_version != 1
+                or not isinstance(ref.batch_id, UUID)
+                or ref.prior_batch_id is not None
+                and not isinstance(ref.prior_batch_id, UUID)
+                or not isinstance(ref.ordered_event_ids, tuple)
+                or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                or any(
+                    type(n) is not int
+                    for n in (
+                        seal.event_count,
+                        seal.expanded_bytes,
+                        seal.compressed_bytes,
+                        seal.manifest_bytes,
+                    )
+                )
+            ):
+                raise _Invalid("invalid_manifest_types")
+            if (
+                not isinstance(item.object_version, str)
+                or len(item.object_version) > 1024
+                or not _aware(ref.sealed_at)
+                or not _aware(ref.eligible_until)
+                or ref.eligible_until.astimezone(UTC) - ref.sealed_at.astimezone(UTC)
+                != timedelta(days=730)
+                or ref.sealed_at.astimezone(UTC) > policy.as_of.astimezone(UTC)
+            ):
+                raise _Invalid("invalid_seal_window")
+            chunks = (seal.canonical_data, seal.compressed_data, seal.manifest_data)
+            if (
+                any(not isinstance(b, bytes) for b in chunks)
+                or not isinstance(ref.event_bytes, tuple)
+                or not 1 <= len(ref.event_bytes) <= 2000
+                or len(chunks[0]) > MAX_EXPANDED
+                or len(chunks[1]) > MAX_COMPRESSED
+                or len(chunks[2]) > MAX_MANIFEST
+            ):
+                raise _Invalid("seal_size_limit")
+            count += len(ref.event_bytes)
+            if count > limits.max_events:
+                raise _Invalid("event_limit")
+            for raw in ref.event_bytes:
+                if not isinstance(raw, bytes) or len(raw) > 16384:
+                    raise _Invalid("event_size_limit")
+            byte_count += sum(map(len, chunks)) + sum(map(len, ref.event_bytes))
+            if byte_count > limits.max_bytes:
+                raise _Invalid("byte_limit")
+            events = []
+            for raw in ref.event_bytes:
+                check()
+                events.append(_event(raw, limits.max_depth))
+            _json(seal.manifest_data, limits.max_depth)
+            if seal_batch(ref) != seal:
+                raise _Invalid("invalid_seal")
+            check()
+            for raw, value in zip(ref.event_bytes, events, strict=True):
+                eid = value["event_id"]
+                digest = hashlib.sha256(raw).hexdigest()
+                if eid in seen and seen[eid] != digest:
+                    raise _Invalid("conflicting_event_id")
+                if eid in seen:
+                    ignored.add(UUID(eid))
+                seen[eid] = digest
+                key = (value["aggregate_type"], value["aggregate_id"])
+                revision = value["revision"]
+                # Snapshot markers dominate all object versions and seal epochs.
+                reason = (
+                    "removed"
+                    if key in blocked
+                    else "expired"
+                    if ref.eligible_until.astimezone(UTC)
+                    <= policy.as_of.astimezone(UTC)
+                    else None
+                )
+                if reason:
+                    excluded[(key, revision)] = reason
+                    ignored.add(UUID(eid))
+                    continue
+                values = retained.setdefault(key, {})
+                existing = values.get(revision)
+                if existing is None or existing[1] < ref.eligible_until.astimezone(UTC):
+                    values[revision] = (
+                        value,
+                        ref.eligible_until.astimezone(UTC),
+                        digest,
+                    )
+        else:
+            raise _Invalid("manifest_limit")
+
+        # Suppression propagates only along explicit endpoints. No graph output or
+        # merge is built. A finite depth cap fails closed if closure is unfinished.
+        for _ in range(limits.max_depth):
+            check()
+            newly = set()
+            for key, revisions in retained.items():
+                check()
+                if key in blocked:
+                    continue
+                if any(
+                    (target, str(v[0]["body"].get(field))) in blocked
+                    for v in revisions.values()
+                    for field, target in _ENDPOINTS.items()
+                    if field in v[0]["body"]
+                ):
+                    newly.add(key)
+            if not newly:
+                break
+            blocked.update(newly)
+        else:
+            raise _Invalid("suppression_depth_limit")
+
+        facts, coverage, gaps, ranges = [], [], [], []
+        keys = set(retained) | {key for key, _ in excluded}
+        for key in sorted(keys):
+            check()
+            revisions = retained.get(key, {})
+            if key in blocked:
+                coverage.append(ProjectionCoverage(*key, "suppressed", None))
+                gaps.append(ProjectionGap(*key, "retention_gap", "removed", None))
+                ignored.update(UUID(v[0]["event_id"]) for v in revisions.values())
+                continue
+            if not revisions:
+                coverage.append(ProjectionCoverage(*key, "incomplete", None))
+                gaps.append(ProjectionGap(*key, "retention_gap", "expired", None))
+                continue
+            ordered = sorted(revisions)
+            # Exact disjoint ranges, never min/max across a missing revision.
+            first = last = ordered[0]
+            for rev in ordered[1:]:
+                if rev != last + 1:
+                    ranges.append((*key, first, last))
+                    first = rev
+                last = rev
+            ranges.append((*key, first, last))
+            latest = ordered[-1]
+            current = latest
+            baseline = None
+            reason = "unknown"
+            for _ in range(limits.max_depth):
+                check()
+                candidate = revisions.get(current)
+                if candidate is None:
+                    reason = excluded.get(
+                        (key, current),
+                        "outside_declared_coverage"
+                        if current < starts.get(key, 1)
+                        else "unknown",
+                    )
+                    break
+                value = candidate[0]
+                if value["kind"] == "baseline":
+                    baseline = current
+                    break
+                current -= 1
+            else:
+                reason = "depth_limit"
+            complete = baseline is not None
+            coverage.append(
+                ProjectionCoverage(
+                    *key,
+                    "complete_from_baseline" if complete else "incomplete",
+                    baseline,
+                )
+            )
+            if not complete:
+                gaps.append(
+                    ProjectionGap(*key, "retention_gap", reason, max(1, current))
+                )
+            value, eligible, digest = revisions[latest]
+            # Every prefix-derived field expires with its earliest dependency.
+            if complete:
+                eligible = min(revisions[r][1] for r in range(baseline, latest + 1))
+                fields = value["body"].copy()
+            else:
+                allow = INDEPENDENT_FACT_FIELDS.get(key[0], frozenset())
+                fields = {k: v for k, v in value["body"].items() if k in allow}
+            if value["kind"] == "removed":
+                fields = {}
+            applied.update(UUID(revisions[r][0]["event_id"]) for r in ordered)
+            if fields:
+                facts.append(
+                    ProjectedFact(
+                        *key,
+                        latest,
+                        UUID(value["event_id"]),
+                        fields,
+                        datetime.fromisoformat(value["occurred_at"]),
+                        datetime.fromisoformat(value["observed_at"])
+                        if value["observed_at"]
+                        else None,
+                        datetime.fromisoformat(value["recorded_at"]),
+                        value["provenance"],
+                        complete,
+                        eligible,
+                        digest,
+                    )
+                )
+        check()
+        return ProjectionResult(
+            tuple(sorted(applied, key=str)),
+            tuple(sorted(ignored, key=str)),
+            tuple(facts),
+            tuple(coverage),
+            tuple(gaps),
+            tuple(ranges),
+            (),
+            policy.suppression_epoch,
+        )
+    except _Invalid as exc:
+        return ProjectionResult(
+            (), (), errors=(str(exc),), suppression_epoch=policy.suppression_epoch
+        )
+    except (
+        ValueError,
+        TypeError,
+        KeyError,
+        AttributeError,
+        OverflowError,
+        RecursionError,
+    ):
+        # Do not include source bodies/URLs in diagnostics.
+        return ProjectionResult(
+            (),
+            (),
+            errors=("invalid_archive_input",),
+            suppression_epoch=policy.suppression_epoch,
+        )
diff --git a/job_discovery/archive/schema.py b/job_discovery/archive/schema.py
index 54090dc..977c0c0 100644
--- a/job_discovery/archive/schema.py
+++ b/job_discovery/archive/schema.py
@@ -252,10 +252,27 @@ def validate_change(value) -> PublicChange:
                     raise ValueError("public URL required")
             if key == "content_hash" and (
                 len(item) != 64 or any(c not in "0123456789abcdef" for c in item)
             ):
                 raise ValueError("content hash requires sha256 hex")
         if len(canonical_json(body)) > 8192:
             raise ValueError("public event body exceeds 8KiB")
     except (TypeError, OverflowError) as exc:
         raise ValueError("invalid public body") from exc
     return value
+
+
+# Version-1 facts that remain interpretable without any historical prefix.
+# In particular no availability/lifespan, foreign endpoints, identity edges,
+# revisions of other entities, or relationship evidence is independent.
+INDEPENDENT_FACT_FIELDS = {
+    "jobs": frozenset("id external_id title url location department remote".split()),
+    "source_accounts": frozenset("id ats public_board_ref public_url".split()),
+    "source_listings": frozenset("id external_id".split()),
+    "job_versions": frozenset("id content_hash public_metadata observed_at".split()),
+    "companies": frozenset(
+        "id name ats token display_name industry industry_subcategory size hq_country".split()
+    ),
+    "locations": frozenset("raw canonicals components source".split()),
+    "brands": frozenset({"id", "name"}),
+    "skills": frozenset({"id", "canonical_name"}),
+}
diff --git a/job_discovery/archive/types.py b/job_discovery/archive/types.py
index 29dd468..e99a263 100644
--- a/job_discovery/archive/types.py
+++ b/job_discovery/archive/types.py
@@ -98,14 +98,55 @@ class VerifiedBatch:
     data_receipt: VerificationReceipt
     manifest_receipt: VerificationReceipt
 
 
 @dataclass(frozen=True)
 class AckResult:
     exact_event_ids: tuple[UUID, ...]
     archived_revision_markers: tuple[tuple[str, str, int], ...]
 
 
+@dataclass(frozen=True)
+class ProjectedFact:
+    aggregate_type: str
+    aggregate_id: str
+    revision: int
+    event_id: UUID
+    fields: dict
+    occurred_at: datetime
+    observed_at: datetime | None
+    recorded_at: datetime
+    provenance: str
+    history_complete: bool  # Only from the declared activation baseline.
+    eligible_until: datetime
+    event_sha256: str
+
+
+@dataclass(frozen=True)
+class ProjectionCoverage:
+    aggregate_type: str
+    aggregate_id: str
+    status: str
+    baseline_revision: int | None
+    complete_history: bool = False  # No assertion about pre-activation history.
+
+
+@dataclass(frozen=True)
+class ProjectionGap:
+    aggregate_type: str
+    aggregate_id: str
+    kind: str
+    reason: str
+    missing_revision: int | None
+    terminal: bool = True  # Never a request for an automatic retry.
+
+
 @dataclass(frozen=True)
 class ProjectionResult:
     applied_event_ids: tuple[UUID, ...]
     ignored_event_ids: tuple[UUID, ...]
+    facts: tuple[ProjectedFact, ...] = ()
+    coverage: tuple[ProjectionCoverage, ...] = ()
+    gaps: tuple[ProjectionGap, ...] = ()
+    retained_revision_ranges: tuple[tuple[str, str, int, int], ...] = ()
+    errors: tuple[str, ...] = ()
+    suppression_epoch: int = 0
diff --git a/tests/test_archive_replay.py b/tests/test_archive_replay.py
new file mode 100644
index 0000000..b7255a7
--- /dev/null
+++ b/tests/test_archive_replay.py
@@ -0,0 +1,421 @@
+"""Ordinary offline projection correctness; synthetic immutable public seals only."""
+
+from dataclasses import replace
+from datetime import UTC, datetime, timedelta
+from itertools import repeat
+from uuid import UUID, uuid4
+import pytest
+
+from job_discovery.archive.batches import seal_batch
+from job_discovery.archive.codec import canonical_json
+from job_discovery.archive.schema import event_id
+from job_discovery.archive.types import BatchRef
+from job_discovery.lifecycle.types import ClaimRef
+from job_discovery.archive.replay import (
+    Manifest,
+    ProjectionPolicy,
+    ReplayLimits,
+    Suppression,
+    project_archive,
+)
+
+NOW = datetime(2026, 10, 7, tzinfo=UTC)
+
+
+def event(revision=1, *, title="Engineer", aggregate_id="job-1", kind=None, **changes):
+    value = dict(
+        event_id=str(event_id("jobs", aggregate_id, revision)),
+        aggregate_type="jobs",
+        aggregate_id=aggregate_id,
+        revision=revision,
+        predecessor_id=str(event_id("jobs", aggregate_id, revision - 1))
+        if revision > 1
+        else None,
+        kind=kind or ("baseline" if revision == 1 else "upsert"),
+        body=dict(
+            id=aggregate_id,
+            company_id=1,
+            external_id="ext",
+            title=title,
+            url="https://example.test/job",
+            closed_at=None,
+        ),
+        occurred_at=(NOW - timedelta(days=2)).isoformat(),
+        observed_at=(NOW - timedelta(days=3)).isoformat(),
+        recorded_at=(NOW - timedelta(days=1)).isoformat(),
+        provenance="current_baseline" if revision == 1 else "source_observation",
+        schema_version=1,
+    )
+    return value | changes
+
+
+def manifest(*events, expired=False, version="current"):
+    sealed = NOW - timedelta(days=731 if expired else 1)
+    ref = BatchRef(
+        uuid4(),
+        ClaimRef("fixture", 1, NOW + timedelta(seconds=180)),
+        tuple(UUID(e["event_id"]) for e in events),
+        1,
+        sealed,
+        sealed + timedelta(days=730),
+        tuple(canonical_json(e) for e in events),
+        object_prefix="synthetic/public",
+    )
+    return Manifest(seal_batch(ref), version)
+
+
+def project(*items, policy=None, limits=None):
+    return project_archive(
+        items,
+        policy or ProjectionPolicy(admin_authorized=True, as_of=NOW),
+        limits or ReplayLimits(),
+    )
+
+
+def test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times():
+    old, new = event(), event(2, title="Senior")
+    result = project(manifest(new), manifest(old), manifest(old, version="noncurrent"))
+    assert result.errors == ()
+    assert len(result.facts) == 1
+    fact = result.facts[0]
+    assert fact.fields["title"] == "Senior" and fact.revision == 2
+    assert fact.observed_at == datetime.fromisoformat(new["observed_at"])
+    assert fact.recorded_at == datetime.fromisoformat(new["recorded_at"])
+    assert fact.history_complete and fact.provenance == "source_observation"
+    assert len(result.applied_event_ids) == 2
+    assert result.retained_revision_ranges == (("jobs", "job-1", 1, 2),)
+
+
+def test_conflicting_exact_id_fails_closed_even_after_good_fact():
+    result = project(manifest(event()), manifest(event(title="Conflict")))
+    assert not result.facts and "conflicting_event_id" in result.errors
+
+
+@pytest.mark.parametrize(
+    "changes",
+    [
+        {"schema_version": 2},
+        {"schema_version": True},
+        {"revision": True},
+        {"aggregate_id": None},
+        {"body": []},
+        {"occurred_at": 3},
+        {"observed_at": "2026-01-01"},
+        {"extra": "unknown"},
+        {"provenance": "private"},
+        {"predecessor_id": str(uuid4())},
+    ],
+)
+def test_total_envelope_unknown_schema_and_invalid_fields_fail_closed(changes):
+    value = event() | changes
+    # Keep a synthetically sealed exact membership despite invalid envelope fields.
+    result = project(manifest(value))
+    assert not result.facts and result.errors
+
+
+def test_expired_baseline_terminal_gap_independent_facts_only():
+    result = project(manifest(event(), expired=True), manifest(event(2)))
+    assert result.gaps[0].kind == "retention_gap"
+    assert result.gaps[0].reason == "expired" and result.gaps[0].terminal
+    assert not result.facts[0].history_complete
+    assert set(result.facts[0].fields) == {"id", "external_id", "title", "url"}
+    assert result.retained_revision_ranges == (("jobs", "job-1", 2, 2),)
+    assert result.facts[0].eligible_until == NOW + timedelta(days=729)
+
+
+def test_missing_predecessor_unknown_cause_is_terminal_without_retries():
+    result = project(manifest(event(3)))
+    assert result.gaps[0].reason == "unknown"
+    assert result.gaps[0].missing_revision == 2 and result.gaps[0].terminal
+    assert result.coverage[0].status == "incomplete"
+    assert not result.coverage[0].complete_history
+
+
+def test_later_baseline_does_not_invent_earlier_history():
+    result = project(manifest(event(5, kind="baseline", provenance="current_baseline")))
+    assert result.coverage[0].baseline_revision == 5
+    assert result.coverage[0].status == "complete_from_baseline"
+    assert not result.coverage[0].complete_history
+
+
+def test_authorized_suppression_dominates_current_noncurrent_and_later_epochs():
+    marker = Suppression("jobs", "job-1", NOW - timedelta(days=1), "authorized_removal")
+    policy = ProjectionPolicy(True, NOW, suppressions=(marker,), suppression_epoch=7)
+    result = project(
+        manifest(event()),
+        manifest(event(), version="noncurrent"),
+        manifest(event(2)),
+        policy=policy,
+    )
+    assert not result.facts and result.coverage[0].status == "suppressed"
+    assert result.gaps[0].reason == "removed" and result.gaps[0].terminal
+    assert result.suppression_epoch == 7
+    assert not project(
+        manifest(event(3)), policy=replace(policy, suppression_epoch=8)
+    ).facts
+
+
+def test_suppressed_endpoint_invalidates_dependent_facts():
+    policy = ProjectionPolicy(
+        True,
+        NOW,
+        suppressions=(Suppression("companies", "1", NOW, "authorized_removal"),),
+    )
+    assert not project(manifest(event()), policy=policy).facts
+
+
+def test_expired_duplicate_does_not_invalidate_eligible_authorized_reseal():
+    result = project(manifest(event(), expired=True), manifest(event()))
+    assert result.facts[0].history_complete and not result.gaps
+
+
+def test_projection_expiry_recomputes_no_retained_facts_after_horizon():
+    item = manifest(event())
+    assert project(item).facts
+    result = project(item, policy=ProjectionPolicy(True, NOW + timedelta(days=729)))
+    assert not result.facts and result.gaps[0].reason == "expired"
+
+
+@pytest.mark.parametrize(
+    "field", ["canonical_data", "compressed_data", "manifest_data"]
+)
+def test_tampered_seal_bytes_fail_closed(field):
+    item = manifest(event())
+    item = replace(item, seal=replace(item.seal, **{field: b"corrupt"}))
+    result = project(item)
+    assert result.errors and not result.facts
+
+
+@pytest.mark.parametrize(
+    "limits",
+    [
+        ReplayLimits(max_events=1),
+        ReplayLimits(max_bytes=1),
+        ReplayLimits(max_manifests=1),
+    ],
+)
+def test_finite_input_budgets_fail_closed(limits):
+    item = manifest(event())
+    result = project_archive(repeat(item), ProjectionPolicy(True, NOW), limits)
+    assert result.errors and not result.facts
+
+
+def test_deadline_fails_closed(monkeypatch):
+    ticks = iter([0, 2, 3, 4])
+    monkeypatch.setattr(
+        "job_discovery.archive.replay.time.monotonic", lambda: next(ticks, 5)
+    )
+    assert (
+        "deadline"
+        in project(manifest(event()), limits=ReplayLimits(deadline_seconds=1)).errors
+    )
+
+
+def test_depth_limits_json_and_predecessor_walk():
+    result = project(
+        manifest(event(), event(2), event(3)), limits=ReplayLimits(max_depth=2)
+    )
+    assert not result.facts or not result.facts[0].history_complete
+    assert result.errors or result.gaps
+
+
+@pytest.mark.parametrize(
+    "kwargs",
+    [
+        {"max_events": 0},
+        {"max_bytes": float("inf")},
+        {"deadline_seconds": float("nan")},
+        {"max_depth": True},
+        {"max_manifests": 0},
+    ],
+)
+def test_invalid_limits_rejected(kwargs):
+    with pytest.raises(ValueError):
+        ReplayLimits(**kwargs)
+
+
+def test_explicit_admin_policy_and_aware_time_required():
+    with pytest.raises(ValueError):
+        project(manifest(event()), policy=ProjectionPolicy(False, NOW))
+    with pytest.raises(ValueError):
+        ProjectionPolicy(True, datetime(2026, 1, 1))
+
+
+def test_pure_projection_has_zero_application_or_external_calls(monkeypatch):
+    import socket
+    import psycopg
+    import subprocess
+
+    def forbidden(*args, **kwargs):
+        pytest.fail("projection attempted external/application work")
+
+    monkeypatch.setattr(socket, "socket", forbidden)
+    monkeypatch.setattr(psycopg, "connect", forbidden)
+    monkeypatch.setattr(subprocess, "Popen", forbidden)
+    # Trace application/provider Python calls as well as blocking all external
+    # effects. Dashboard-only generation/notification code has no in-process
+    # import here and cannot run through a subprocess or network bridge.
+    import sys
+
+    item = manifest(event())
+    calls = []
+    forbidden_modules = (
+        "reviewer.",
+        "openai.",
+        "boto3.",
+        "botocore.",
+        "requests.",
+        "httpx.",
+        "job_discovery.db",
+        "job_discovery.lifecycle.",
+    )
+
+    def trace(frame, action, arg):
+        if action == "call" and frame.f_globals.get("__name__", "").startswith(
+            forbidden_modules
+        ):
+            calls.append(frame.f_code.co_name)
+
+    previous = sys.getprofile()
+    try:
+        sys.setprofile(trace)
+        result = project(item)
+    finally:
+        sys.setprofile(previous)
+    assert result.facts
+    assert calls == []
+
+
+def test_outside_declared_coverage_is_terminal():
+    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+    result = project(manifest(event(3)), policy=policy)
+    assert result.gaps[0].reason == "outside_declared_coverage"
+
+
+def test_missing_prefix_cannot_project_relationship_or_lifespan():
+    rid = str(uuid4())
+    value = event(2)
+    value.update(
+        aggregate_type="company_brands",
+        aggregate_id=rid,
+        event_id=str(event_id("company_brands", rid, 2)),
+        predecessor_id=str(event_id("company_brands", rid, 1)),
+        body=dict(
+            id=rid,
+            company_id=1,
+            brand_id=str(uuid4()),
+            revision=2,
+            status="accepted",
+            evidence_kind="structured_source",
+            public_evidence_ref="https://example.test/evidence",
+        ),
+    )
+    result = project(manifest(value))
+    assert not result.facts and result.gaps[0].kind == "retention_gap"
+
+
+def test_prefix_dependent_fact_expires_with_earliest_baseline():
+    old = manifest(event())
+    # A still eligible baseline has only one second left.
+    ref = replace(
+        old.seal.batch,
+        sealed_at=NOW - timedelta(days=730) + timedelta(seconds=1),
+        eligible_until=NOW + timedelta(seconds=1),
+    )
+    old = replace(old, seal=seal_batch(ref))
+    result = project(old, manifest(event(2)))
+    assert result.facts[0].history_complete
+    assert result.facts[0].eligible_until == NOW + timedelta(seconds=1)
+    later = project(
+        old,
+        manifest(event(2)),
+        policy=ProjectionPolicy(True, NOW + timedelta(seconds=1)),
+    )
+    assert not later.facts[0].history_complete
+    assert "closed_at" not in later.facts[0].fields
+
+
+def test_predecessor_walk_stops_at_depth_with_normal_json():
+    result = project(
+        manifest(*(event(i) for i in range(1, 7))), limits=ReplayLimits(max_depth=4)
+    )
+    assert not result.errors
+    assert result.gaps[0].reason == "depth_limit"
+    assert not result.facts[0].history_complete
+
+
+def test_disjoint_retained_ranges_never_claim_missing_revisions():
+    result = project(manifest(event(), event(3)))
+    assert result.retained_revision_ranges == (
+        ("jobs", "job-1", 1, 1),
+        ("jobs", "job-1", 3, 3),
+    )
+    assert result.gaps[0].missing_revision == 2
+
+
+def test_complete_relation_assertion_retracts_without_identity_inference():
+    rid, left, right = (str(uuid4()) for _ in range(3))
+
+    def assertion(rev, status, kind):
+        value = event(rev, kind=kind)
+        value.update(
+            aggregate_type="identity_assertions",
+            aggregate_id=rid,
+            event_id=str(event_id("identity_assertions", rid, rev)),
+            predecessor_id=str(event_id("identity_assertions", rid, rev - 1))
+            if rev > 1
+            else None,
+            body=dict(
+                id=rid,
+                left_listing_id=left,
+                right_listing_id=right,
+                relation="possible_same_posting",
+                revision=rev,
+                status=status,
+                evidence_kind="public_correction",
+                public_evidence_ref="https://example.test/evidence",
+            ),
+        )
+        return value
+
+    result = project(
+        manifest(
+            assertion(1, "proposed", "baseline"), assertion(2, "retracted", "upsert")
+        )
+    )
+    assert len(result.facts) == 1
+    assert result.facts[0].fields["status"] == "retracted"
+    assert result.facts[0].fields["relation"] == "possible_same_posting"
+    assert result.facts[0].revision == 2
+
+
+@pytest.mark.parametrize(
+    "field,value", [("serializer_version", True), ("serializer_version", 2)]
+)
+def test_total_manifest_rejects_unknown_or_boolean_serializer(field, value):
+    item = manifest(event())
+    # A total reader also rejects the boolean/1 equality ambiguity.
+    ref = replace(item.seal.batch, **{field: value})
+    seal = replace(item.seal, batch=ref)
+    if value is True:
+        seal = seal_batch(ref)
+    result = project(replace(item, seal=seal))
+    assert result.errors and not result.facts
+
+
+def test_invalid_iterable_member_returns_sanitized_error():
+    result = project({"private": "never log bodies"})
+    assert result.errors == ("invalid_manifest",) and not result.facts
+
+
+def test_retention_window_requires_730_elapsed_utc_days():
+    from zoneinfo import ZoneInfo
+
+    item = manifest(event())
+    london = ZoneInfo("Europe/London")
+    # The same wall time crosses a DST offset; it is one hour short of730days.
+    start = datetime(2024, 3, 31, 0, 30, tzinfo=london)
+    end = datetime(2026, 3, 31, 0, 30, tzinfo=london)
+    ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
+    result = project(replace(item, seal=seal_batch(ref)))
+    assert result.errors == ("invalid_seal_window",)
