# Final correction — same-reviewer scoped requirements and code-quality rereview

**DONE — Requirements / Spec: PASS. Code quality: APPROVED.**

All seven original Important findings F1–F7 and all three original new Minor findings M1–M3 are addressed. There are **0 residual Critical, 0 residual Important and 0 residual original new Minor findings**. No fix-introduced Important or Critical issue was found in the permitted scope. The two earlier deferred Minor dispositions and the deliberately unreviewed areas remain explicit below. This is the one same-reviewer correction rereview, not a new whole-branch review or security approval.

## Exact source and authority

- Correction BASE: `6cb16037aa667d11ea673e2d6d4b876df9b9f4b1`.
- Reviewed correction HEAD: `799cb7c44a594f2bbe6fe8f804fcff8d2c9506f0`.
- Final product and DB-tested source: `1cb3ab03e7194d61563f52b5802ccb14b52d7272`.
- Final default-dashboard test pin: `a1f766ed446e2946b03326c134f80730a2ed1727`. Its sole change after the DB-tested pin is the positive test double in `dashboard/app/actions/tombstoneGuard.test.ts`; product and DB test sources are unchanged.
- Completed author report: `a8c41165da7386d2ae6d3dc962c3caf5bbf7c502`.
- Packaging successor `c85fd8a` changes only three plan package files. It does not widen this reviewed source pin.
- Complete raw `final-fix1-review-package.md`: **70,537 lines, 5,217,546 bytes**, SHA-256 **`24eb2286ba6094e8e813343a1803ab948ff0e82a52a43f5712f0ef71d7129bb5`**.
- Complete non-plan correction `final-fix1-product-review-entrypoint.md`: **25 diff blocks / paths, 2,523 lines, 158,914 bytes**, SHA-256 **`6e86f5f43bbdba90a5e8408ef9c6a2aaa8eb4134f777f338e95393d8b8fe91b9`**.

I read `final-fix1-scoped-review-dispatch.md` first, the original `final-requirements-review.md`, completed `final-fix1-report.md`, the complete current 39-ruling inventory with reasons/costs, the review amendment and release authorization, every correction product/configuration/test/runbook diff block, relevant actual caller context, and the selection, lane, source and integrity audits. The original report supplies the binding design/plan/carry references and original whole-branch assessment. Its verdict at `8893ca76b7c228766eaf5b93d1f81389b754edcd` remains a historical FAIL; this report closes its correction list at the pins above.

I independently read/hash-checked both correction packages and matched all **25 current source** and **24 DB-lane source** manifest entries against current files. The controller's separate integrity record reports 94 evidence/report hashes checked and source objects matched against both working tree and Git. I read actual final saved result summaries/logs, the browser script/result, and historical phase summaries. I did **not** semantically read all 70,537 lines of repeated raw telemetry/nested packages or every line of the 4.4 MiB failed catalog diff. Package hashing is an integrity check, not semantic review of all telemetry.

No tests, helpers/subagents, DB connections, provider/network/cloud/production actions, Git mutation, migration, activation or release were performed in this rereview. The report is my only write. Existing enforcement interfaces and unchanged copied SQL bodies are accepted development contracts only; inspection of the narrow authorized additions supplies no independent certification of the old mechanisms.

## Original finding dispositions

### F1 — Reachable version admission and exact archived local compaction: addressed

Binding: design §7 and Task 7's deferred archive/reference-aware retirement prerequisite, as cited in the original finding. `version_retention.py:29` now computes a prospective replacement plan; `identity.py` checks it and moves the current pointer before bounded local compaction. `maintenance.py:181` can retire the oldest superseded row with nine newer superseded versions, so the ordinary current-plus-ten state can make room. The old-current case can progress through replacement when exact proof and references permit it.

Eligibility requires exact version ID/listing/revision/hash coverage, no pending version event, no needed cache/private/demand references, and acknowledged current public-edge heads without pending edge events. Migration10 adds the narrow edge-compaction branch; local storage retirement keeps historical public facts and does not publish `removed`. The schema mirror matches the additive definition. Retirement controls/dry-run remain material; protected or unarchived history still pauses. Replacement allows at most 12 extra row effects per posting (the existing 25-posting chunk plus base effects remains within 500); maintenance bounds selected effects and bytes independently. Oversized inherited/protected histories can still defer until eligible bounded maintenance progresses; this is an intentional limit, not a promise that all history is immediately disposable.

