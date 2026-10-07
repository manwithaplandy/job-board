# Task 7 — lean admission and public versions

The original author sections below are historical pre-Fix1 evidence. The appended Fix1 section supersedes their unconditional legacy JD-removal behavior and records the R7-1 correction, verification and full original review.

Base: `8f9a195e8bed49e0002d7b152b1d4b8983d96f04`, `feature/lifecycle-recovery` worktree. The supplied production reference `114cce96cb244546864a6bddc5476b5630bc024a` is an ancestor. The local `origin/main` ref is stale (`73ce118`, August 23); it was not treated as newer upstream evidence or used to reset anything. Local implementation only. Controller documents are excluded from this author's commit. No activation, production writes, remote publishing, infrastructure, provider/model or paid calls occurred.

## Behavior and integration

- `admit_metadata` preserves source/external coordinates, existing Job IDs, first-seen timestamps, frozen anchors and private foreign keys. New Jobs contain metadata only. Neither legacy upsert nor lifecycle admission passively fills descriptions. Existing populated caches and private packages stay unchanged; no legacy version/use history is invented.
- The actual `verify_due_sources -> stage_postings` path now admits metadata before recording the same enumeration's positive sightings. Its returned new-job count increments only after committed chunks. Minimal identifiable fallback postings have `metadata_complete=False`: they can reopen/confirm availability but cannot overwrite good metadata or manufacture versions.
- Admission/staging accepts at most **25 postings per transaction**. Each posting has at most five metadata effects (Job, listing insert OR later publication update, version, listing version pointer, one existing-location edge) plus three membership/sighting effects: **25 × 8 = 200**, below the established 500-row ceiling. Reconciliation retains its independent 100-row cursor. No unbounded multi-location or skill expansion exists. Oversized admission batches are rejected before writing; callers split them. A caller-held chunk forecast accompanies separate existing scoped reservations for row effects, conservatively holding extra headroom rather than rebinding one reservation across jobs/tables. This is functional use of Task 3, not independent capacity/security approval.
- Public versions use the source listing revision and a deterministic UTF-8/NFC/whitespace-normalized hash of allowlisted metadata. Received descriptions contribute only a normalized digest, never persistent body text. Absent optional fields/body are unknown and preserve prior facts. Unchanged metadata creates no new version; availability alone creates none. Public metadata is bounded to 6 KiB; Task 10 still owns complete event-envelope validation.
- Current plus ten superseded versions is the maximum. History older than 30 days also pauses growth before a new version could supersede an old current row. All unarchived evidence is retained; version-limit pauses leave known Job metadata intact while sightings continue. No version deletion/compaction is implemented here: safe archive/reference-aware retirement is a later integration prerequisite. The archive producer remains unavailable and activated public writes remain blocked by existing triggers until Task 10 supplies the outbox contract.
- On an Ashby listing's first capture, valid timezone-aware, nonfuture `publishedAt` can supply the frozen anchor, with `ashby.publishedAt` provenance. This is Ashby's last-publication timestamp at capture, **not** original requisition/publication history. Later valid publication observations update the source publication field, including on legacy listings, while never moving an existing anchor or creating a content version solely for republication. Invalid/future/naive publication values fall back through the existing `choose_anchor` contract; other source publication fields remain unknown rather than guessed.
- Typed location evidence links only to an existing location dictionary entry. Unknown raw locations remain metadata without invented canonical facts. Valid-from/to and confidence remain NULL. No public skills, brands or employer equivalences are extracted from private data or guessed from titles/descriptions.
- `set_identity_assertion` accepts only typed public fields, requires reviewed evidence for acceptance, rejects self-links, accepted same-job cycles and conflicting representatives, and never rewrites Job/private anchors. Proposed edges do not imply accepted/transitive merges.
- Routine Greenhouse question backfill is removed from polling. Workday/SmartRecruiters poll with detail fetch disabled. Existing explicit question helper, parsers and detail functions remain reusable for later demand hydration; their ordinary helper tests pass.

## Caller inventory

