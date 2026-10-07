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