The ordinary final regression covers old current, current-plus-ten, and known-location edge cases through actual admission and exact archive acknowledgement, plus protected and unarchived pauses. The repaired selected maintenance fixture uses actual admitted/acknowledged history rather than the former manually fabricated 15-version watermark. These cases passed in both saved final PostgreSQL lanes. No physical reclamation conclusion follows from logical compaction.

### F2 — Disposable demand retention and actual consumer lifetime: addressed

Binding: design §4 cache policy and §6 terminal details. `maintenance.py` removes permanent protection based merely on a non-NULL terminal snapshot. Phase 4 permits completed demand bodies/receipts to retire after seven days from the latest settlement/actual consumption, after use application and only when the relevant handoff/active-consumer conditions allow it. Active generation and pending/running demand work remain needed inputs. Saved application/review/private bundles remain independent durable inputs.

The typed dashboard request wrapper pins only the exact returned ready owner/job/version/kind/JD/Q tuple for DBnow+180 seconds; Python ready reuse also refreshes its handoff. `reviewer/db.py:542` pins exact attached review inputs in bounded sorted chunks. The actual `_review_user` caller at `reviewer/run.py:585` wraps its async batch in `review_with_input_pins`: renew every 30 seconds, commit before provider awaits, serialize synchronous connection use, and stop/cancel the consumer on renewal failure or surrounding cancellation. The heartbeat is joined in `finally`. It does not stamp actual use prematurely.

Saved ordinary evidence covers detail-only expiry/re-demand, unchanged saved package input, active generation retention, and an actual async review batch with fake provider and maintenance between pin renewals. Review persistence retains the exact input, applies consumption, completes `review_write`, and later retires temporary receipt/detail while keeping the saved review. This closes the actual-consumer gap as well as the original unbounded terminal retention. Handoff/renewal timing remains a runtime dependency, not new independent expiry-enforcement assurance.

### F3 — Applied status independent of irrelevant preparation questions: addressed

Binding: design §4 application/history consumers and §5 protected saved work; Tasks 8/9 compatibility. `dashboard/app/actions/applications.ts:14` first detects existing saved work. Existing packages take the status-only path and preserve all saved inputs/artifacts. A new marker requests description readiness, carries the actual returned tuple/capture time, and consumes that exact receipt; non-Greenhouse jobs no longer need Greenhouse questions. Repeat marking preserves applied time, and bare-marker undo remains supported.

Migration10's narrowly authorized application-package UPDATE exception excludes only status/applied_at/updated_at from null-safe equality. It preserves the remaining owner, input, artifact, insert and accounting contracts; it does not invent legacy provenance. Actual owned action/worker cases cover a non-Greenhouse new marker and known/unknown saved résumé packages with NULL questions under enforced fixture controls, repeat marking and undo. Both majors pass. Unknown-input full artifact recapture remains explicitly unimplemented; that limitation no longer blocks an ordinary status change.

### F4 — Positive live demand observation and newer-positive ordering: addressed

Binding: design §1 distinct sightings and §2 newer-positive-wins. `_record_live_verification` at `demand.py:167` records the exact live-completion demand identity, observation kind/time, one count increment, open availability and reset miss evidence in the same committed ready-completion work. It also clears the paired Job closure when reconciliation closed that exact Job while the validated fetch was in flight. Public change pairing remains on the ordinary writer path; the compact private demand UUID is not added to public projection.

Ready reuse, failed fetch and genuine private-copy paths do not call this live-observation path. Final tests cover both orderings of older absence versus successful live fetch, one counted observation, stable discovery anchor, no reuse increment and no failed/private-copy increment. The late close-during-fetch RED and subsequent two-case GREEN are retained; the complete current lanes include the corrected ordering case. Accepted demand identity/floor interfaces provide the existing completion contract, not a newly reviewed deduplication/security mechanism.

### F5 — Exact ready detail delivery records use: addressed

Binding: design §4 actual authorized detail use. `dashboard/app/api/jobs/[id]/route.ts:50` consumes only the exact authenticated ready payload returned by the helper before delivering it. The controller expressly chose successful server delivery as the semantic boundary. Status-only helper access and anonymous/pending access do not become use. `apply_consumptions` now also handles delivered question content where present and matches the actual questions as well as version, avoiding attribution to a later different question capture.