- `run.run` flag-off path -> `_admit_chunk` -> `db.upsert_jobs`; `db.upsert_job` is the retained one-item legacy wrapper. Both now keep source descriptions transient and ignore availability-only fallback metadata.
- `run.run` source-enabled path -> `verify_due_sources` -> `stage_postings` -> `admit_metadata` -> `capture_version`. Source staging uses `ADMISSION_CHUNK_SIZE`; source absence reconciliation keeps `CHUNK=100`.
- `capture_version` is an explicit typed API used by admission; its former reserved/no-op test is replaced by the new complete-metadata requirement.
- `set_identity_assertion` is an explicit service API with no automatic poll caller. Existing `migrate_identity_batch`/`company_sources` legacy mapping remains unchanged.
- `backfill_greenhouse_questions` has no production call site after this change; only its explicit helper tests invoke it. `insert_job_questions` remains for later demand callers.
- `Posting.metadata_complete` survives the existing dataclass spool serialization. The common identified-posting parser marks parser fallbacks false.

## Verification chronology

Exact command strings are in `task-7-evidence/commands.json`; each corresponding numbered log preserves its actual result. Labels containing “final” describe the command's intent at that time, not a claim that later edits had already been verified.

1. System `python` could not import `psycopg`; no tests ran. Switched to the existing repository venv without changing dependencies.
2. PostgreSQL 17 initial RED: eight failures for missing admission/API/completeness behavior and zero actual source admission.
3. First implementation: seven passed, one failed because the existing location dictionary rejects an invented `pending` provenance. Corrected to reuse existing dictionary entries and made the test's known-location fixture explicit; no schema relaxation.
4. Legacy RED: seven passed, two failed showing passive description refill and routine question/detail fetching.
5. Broader PG17 snapshot: 88 passed, three failed. The old 100-posting producer did not reach the simulated next-page interruption within its budget. Two completed-membership handoff assertions incorrectly included the newly admitted observed `extra` listing among absent identities. Those assertions now check the 205 prior identities' misses and the observed listing's zero misses separately.
6. Ashby initial-anchor RED: one failure, then frozen initial capture implemented.
7–8. Historical affected lanes before the final batching correction: **101 passed each**, PostgreSQL **17.11** and **16.15**, zero skips.
9. Initial 70-posting bulk fixture without location edges passed (490 maximum effects); it did not exercise the over-limit case.
10. Bulk fixture with existing typed location edges reproduced **`lifecycle admission chunk exceeds 500 rows`**. Reduced only the producer/admission batch to 25, preserving reconciliation's 100-row cursor.
11. Bounded-product PG17 snapshot: **68 passed, 3 failed**, using the older collected interruption and handoff fixtures.
12. Bounded-product PG16 snapshot: **70 passed, 1 failed**, using the corrected handoff assertions but older interruption fixture. The network-interruption test now fixes only the public scheduler clock to isolate its intended next-page interruption from CPU/database admission time; DB lease time remains real. Source time-budget behavior is independently covered by existing scheduler tests. This fixture correction does not remove the production 60-second board budget; slower initial admission may produce a safe partial enumeration.
13. Corrected PG17 recovery fixtures: **3 passed**. Fresh-worker committed-positive recovery and both completed-membership cursor handoff cases pass, including the observed-extra/old-misses distinction.
14–15. Admission plus corrected recovery snapshots before the final publication-field correction: **17 passed each**, PostgreSQL 16.15 and 17.11; zero skips.
16. Final exact-spec RED: later Ashby publication remained at the initial value. Implemented recording valid new publication observations independently of frozen anchor and content hash; added an assertion that publication-only changes create no content version.
17–18. Product lanes after publication correction, before the final retention predicate correction: **71 passed each**, PostgreSQL 17.11 and 16.15, zero skips.
19. Changed-file lint and whitespace checks passed.
20. RED at the prospective retention boundary: a 31-day-old current version was incorrectly allowed to become superseded (`2` versions versus expected `1`). The room check now includes the current row's age because a changed version would supersede it.
21. Final PostgreSQL **17.11** lane after all corrections: **72 passed**, zero skips (526.08 seconds).
22. Final PostgreSQL **16.15** lane after all corrections: **72 passed**, zero skips (552.95 seconds).
23. Final changed-file Ruff and `git diff --check`: passed. The first staged check found trailing whitespace in pytest's original traceback formatting; evidence sanitization removed that whitespace along with synthetic claim tokens, then the staged check passed.

Final formatting/lint checks cover changed Python modules and tests; `git diff --check` passed before the author's commit. Testing is scoped to permitted ordinary admission, adapter, relation, source orchestration, legacy and question-helper behavior. No blanket whole-suite/security verdict is claimed.

## Outstanding requirements and review boundaries

