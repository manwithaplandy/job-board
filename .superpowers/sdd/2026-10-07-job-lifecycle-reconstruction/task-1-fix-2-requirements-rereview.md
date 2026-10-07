# Task 1 Fix Round 2 scoped requirements rereview

Spec: **PASS**. Quality: **APPROVED**.

No Critical/Important fix-introduced findings were identified in bounded ownership, timeout/cancellation cleanup, or previously accepted requirements. No additional evidence is missing for this scoped verdict.

Reviewed base `a288a9ad290d45d557953c9133bc61482d571f08` through pinned head `204eea6ac9be1e1fd3263708577d1483f26969fb`, in `/workspace/job-board/.claude/worktrees/lifecycle-recovery` on 2026-10-07. Read all 889 lines of `task-1-fix-2-review-package.md` and the appended Fix Round 2 report. Independently confirmed the package's complete diff matches `git diff --unified=10 BASE HEAD` apart from trailing whitespace/newlines, and working HEAD matches the pin.

This rereview covers regressions introduced by the two residual security fixes and the related test-phase adjustment. It does not reopen unchanged whole-task requirements. The global-default and NULL-ACL ownership findings passed my Fix Round 1 rereview; their helper and migration-test files are byte-for-byte unchanged in this round. Independently verified that the frozen schema, canonical schema, CI workflow, and conftest are also unchanged. Frozen schema SHA-256 remains `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6`.

## Scoped assessment

| Area | Assessment |
| --- | --- |
| Invocation ownership on failed creation | PASS. `tools/lifecycle_test_db.py:273` generates the container name and a separate 192-bit invocation marker independently. A colliding name therefore cannot reproduce a prior invocation's ownership marker. Existing marker verification and immutable-ID validation/removal remain in place. A boundary reproduction checks the old marker representation, and a real two-harness collision proves the first invocation's immutable container ID survives the second invocation's failed creation. |
| Cancellation during inner timeout cleanup | PASS. `_stop_command_group()` now defers signal-handler exceptions until group termination and direct-child reaping finish. A received signal shortens the existing grace deadline rather than restarting it. TERM/KILL, direct-child wait, live-group verification, and their finite bounds remain present. The real regression acknowledges entry into inner timeout cleanup, exercises a repeated SIGTERM, and requires the SIGTERM-ignoring worker to disappear before return. |
| Cancellation during container cleanup | PASS. The finally block defers termination while the existing bounded marker/immutable-ID cleanup executes, then propagates pending cancellation and restores previous handlers. No name-only or broad Docker deletion path is introduced. |
| Running-command cancellation test | PASS. The test-only wrapper waits with a finite timeout for the actual command's Event acknowledgement before invoking real outer cancellation. It always performs real cleanup before checking whether the intended phase was observed. The fixed eight-second deadline previously could expire during Docker startup; the tracked diagnosis and phase observation justify separating phase acknowledgement from cancellation behavior. Product execution/readiness/grace constants remain unchanged. |
| Startup cancellation coverage | PASS. A separate real Docker regression acknowledges the owned immutable ID after container creation and port publication, then cancels before readiness/command execution. It checks that the command never starts and the exact container disappears. Test cleanup remains limited to the acknowledged owned identity. |
| Previously accepted DSN/environment/schema/catalog/CI requirements | Retained. Relevant validation and sanitization code is unchanged; helper/catalog tests, frozen/schema files, conftest, and CI are unchanged. The fresh affected lanes include migration/catalog parity and existing RLS checks on both majors. |

The report's initial failed covering lane is transparently recorded as a failure, not acceptance evidence. The real diagnostic measured Docker creation at 4.777 seconds and readiness at 6.943 seconds in a separate observation; it does not claim these were exact timings in the failed run. The test adjustment addresses observed phase ambiguity without extending product bounds or dropping startup cancellation coverage.

## Fresh evidence accepted

Read the pinned `fix-round2-postgres17.txt`, `fix-round2-postgres16.txt`, `fix-round2-red-chronology.json`, phase-probe script/JSON, updated `verification.json`, and report. The three residual reproductions are recorded as RED (3 failed) followed by GREEN (3 passed). Fresh covering commands run the complete harness, migration, and RLS test files through the owned runner:

| Actual server | Covering result |
| --- | --- |
| PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) | 86 passed, zero skipped, exit 0, 53.97 seconds |
| PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) | 86 passed, zero skipped, exit 0, 63.40 seconds |

Reported Ruff and diff checks passed. Earlier full-suite and Fix Round 1 results remain explicitly tied to their earlier commits; no full-suite rerun is fabricated. The fresh affected coverage supports this scoped rereview, so no unchanged covered tests or resource probes were rerun by this reviewer.

Task 13's future safety/archive file set and dashboard DB tests remain pending. This verdict does not replace the controller's independent security rereview or checkpoint.

Reviewer actions were read-only inspection plus writing this artifact, using `/bin/bash`, `login:false`. No agents were spawned and no product/source/tests, Git history, production/shared databases, Docker resources, cloud/provider resources, or external communications were changed.