Owned actual route/helper/service-worker evidence verifies the receipt-to-last-use path and leaves an unrelated same-version receipt untouched. The focused question-use fixture verifies matching capture update and preservation after the shared questions change. These are ordinary composition tests, not cross-user assurance. Delivered but unseen content can extend retention; the runbook discloses this approved cost.

### F6 — Completed producers reach finite terminal cleanup: addressed

Binding: design §6 detail retention with retained compact replay state. Demand completion commits the authoritative terminal result and optional shared-cache write before normal finalization. `dashboard/lib/db.ts:160` finalizes the exact dashboard claim in a second transaction after original deferred checks have committed. If that metadata step fails, it logs the class and returns the already committed artifact outcome rather than misreporting failure/refunding it.

`maintenance.py:252` provides bounded committed-work recovery for transaction-specific `public_writer`, `dashboard`, `review_write` and aged terminal demand leftovers. It requires matching settled reservation history and excludes held/current-transaction work, then invokes the existing finalization interface while retaining compact floors. Phase 3 subsequently removes eligible seven-day settled details. The added `review_write` scope follows its explicit controller ruling and actual saved-review caller.

Saved final ordinary cases exercise actual public-writer, dashboard, demand and review persistence through terminal eligibility; unfinished held accounting stays retained. Test cutoff wrappers advance only the ordinary retention cutoff, not old mechanism clocks. Source ordering accounts for demand's optional last write and caller-owned public/review commits. This closes new producer-to-cleanup composition, with no independent review of old fencing, expiry or physical accounting.

### F7 — Repeated suspicious-empty follow-up and operator signal: addressed

Binding: design §2 suspicious-empty policy. The normal and operational completion paths now persist bounded due/last/status state and invoke `followup.py`. At streak >=2, at most three deterministic stored exact existing-open coordinates are checked once per 24 hours/source, sharing remaining source request/time budget and existing transport. Attempt state commits before network; results produce existing warning/migration-review status. Exhausted budget can defer work, and the conservative sample can miss a migration; both are explicit policy costs.

Normal and operational scheduler fixtures cover live, unknown and failed responses, no mass closure, three distinct sampled coordinates and no repeated sample within the cooldown. This is bounded diagnostic/operator follow-up, not automatic title merge/reactivation or proof of whole-board availability. No new outreach, notification infrastructure or paid/live call was introduced or run in this review.

### Original new Minors: all addressed

| Finding | Disposition and evidence |
| --- | --- |
| M1 — inconsistent Unicode description hash | `identity.description_hash` centralizes NFC/whitespace normalization; poll and demand use it. Ordinary decomposed-accent poll/demand fixture retains the same version, passing both final DB lanes. |
| M2 — applied/approved population mismatch | `FunnelSection` removes the cross-population conversion percentage, preserves lifetime applied and retained-history explanation. Component regression and actual FunnelSection Chromium fixture cover applied=10/current approved=2 at desktop/mobile sizes; no “of approved” percentage remains. |
| M3 — stale runbook sequence/inventory | Summary now states first bounded baseline page then interleaved export/ACK, correctly names the global critical-slot increment and actual identity/reconcile modules. New composition/retention/consumer policies are documented. Source review is the appropriate evidence. |

## Evidence chronology and limits

The original 79 Python selectors and their order remain; only the new ordinary final-fix file and the exact repaired ordinary version-retirement node were appended (81 selectors). Security exclusions and the two owned dashboard files are unchanged. A selector count is not a test-case count. The final file has 21 parameterized cases; total current selection is 407. No broad omitted suite is inferred from that count.