- Task 6 FULL specification remains FAIL: R6-4 durable reconciliation above 6000 MiB and R6-5 shared bounded public transport remain required for later Tasks 8/10/13. This change uses the existing below-guard core; it does not repair or waive those requirements. Above-guard fallback is still read-only and does not claim durable reconciliation.
- Independent Task 3 expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed. No refused probes or replacement security review were attempted. Ordinary enforced-mode tests demonstrate this writer's integration only.
- Archive/reference-aware version compaction, paired outbox writes and demand hydration remain later-task work. Flags retain their off defaults, retirement remains dry-run, and archive activation is unavailable.
- An optional local process diagnostic encountered `PermissionError: [Errno 13] Permission denied: '/proc/77856/environ'`. It was abandoned without retry/escalation; independently permitted tests continued.
- Stop after this local author commit for independent permitted requirements/quality review and Library checkpoint 07, before Task 8. Controller owns any final release after all tasks and verification.

Author outcome: implementation and permitted affected verification complete. Independent requirements/quality review and Library 07 remain the next gate; this is not a security or release approval.

## Fix1 — R7-1 legacy consumer compatibility

Fix base: `1f897475023a50fa029def5a5e9e016ded794a8b`. Controller-only commits through `0654c2a` remain in history; they are excluded from this author's changes. The original author sections above and their 72-pass PostgreSQL lanes describe the reviewed pre-Fix1 implementation. In particular, their unconditional legacy-lean/JD-transient statements are superseded by this correction. The review correctly found that those lanes did not verify the actual new-Job reviewer consumer.

The controller's sequencing ruling preserves pre-cutover legacy JD capture until Task 8 provides compatible hydration. Inspection found all required control fields already exist: `source_enabled`, `hydration_enabled`, `maintenance_enabled`, `safety_stage`, `archive_ever_activated`, and the permanent `lifecycle_maintenance_state.cutover_at`. Existing maintenance SQL records the timestamp when maintenance is enabled, forbids clearing an existing timestamp, and existing control enforcement makes archive-ever monotonic and prevents enforced-to-legacy rollback. No normal contract conflict requires changing these fields, grants, triggers, GUCs, claims or activation rules. This fix adds only a read-side service decision over those interfaces; it makes no new independent security claim about their enforcement.

`legacy_description_capture_allowed` reads under the existing transaction gate and fails closed on missing cutover state. Capture is permitted only before all of the named lifecycle/readiness/cutover conditions apply. Legacy `upsert_jobs` rechecks this decision under the gate through commit and uses the original `extract_description` implementation. The existing SQL still preserves populated caches and never refills `description_pruned` rows. `_admit_chunk` includes the conditionally captured body in its existing conservative forecast. Workday and SmartRecruiters receive `fetch_details=True` only for eligible pre-cutover, below-guard legacy polling. Their caller commits the gate/read transaction before invoking the adapter; admission rechecks after fetching. Existing source-mode `stage_postings`/`admit_metadata` stays lean regardless of source payload. No question backfill is reintroduced.

Updated caller inventory:

- Legacy `run.run` → `_admit_chunk` → `db.upsert_jobs`/single-item wrapper → conditional `_posting_row` → original legacy SQL. `_posting_row` itself defaults to no description; its only production callers explicitly select the gated compatibility behavior.
- Legacy Workday/SmartRecruiters adapter selection → gated detail decision → commit before external work → batch admission recheck.
- Actual reviewer flow remains unchanged: `review_all` → DB candidate selection → `_stage2_inner` → offline provider double in tests → stored approval. New Lever, Workday and SmartRecruiters Jobs now supply their actual captured JD through this entire caller path. Only unrelated location/prune phases and the adapter/provider boundaries are doubled; the affected reviewer consumer is real.
- Prepare's `getJobForPackage` query continues reading the stored description. A narrow route test asserts the captured description reaches generation arguments and the actual `buildResumePrompt`; it uses the existing DB-query/generation doubles, not a real cross-language DB integration or a model call. Existing question fallback fixtures remain in the same selected test files.
- Normal post-cutover feature fixtures show flags-off new admission and a never-captured legacy row both retain NULL descriptions. WD/SR post-cutover poll fixtures assert detail requests are disabled and unsolicited source bodies remain transient. A separate read-side matrix covers source/hydration/maintenance/enforced/archive-ever/cutover states with doubles; it is not a control-transition, activation or security-enforcement probe.

Fix1 chronology (exact commands and actual output are retained in `task-7-evidence/commands.json` and the named logs):

