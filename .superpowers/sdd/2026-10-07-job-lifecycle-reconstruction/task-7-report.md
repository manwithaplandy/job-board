# Task 7 — lean admission and public versions

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