| Current saved lane | Source | Actual result |
| --- | --- | --- |
| Python PostgreSQL 17.11 | 1cb3ab03 | 407 passed, pytest 220.98 s; harness 239.21 s; exit 0 |
| Python PostgreSQL 16.15 | 1cb3ab03 | 407 passed, pytest 215.54 s; harness 227.88 s; exit 0 |
| Owned dashboard PG17 | 1cb3ab03 | Flow 10 + Consumers 6, separate sequential files; harness 23.62 s; exit 0 |
| Owned dashboard PG16 | 1cb3ab03 | Flow 10 + Consumers 6; harness 20.30 s; exit 0 |
| Default dashboard | a1f766ed | 217 files; 1,717 passed / 2 historical missing-PDF skips; Vitest 89.07 s, harness 90.23 s; exit 0 |
| Type/lint | a1f766ed | Type exit 0; lint 0 errors / 9 inherited warnings; exits 0 |
| Offline webpack build | a1f766ed | Exit 0; inherited unpdf import.meta warning retained; sanitized local font mock/dummy configuration, no production integration proof |
| Actual FunnelSection browser | a1f766ed | Chromium 151.0.7922.173, two viewports, eight assertions, zero page errors/blocked requests; loopback static metrics, no server/auth/provider |
| Controller Ruff | current unchanged product | Controller integrity report records `ruff check .`, exit 0. Not run by this reviewer. |

The browser result has two descriptive viewport entries; its script contains four assertions per viewport, hence eight assertions rather than eight result-array entries. The screenshots are retained artifacts; this review did not claim separate screenshot visual inspection. Local tools include Python 3.12.14 and Node 24.19.0; hosted CI uses Node 22. No hosted CI execution or live provider coverage is claimed here.

Historical failures are not erased or relabeled current passes. The initial ignored-workspace inventory was committed after the first RED had started; the author explicitly records that procedural deviation. Initial Python RED was 9 failed/2 passed, including an initially invalid location fixture; owned RED was 4 failed/6 passed, analytics 1 failed/9 passed. Intermediate Python was 3 failed/8 passed. Additional actual review-pin, enforced legacy-status, detail-question-use and close-during-fetch REDs drove same-wave corrections. The enforced-status RED also contained a separate fixture SQL typo. An affected PG16 lane was 20 passed/1 catalog mismatch while source/schema fixture definitions were out of step; its large failed log is retained. The first broad candidate was 405 passed/1 failure because an older test manually cancelled a now-completed claim; the test was changed to assert the actual completed state. A later candidate PG17 had 406 passes; candidate PG16 was deliberately interrupted at 383 passes with **exit 2**, and its remaining lanes did not run. Final stable DB lanes then reran at 1cb3ab03 with 407 each. The first default lane had 1,716 passes/1 failure/2 skips; only its positive wrapper call-count mock changed before the final 1,717-pass lane. Counts across these phases are not summed, and interrupted/failed lanes are not acceptance evidence.

These current lanes supersede earlier phase evidence only for their actual selected source/scope. Original task reports remain the source for other historical measurements. No current local result proves production physical headroom, reclaimed allocation, TLS/destination configuration, paid-provider compatibility, cost neutrality, sustained source coverage, or omitted security properties.

## All 39 controller rulings — disposition and retained cost

Numbers below are the order of `Ruling:` entries in the complete current inventory; its full original text remains authoritative. Prior accepted contracts are carried, not independently re-certified in this scoped rereview.