1. `fix1-01-red.txt`: PostgreSQL 17.11, **10 failed, 1 passed**, 3.73 seconds. Real new-Job Lever reviewer never reached the provider because the JD was absent; WD/SR failed the expected detail request. Seven reader cases failed because the compatibility function did not exist. The already-lean sticky-cutover DB case passed. This was the pre-fix 11-case suite.
2. `fix1-02-green.txt`: PostgreSQL 17.11, **11 passed**, 6.77 seconds after the producer/control correction. No skips.
3. `fix1-03-prepare-generation.txt`: offline narrow Vitest prepare route/resume-schema files, **45 passed across 2 files**, 1.65 seconds. This includes the new actual prompt propagation assertion and existing question fallback. It was not repeated after the two Python-only post-cutover WD/SR cases were added.
4. `fix1-04-covering-pg17.txt`: PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)**, **72 passed, 1 failed**, 114.87 seconds. `fix1-05-covering-pg16.txt`: PostgreSQL **16.15 (Debian 16.15-1.pgdg13+2)**, **72 passed, 1 failed**, 135.03 seconds. These independent owned DB lanes ran concurrently. All 13 Fix1 consumer/read-side/cutover cases passed, as did the selected legacy/run/question/identity cases. The sole failure in each was the unchanged existing 70-posting bulk-source fixture: actual `new_jobs=50`, expected `70`.
5. Without changing product, fixture, clocks or budgets, reran only that failed bulk-source case sequentially: `fix1-06-bulk-pg17.txt`, PostgreSQL 17.11, **1 passed**, 9.36 seconds; `fix1-07-bulk-pg16.txt`, PostgreSQL 16.15, **1 passed**, 13.38 seconds. The real 60-second source budget under concurrent load is a plausible explanation for the earlier partial result, not a proven timing diagnosis. The new compatibility reader is not called by this source-admission path. These reruns demonstrate the existing 70-posting row-bound fixture on both versions; they do not establish a throughput guarantee or erase the two combined-lane failures. No complete 73-case all-green rerun is claimed, and the unaffected earlier source-recovery lanes were not repeated.
6. `fix1-08-static.txt`: changed-file Ruff and final whitespace check passed. Evidence log trailing whitespace is normalized; no credentials, DSNs, private content or provider output is recorded.

Fix1 changes no migration, control fields/defaults, activation/readiness enforcement, reservations, archive behavior or network transport. No new normal contract conflict was found. Demand consumers after cutover still require Task 8; this correction supplies the required pre-cutover compatibility, and deliberately cannot reopen legacy refill after durable cutover. The initial 72-pass lanes remain historical pre-Fix1 evidence. Task 6 R6-4/R6-5 and the deliberate Task 3 independent review gaps stated above remain unresolved and are neither waived nor re-probed. No production writes, enabling, publishing, paid/provider calls, subprocess-environment inspection, or previously refused security diagnostic occurred in Fix1. No model-capacity or transport error was received by this worker; recovery resumed saved changes and results without restarting completed lanes.

Author Fix1 outcome: ordinary compatibility correction and scoped verification complete, with combined-run timing sensitivity recorded above. Independent permitted rereview and Library checkpoint 07 remain required before Task 8. This is not security, activation or release approval.

## Original independent review — verbatim

The following original review is preserved in full as the finding and scope record. Its original FAIL/CHANGES_REQUIRED verdict remains the prior review outcome pending a fresh reviewer verdict on Fix1.

# Task 7 independent permitted requirements / code-quality review

**Spec: FAIL. Quality: CHANGES_REQUIRED.** One Important finding (R7-1); no Critical findings in the permitted scope.

Reviewed product range: `8f9a195e8bed49e0002d7b152b1d4b8983d96f04..1f897475023a50fa029def5a5e9e016ded794a8b`, using the complete recorded `task-7-review-package.md`, changed implementation/tests, `task-7-brief.md`, `task-7-report.md`, and sanitized evidence/command records. During review the working HEAD was `b50555ff302cee6a64e45ff795de180dcc3af159`; `git diff --name-only 1f897475023a50fa029def5a5e9e016ded794a8b HEAD` confirmed only controller/review documentation changed. Product and test line references below apply to the pinned product commit, not an assertion that working HEAD still equals that pin.

Read `REVIEW-SCOPE-AMENDMENT.md`, `RELEASE-AUTHORIZATION.md`, reviewer dispatch and applicable repository instructions. This is an ordinary Task 7 admission, version, relation and caller-compatibility review. The review did not revisit the refused Task 3 expiry/capacity/cross-user/adversarial work, run covered author suites, use production/network/paid services, modify product code, commit, or delegate. One new offline function diagnostic addressed the uncovered legacy consumer concern described below.

## Important finding

### R7-1 — Flag-off discovery removes the description producer before the existing consumer can hydrate it

**Changed location:** `job_discovery/db.py:130–135` (`_posting_row`, unconditional `description = None`); related removal of routine detail acquisition at `job_discovery/run.py:135–138`.

**Requirement:** Binding amendments in `task-7-brief.md:74–77` require every intermediate commit to retain a tested flag-off legacy path; lines 100–102 require pre-cutover legacy compatibility. The design's compatibility section also requires readers and writers to migrate together behind flags. Task 7's eventual lean-admission requirement does not waive this explicit sequencing requirement.

With all lifecycle flags off, `run.run` still uses `db.upsert_jobs` and still invokes `review_all` (`job_discovery/run.py:125–153,267–269`). `_posting_row` now discards even a nonempty source description for every newly discovered Job. The current reviewer reads `j.description` directly (`reviewer/db.py:312–319`) and `_stage2_inner` returns undecided as soon as that value is absent (`reviewer/run.py:88–101`). There is no intervening description hydration in this caller path at the pinned commit. Thus a new ordinary listing that would previously have supplied its JD cannot complete stage 2, and later polls cannot refill it either. Preserving already-populated caches does not preserve functionality for new listings.

The same producer change also reaches current prepare/generation consumers: `getJobForPackage` reads `j.description` (`dashboard/lib/queries.ts:466–494`), and prepare passes it directly to `generateResume` (`dashboard/app/api/application/prepare/route.ts:181–190`); the resume prompt renders a missing description as `(none provided)` (`dashboard/lib/rolefit/resumeSchema.ts:189`). This is supporting caller evidence for the same finding, not a separate whole-dashboard review.

**Evidence:** The author's final tests explicitly assert the new absence of descriptions, while the new flag-off polling test replaces the affected consumer with a no-op (`tests/test_lifecycle_admission.py:258–295`, especially line 289). The final lane command list contains no actual review/prepare/generation compatibility scenario for a newly admitted lean Job. Existing DB tests changing expectations from captured JD to NULL (`tests/test_db_jobs.py:114–122,168–188`) validate the writer change, not consumer compatibility.

A narrowly scoped, fresh offline diagnostic loaded the actual `_posting_row` and `_stage2_inner` function ASTs from the pinned-equivalent working files using Python's standard library, supplied a Posting-like value with `descriptionPlain='Available source job description'`, and used a client double whose provider method must never run. Assertions verified the returned SQL tuple contains `description=None` and the reviewer returns the same undecided result with zero provider calls. Exit status 0; output:

```text
Uncovered flag-off consumer diagnostic: source body present; legacy row description=None; stage2 returns undecided; model calls=0.
```

This is function-level confirmation plus a static real-caller trace, not an executed end-to-end DB/consumer test. No existing suite was rerun.

**Required fix:** Retain the tested pre-cutover legacy description behavior behind the appropriate service-owned readiness/control transition until compatible demand consumers exist, or supply and test the necessary consumer hydration before disabling the producer. Preserve the approved rule that rollback after cutover cannot restore unsafe passive refill. Add an ordinary offline/isolated-DB integration test exercising a real newly admitted flag-off Job through the reviewer consumer with a provider double, plus relevant prepare/generation compatibility coverage; do not stub away the component whose compatibility is asserted. This intermediate-commit failure cannot be deferred as already satisfied by future Task 8 work.

**Greenhouse distinction:** Removing routine question backfill is not independently a finding here. Prepare already reads stored questions and, when absent, calls `fetchGreenhouseQuestions` into memory before generation (`dashboard/app/api/application/prepare/route.ts:94–107`). An existing route fixture specifically exercises that fallback (`route.test.ts:205–216`). That fixture was inspected, not executed in this review, and is not part of the recorded final Task 7 Python lanes. Description consumption lacks the corresponding fallback.

## Other Task 7 requirements assessed