| # | Ruling and disposition / remaining cost |
| --- | --- |
| 1 | Task4 nested-IF staging correctness: retained accepted ordinary repair; no independent fence assurance. |
| 2 | Task6 initial above-guard read-only concession: historical interim limit, superseded functionally by #15; HTTP alone was not durable closure progress. Physical limits are unchanged. |
| 3 | Task6 completed-membership same-source handoff: retained identity/membership/checkpoint contract; possible consistency cost was addressed in its earlier ordinary scope, no ownership/expiry recertification. |
| 4 | Workable mixed-valid positives: retained accepted parser correction, with conservative incomplete status and compatibility cost. |
| 5 | SmartRecruiters/Workday mixed-page positives: retained accepted paged correction; cursor/count conservatism and prior phase evidence remain explicit. |
| 6 | Conditional Task6 checkpoint: sequencing carry resolved by shared transport and #15; not a waiver or new Task3 verdict. |
| 7 | Task7 pre-cutover legacy capture/sticky cutover: retained compatibility contract; no passive refill after cutover. Earlier bulk concurrent timing failure remains historical, cause unproven. F1 final retirement carry is now closed. |
| 8 | Task8 same-transaction service capability setup/original authenticated DML: retained; new completion integration reviewed under F6, no new grant or old mechanism assurance. |
| 9 | Explicit missing-question work with legacy flag off: retained actual request/worker behavior before sticky cutover; paused hydration afterward can still honestly defer. |
| 10 | Bounded exact-job identity mapper: retained; subset mapping is not global readiness and does not reset/advance the global cursor. |
| 11 | Authoritative full private tuple and actual receipt ID/kind, first NULL-to-Q acquisition: preserved by F2/F3/F5; saved JD/time are not rewritten or retroactively attributed. |
| 12 | Missing-origin genuine private-copy recovery: retained; new capture/time is honest, saved package unchanged, no source sighting. F2 may now retire the disposable origin. |
| 13 | Unknown-input historical artifact terminal alternative: still an explicit availability limitation. Full atomic recapture of all output legs remains unimplemented; saved artifacts remain available. F3 restores independent status functionality. |
| 14 | Narrow public read projection: retained accepted interface; per-row query/refresh cost and production exposure assurance remain unmeasured/unreviewed. |
| 15 | Bounded operational lane: retained, including fixed allowed fields and finite provisioned receipts/slots; F7 adds only approved source follow-up fields. Exhaustion defers; MVCC/index/WAL/reuse remains unknown. |
| 16 | Logical archive processing escrow: retained ordinary 112 MiB/hard 128 MiB forecast and `6*C + 128000`; lower runway and accounting complexity remain. This is not physical accounting certification. |
| 17 | Task11 authorized supersession/transfer extension: retained exact membership and explicit consumed authorization; extra history/fence metadata and recovery complexity remain. |
| 18 | Task11 second archive-only migration ruling: same retained feature contract as #17, not a second authorization or production recovery permission. |
| 19 | Exact clean-schema/migration catalog node only: selection retained; ordinary parity supports schema composition, not sibling ACL/RLS/security behavior. |
| 20 | Replay defaulted metadata/permanent suppression: retained optional pure reader; epoch is provenance, suppression remains conservative, caller policy/time/markers remain obligations. |
| 21 | Independent source child, 60 s tick/330 s deadline/300 s turns: retained actual caller and committed closure counts; connections/RSS/API cost and production 24-hour lag remain unmeasured. |
| 22 | Readiness09 additive prerequisites/attestations: retained accepted feature interface. Seeded local attestations do not establish deployed producer compatibility or production activation readiness. |
| 23 | Clean-schema ledger entries for already mirrored05/06: retained ordinary parity; no history rewrite or claim of production migration completion. |
| 24 | Stripe helper extraction: retained minimal App Router compatibility fix; mocked tests/offline build are not live billing evidence. |
| 25 | TierCard extraction: retained unchanged behavior/copy; original count correction (21 helper/route, two TierCard cases) remains, no pricing scope expansion. |
| 26 | Conditional owned fixture CHECKPOINT: retained test-only housekeeping; earlier reset-churn evidence is a hypothesis, not proof of production latency/capacity. |
| 27 | Owned immutable fixture marker plumbing: retained harness limitation; no production CHECKPOINT or target/guard/deadline relaxation. |
| 28 | Bounded baseline/export/ACK interleaving: retained and M3 summary aligned; completeness still gates rollout readiness, not ability to drain the first bounded baseline. |
| 29 | Backward-compatible admission_allowed caller propagation: retained; existing verification continues while metadata admission defers. Conservative metadata delay remains possible. |
| 30 | Prospective exact archived version/edge compaction: implemented in F1; current facts, needed inputs and history retained. Logical retirement supplies no physical reclamation or deletion authorization. |
| 31 | Authenticated ready-detail server delivery boundary: implemented in F5; delivered-but-unseen retention extension remains explicit. |
| 32 | Additive exact edge-compaction trigger branch: implemented in migration10/schema and F1; no semantic removed event. Narrow addition reviewed, copied old mechanism bodies not certified. |
| 33 | Compact service-only live-demand identity/kind: implemented in F4; exact live completion/public pairing reviewed, private UUID not added to projection; old deduplication enforcement not independently certified. |
| 34 | Streak2 / <=3 exact samples / 24h follow-up: implemented in F7 on both callers. Small sample, budget deferral and migration-attention delay remain explicit costs. |
| 35 | Post-commit demand/dashboard/public-writer completion: implemented in F6 with optional last write and bounded recovery accounted for; held/unresolved work retained, compact floors persist. |
| 36 | Exact 180-second ready handoff and seven-day terminal capture policy: implemented in F2; active use and durable bundles remain separate. Pins can conservatively prolong temporary retention. |
| 37 | Actual review batch 30-second input-pin renewal: wired to real caller and covered by actual async batch fixture; stop/join behavior inspected. Missed renewal remains an operational dependency, not a new expiry proof. |
| 38 | Include review_write producer completion: implemented and actual saved-review cleanup fixture passes. Completion follows committed writes, not provider start. |
| 39 | Narrow legacy application status-only equality exception: implemented and ordinary enforced known/unknown retained-artifact cases pass. No fabricated input provenance or general payload exemption. |