- Stable identity and private history: admission resolves the existing source/external listing first and retains its Job ID; it does not rewrite private FKs, existing first-seen times, frozen anchors, populated caches or use timestamps (`identity.py:405–509`). The stable-identity/private-package fixture and legacy-age fixture support this ordinary behavior. This is not a cross-user isolation verdict.
- Real caller integration: `verify_due_sources` uses `ADMISSION_CHUNK_SIZE`, calls `stage_postings`, and increments `new_jobs` only after the chunk commit. Staging admits first and records positive membership/sightings in the same transaction (`reconcile.py:176–204,334–367`). The actual source orchestration and 70-posting existing-location fixtures exercise these paths.
- Explicit business-row bound: at most one Job effect, one listing creation OR publication update, one version insertion, one listing version-pointer update, and one existing-location edge per posting; staging adds membership, listing sighting and Job availability effects. Therefore **25 postings × at most 8 business-row effects = 200**, below 500. No per-posting multi-location expansion occurs. The caller holds a chunk forecast and row writers use the established scoped reservation protocol. This assesses ordinary caller composition only, not the deliberately excluded independent capacity-enforcement guarantees.
- Source recovery fixtures: excluding newly admitted `extra` from the old 205 absent identities is correct; the fixture separately verifies `extra` has zero misses. The interruption fixture freezes only scheduler monotonic clocks to reach the intended next-page interruption; it does not prove a real-time initial admission throughput bound. Recorded final affected recovery cases pass.
- Availability-only parser fallback: `metadata_complete=False` is set centrally; metadata admission skips its display values while staging retains exact positive identity evidence. It cannot overwrite known display fields or create a synthetic version. Normal dataclass spool serialization preserves the flag.
- Versions: allowlisted metadata and normalized body digest remain lean; deterministic NFC/whitespace normalization and unchanged-hash paths avoid redundant versions. Missing optional facts preserve prior facts. Source publication updates are independent of content hashes. The prospective retention check includes the current row's age; count 11 or a version older than 30 days pauses changed-version growth and preserves evidence/known metadata. There is no archive-backed deletion or compaction to approve: the implemented pause is the specified fail-closed alternative while safe archival/reference-aware compaction is unavailable.
- Publication anchors: new Ashby listings may use a valid aware, nonfuture first-capture publication value. Existing legacy Jobs retain first-seen anchors; later publication observations record the source field without resetting the anchor or creating a publication-only content version. Unknown/invalid source publication remains unknown. The new-Ashby fixture covers initial capture and later content/publication-only changes; the legacy late-publication branch was assessed statically, not separately executed by this reviewer.
- Typed relations: only existing locations receive an explicit public structured-source edge; unknown validity/confidence remain NULL. Assertions require typed fields and reviewed evidence for acceptance and reject ordinary self-link/conflicting representative/same-job-cycle cases. No title/name auto-merge, private extraction, automatic weak-link promotion or private-anchor rewrite was introduced. Existing company/source migration mapping is unchanged.
- Flags/defaults, retirement dry-run and archive readiness are unchanged in this range. Task 10 outbox/revision integration remains necessary before archive activation; Task 7 does not establish safe activated public mutation or fabricate archived history.

## Recorded verification and limits

`task-7-evidence/commands.json` contains exact author commands. The final applicable logs are:

| Evidence | Actual server / result |
| --- | --- |
| `21-final-verified-pg17.txt` | PostgreSQL 17.11; **72 passed, 0 skipped**, 526.08 seconds |
| `22-final-verified-pg16.txt` | PostgreSQL 16.15; **72 passed, 0 skipped**, 552.95 seconds |
| `23-final-static-checks.txt` | Changed-file Ruff reports `All checks passed!`; author records the whitespace check passed |

The initial missing-`psycopg` attempt ran no tests. Missing API, location-dictionary provenance, legacy writer, publication and prospective-retention RED evidence is retained. The earlier 101-pass lanes preceded batching/publication/retention corrections; the 71-pass lanes preceded the final retention correction. They are historical evidence, not final-code verification. Failed intermediate integration snapshots and corrected recovery results remain distinguished in the author report.

No further Important or Critical findings were established in this bounded review. No separate minor finding is necessary. The final lanes do not supply the missing flag-off consumer coverage identified in R7-1, a full fresh adapter matrix after every correction, archive compaction/outbox verification, or a full-source/security/release approval.

Task 6 **FULL Spec remains FAIL**: R6-4 durable above-guard reconciliation and R6-5 shared bounded transport remain mandatory Task 8/10/13 integrations. They were not repaired, waived or independently reprobed here. The existing Task 3 independent expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed. The recorded optional `/proc/.../environ` PermissionError was not reproduced or escalated. Controller release authorization covers completion of the full upgrade through its workflow; this Task 7 report grants no rollout approval.