## Remaining carries and deliberately unreviewed gaps

- **Task3 remains development basis only**, at `a17b6427ea06c60e801836e56114890441166842`, never fully security-approved. Independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes remain deliberately unreviewed. They were not retried, split, disguised, reproduced or substituted here. PASS/APPROVED does not supply that missing verdict. No new safeguard rejection occurred in this rereview.
- **Prior Minor R11-2:** misleading bomb-test label was already corrected; the fixture still exercises declared compressed-length rejection/body closure, not exporter decompression-path execution. That focused execution remains a nonblocking evidence gap, unchanged by these fixes. No new probe is requested.
- **Prior Minor migration04 duplication:** append-only historical definitions with forward05/06 and later additive10 remain a nonblocking maintenance cost; clean-schema parity is the ordinary evidence. History is not rewritten to erase duplication.
- Earlier Task10 predecessor lookup/readability/warning findings, Task9 history page/unscored/caption/checklist findings, R11-1 renewed-grant history, Task13 interpreter/baseline/admission findings and R6-4/R6-5 feature carries remain closed in their recorded accepted scopes. The correction does not reopen untouched findings. Original historical failures and phase-specific evidence remain preserved.
- Full unknown-input legacy artifact recapture, optional replay runtime loader/object adapter/PG bootstrap/serving and automatic disposal remain unimplemented optional/explicitly limited scope. Permanent suppression is not undone by a snapshot epoch; optional replay is not an authentication system.
- Logical budgets, finite operational preallocation and local retention tests do not establish physical reclamation, sustainable headroom, WAL/index/MVCC reuse, cost neutrality or API load. The original 61 two-event closures figure uses a **16 MiB** free critical allowance, not the count of 12,500 slots. Prior aggregate resource sample (112,779,264 bytes child RSS, about 2.99 CPU seconds, two DB sessions including observer) was short/local with inert reviewer and source disabled; it is not an active production workload measurement.
- Source child/fairness fixtures and bounded representative follow-up do not establish corpus-wide production verification within 24 hours. Production corpus size, oldest-success lag and actual provider timing/cost still require operational evidence. Dynamic dashboard query/refresh load is likewise unmeasured.
- Two historical missing-PDF skips, nine inherited lint warnings and the inherited unpdf build warning remain nonblocking, disclosed limitations. Offline build and component browser evidence do not prove live Next/auth/provider/billing behavior. Hosted CI has not been run by this reviewer.
- Fresh-install defaults remain off/dry-run/inactive. Actual production migrations, writer compatibility/readiness, volume/TLS/server and encrypted destination/IAM/retention configuration remain controller/operator rollout work. Source deployment alone is not full lifecycle activation. No production destination, recovery, deletion, credential or security-setting approval is inferred from this report.
- The release authorization supersedes the earlier deployment hold for the **completed upgrade after this permitted process**. Release is the controller's responsibility, with unrelated staged Railway discovery changes preserved and exact live SHA/service/aliases and permitted E2E verified through the actual workflow. Accepted complete-history bundle/Library checkpoints remain the recovery basis. This reviewer performed no release or recovery mutation.

## Final disposition

The single complete correction wave resolves the original permitted final finding list. The implementation, saved current tests and this source/evidence rereview support **Requirements PASS / Code quality APPROVED within the amended scope**. The controller now adjudicates the explicitly retained nonblocking costs/gaps and handles release under the existing authorization; no second external final correction wave is requested.

**DONE — PASS / APPROVED; 0 residual Critical, 0 residual Important, all F1–F7/M1–M3 closed. STOP.**
