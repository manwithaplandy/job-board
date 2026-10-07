# Full pinned review package

BASE: 6538fc70a8dc5d49d3a0812f18542730c49c381b

HEAD: 3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061

## Commits

3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061 fix: close lifecycle transaction and capacity review gaps


## Files

 .../task-3-evidence/fix1-caller-inventory.txt      |  348 ++++++
 .../task-3-evidence/fix1-dashboard-attempt17.txt   |   14 +
 .../task-3-evidence/fix1-dashboard16.txt           |   14 +
 .../task-3-evidence/fix1-dashboard17.txt           |   14 +
 .../task-3-evidence/fix1-eslint.txt                |    0
 .../task-3-evidence/fix1-final16.txt               |    7 +
 .../task-3-evidence/fix1-final17.txt               |    7 +
 .../task-3-evidence/fix1-green-attempt17.txt       |  191 ++++
 .../task-3-evidence/fix1-green-expanded17.txt      |   55 +
 .../task-3-evidence/fix1-green-poll17.txt          |    3 +
 .../task-3-evidence/fix1-green2-17.txt             |    4 +
 .../task-3-evidence/fix1-green3-17.txt             |   94 ++
 .../fix1-post-install-inventory17.txt              | 1168 ++++++++++++++++++++
 .../task-3-evidence/fix1-red-backlog17.txt         |   21 +
 .../task-3-evidence/fix1-red-callers17.txt         |  375 +++++++
 .../task-3-evidence/fix1-red-corrected17.txt       |  613 ++++++++++
 .../task-3-evidence/fix1-red-erasure-order17.txt   |   24 +
 .../task-3-evidence/fix1-red-order17.txt           |   61 +
 .../task-3-evidence/fix1-red-security17.txt        |  483 ++++++++
 .../task-3-evidence/fix1-ruff.txt                  |    1 +
 .../task-3-evidence/fix1-typecheck.txt             |    9 +
 .../task-3-report.md                               |  181 +++
 company_discovery/enrich_apply.py                  |   64 +-
 company_discovery/enrich_backfill.py               |   35 +-
 company_discovery/name_backfill.py                 |   38 +-
 company_discovery/run.py                           |    3 +-
 company_discovery/worker.py                        |   13 +-
 dashboard/lib/jobLifecycle.db.test.ts              |   26 +
 job_discovery/db.py                                |   31 +-
 job_discovery/lifecycle/claims.py                  |    2 +-
 job_discovery/lifecycle/legacy_spool.py            |   26 +-
 job_discovery/locations.py                         |    4 +
 job_discovery/run.py                               |    9 +-
 migrations/2026-10-03-02-lifecycle-safety.sql      |   57 +-
 reviewer/backfill_floors.py                        |    3 +
 schema.sql                                         |   57 +-
 tests/test_lifecycle_company_boundaries.py         |  256 +++++
 tests/test_lifecycle_legacy_spool.py               |   75 ++
 tests/test_lifecycle_review_security.py            |  357 ++++++
 tests/test_lifecycle_service_order.py              |  123 +++
 40 files changed, 4757 insertions(+), 109 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-caller-inventory.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-caller-inventory.txt
new file mode 100644
index 0000000..dc6e43e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-caller-inventory.txt
@@ -0,0 +1,348 @@
+reviewer/worker.py:66:    was empty (caller should sleep). Per-request isolation: any failure is recorded on
+reviewer/worker.py:73:    conn.commit()
+reviewer/worker.py:76:    conn.commit()
+reviewer/worker.py:92:            conn.commit()
+reviewer/worker.py:94:        # _review_user manages its own review_runs row + commits (incl. the cap/skip
+reviewer/worker.py:104:            # off, rather than consume a resume which has not actually executed.
+reviewer/worker.py:106:            conn.commit()
+reviewer/worker.py:109:        conn.commit()
+reviewer/worker.py:112:            conn.rollback()
+reviewer/worker.py:116:        conn.commit()
+reviewer/worker.py:119:        # Clear only now — after finish_review_request + commit in BOTH paths above, so
+reviewer/worker.py:122:        # Fallback: if finish/commit itself raised, we still clear here; the row stays
+reviewer/worker.py:157:    finally. The claim path (FOR UPDATE SKIP LOCKED) lets K loops on separate connections
+reviewer/worker.py:181:                # Idle: sleep in 1s slices so a SIGTERM (stop) or a sibling's fatal event
+reviewer/worker.py:186:                    time.sleep(1)
+reviewer/backfill_floors.py:52:            cur.execute(_SELECT)
+reviewer/backfill_floors.py:53:            rows = cur.fetchall()
+reviewer/backfill_floors.py:61:                cur.execute(
+reviewer/backfill_floors.py:68:        conn.commit()
+reviewer/config.py:22:# On-demand review worker (reviewer.worker): seconds to sleep when the
+company_discovery/enrich_backfill.py:2:stamp enriched_at from the free ATS-board metadata the poller already fetches, so
+company_discovery/enrich_backfill.py:29:from company_discovery.enrich_apply import apply_enrichment, fetch_batches, plan_enrichment
+company_discovery/enrich_backfill.py:55:        cur.execute(_SCOPE_SQL)
+company_discovery/enrich_backfill.py:56:        return cur.fetchall()
+company_discovery/enrich_backfill.py:69:        conn.commit()
+company_discovery/enrich_backfill.py:70:        for results in fetch_batches(rows, plan_enrichment):
+company_discovery/enrich_backfill.py:78:                conn.commit()
+company_discovery/enrich_backfill.py:80:                conn.rollback()
+company_discovery/serp.py:9:_SERPER_URL = "https://google.serper.dev/search"
+company_discovery/serp.py:14:# to Serper.dev) throttles at ~1-2 req/s, so the fetch loop self-limits
+company_discovery/serp.py:29:        time.sleep(wait)
+company_discovery/serp.py:33:def fetch_company_snippets(name: str, ats: str) -> str | None:
+company_discovery/serp.py:55:        log.warning("serp fetch failed for %s (%s)", name, ats, exc_info=True)
+company_discovery/serp.py:62:        cur.execute(
+job_discovery/db.py:45:        cur.execute("SELECT pg_database_size(current_database()) AS bytes")
+job_discovery/db.py:46:        return cur.fetchone()["bytes"] / (1024.0 * 1024.0)
+job_discovery/db.py:62:            cur.execute(
+job_discovery/db.py:76:        cur.execute(
+job_discovery/db.py:79:        return cur.fetchall()
+job_discovery/db.py:82:POLL_FAILURE_DEACTIVATE = 5  # consecutive failed board fetches before a non-seed company stops being polled
+job_discovery/db.py:86:    """Track consecutive board-fetch failures; deactivate dead non-seed boards.
+job_discovery/db.py:90:            cur.execute(
+job_discovery/db.py:94:        cur.execute(
+job_discovery/db.py:105:        return cur.fetchone()["active"] is False
+job_discovery/db.py:143:    """Batch-upsert a list of postings using psycopg3 pipelined executemany.
+job_discovery/db.py:156:        cur.executemany(_UPSERT_SQL, rows, returning=True)
+job_discovery/db.py:158:            row = cur.fetchone()
+job_discovery/db.py:179:        cur.execute(
+job_discovery/db.py:183:        return {r["external_id"] for r in cur.fetchall()}
+job_discovery/db.py:188:    rows = conn.execute(
+job_discovery/db.py:191:    ).fetchall()
+job_discovery/db.py:199:        conn.execute(
+job_discovery/db.py:211:        cur.execute(
+job_discovery/db.py:221:        cur.execute("INSERT INTO poll_runs (started_at) VALUES (now()) RETURNING id")
+job_discovery/db.py:222:        return cur.fetchone()["id"]
+job_discovery/db.py:236:        cur.execute(
+job_discovery/db.py:254:    conflict = ("DO UPDATE SET questions = EXCLUDED.questions, fetched_at = now()"
+job_discovery/db.py:257:        cur.execute(
+job_discovery/db.py:259:            INSERT INTO job_questions (job_id, questions, fetched_at)
+job_discovery/db.py:271:        cur.execute(
+job_discovery/db.py:281:        return [r["external_id"] for r in cur.fetchall()]
+job_discovery/location_backfill.py:9:outage). Safe to rerun; commits per batch, so an interrupt loses nothing.
+reviewer/db.py:68:            cur.execute("SELECT plan, config FROM tier_settings")
+reviewer/db.py:69:            rows = cur.fetchall()
+reviewer/db.py:71:        conn.rollback()
+reviewer/db.py:83:            cur.execute("SELECT value FROM app_settings WHERE key = 'invite_comp_plan'")
+reviewer/db.py:84:            row = cur.fetchone()
+reviewer/db.py:86:        conn.rollback()
+reviewer/db.py:93:        cur.execute(_LOAD_PROFILES_SQL)
+reviewer/db.py:94:        return cur.fetchall()
+reviewer/db.py:100:        cur.execute(_LOAD_PROFILES_SQL + " WHERE p.user_id = %s", (_uuid(user_id),))
+reviewer/db.py:101:        return cur.fetchone()
+reviewer/db.py:108:    short transaction is committed by the caller before any external model calls.
+reviewer/db.py:112:        cur.execute("SELECT user_id FROM matching_activity WHERE user_id=%s FOR UPDATE", (_uuid(user_id),))
+reviewer/db.py:113:        if cur.fetchone() is None:
+reviewer/db.py:115:        cur.execute("SELECT matching_paused(%s) AS paused", (_uuid(user_id),))
+reviewer/db.py:116:        paused = cur.fetchone()["paused"]
+reviewer/db.py:118:            cur.execute("UPDATE matching_activity SET paused_at=coalesce(paused_at,now()) WHERE user_id=%s", (_uuid(user_id),))
+reviewer/db.py:132:        cur.execute(
+reviewer/db.py:136:        row = cur.fetchone()
+reviewer/db.py:141:# it survives _review_user's intermediate commits (start_review_run, _persist_rows'
+reviewer/db.py:142:# per-chunk commits); it must be explicitly released with unlock_user_review.
+reviewer/db.py:158:    AFTER the spend/finish commit, so the next run reads the committed spend.
+reviewer/db.py:168:        cur.execute(
+reviewer/db.py:172:        return bool(cur.fetchone()["locked"])
+reviewer/db.py:178:        cur.execute(
+reviewer/db.py:193:        cur.execute(
+reviewer/db.py:198:        row = cur.fetchone()
+reviewer/db.py:205:    The caller commits this in its own transaction right after the review rows' own
+reviewer/db.py:206:    chunked commits, so spend lands just behind the persisted rows (see _persist_chunk).
+reviewer/db.py:211:        cur.execute(
+reviewer/db.py:306:        cur.execute(
+reviewer/db.py:310:        total = cur.fetchone()["n"]
+reviewer/db.py:311:        cur.execute(
+reviewer/db.py:319:        rows = cur.fetchall()
+reviewer/db.py:331:        cur.execute(_UPSERT_REVIEW_SQL, full)
+reviewer/db.py:342:        cur.execute(
+reviewer/db.py:357:        return cur.fetchall()
+reviewer/db.py:362:        cur.execute(
+reviewer/db.py:366:        return cur.fetchone()["id"]
+reviewer/db.py:372:        cur.execute(
+reviewer/db.py:391:    """Atomically claim the oldest pending request → status='running'. FOR UPDATE SKIP
+reviewer/db.py:393:    claimed {id, user_id, claim_version} or None when the queue is empty. Caller commits."""
+reviewer/db.py:395:        cur.execute(
+reviewer/db.py:402:              FOR UPDATE SKIP LOCKED LIMIT 1
+reviewer/db.py:407:        return cur.fetchone()
+reviewer/db.py:413:        cur.execute(
+reviewer/db.py:418:        return bool(cur.fetchone()["current"])
+reviewer/db.py:427:    Caller commits.
+reviewer/db.py:430:        cur.execute(
+reviewer/db.py:451:    Returns the number recovered. Caller commits."""
+reviewer/db.py:454:        cur.execute(
+reviewer/db.py:484:        cur.execute(
+reviewer/db.py:503:        return cur.fetchall()
+job_discovery/jd.py:76:    """Pull JD plain text from the stored `raw` payload. No HTTP — spec §5."""
+company_discovery/enrich.py:1:"""Per-ATS company enrichment: fetch the real display name + about text that the
+company_discovery/enrich.py:2:job adapters already touch but discard. Reuses job_discovery.http.get_json/get_text
+company_discovery/enrich.py:7:(their JSON APIs carry no org name); see fetch_board_name / enrich_from_jd. Callers
+company_discovery/enrich.py:19:from job_discovery.http import get_json, get_text
+company_discovery/enrich.py:35:# name from the public board page <title> (see fetch_board_name / _BOARD_PAGES).
+company_discovery/enrich.py:42:    "lever": "https://jobs.lever.co/{token}",
+company_discovery/enrich.py:43:    "ashby": "https://jobs.ashbyhq.com/{token}",
+company_discovery/enrich.py:56:def fetch_board_name(ats: str, token: str) -> str | None:
+company_discovery/enrich.py:89:    # fetches `/v1/boards/{token}/jobs?content=true`): the board root returns
+company_discovery/enrich.py:91:    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{token}")
+company_discovery/enrich.py:100:        f"https://apply.workable.com/api/v1/widget/accounts/{token}?details=true"
+company_discovery/enrich.py:109:    base = f"https://api.smartrecruiters.com/v1/companies/{token}/postings"
+company_discovery/enrich.py:129:        name = fetch_board_name(ats, token)
+company_discovery/enrich.py:131:        log.warning("board-title fetch %s/%s failed (%s: %s); continuing without name",
+reviewer/run.py:20:    """Persist review rows with per-chunk commits.
+reviewer/run.py:22:    Commits every chunk_size rows so a partial batch is durable on partial
+reviewer/run.py:24:    committed so far is kept and iteration continues from the next row.
+reviewer/run.py:37:                conn.rollback()
+reviewer/run.py:43:            conn.commit()
+reviewer/run.py:45:    conn.commit()  # final commit for the tail
+reviewer/run.py:350:    conn.commit()
+reviewer/run.py:362:        # lock is released in the finally, AFTER the spend/finish commit, so the next run
+reviewer/run.py:363:        # reads the committed spend. Covers BOTH entry points since both funnel here.
+reviewer/run.py:388:        conn.commit()  # release short activity-row lock before slow model work
+reviewer/run.py:474:            # per non-empty chunk), so the dashboard's cursor poll sees committed rows +
+reviewer/run.py:488:                conn.commit()
+reviewer/run.py:520:            # _persist_rows already committed this chunk's job_reviews (per-PERSIST_CHUNK_SIZE
+reviewer/run.py:521:            # commits + a tail commit inside it); this commit lands the spend immediately
+reviewer/run.py:525:            # commit is what makes the chunk visible to the dashboard's cursor poll (not at
+reviewer/run.py:526:            # end of run). Per-chunk commits do NOT release the session advisory lock — only
+reviewer/run.py:528:            conn.commit()
+reviewer/run.py:530:        conn.commit()  # Candidate/usage reads must not span model work.
+reviewer/run.py:533:            conn.commit()
+reviewer/run.py:559:        conn.rollback()
+reviewer/run.py:564:        conn.commit()
+reviewer/run.py:565:        # Release AFTER the commit above so any concurrent run that now acquires the
+reviewer/run.py:566:        # lock reads this run's committed daily spend (M-TOCTOU). No-op if we never
+job_discovery/run.py:8:from job_discovery.http import get_json as _get_json
+job_discovery/run.py:15:    """Fetch + persist the question schema for this Greenhouse company's open jobs that
+job_discovery/run.py:16:    lack a job_questions row (rolling backfill). One HTTP call per missing job, each
+job_discovery/run.py:21:        fetched = 0
+job_discovery/run.py:24:            fetched += 1
+job_discovery/run.py:25:            if fetched % UPSERT_CHUNK_SIZE == 0:
+job_discovery/run.py:26:                conn.commit()
+job_discovery/run.py:27:        conn.commit()
+job_discovery/run.py:28:        return fetched
+job_discovery/run.py:42:        conn.rollback()
+job_discovery/run.py:47:    """Execute one poll cycle.
+job_discovery/run.py:58:        locked = conn.execute(
+job_discovery/run.py:60:        ).fetchone()["locked"]
+job_discovery/run.py:74:        conn.commit()
+job_discovery/run.py:76:        conn.commit()  # No read transaction spans adapter HTTP.
+job_discovery/run.py:85:                postings = (ADAPTERS[ats](token, fetch_details=False)
+job_discovery/run.py:102:                                conn.commit()
+job_discovery/run.py:107:                            conn.commit()
+job_discovery/run.py:112:                            if conn.execute("SELECT 1 FROM jobs WHERE id=%s", (f"greenhouse:{token}:{external_id}",)).fetchone():
+job_discovery/run.py:115:                                conn.commit()
+job_discovery/run.py:116:                        conn.commit()
+job_discovery/run.py:131:                conn.commit()
+job_discovery/run.py:136:                    conn.rollback()
+job_discovery/run.py:138:                    log.exception("rollback failed for %s; attempting reconnect",
+job_discovery/run.py:159:                # write needs its own commit; isolate it so a hiccup here never
+job_discovery/run.py:163:                    conn.commit()
+job_discovery/run.py:170:                        conn.rollback()
+job_discovery/run.py:172:                        log.exception("rollback after failure-record error failed for %s",
+job_discovery/run.py:182:        conn.commit()
+job_discovery/run.py:198:            conn.commit()
+job_discovery/run.py:200:            conn.rollback()
+job_discovery/run.py:207:            conn.rollback()
+reviewer/llm.py:16:_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
+reviewer/llm.py:94:    NOT included: it is untrusted free text fetched verbatim from the company's own
+company_discovery/enrich_apply.py:1:"""Shared company-enrichment logic: the per-row board-fetch decision
+company_discovery/enrich_apply.py:14:# Board fetches share the poller's egress IP; keep concurrency small.
+company_discovery/enrich_apply.py:16:FETCH_BATCH_SIZE = 50
+company_discovery/enrich_apply.py:32:    """Pure per-row decision (DB-free; it does perform the board fetch): pick the
+company_discovery/enrich_apply.py:38:    httpx client via the enrichers; no DB handle is involved."""
+company_discovery/enrich_apply.py:40:        source, fetch, args = "ats_board", ENRICHERS[ats], (token,)
+company_discovery/enrich_apply.py:42:        source, fetch, args = "jd_probe", enrich_from_jd, (ats, token)
+company_discovery/enrich_apply.py:46:        display_name, about = fetch(*args)
+company_discovery/enrich_apply.py:60:        cur.execute(_UPDATE_SQL,
+company_discovery/enrich_apply.py:64:def fetch_batches(rows, fetch, *, max_workers=MAX_WORKERS):
+company_discovery/enrich_apply.py:65:    """Finish every HTTP future in a bounded batch before exposing DB work.
+company_discovery/enrich_apply.py:67:    Callers close their read/write transaction before iterating and commit each
+company_discovery/enrich_apply.py:69:    a failed fetch remains a None result so successful peers still persist.
+company_discovery/enrich_apply.py:71:    for start in range(0, len(rows), FETCH_BATCH_SIZE):
+company_discovery/enrich_apply.py:72:        batch = rows[start:start + FETCH_BATCH_SIZE]
+company_discovery/enrich_apply.py:74:            futures = {pool.submit(fetch, r["ats"], r["token"]): r for r in batch}
+company_discovery/enrich_apply.py:81:    """Fetch outside transactions, then persist up to 50 completed enrichments.
+company_discovery/enrich_apply.py:83:    Owns short batch commits, including closing the initial candidate read even
+company_discovery/enrich_apply.py:88:    conn.commit()
+company_discovery/enrich_apply.py:90:    for results in fetch_batches(pending, plan_enrichment, max_workers=max_workers):
+company_discovery/enrich_apply.py:97:            conn.commit()
+company_discovery/enrich_apply.py:99:            conn.rollback()
+company_discovery/db.py:31:        cur.execute(
+company_discovery/db.py:35:        return cur.fetchall()
+company_discovery/db.py:43:    deactivates it only after repeated board-fetch failures. Per-user preference is
+company_discovery/db.py:49:            cur.execute(
+company_discovery/db.py:62:        cur.execute(
+company_discovery/db.py:78:        return cur.fetchall()
+company_discovery/db.py:87:        cur.execute(_UPSERT_REVIEW_SQL, full)
+company_discovery/db.py:92:        cur.execute(
+company_discovery/db.py:113:        cur.execute(
+company_discovery/db.py:126:        return cur.fetchone()["n"]
+company_discovery/db.py:131:        cur.execute("INSERT INTO discovery_runs (started_at) VALUES (now()) RETURNING id")
+company_discovery/db.py:132:        return cur.fetchone()["id"]
+company_discovery/db.py:139:        cur.execute(
+company_discovery/db.py:154:        cur.execute(
+company_discovery/llm.py:14:_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
+company_discovery/llm.py:199:        """Release the underlying AsyncOpenAI client's pooled httpx sockets. The
+company_discovery/name_backfill.py:22:from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, fetch_board_name
+company_discovery/name_backfill.py:23:from company_discovery.enrich_apply import fetch_batches
+company_discovery/name_backfill.py:33:def fetch_name(ats: str, token: str) -> str | None:
+company_discovery/name_backfill.py:34:    """Name-only fetch for one company; never raises (returns None to skip, so a
+company_discovery/name_backfill.py:39:            return fetch_board_name(ats, token)
+company_discovery/name_backfill.py:43:        log.warning("name fetch %s/%s failed (%s: %s); skipping",
+company_discovery/name_backfill.py:55:            cur.execute(_SCOPE_SQL)
+company_discovery/name_backfill.py:56:            rows = cur.fetchall()
+company_discovery/name_backfill.py:59:        conn.commit()  # Close the selection read before HTTP starts.
+company_discovery/name_backfill.py:60:        for results in fetch_batches(rows, fetch_name):
+company_discovery/name_backfill.py:67:                        cur.execute(_UPDATE_SQL, (name, row["id"]))
+company_discovery/name_backfill.py:69:                conn.commit()
+company_discovery/name_backfill.py:71:                conn.rollback()
+company_discovery/run.py:89:    conn.commit()
+company_discovery/run.py:97:        conn.commit()  # Includes the no-enrichment branch before model work.
+company_discovery/run.py:123:        conn.commit()
+company_discovery/run.py:125:        conn.rollback()
+company_discovery/run.py:132:        conn.commit()
+company_discovery/run.py:154:        conn.commit()
+company_discovery/run.py:163:        conn.rollback()  # Close any early-return read before network tracing flush.
+job_discovery/http.py:5:import httpx
+job_discovery/http.py:13:# sleep before the last attempt; length == retries.
+job_discovery/http.py:18:# Avoids the per-call TCP handshake overhead of the previous httpx.get() calls.
+job_discovery/http.py:20:_client = httpx.Client(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True)
+job_discovery/http.py:23:def _sleep_backoff(attempt: int, backoff: float) -> None:
+job_discovery/http.py:25:    time.sleep(backoff * (2 ** attempt) + random.uniform(0, 0.25))
+job_discovery/http.py:37:    """Send an HTTP request with retry/back-off, using the shared client.
+job_discovery/http.py:52:        except httpx.HTTPStatusError as e:
+job_discovery/http.py:58:                time.sleep(delay + random.uniform(0, 0.25))
+job_discovery/http.py:63:                _sleep_backoff(attempt, backoff)  # 5xx: back off and retry
+job_discovery/http.py:64:        except (httpx.HTTPError, ValueError) as e:
+job_discovery/http.py:67:                _sleep_backoff(attempt, backoff)
+job_discovery/prune.py:35:FOR UPDATE OF j SKIP LOCKED
+job_discovery/prune.py:58:                cur.execute(_SELECT_CLOSED.replace("FOR UPDATE OF j SKIP LOCKED", ""), (days, min(batch, cap - done)))
+job_discovery/prune.py:59:                lock_jobs(conn, [row["id"] for row in cur.fetchall()])
+job_discovery/prune.py:60:                cur.execute(_SELECT_CLOSED, (days, min(batch, cap - done)))
+job_discovery/prune.py:61:                ids = [row["id"] for row in cur.fetchall()]
+job_discovery/prune.py:63:                    conn.commit()
+job_discovery/prune.py:65:                cur.execute(
+job_discovery/prune.py:66:                    "SELECT job_id FROM job_reviews WHERE job_id = ANY(%s) FOR UPDATE NOWAIT",
+job_discovery/prune.py:69:                # Separate statement: READ COMMITTED now sees any approvals that
+job_discovery/prune.py:70:                # committed between candidate selection and review lock acquisition.
+job_discovery/prune.py:71:                cur.execute(_DELETE_CLOSED, (days, ids))
+job_discovery/prune.py:73:            conn.commit()
+job_discovery/prune.py:75:            conn.rollback()
+job_discovery/prune.py:89:    never a deletion cutoff. Commit each bounded batch to limit transaction size.
+company_discovery/jobs_db.py:6:(dict_row) and never commits — the worker owns transaction boundaries so a chunk of
+company_discovery/jobs_db.py:42:    pending). FOR UPDATE SKIP LOCKED keeps concurrent workers from claiming the
+company_discovery/jobs_db.py:56:        cur.execute(
+company_discovery/jobs_db.py:62:                        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
+company_discovery/jobs_db.py:66:        return cur.fetchone()
+company_discovery/jobs_db.py:94:        cur.execute(
+company_discovery/jobs_db.py:113:        cur.execute(
+company_discovery/jobs_db.py:123:        cur.execute("SELECT status FROM classification_jobs WHERE id = %s", (job_id,))
+company_discovery/jobs_db.py:124:        row = cur.fetchone()
+company_discovery/jobs_db.py:147:        cur.execute(
+company_discovery/jobs_db.py:161:        return cur.fetchall()
+company_discovery/jobs_db.py:168:        cur.execute(
+company_discovery/jobs_db.py:192:        cur.execute(
+company_discovery/jobs_db.py:214:        cur.execute(
+job_discovery/prefs_backfill.py:39:        cur.execute("SELECT raw, canonicals FROM locations")
+job_discovery/prefs_backfill.py:40:        mapping = {r["raw"]: r["canonicals"] for r in cur.fetchall()}
+job_discovery/prefs_backfill.py:41:        cur.execute("SELECT user_id, preferred_locations FROM profiles")
+job_discovery/prefs_backfill.py:42:        profiles = cur.fetchall()
+job_discovery/prefs_backfill.py:49:            cur.execute("UPDATE profiles SET preferred_locations = %s WHERE user_id = %s",
+job_discovery/prefs_backfill.py:52:    conn.commit()
+job_discovery/location_llm.py:16:_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
+company_discovery/reclassify.py:67:            cur.execute("SELECT user_id, company_id, red_flags FROM company_reviews")
+company_discovery/reclassify.py:68:            rows = cur.fetchall()
+company_discovery/reclassify.py:75:                cur.execute(
+company_discovery/reclassify.py:81:        conn.commit()
+company_discovery/worker.py:2:classification_jobs row — the weekly tick below is LLM-free (dataset ingest + HTTP
+company_discovery/worker.py:3:enrichment). Mirrors reviewer/worker.py: claim -> process -> commit; belt-and-braces
+company_discovery/worker.py:4:per-job isolation; SIGTERM-aware sleep.
+company_discovery/worker.py:29:# which prevents all other successful results in the 25-company chunk from committing and
+company_discovery/worker.py:125:    transaction of its own beyond the per-chunk commits it issues; the caller committed
+company_discovery/worker.py:151:    # httpx.AsyncClient (via AsyncOpenAI); calling asyncio.run() per chunk would spin up
+company_discovery/worker.py:177:                conn.commit()
+company_discovery/worker.py:185:                conn.commit()
+company_discovery/worker.py:191:            conn.commit()  # Close status/target reads before HTTP/model/throttle.
+company_discovery/worker.py:202:                        snippets = serp.fetch_company_snippets(
+company_discovery/worker.py:206:                            conn.commit()
+company_discovery/worker.py:209:            enrich_selected(conn, targets)   # LLM-free board-metadata fetch
+company_discovery/worker.py:210:            conn.commit()  # Also close reads when no enrichment succeeded.
+company_discovery/worker.py:225:                    conn.commit()
+company_discovery/worker.py:254:            conn.commit()
+company_discovery/worker.py:288:        conn.commit()
+company_discovery/worker.py:290:        conn.rollback()  # Never close HTTP sockets with a failed/open DB transaction.
+company_discovery/worker.py:304:    are none), ingest the shipped company dataset AND HTTP-enrich a bounded batch of
+company_discovery/worker.py:308:    Enrichment is LLM-free (board display_name/about fetches) but essential: without it,
+company_discovery/worker.py:313:        cur.execute("SELECT max(started_at) AS last FROM discovery_runs")
+company_discovery/worker.py:314:        last = cur.fetchone()["last"]
+company_discovery/worker.py:315:    conn.commit()
+company_discovery/worker.py:320:    # HTTP enrichment (LLM-free): fetch board metadata for a bounded batch of the newest
+company_discovery/worker.py:321:    # un-enriched companies. Ingest is durable before the bounded HTTP batches.
+company_discovery/worker.py:323:        cur.execute(
+company_discovery/worker.py:328:        pending = cur.fetchall()
+company_discovery/worker.py:329:    conn.commit()
+company_discovery/worker.py:335:    conn.commit()
+company_discovery/worker.py:341:    False if the queue was empty (sleep). Per-job isolation: a job failure is recorded on
+company_discovery/worker.py:345:    # Weekly ingest tick — ISOLATED. A persistent tick failure (malformed committed
+company_discovery/worker.py:358:            conn.rollback()
+company_discovery/worker.py:371:    conn.commit()
+company_discovery/worker.py:373:    conn.commit()
+company_discovery/worker.py:383:            conn.rollback()
+company_discovery/worker.py:388:            conn.commit()
+company_discovery/worker.py:449:                # Idle: sleep in 1s slices so a SIGTERM (stop) is honored promptly.
+company_discovery/worker.py:453:                    time.sleep(1)
+job_discovery/locations.py:27:# ON CONFLICT DO NOTHING: a concurrent run (or rerun after a partial commit)
+job_discovery/locations.py:51:        cur.execute(_INSERT_SQL, (raw, [r.canonical for r in resolved],
+job_discovery/locations.py:59:        cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))
+job_discovery/locations.py:65:    rows = conn.execute("SELECT j.id FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals").fetchall()
+job_discovery/locations.py:68:        cur.execute(_STAMP_SQL)
+job_discovery/locations.py:84:    A single asyncio.run wraps this coroutine so the client's httpx pool stays
+job_discovery/locations.py:87:    `counts` only AFTER that batch's commit, so a mid-batch throw can't inflate
+job_discovery/locations.py:88:    the returned counts past what was actually committed. Blocking the loop on
+job_discovery/locations.py:89:    the sync conn.commit() between batches is fine in this cron context.
+job_discovery/locations.py:106:        conn.commit()
+job_discovery/locations.py:114:    Returns counts {'rule','llm','unmappable','stamped'}. Commits after the
+job_discovery/locations.py:122:        cur.execute(_NEW_RAWS_SQL)
+job_discovery/locations.py:123:        raws = [r["raw"] for r in cur.fetchall()]
+job_discovery/locations.py:133:    conn.commit()
+job_discovery/locations.py:141:            conn.rollback()
+job_discovery/locations.py:146:    conn.commit()
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard-attempt17.txt
new file mode 100644
index 0000000..c39a339
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard-attempt17.txt
@@ -0,0 +1,14 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run lib/jobLifecycle.db.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.db.test.ts (5 tests) 358ms
+
+ Test Files  1 passed (1)
+      Tests  5 passed (5)
+   Start at  07:34:25
+   Duration  642ms (transform 66ms, setup 0ms, import 97ms, tests 358ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard16.txt
new file mode 100644
index 0000000..bd7941f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard16.txt
@@ -0,0 +1,14 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run lib/jobLifecycle.db.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.db.test.ts (5 tests) 789ms
+
+ Test Files  1 passed (1)
+      Tests  5 passed (5)
+   Start at  07:39:20
+   Duration  1.26s (transform 71ms, setup 0ms, import 109ms, tests 789ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard17.txt
new file mode 100644
index 0000000..4c5e875
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-dashboard17.txt
@@ -0,0 +1,14 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run lib/jobLifecycle.db.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.db.test.ts (5 tests) 541ms
+
+ Test Files  1 passed (1)
+      Tests  5 passed (5)
+   Start at  07:39:19
+   Duration  1.07s (transform 122ms, setup 0ms, import 174ms, tests 541ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-eslint.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-eslint.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final16.txt
new file mode 100644
index 0000000..b60c2e2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final16.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 20%]
+........................................................................ [ 41%]
+........................................................................ [ 62%]
+........................................................................ [ 83%]
+........................................................                 [100%]
+344 passed in 188.54s (0:03:08)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final17.txt
new file mode 100644
index 0000000..c636c86
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-final17.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 20%]
+........................................................................ [ 41%]
+........................................................................ [ 62%]
+........................................................................ [ 83%]
+........................................................                 [100%]
+344 passed in 142.97s (0:02:22)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-attempt17.txt
new file mode 100644
index 0000000..907b838
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-attempt17.txt
@@ -0,0 +1,191 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.....................................F.FF...F....                        [100%]
+=================================== FAILURES ===================================
+___ test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06eab5280>
+
+    @requires_db
+    def test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner(conn):
+        seed(conn)
+        conn.commit()
+        claim = api('claims').claim_work(conn, 'payload', 'shared', 180)
+        ra = api('capacity').reserve_capacity(conn, claim, 16384)
+        rb = api('capacity').reserve_capacity(conn, claim, 16384)
+        api('capacity').bind_reservation(conn, ra, job_id='lever:x:0', scope='job_reviews', subject_id=A, invoking_role='authenticated')
+        conn.commit()
+        with pytest.raises(psycopg.Error, match='subject|owner'):
+            api('capacity').bind_reservation(conn, rb, job_id='lever:x:0', scope='job_reviews', subject_id=B, invoking_role='authenticated')
+        conn.rollback()
+        other = api('claims').claim_work(conn, 'payload', 'separate-b', 180)
+        separate = api('capacity').reserve_capacity(conn, other, 16384)
+        api('capacity').bind_reservation(conn, separate, job_id='lever:x:0', scope='job_reviews', subject_id=B, invoking_role='authenticated')
+        conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')", (B,))
+        conn.commit()
+        conn.execute('SELECT lifecycle_forget_subject(%s)', (A,))
+        conn.commit()
+        assert conn.execute('SELECT state FROM capacity_reservations WHERE id=%s', (separate.id,)).fetchone()['state'] == 'held'
+        assert conn.execute('SELECT count(*) n FROM job_reviews WHERE user_id=%s', (B,)).fetchone()['n'] == 1
+        assert conn.execute('SELECT count(*) n FROM jobs').fetchone()['n'] == 1
+        with pytest.raises(psycopg.Error, match='stale|fenced'):
+>           api('claims').validate_claim(conn, claim)
+
+tests/test_lifecycle_review_security.py:121:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06eab5280>
+claim = ClaimRef(owner_token='sWxbqEjHXd74em9AkVucijv2W45UbsjnF2TDT8nhcGo', generation=1, lease_until=datetime.datetime(2026, 10, 7, 7, 33, 37, 342767, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def validate_claim(conn, claim: ClaimRef) -> None:
+        enter_gate(conn)
+        row = conn.execute(
+            """SELECT kind FROM lifecycle_claims WHERE owner_token=%s AND generation=%s
+           AND generation>replay_floor AND state='active' AND lease_until>clock_timestamp()
+           AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() FOR UPDATE""",
+            (claim.owner_token, claim.generation),
+        ).fetchone()
+        if row is None:
+>           raise RuntimeError("stale, expired or fenced lifecycle claim")
+E           RuntimeError: stale, expired or fenced lifecycle claim
+
+job_discovery/lifecycle/claims.py:65: RuntimeError
+__ test_streaming_backfills_finish_network_batch_before_writes[name_backfill] __
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06e9913a0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fe06e991d30>
+module_name = 'name_backfill'
+
+    @requires_db
+    @pytest.mark.parametrize('module_name', ['name_backfill', 'enrich_backfill'])
+    def test_streaming_backfills_finish_network_batch_before_writes(conn, monkeypatch, module_name):
+        module = importlib.import_module('company_discovery.' + module_name)
+        companies(conn, 55)
+        class Borrowed:
+            def __getattr__(self, name): return getattr(conn, name)
+            def close(self): pass
+        monkeypatch.setattr('job_discovery.db.connect', lambda: Borrowed())
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            seen.append(token)
+            if token == 'c1': return None
+            return token if module_name == 'name_backfill' else enrich_apply.EnrichUpdate(token, 'about', 'ats_board')
+        monkeypatch.setattr(module, 'fetch_name' if module_name == 'name_backfill' else 'plan_enrichment', fetch)
+>       module.main()
+
+tests/test_lifecycle_company_boundaries.py:62:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/name_backfill.py:60: in main
+    for results in fetch_batches(rows, fetch_name):
+                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+company_discovery/enrich_apply.py:75: in fetch_batches
+    results = [(futures[f], f.result()) for f in as_completed(futures)]
+                            ^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:57: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06e9913a0>
+
+    def assert_network_boundary(conn):
+        assert conn.info.transaction_status == TransactionStatus.IDLE
+        with connect() as observer:
+>           assert observer.execute('SELECT pg_try_advisory_xact_lock(20916294442894917) AS free').fetchone()['free']
+E           assert False
+
+tests/test_lifecycle_company_boundaries.py:18: AssertionError
+_ test_streaming_backfills_finish_network_batch_before_writes[enrich_backfill] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06e991850>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fe06e9923f0>
+module_name = 'enrich_backfill'
+
+    @requires_db
+    @pytest.mark.parametrize('module_name', ['name_backfill', 'enrich_backfill'])
+    def test_streaming_backfills_finish_network_batch_before_writes(conn, monkeypatch, module_name):
+        module = importlib.import_module('company_discovery.' + module_name)
+        companies(conn, 55)
+        class Borrowed:
+            def __getattr__(self, name): return getattr(conn, name)
+            def close(self): pass
+        monkeypatch.setattr('job_discovery.db.connect', lambda: Borrowed())
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            seen.append(token)
+            if token == 'c1': return None
+            return token if module_name == 'name_backfill' else enrich_apply.EnrichUpdate(token, 'about', 'ats_board')
+        monkeypatch.setattr(module, 'fetch_name' if module_name == 'name_backfill' else 'plan_enrichment', fetch)
+>       module.main()
+
+tests/test_lifecycle_company_boundaries.py:62:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/enrich_backfill.py:70: in main
+    for results in fetch_batches(rows, plan_enrichment):
+                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+company_discovery/enrich_apply.py:75: in fetch_batches
+    results = [(futures[f], f.result()) for f in as_completed(futures)]
+                            ^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:57: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06e991850>
+
+    def assert_network_boundary(conn):
+        assert conn.info.transaction_status == TransactionStatus.IDLE
+        with connect() as observer:
+>           assert observer.execute('SELECT pg_try_advisory_xact_lock(20916294442894917) AS free').fetchone()['free']
+E           assert False
+
+tests/test_lifecycle_company_boundaries.py:18: AssertionError
+________ test_company_review_no_success_branch_closes_read_before_model ________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32911 user=postgres database=poller_lifecycle_test) at 0x7fe06e993770>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fe06e992150>
+
+    @requires_db
+    def test_company_review_no_success_branch_closes_read_before_model(conn, monkeypatch):
+        run = importlib.import_module('company_discovery.run')
+        companies(conn)
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            return None
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+        class Client:
+            model = 'offline'
+            async def review(self, **kw):
+                assert_network_boundary(conn)
+                seen.append(kw['token'])
+                from company_discovery.schemas import CompanyReviewResult
+                return CompanyReviewResult(verdict='unknown', confidence='high', reasoning='offline')
+        monkeypatch.setattr(run, 'CompanyReviewClient', lambda **kw: Client())
+        run._review_user(conn, {'user_id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'company_instructions': 'software'})
+>       assert len(seen) == 3
+E       assert 0 == 3
+E        +  where 0 = len([])
+
+tests/test_lifecycle_company_boundaries.py:129: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_review_security.py::test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner
+FAILED tests/test_lifecycle_company_boundaries.py::test_streaming_backfills_finish_network_batch_before_writes[name_backfill]
+FAILED tests/test_lifecycle_company_boundaries.py::test_streaming_backfills_finish_network_batch_before_writes[enrich_backfill]
+FAILED tests/test_lifecycle_company_boundaries.py::test_company_review_no_success_branch_closes_read_before_model
+4 failed, 45 passed in 20.20s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-expanded17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-expanded17.txt
new file mode 100644
index 0000000..785fe22
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-expanded17.txt
@@ -0,0 +1,55 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+............................................F........................... [ 57%]
+......................................................                   [100%]
+=================================== FAILURES ===================================
+___ test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed ____
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32914 user=postgres database=poller_lifecycle_test) at 0x7f886f85e240>
+
+    @requires_db
+    def test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed(conn):
+        seed(conn)
+        vid = version(conn)
+>       conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id,resume_json) VALUES (%s,'lever:x:0',%s,12345)", (A, vid))
+
+tests/test_lifecycle_review_security.py:181:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32914 user=postgres database=poller_lifecycle_test) at 0x7f886f85e240>
+query = "INSERT INTO application_packages(user_id,job_id,job_version_id,resume_json) VALUES (%s,'lever:x:0',%s,12345)"
+params = ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', UUID('ff492b2a-ed10-4b20-bff0-916a9cdcb73a'))
+prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.DatatypeMismatch: column "resume_json" is of type jsonb but expression is of type integer
+E           LINE 1: ...job_version_id,resume_json) VALUES ($1,'lever:x:0',$2,12345)
+E                                                                            ^
+E           HINT:  You will need to rewrite or cast the expression.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: DatatypeMismatch
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_review_security.py::test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed
+1 failed, 125 passed in 39.55s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-poll17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-poll17.txt
new file mode 100644
index 0000000..3bf91df
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green-poll17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..............................                                           [100%]
+30 passed in 11.17s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green2-17.txt
new file mode 100644
index 0000000..374b34c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green2-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 83%]
+..............                                                           [100%]
+86 passed in 44.21s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green3-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green3-17.txt
new file mode 100644
index 0000000..d240438
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-green3-17.txt
@@ -0,0 +1,94 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+............................................F.....................F..... [ 82%]
+...............                                                          [100%]
+=================================== FAILURES ===================================
+___ test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed ____
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32918 user=postgres database=poller_lifecycle_test) at 0x7f2aee46acf0>
+
+    @requires_db
+    def test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed(conn):
+        seed(conn)
+        vid = version(conn)
+        conn.execute(
+            "INSERT INTO application_packages(user_id,job_id,job_version_id,resume_json) VALUES (%s,'lever:x:0',%s,'12345'::jsonb)",
+            (A, vid),
+        )
+        claim = api("claims").claim_work(conn, "payload", "full", 180)
+        conn.commit()
+        allocated = conn.execute(
+            "SELECT pg_database_size(current_database()) n"
+        ).fetchone()["n"]
+        api("capacity").reserve_capacity(conn, claim, 6291456000 - allocated - 1024**2)
+        conn.commit()
+        conn.execute(
+            "UPDATE jobs SET description=(SELECT string_agg(md5(i::text),'') FROM generate_series(1,131072) i)"
+        )
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+            with pytest.raises(psycopg.Error, match="physical capacity"):
+                conn.execute(
+                    "UPDATE application_packages SET resume_json=repeat('9',100000)::jsonb"
+                )
+        with as_user(conn, A):
+>           conn.execute(
+                "UPDATE application_packages SET status='applied',resume_json=NULL"
+            )
+
+tests/test_lifecycle_review_security.py:309:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32918 user=postgres database=poller_lifecycle_test) at 0x7f2aee46acf0>
+query = "UPDATE application_packages SET status='applied',resume_json=NULL"
+params = None, prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.CheckViolation: new row for relation "application_packages" violates check constraint "applied_iff_timestamp"
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: CheckViolation
+____________ test_question_backlog_read_is_bounded_before_spooling _____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32918 user=postgres database=poller_lifecycle_test) at 0x7f2aee34d790>
+
+    @requires_db
+    def test_question_backlog_read_is_bounded_before_spooling(conn):
+        from job_discovery import db
+        from tests.test_lifecycle_safety import seed
+
+        seed(conn, count=3)
+        company = conn.execute("SELECT id FROM companies").fetchone()["id"]
+>       assert db.greenhouse_jobs_missing_questions(conn, company, limit=1) == ["0"]
+E       AssertionError: assert ['1'] == ['0']
+E
+E         At index 0 diff: '1' != '0'
+E         Use -v to get more diff
+
+tests/test_lifecycle_legacy_spool.py:155: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_review_security.py::test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed
+FAILED tests/test_lifecycle_legacy_spool.py::test_question_backlog_read_is_bounded_before_spooling
+2 failed, 85 passed in 42.50s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-post-install-inventory17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-post-install-inventory17.txt
new file mode 100644
index 0000000..d16c2e5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-post-install-inventory17.txt
@@ -0,0 +1,1168 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+foreign_keys [
+  {
+    "child": "application_packages",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "application_packages",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "capacity_reservations",
+    "parent": "lifecycle_claims",
+    "definition": "FOREIGN KEY (claim_kind, claim_id) REFERENCES lifecycle_claims(kind, work_id)"
+  },
+  {
+    "child": "company_brands",
+    "parent": "brands",
+    "definition": "FOREIGN KEY (brand_id) REFERENCES brands(id)"
+  },
+  {
+    "child": "company_brands",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (company_id) REFERENCES companies(id)"
+  },
+  {
+    "child": "company_overrides",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "company_reviews",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (company_id) REFERENCES companies(id)"
+  },
+  {
+    "child": "company_sources",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (company_id) REFERENCES companies(id)"
+  },
+  {
+    "child": "company_sources",
+    "parent": "source_accounts",
+    "definition": "FOREIGN KEY (source_account_id) REFERENCES source_accounts(id)"
+  },
+  {
+    "child": "cover_letter_edits",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "cover_letter_edits",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "enumeration_members",
+    "parent": "source_enumerations",
+    "definition": "FOREIGN KEY (enumeration_id) REFERENCES source_enumerations(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "generation_jobs",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "generation_jobs",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "identity_assertions",
+    "parent": "source_listings",
+    "definition": "FOREIGN KEY (left_listing_id) REFERENCES source_listings(id)"
+  },
+  {
+    "child": "identity_assertions",
+    "parent": "source_listings",
+    "definition": "FOREIGN KEY (right_listing_id) REFERENCES source_listings(id)"
+  },
+  {
+    "child": "invite_redemptions",
+    "parent": "invite_codes",
+    "definition": "FOREIGN KEY (code) REFERENCES invite_codes(code)"
+  },
+  {
+    "child": "job_locations",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id) REFERENCES job_versions(id)"
+  },
+  {
+    "child": "job_locations",
+    "parent": "locations",
+    "definition": "FOREIGN KEY (location_id) REFERENCES locations(raw)"
+  },
+  {
+    "child": "job_payload_demands",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id)"
+  },
+  {
+    "child": "job_payload_demands",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "job_questions",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "job_questions",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "job_reviews",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "job_reviews",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "jobs",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (company_id) REFERENCES companies(id)"
+  },
+  {
+    "child": "jobs",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (description_version_id, id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "job_skills",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id) REFERENCES job_versions(id)"
+  },
+  {
+    "child": "job_skills",
+    "parent": "skills",
+    "definition": "FOREIGN KEY (skill_id) REFERENCES skills(id)"
+  },
+  {
+    "child": "job_versions",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id)"
+  },
+  {
+    "child": "job_versions",
+    "parent": "source_listings",
+    "definition": "FOREIGN KEY (source_listing_id, job_id) REFERENCES source_listings(id, job_id)"
+  },
+  {
+    "child": "matching_activity",
+    "parent": "profiles",
+    "definition": "FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE"
+  },
+  {
+    "child": "reconciliation_checkpoints",
+    "parent": "source_enumerations",
+    "definition": "FOREIGN KEY (enumeration_id) REFERENCES source_enumerations(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "resume_scores",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "resume_scores",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "review_corrections",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "review_corrections",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (job_version_id, job_id) REFERENCES job_versions(id, job_id)"
+  },
+  {
+    "child": "source_accounts",
+    "parent": "companies",
+    "definition": "FOREIGN KEY (legacy_company_id) REFERENCES companies(id)"
+  },
+  {
+    "child": "source_enumerations",
+    "parent": "source_accounts",
+    "definition": "FOREIGN KEY (source_id) REFERENCES source_accounts(id)"
+  },
+  {
+    "child": "source_listings",
+    "parent": "jobs",
+    "definition": "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE"
+  },
+  {
+    "child": "source_listings",
+    "parent": "job_versions",
+    "definition": "FOREIGN KEY (current_version_id, id) REFERENCES job_versions(id, source_listing_id)"
+  },
+  {
+    "child": "source_listings",
+    "parent": "source_accounts",
+    "definition": "FOREIGN KEY (source_account_id) REFERENCES source_accounts(id)"
+  }
+]
+table_grants [
+  {
+    "table_name": "app_settings",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "app_settings",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "application_packages",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "application_packages",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "application_packages",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "application_packages",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "companies",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "companies",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "company_overrides",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "company_overrides",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "company_overrides",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "company_overrides",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "company_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "company_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "company_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "company_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "cover_letter_edits",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "cover_letter_edits",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "cover_letter_edits",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "cover_letter_edits",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "discovery_runs",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "discovery_state",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "feedback",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "generation_jobs",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "generation_jobs",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "generation_jobs",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "generation_jobs",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "invite_allowances",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_questions",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_questions",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_reviews",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "job_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "job_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_reviews",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "jobs",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "jobs",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "matching_activity",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "plan_overrides",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "poll_runs",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "profiles",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "profiles",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "resume_scores",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "resume_scores",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "resume_scores",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "resume_scores",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "review_corrections",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "review_corrections",
+    "grantee": "authenticated",
+    "privilege_type": "DELETE"
+  },
+  {
+    "table_name": "review_corrections",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "review_corrections",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "review_corrections",
+    "grantee": "authenticated",
+    "privilege_type": "UPDATE"
+  },
+  {
+    "table_name": "review_requests",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "review_requests",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "review_runs",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "subscriptions",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "tier_settings",
+    "grantee": "anon",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "tier_settings",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "usage_counters",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  }
+]
+column_grants [
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "claim_generation",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "claim_owner_token",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "created_at",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "description_snapshot",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "job_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "job_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "job_version_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "kind",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "kind",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "lease_until",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "protection_until",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "questions_snapshot",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "settled_at",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "snapshot_captured_at",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "status",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "user_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "job_payload_demands",
+    "column_name": "user_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "activation_generation",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "archive_ever_activated",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "archive_stage",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "export_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "feed_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "flags_version",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "hydration_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "identity_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "identity_migration_activated_at",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "maintenance_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "retirement_dry_run",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "retirement_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "safety_stage",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "singleton",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_control",
+    "column_name": "source_enabled",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "backend_pid",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "backend_pid",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "bytes",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "bytes",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "created_at",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "created_at",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "generation",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "generation",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "invoking_role",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "invoking_role",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "job_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "job_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "owner_token",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "owner_token",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "reservation_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "reservation_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "row_count",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "row_count",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "scope",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "scope",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "subject_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "subject_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "total_bytes",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "total_bytes",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "total_rows",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "total_rows",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "transaction_id",
+    "grantee": "authenticated",
+    "privilege_type": "INSERT"
+  },
+  {
+    "table_name": "lifecycle_write_checks",
+    "column_name": "transaction_id",
+    "grantee": "authenticated",
+    "privilege_type": "SELECT"
+  }
+]
+gates [
+  {
+    "relname": "account_deletions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON account_deletions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "application_packages",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON application_packages FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "brands",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON brands FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "capacity_reservations",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON capacity_reservations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "classification_jobs",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON classification_jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "companies",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON companies FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "company_brands",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON company_brands FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "company_overrides",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON company_overrides FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "company_reviews",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON company_reviews FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "company_sources",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON company_sources FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "cover_letter_edits",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON cover_letter_edits FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "enumeration_members",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON enumeration_members FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "feedback",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON feedback FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "generation_jobs",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON generation_jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "identity_assertions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON identity_assertions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "invite_allowances",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON invite_allowances FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "invite_codes",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON invite_codes FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "invite_redemptions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON invite_redemptions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_locations",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_locations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_payload_demands",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_payload_demands FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_questions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_questions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_reviews",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_reviews FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_skills",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_skills FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "job_versions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON job_versions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "jobs",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "lifecycle_claims",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON lifecycle_claims FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "lifecycle_control",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON lifecycle_control FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "lifecycle_write_checks",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON lifecycle_write_checks FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "locations",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON locations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "matching_activity",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON matching_activity FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "plan_overrides",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON plan_overrides FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "profiles",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON profiles FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "reconciliation_checkpoints",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON reconciliation_checkpoints FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "resume_scores",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON resume_scores FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "review_corrections",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON review_corrections FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "review_requests",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON review_requests FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "review_runs",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON review_runs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "skills",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON skills FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "source_accounts",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON source_accounts FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "source_enumerations",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON source_enumerations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "source_listings",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON source_listings FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "subscriptions",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON subscriptions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  },
+  {
+    "relname": "usage_counters",
+    "tgname": "lifecycle_pre_dml",
+    "definition": "CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON usage_counters FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()"
+  }
+]
+private_functions [
+  {
+    "name": "lifecycle_private.protect_demand_claim()",
+    "prosecdef": true,
+    "proconfig": [
+      "search_path=pg_catalog"
+    ],
+    "proacl": "{postgres=X/postgres}",
+    "owner": "postgres",
+    "definition": "CREATE OR REPLACE FUNCTION lifecycle_private.protect_demand_claim()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nBEGIN\n IF current_setting('role')='authenticated' AND OLD.user_id IS DISTINCT FROM public.app_user_id() THEN RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;\n -- Deleting an owner queue row cannot silently cancel/release a live service\n -- claim. The service must fence the claim first (account erasure does so).\n IF EXISTS(SELECT FROM public.lifecycle_claims WHERE kind='demand' AND work_id=OLD.id::text\n AND state='active' AND generation>replay_floor) THEN\n  RAISE EXCEPTION 'demand removal requires fenced service claim'; END IF;\n RETURN OLD;\nEND $function$\n"
+  },
+  {
+    "name": "lifecycle_private.validate_write()",
+    "prosecdef": true,
+    "proconfig": [
+      "search_path=pg_catalog"
+    ],
+    "proacl": "{postgres=X/postgres}",
+    "owner": "postgres",
+    "definition": "CREATE OR REPLACE FUNCTION lifecycle_private.validate_write()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nDECLARE c public.lifecycle_claims; r public.capacity_reservations; actor name;\nBEGIN\n -- PostgreSQL lets any caller consume a deferred constraint early. Only the\n -- actual top-level, standalone transaction boundary may run this AFTER check.\n -- current_query() is server-provided, not a GUC. Fail closed for comments,\n -- multi-statements, SET CONSTRAINTS, implicit/autocommit and PREPARE TRANSACTION.\n -- Supported writers explicitly finish with COMMIT/END [WORK|TRANSACTION].\n IF TG_WHEN='AFTER' AND COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN\n  RAISE EXCEPTION 'lifecycle receipts require standalone COMMIT or END validation';\n END IF;\n -- role is PostgreSQL's actual SET ROLE state, not a caller-supplied identity GUC.\n actor:=CASE WHEN current_setting('role')='none' THEN session_user ELSE current_setting('role') END;\n IF TG_WHEN='BEFORE' AND (NEW.invoking_role<>actor OR NEW.subject_id IS DISTINCT FROM public.app_user_id()\n OR NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id()) THEN\n  RAISE EXCEPTION 'invalid lifecycle invoking identity';\n END IF;\n IF NEW.bytes>0 AND pg_database_size(current_database())+(SELECT COALESCE(sum(bytes),0) FROM public.capacity_reservations WHERE state='held')>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;\n IF NEW.total_rows>500 THEN RAISE EXCEPTION 'lifecycle admission chunk exceeds 500 rows'; END IF;\n IF NEW.bytes>0 AND NEW.reservation_id IS NULL THEN RAISE EXCEPTION 'growth_without_reservation'; END IF;\n IF NEW.reservation_id IS NOT NULL THEN\n  SELECT * INTO r FROM public.capacity_reservations WHERE id=NEW.reservation_id;\n  IF NOT FOUND OR r.state NOT IN ('held','settled') OR r.backend_pid<>NEW.backend_pid OR r.transaction_id<>NEW.transaction_id\n   OR r.invoking_role<>NEW.invoking_role OR r.subject_id IS DISTINCT FROM NEW.subject_id\n   OR r.job_id IS DISTINCT FROM NEW.job_id OR r.scope IS DISTINCT FROM NEW.scope OR r.bytes<NEW.total_bytes\n   OR r.backend_pid IS NULL THEN RAISE EXCEPTION 'invalid capacity reservation owner, scope or budget'; END IF;\n  SELECT * INTO c FROM public.lifecycle_claims WHERE kind=r.claim_kind AND work_id=r.claim_id;\n  IF NOT FOUND OR c.owner_token<>r.owner_token OR c.generation<>r.generation THEN\n   RAISE EXCEPTION 'stale or fenced capacity claim'; END IF;\n ELSIF NEW.owner_token IS NOT NULL THEN\n  SELECT * INTO c FROM public.lifecycle_claims WHERE owner_token=NEW.owner_token AND generation=NEW.generation;\n  IF NOT FOUND OR c.invoking_role<>NEW.invoking_role OR c.subject_id IS DISTINCT FROM NEW.subject_id THEN\n   RAISE EXCEPTION 'stale or foreign lifecycle claim'; END IF;\n ELSE RETURN NEW;\n END IF;\n IF c.state<>'active' OR c.generation<=c.replay_floor OR c.lease_until<=clock_timestamp() THEN\n  RAISE EXCEPTION 'stale, expired or fenced lifecycle claim'; END IF;\n RETURN NEW;\nEND $function$\n"
+  }
+]
+control [
+  {
+    "singleton": true,
+    "flags_version": 1,
+    "safety_stage": "legacy",
+    "identity_enabled": false,
+    "source_enabled": false,
+    "maintenance_enabled": false,
+    "hydration_enabled": false,
+    "feed_enabled": false,
+    "retirement_enabled": false,
+    "retirement_dry_run": true,
+    "archive_ever_activated": false,
+    "archive_stage": "never_activated",
+    "export_enabled": false,
+    "activation_generation": 0,
+    "identity_migration_activated_at": null
+  }
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-backlog17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-backlog17.txt
new file mode 100644
index 0000000..f8ec5f2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-backlog17.txt
@@ -0,0 +1,21 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+____________ test_question_backlog_read_is_bounded_before_spooling _____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32917 user=postgres database=poller_lifecycle_test) at 0x7fd4ff369580>
+
+    @requires_db
+    def test_question_backlog_read_is_bounded_before_spooling(conn):
+        from job_discovery import db
+        from tests.test_lifecycle_safety import seed
+        seed(conn, count=3)
+        company = conn.execute('SELECT id FROM companies').fetchone()['id']
+>       assert db.greenhouse_jobs_missing_questions(conn, company, limit=1) == ['0']
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       TypeError: greenhouse_jobs_missing_questions() got an unexpected keyword argument 'limit'
+
+tests/test_lifecycle_legacy_spool.py:123: TypeError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_legacy_spool.py::test_question_backlog_read_is_bounded_before_spooling
+1 failed, 7 deselected in 0.42s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-callers17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-callers17.txt
new file mode 100644
index 0000000..5b0539c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-callers17.txt
@@ -0,0 +1,375 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFF....F                                                             [100%]
+=================================== FAILURES ===================================
+__________ test_enrichment_batches_never_overlap_network_and_database __________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261df73d70>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261df73c20>
+
+    @requires_db
+    def test_enrichment_batches_never_overlap_network_and_database(conn, monkeypatch):
+        rows = companies(conn, 55)
+        observed = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            observed.append(token)
+            return None if token == 'c1' else enrich_apply.EnrichUpdate(token, 'about', 'ats_board')
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+        # Start with the real candidate read transaction too.
+        conn.execute('SELECT 1')
+>       assert enrich_apply.enrich_selected(conn, rows, max_workers=1) == 54
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_company_boundaries.py:40:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/enrich_apply.py:87: in enrich_selected
+    plan = fut.result()  # plan_enrichment never raises (it skips instead)
+           ^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:34: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261df73d70>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261de30500>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261de30500> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261df73d70>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+__ test_streaming_backfills_finish_network_batch_before_writes[name_backfill] __
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33cb0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261de324b0>
+module_name = 'name_backfill'
+
+    @requires_db
+    @pytest.mark.parametrize('module_name', ['name_backfill', 'enrich_backfill'])
+    def test_streaming_backfills_finish_network_batch_before_writes(conn, monkeypatch, module_name):
+        module = importlib.import_module('company_discovery.' + module_name)
+        companies(conn, 55)
+        class Borrowed:
+            def __getattr__(self, name): return getattr(conn, name)
+            def close(self): pass
+        monkeypatch.setattr('job_discovery.db.connect', lambda: Borrowed())
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            seen.append(token)
+            if token == 'c1': return None
+            return token if module_name == 'name_backfill' else enrich_apply.EnrichUpdate(token, 'about', 'ats_board')
+        monkeypatch.setattr(module, 'fetch_name' if module_name == 'name_backfill' else 'plan_enrichment', fetch)
+>       module.main()
+
+tests/test_lifecycle_company_boundaries.py:62:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/name_backfill.py:69: in main
+    name = fut.result()  # fetch_name never raises
+           ^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:57: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33cb0>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261dea0f80>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261dea0f80> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33cb0>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+_ test_streaming_backfills_finish_network_batch_before_writes[enrich_backfill] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de69160>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261de68410>
+module_name = 'enrich_backfill'
+
+    @requires_db
+    @pytest.mark.parametrize('module_name', ['name_backfill', 'enrich_backfill'])
+    def test_streaming_backfills_finish_network_batch_before_writes(conn, monkeypatch, module_name):
+        module = importlib.import_module('company_discovery.' + module_name)
+        companies(conn, 55)
+        class Borrowed:
+            def __getattr__(self, name): return getattr(conn, name)
+            def close(self): pass
+        monkeypatch.setattr('job_discovery.db.connect', lambda: Borrowed())
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            seen.append(token)
+            if token == 'c1': return None
+            return token if module_name == 'name_backfill' else enrich_apply.EnrichUpdate(token, 'about', 'ats_board')
+        monkeypatch.setattr(module, 'fetch_name' if module_name == 'name_backfill' else 'plan_enrichment', fetch)
+>       module.main()
+
+tests/test_lifecycle_company_boundaries.py:62:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/enrich_backfill.py:80: in main
+    plan = fut.result()  # plan_enrichment never raises (it skips instead)
+           ^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:57: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de69160>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261de6a7e0>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261de6a7e0> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de69160>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+_________________ test_weekly_ingest_commits_before_enrichment _________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea2750>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261dea3cb0>
+
+    @requires_db
+    def test_weekly_ingest_commits_before_enrichment(conn, monkeypatch):
+        monkeypatch.setattr(worker.dataset, 'load_candidates', lambda _: [Candidate('New', 'lever', 'new')])
+        called = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            called.append(token)
+            return enrich_apply.EnrichUpdate('New', 'about', 'ats_board')
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+>       worker._maybe_ingest(conn)
+
+tests/test_lifecycle_company_boundaries.py:77:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/worker.py:327: in _maybe_ingest
+    enriched = enrich_selected(conn, pending)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+company_discovery/enrich_apply.py:87: in enrich_selected
+    plan = fut.result()  # plan_enrichment never raises (it skips instead)
+           ^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:73: in fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea2750>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261dea0ec0>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261dea0ec0> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea2750>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+_ test_classification_reads_serp_throttle_and_empty_enrichment_are_idle[False] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea0b00>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261dea19a0>
+serp_enabled = False
+
+    @requires_db
+    @pytest.mark.parametrize('serp_enabled', [False, True])
+    def test_classification_reads_serp_throttle_and_empty_enrichment_are_idle(conn, monkeypatch, serp_enabled):
+        companies(conn)
+        _new_job(conn, company_cap=3, use_serp=serp_enabled)
+        conn.commit()
+        job = jobs_db.claim_next_job(conn)
+        conn.commit()
+        seen = []
+        def enrichment(ats, token):
+            assert_network_boundary(conn)
+            seen.append('enrich')
+            return None
+        def serp_fetch(name, ats):
+            assert_network_boundary(conn)
+            seen.append('serp')
+            # Represents provider pacing as well as the HTTP request.
+            assert_network_boundary(conn)
+            return 'public snippets'
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', enrichment)
+        monkeypatch.setattr(worker.serp, 'serp_available', lambda: True)
+        monkeypatch.setattr(worker.serp, 'fetch_company_snippets', serp_fetch)
+        client = _StubClient(hook=lambda _: assert_network_boundary(conn))
+>       worker.process_job(conn, job, classify_client=client)
+
+tests/test_lifecycle_company_boundaries.py:105:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/worker.py:207: in process_job
+    enriched = enrich_selected(conn, targets)   # LLM-free board-metadata fetch
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+company_discovery/enrich_apply.py:87: in enrich_selected
+    plan = fut.result()  # plan_enrichment never raises (it skips instead)
+           ^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:449: in result
+    return self.__get_result()
+           ^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/_base.py:401: in __get_result
+    raise self._exception
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/concurrent/futures/thread.py:59: in run
+    result = self.fn(*self.args, **self.kwargs)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_company_boundaries.py:92: in enrichment
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea0b00>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261dea17c0>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261dea17c0> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea0b00>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+_ test_classification_reads_serp_throttle_and_empty_enrichment_are_idle[True] __
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33590>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261dea0a70>
+serp_enabled = True
+
+    @requires_db
+    @pytest.mark.parametrize('serp_enabled', [False, True])
+    def test_classification_reads_serp_throttle_and_empty_enrichment_are_idle(conn, monkeypatch, serp_enabled):
+        companies(conn)
+        _new_job(conn, company_cap=3, use_serp=serp_enabled)
+        conn.commit()
+        job = jobs_db.claim_next_job(conn)
+        conn.commit()
+        seen = []
+        def enrichment(ats, token):
+            assert_network_boundary(conn)
+            seen.append('enrich')
+            return None
+        def serp_fetch(name, ats):
+            assert_network_boundary(conn)
+            seen.append('serp')
+            # Represents provider pacing as well as the HTTP request.
+            assert_network_boundary(conn)
+            return 'public snippets'
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', enrichment)
+        monkeypatch.setattr(worker.serp, 'serp_available', lambda: True)
+        monkeypatch.setattr(worker.serp, 'fetch_company_snippets', serp_fetch)
+        client = _StubClient(hook=lambda _: assert_network_boundary(conn))
+>       worker.process_job(conn, job, classify_client=client)
+
+tests/test_lifecycle_company_boundaries.py:105:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+company_discovery/worker.py:201: in process_job
+    snippets = serp.fetch_company_snippets(
+tests/test_lifecycle_company_boundaries.py:96: in serp_fetch
+    assert_network_boundary(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33590>
+
+    def assert_network_boundary(conn):
+>       assert conn.info.transaction_status == TransactionStatus.IDLE
+E       assert <TransactionStatus.INTRANS: 2> == <TransactionStatus.IDLE: 0>
+E        +  where <TransactionStatus.INTRANS: 2> = <psycopg.ConnectionInfo object at 0x7f261de33ef0>.transaction_status
+E        +    where <psycopg.ConnectionInfo object at 0x7f261de33ef0> = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261de33590>.info
+E        +  and   <TransactionStatus.IDLE: 0> = TransactionStatus.IDLE
+
+tests/test_lifecycle_company_boundaries.py:16: AssertionError
+________ test_company_review_no_success_branch_closes_read_before_model ________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261dea2870>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261dea0680>
+
+    @requires_db
+    def test_company_review_no_success_branch_closes_read_before_model(conn, monkeypatch):
+        run = importlib.import_module('company_discovery.run')
+        companies(conn)
+        seen = []
+        def fetch(ats, token):
+            assert_network_boundary(conn)
+            return None
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+        class Client:
+            model = 'offline'
+            async def review(self, **kw):
+                assert_network_boundary(conn)
+                seen.append(kw['token'])
+                from company_discovery.schemas import CompanyReviewResult
+                return CompanyReviewResult(verdict='unknown', confidence='high', reasoning='offline')
+        monkeypatch.setattr(run, 'CompanyReviewClient', lambda **kw: Client())
+        run._review_user(conn, {'user_id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'company_instructions': 'software'})
+>       assert len(seen) == 3
+E       assert 0 == 3
+E        +  where 0 = len([])
+
+tests/test_lifecycle_company_boundaries.py:129: AssertionError
+______ test_poll_preserves_cached_questions_and_optional_backfill_timeout ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32908 user=postgres database=poller_lifecycle_test) at 0x7f261d571f70>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f261d505640>
+
+    @requires_db
+    def test_poll_preserves_cached_questions_and_optional_backfill_timeout(conn, monkeypatch):
+        from tests.conftest import TEST_DSN
+        run = importlib.import_module('job_discovery.run')
+        monkeypatch.setattr(run, 'load_targets', lambda: [{'name': 'Cached', 'ats': 'greenhouse', 'token': 'cached'}])
+        monkeypatch.setitem(run.ADAPTERS, 'greenhouse', lambda _: [Posting('1', 'Engineer', 'u'), Posting('2', 'Engineer', 'u')])
+        monkeypatch.setattr('job_discovery.locations.resolve_new_locations', lambda c: None)
+        monkeypatch.setattr('reviewer.run.review_all', lambda c: None)
+        calls = []
+        def http(url):
+            calls.append(url)
+            return {'questions': [{'label': 'Remote', 'required': False, 'fields': [{'name': 'q', 'type': 'input_text'}]}]}
+        monkeypatch.setattr(run, '_get_json', http)
+        assert run.run(TEST_DSN)['ok'] == 1
+        conn.execute("UPDATE job_questions SET questions='{}'::jsonb")
+        conn.commit()
+        calls.clear()
+        assert run.run(TEST_DSN)['ok'] == 1
+>       assert calls == []
+E       AssertionError: assert ['https://boa...estions=true'] == []
+E
+E         Left contains 2 more items, first extra item: 'https://boards-api.greenhouse.io/v1/boards/cached/jobs/1?questions=true'
+E         Use -v to get more diff
+
+tests/test_lifecycle_legacy_spool.py:101: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_company_boundaries.py::test_enrichment_batches_never_overlap_network_and_database
+FAILED tests/test_lifecycle_company_boundaries.py::test_streaming_backfills_finish_network_batch_before_writes[name_backfill]
+FAILED tests/test_lifecycle_company_boundaries.py::test_streaming_backfills_finish_network_batch_before_writes[enrich_backfill]
+FAILED tests/test_lifecycle_company_boundaries.py::test_weekly_ingest_commits_before_enrichment
+FAILED tests/test_lifecycle_company_boundaries.py::test_classification_reads_serp_throttle_and_empty_enrichment_are_idle[False]
+FAILED tests/test_lifecycle_company_boundaries.py::test_classification_reads_serp_throttle_and_empty_enrichment_are_idle[True]
+FAILED tests/test_lifecycle_company_boundaries.py::test_company_review_no_success_branch_closes_read_before_model
+FAILED tests/test_lifecycle_legacy_spool.py::test_poll_preserves_cached_questions_and_optional_backfill_timeout
+8 failed, 4 passed in 4.57s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-corrected17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-corrected17.txt
new file mode 100644
index 0000000..b2f1fd2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-corrected17.txt
@@ -0,0 +1,613 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFFFF...FFFFFFFFFF...............FFFFF                               [100%]
+=================================== FAILURES ===================================
+_ test_early_constraint_consumption_never_commits_expired_growth[before-authenticated] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f3494a1e540>
+role = 'authenticated', timing = 'before'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[before-review_inherited] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349297b830>
+role = 'review_inherited', timing = 'before'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[after-authenticated] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bca40>
+role = 'authenticated', timing = 'after'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[after-review_inherited] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349297b7d0>
+role = 'review_inherited', timing = 'after'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929732f0>
+command = 'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294e7b0>
+command = '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294dd30>
+command = 'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[/* receipt */ COMMIT] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294e720>
+command = '/* receipt */ COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[COMMIT; SELECT 1] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294d730>
+command = 'COMMIT; SELECT 1'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_every_package_json_representation_requires_capacity[large-number-resume_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bcce0>
+field = 'resume_json'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[large-number-cover_letter_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bd400>
+field = 'cover_letter_json'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[large-number-answers_snapshot] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929be780>
+field = 'answers_snapshot'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[large-number-greenhouse_questions] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bf800>
+field = 'greenhouse_questions'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[large-number-prefilled_answers] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929be150>
+field = 'prefilled_answers'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[boolean-resume_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929c3680>
+field = 'resume_json', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[boolean-cover_letter_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bf2f0>
+field = 'cover_letter_json', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[boolean-answers_snapshot] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bec90>
+field = 'answers_snapshot', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[boolean-greenhouse_questions] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bdee0>
+field = 'greenhouse_questions', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[boolean-prefilled_answers] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929bdca0>
+field = 'prefilled_answers', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'], ids=['large-number', 'boolean', 'string', 'object', 'array'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+___ test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294e5d0>
+
+    @requires_db
+    def test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner(conn):
+        seed(conn)
+        conn.commit()
+        claim = api('claims').claim_work(conn, 'payload', 'shared', 180)
+        ra = api('capacity').reserve_capacity(conn, claim, 16384)
+        rb = api('capacity').reserve_capacity(conn, claim, 16384)
+        api('capacity').bind_reservation(conn, ra, job_id='lever:x:0', scope='job_reviews', subject_id=A, invoking_role='authenticated')
+        conn.commit()
+>       with pytest.raises(psycopg.Error, match='subject|owner'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:107: Failed
+___________ test_service_writer_prelocks_all_sorted_job_keys[close] ____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f349294e270>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f349294f710>
+operation = 'close'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+        seed(conn, count=3)
+        company_id = conn.execute('SELECT id FROM companies').fetchone()['id']
+        if operation == 'reopen': conn.execute('UPDATE jobs SET closed_at=now()')
+        if operation == 'stamp':
+            conn.execute("UPDATE jobs SET location='raw'")
+            conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')")
+        if operation == 'floors':
+            conn.execute("UPDATE jobs SET title='Senior Engineer'")
+            conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs")
+        conn.commit()
+        recorded = RecordedConnection(conn)
+        db = importlib.import_module('job_discovery.db')
+        if operation == 'close': db.close_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'reopen': db.reopen_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'stamp': importlib.import_module('job_discovery.locations').stamp_jobs(recorded)
+        else:
+            monkeypatch.setattr(db, 'connect', lambda: recorded)
+            importlib.import_module('reviewer.backfill_floors').main()
+        writes = [i for i,(sql,_) in enumerate(recorded.statements) if sql.lstrip().upper().startswith('UPDATE')]
+        locks = [(i, params) for i,(sql,params) in enumerate(recorded.statements) if 'hashtextextended' in sql]
+        gates = [i for i,(sql,_) in enumerate(recorded.statements) if 'pg_advisory_xact_lock' in sql and 'hashtextextended' not in sql]
+>       assert writes and gates and locks, recorded.statements
+E       AssertionError: [('UPDATE jobs SET closed_at = now() WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)', (1, ['0', '1', '2']))]
+E       assert ([0] and [])
+
+tests/test_lifecycle_service_order.py:56: AssertionError
+___________ test_service_writer_prelocks_all_sorted_job_keys[reopen] ___________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f3492970500>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f349294f1d0>
+operation = 'reopen'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+        seed(conn, count=3)
+        company_id = conn.execute('SELECT id FROM companies').fetchone()['id']
+        if operation == 'reopen': conn.execute('UPDATE jobs SET closed_at=now()')
+        if operation == 'stamp':
+            conn.execute("UPDATE jobs SET location='raw'")
+            conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')")
+        if operation == 'floors':
+            conn.execute("UPDATE jobs SET title='Senior Engineer'")
+            conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs")
+        conn.commit()
+        recorded = RecordedConnection(conn)
+        db = importlib.import_module('job_discovery.db')
+        if operation == 'close': db.close_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'reopen': db.reopen_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'stamp': importlib.import_module('job_discovery.locations').stamp_jobs(recorded)
+        else:
+            monkeypatch.setattr(db, 'connect', lambda: recorded)
+            importlib.import_module('reviewer.backfill_floors').main()
+        writes = [i for i,(sql,_) in enumerate(recorded.statements) if sql.lstrip().upper().startswith('UPDATE')]
+        locks = [(i, params) for i,(sql,params) in enumerate(recorded.statements) if 'hashtextextended' in sql]
+        gates = [i for i,(sql,_) in enumerate(recorded.statements) if 'pg_advisory_xact_lock' in sql and 'hashtextextended' not in sql]
+>       assert writes and gates and locks, recorded.statements
+E       AssertionError: [('UPDATE jobs SET closed_at = NULL WHERE company_id = %s AND closed_at IS NOT NULL AND external_id = ANY(%s)', (1, ['0', '1', '2']))]
+E       assert ([0] and [])
+
+tests/test_lifecycle_service_order.py:56: AssertionError
+___________ test_service_writer_prelocks_all_sorted_job_keys[stamp] ____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f3492975160>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f3492975460>
+operation = 'stamp'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+        seed(conn, count=3)
+        company_id = conn.execute('SELECT id FROM companies').fetchone()['id']
+        if operation == 'reopen': conn.execute('UPDATE jobs SET closed_at=now()')
+        if operation == 'stamp':
+            conn.execute("UPDATE jobs SET location='raw'")
+            conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')")
+        if operation == 'floors':
+            conn.execute("UPDATE jobs SET title='Senior Engineer'")
+            conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs")
+        conn.commit()
+        recorded = RecordedConnection(conn)
+        db = importlib.import_module('job_discovery.db')
+        if operation == 'close': db.close_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'reopen': db.reopen_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'stamp': importlib.import_module('job_discovery.locations').stamp_jobs(recorded)
+        else:
+            monkeypatch.setattr(db, 'connect', lambda: recorded)
+            importlib.import_module('reviewer.backfill_floors').main()
+        writes = [i for i,(sql,_) in enumerate(recorded.statements) if sql.lstrip().upper().startswith('UPDATE')]
+        locks = [(i, params) for i,(sql,params) in enumerate(recorded.statements) if 'hashtextextended' in sql]
+        gates = [i for i,(sql,_) in enumerate(recorded.statements) if 'pg_advisory_xact_lock' in sql and 'hashtextextended' not in sql]
+>       assert writes and gates and locks, recorded.statements
+E       AssertionError: [('
+E             UPDATE jobs SET location_canonicals = l.canonicals
+E             FROM locations l
+E             WHERE jobs.location = l.raw
+E               AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
+E         ', None)]
+E       assert ([0] and [])
+
+tests/test_lifecycle_service_order.py:56: AssertionError
+___________ test_service_writer_prelocks_all_sorted_job_keys[floors] ___________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32910 user=postgres database=poller_lifecycle_test) at 0x7f34929c1040>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f34929c03b0>
+operation = 'floors'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+        seed(conn, count=3)
+        company_id = conn.execute('SELECT id FROM companies').fetchone()['id']
+        if operation == 'reopen': conn.execute('UPDATE jobs SET closed_at=now()')
+        if operation == 'stamp':
+            conn.execute("UPDATE jobs SET location='raw'")
+            conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')")
+        if operation == 'floors':
+            conn.execute("UPDATE jobs SET title='Senior Engineer'")
+            conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs")
+        conn.commit()
+        recorded = RecordedConnection(conn)
+        db = importlib.import_module('job_discovery.db')
+        if operation == 'close': db.close_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'reopen': db.reopen_jobs(recorded, company_id, {'2','0','1'})
+        elif operation == 'stamp': importlib.import_module('job_discovery.locations').stamp_jobs(recorded)
+        else:
+            monkeypatch.setattr(db, 'connect', lambda: recorded)
+            importlib.import_module('reviewer.backfill_floors').main()
+        writes = [i for i,(sql,_) in enumerate(recorded.statements) if sql.lstrip().upper().startswith('UPDATE')]
+        locks = [(i, params) for i,(sql,params) in enumerate(recorded.statements) if 'hashtextextended' in sql]
+        gates = [i for i,(sql,_) in enumerate(recorded.statements) if 'pg_advisory_xact_lock' in sql and 'hashtextextended' not in sql]
+>       assert writes and gates and locks, recorded.statements
+E       AssertionError: [("
+E             SELECT r.user_id, r.job_id, r.seniority, r.work_arrangement, j.title, j.remote
+E             FROM job_reviews r
+E             J...= %s WHERE user_id = %s AND job_id = %s', ('senior', None, UUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'lever:x:2'))]
+E       assert ([1, 2, 3] and [])
+
+tests/test_lifecycle_service_order.py:56: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[before-authenticated]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[before-review_inherited]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[after-authenticated]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[after-review_inherited]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[/* receipt */ COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[COMMIT; SELECT 1]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[large-number-resume_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[large-number-cover_letter_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[large-number-answers_snapshot]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[large-number-greenhouse_questions]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[large-number-prefilled_answers]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[boolean-resume_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[boolean-cover_letter_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[boolean-answers_snapshot]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[boolean-greenhouse_questions]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[boolean-prefilled_answers]
+FAILED tests/test_lifecycle_review_security.py::test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[close]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[reopen]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[stamp]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[floors]
+24 failed, 18 passed in 28.17s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-erasure-order17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-erasure-order17.txt
new file mode 100644
index 0000000..e1ccbf8
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-erasure-order17.txt
@@ -0,0 +1,24 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_______________ test_account_erasure_service_prelocks_owned_jobs _______________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32916 user=postgres database=poller_lifecycle_test) at 0x7f00ca76a330>
+
+    @requires_db
+    def test_account_erasure_service_prelocks_owned_jobs(conn):
+        from tests.test_lifecycle_safety import A, B, connect
+        seed(conn, count=3)
+        conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version) SELECT %s,id,'v' FROM jobs WHERE external_id IN ('0','2')", (A,))
+        conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version) VALUES (%s,'lever:x:1','v')", (B,))
+        conn.commit()
+        conn.execute('SELECT lifecycle_forget_subject(%s)', (A,))
+        with connect() as observer:
+            for suffix in ('0','2'):
+>               assert not observer.execute("SELECT pg_try_advisory_xact_lock(hashtextextended(%s,0)) locked", ('lifecycle:job:lever:x:' + suffix,)).fetchone()['locked']
+E               assert not True
+
+tests/test_lifecycle_service_order.py:72: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_service_order.py::test_account_erasure_service_prelocks_owned_jobs
+1 failed, 4 deselected in 0.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-order17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-order17.txt
new file mode 100644
index 0000000..df0a371
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-order17.txt
@@ -0,0 +1,61 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFF                                                                     [100%]
+=================================== FAILURES ===================================
+___________ test_service_writer_prelocks_all_sorted_job_keys[close] ____________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32909 user=postgres database=poller_lifecycle_test) at 0x7fb1b5147da0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb1b5147350>
+operation = 'close'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+>       seed(conn, n=3)
+E       TypeError: seed() got an unexpected keyword argument 'n'
+
+tests/test_lifecycle_service_order.py:35: TypeError
+___________ test_service_writer_prelocks_all_sorted_job_keys[reopen] ___________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32909 user=postgres database=poller_lifecycle_test) at 0x7fb1b516af00>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb1b5168140>
+operation = 'reopen'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+>       seed(conn, n=3)
+E       TypeError: seed() got an unexpected keyword argument 'n'
+
+tests/test_lifecycle_service_order.py:35: TypeError
+___________ test_service_writer_prelocks_all_sorted_job_keys[stamp] ____________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32909 user=postgres database=poller_lifecycle_test) at 0x7fb1b516b830>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb1b51686e0>
+operation = 'stamp'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+>       seed(conn, n=3)
+E       TypeError: seed() got an unexpected keyword argument 'n'
+
+tests/test_lifecycle_service_order.py:35: TypeError
+___________ test_service_writer_prelocks_all_sorted_job_keys[floors] ___________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32909 user=postgres database=poller_lifecycle_test) at 0x7fb1b516a9f0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb1b516a870>
+operation = 'floors'
+
+    @requires_db
+    @pytest.mark.parametrize('operation', ['close', 'reopen', 'stamp', 'floors'])
+    def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+>       seed(conn, n=3)
+E       TypeError: seed() got an unexpected keyword argument 'n'
+
+tests/test_lifecycle_service_order.py:35: TypeError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[close]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[reopen]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[stamp]
+FAILED tests/test_lifecycle_service_order.py::test_service_writer_prelocks_all_sorted_job_keys[floors]
+4 failed in 1.44s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-security17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-security17.txt
new file mode 100644
index 0000000..e917329
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-red-security17.txt
@@ -0,0 +1,483 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFFFF...FFFFFFFFFF...............F                                   [100%]
+=================================== FAILURES ===================================
+_ test_early_constraint_consumption_never_commits_expired_growth[before-authenticated] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf67b60>
+role = 'authenticated', timing = 'before'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[before-review_inherited] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6bd70>
+role = 'review_inherited', timing = 'before'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[after-authenticated] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6d280>
+role = 'authenticated', timing = 'after'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+        vid = owned_growth(conn, role)
+        error = None
+        try:
+            if timing == 'before':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            insert_review(conn, vid)
+            if timing == 'after':
+                conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
+            time.sleep(2.1)
+            conn.commit()
+        except psycopg.Error as exc:
+            error = exc
+            conn.rollback()
+>       assert error is not None, 'expired reserved owner write committed'
+E       AssertionError: expired reserved owner write committed
+E       assert None is not None
+
+tests/test_lifecycle_review_security.py:50: AssertionError
+_ test_early_constraint_consumption_never_commits_expired_growth[after-review_inherited] _
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6dbe0>
+role = 'review_inherited', timing = 'after'
+
+    @requires_db
+    @pytest.mark.parametrize('role', ['authenticated', 'review_inherited'])
+    @pytest.mark.parametrize('timing', ['before', 'after'])
+    def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+>       vid = owned_growth(conn, role)
+              ^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_review_security.py:37:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_review_security.py:16: in owned_growth
+    conn.execute('CREATE ROLE review_inherited NOLOGIN INHERIT')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6dbe0>
+query = 'CREATE ROLE review_inherited NOLOGIN INHERIT', params = None
+prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.DuplicateObject: role "review_inherited" already exists
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: DuplicateObject
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6e900>
+command = 'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6f860>
+command = '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8d3ead50>
+command = 'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[/* receipt */ COMMIT] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf405f0>
+command = '/* receipt */ COMMIT'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_commit_boundary_rejects_comments_and_multistatement_evasion[COMMIT; SELECT 1] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6c440>
+command = 'COMMIT; SELECT 1'
+
+    @requires_db
+    @pytest.mark.parametrize('command', [
+        'SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT',
+        '/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE',
+        'SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT',
+        '/* receipt */ COMMIT',
+        'COMMIT; SELECT 1',
+    ])
+    def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+        vid = owned_growth(conn)
+        insert_review(conn, vid)
+>       with pytest.raises(psycopg.Error, match='commit|COMMIT'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:69: Failed
+_ test_every_package_json_representation_requires_capacity[<100000-digit-number>-resume_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6fc50>
+field = 'resume_json'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[<100000-digit-number>-cover_letter_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6f920>
+field = 'cover_letter_json'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[<100000-digit-number>-answers_snapshot] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cf6c1a0>
+field = 'answers_snapshot'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[<100000-digit-number>-greenhouse_questions] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb1b20>
+field = 'greenhouse_questions'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[<100000-digit-number>-prefilled_answers] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb15b0>
+field = 'prefilled_answers'
+value = '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999...9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+__ test_every_package_json_representation_requires_capacity[true-resume_json] __
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb0bc0>
+field = 'resume_json', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[true-cover_letter_json] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb27b0>
+field = 'cover_letter_json', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[true-answers_snapshot] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb2840>
+field = 'answers_snapshot', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[true-greenhouse_questions] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb29c0>
+field = 'greenhouse_questions', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+_ test_every_package_json_representation_requires_capacity[true-prefilled_answers] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb1280>
+field = 'prefilled_answers', value = 'true'
+
+    @requires_db
+    @pytest.mark.parametrize('field', ['resume_json', 'cover_letter_json', 'answers_snapshot', 'greenhouse_questions', 'prefilled_answers'])
+    @pytest.mark.parametrize('value', ['9' * 100000, 'true', '"text"', '{"a":1}', '[1]'])
+    def test_every_package_json_representation_requires_capacity(conn, field, value):
+        seed(conn)
+        vid = version(conn)
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)", (A, vid))
+        conn.commit()
+        enforced(conn)
+        with as_user(conn, A):
+>           with pytest.raises(psycopg.Error, match='growth_without_reservation'):
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E           Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:94: Failed
+___ test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32907 user=postgres database=poller_lifecycle_test) at 0x7fdb8cfb0950>
+
+    @requires_db
+    def test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner(conn):
+        seed(conn)
+        conn.commit()
+        claim = api('claims').claim_work(conn, 'payload', 'shared', 180)
+        ra = api('capacity').reserve_capacity(conn, claim, 16384)
+        rb = api('capacity').reserve_capacity(conn, claim, 16384)
+        api('capacity').bind_reservation(conn, ra, job_id='lever:x:0', scope='job_reviews', subject_id=A, invoking_role='authenticated')
+        conn.commit()
+>       with pytest.raises(psycopg.Error, match='subject|owner'):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE Error
+
+tests/test_lifecycle_review_security.py:107: Failed
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[before-authenticated]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[before-review_inherited]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[after-authenticated]
+FAILED tests/test_lifecycle_review_security.py::test_early_constraint_consumption_never_commits_expired_growth[after-review_inherited]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[/* receipt */ COMMIT]
+FAILED tests/test_lifecycle_review_security.py::test_commit_boundary_rejects_comments_and_multistatement_evasion[COMMIT; SELECT 1]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[<100000-digit-number>-resume_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[<100000-digit-number>-cover_letter_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[<100000-digit-number>-answers_snapshot]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[<100000-digit-number>-greenhouse_questions]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[<100000-digit-number>-prefilled_answers]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[true-resume_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[true-cover_letter_json]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[true-answers_snapshot]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[true-greenhouse_questions]
+FAILED tests/test_lifecycle_review_security.py::test_every_package_json_representation_requires_capacity[true-prefilled_answers]
+FAILED tests/test_lifecycle_review_security.py::test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner
+20 failed, 18 passed in 19.93s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-typecheck.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-typecheck.txt
new file mode 100644
index 0000000..b030527
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix1-typecheck.txt
@@ -0,0 +1,9 @@
+
+> job-board-dashboard@0.1.0 typecheck
+> tsc --noEmit
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
index 33b5bb9..791c119 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
@@ -270,10 +270,191 @@ CLI-generated filename convention. Verification-before-completion guidance was
 used for fresh final checks. No author-selected reviewer or subagent was spawned.
 
 ## Remaining gates
 
 Independent controller reviews of complete BASE..HEAD are still required. Task 3
 provides contracts and tested fail-closed stages, not writer readiness or rollout
 authorization. Tasks 4–13 retain their specified cleanup, scheduling, source,
 hydration, feed, outbox/archive and final end-to-end rollout responsibilities.
 No new provider or user approval is needed to continue those authorized local tasks
 once both controller gates pass. Production enabling remains separately gated.
+
+## Fix round 1 — independent review corrections
+
+Fix BASE: `6538fc70a8dc5d49d3a0812f18542730c49c381b`. Both independent
+reviews rejected that implementation. The six unique findings (R1/S2, R2, R3,
+S1, S3, S4) are addressed together in this forward fix. The original evidence
+above describes the original commit, not this fix. Review reports and reviewer
+probe artifacts remain controller-owned and are excluded from the author commit.
+
+### S1 — unavoidable supported commit boundary
+
+A deferred constraint alone is insufficient: a caller can consume it with
+`SET CONSTRAINTS`. PostgreSQL documents both that early execution and that
+`current_query()` returns the complete client-submitted command, including
+multiple statements ([constraint timing](https://www.postgresql.org/docs/17/sql-set-constraints.html),
+[server query text](https://www.postgresql.org/docs/17/functions-info.html)).
+The private receipt validator now permits its AFTER invocation **only** when the
+server command is a standalone `COMMIT` or `END`, optionally `WORK` or
+`TRANSACTION`, whitespace and one trailing semicolon. It then validates the
+actual claim generation, reservation binding and DB-clock lease in that commit
+phase. This is server-derived command text, never an application GUC or caller
+promise. Its fixed `pg_catalog` search path prevents function shadowing.
+
+Changing constraint timing before or after a receipt now aborts rather than
+consuming the final check. Comments, multiple statements and commands containing
+fake COMMIT text fail closed. Implicit/autocommit receipt writes, prepared
+transactions, SQL procedure-managed boundaries and `COMMIT AND CHAIN` are outside
+this explicitly supported boundary and fail closed; they are not fallback paths
+that receive only statement-time validation. Existing psycopg explicit commits
+and postgres.js `begin`/commit use the supported boundary. Dashboard tests now
+prove an actual reserved authenticated write commits through postgres.js and an
+early constraint check rolls the entire attempted update back. Python tests cover
+both authenticated and inherited roles, early timing before/after, real natural
+expiry and zero persisted owner writes after rejection. No grants were widened.
+
+### S3/S4 — complete JSON accounting and one capacity subject per generation
+
+The row validator consults the table's declared JSON/JSONB column types. Changed
+numeric and boolean scalars now consume the same conservative allocation budget
+as strings, objects and arrays. Small SQL scalar metadata remains distinct from
+JSON payload. SQL/JSON null and empty default collections retain the existing
+no-payload protection exception; clearing payload earns no DELETE credit.
+Tests include 100,000-digit numeric payloads across all package JSON fields,
+all JSON fields on reviews/corrections/scores, object/array/string/boolean cases,
+cumulative repeated numeric replacements, whole-transaction rollback on exhausted
+forecasts, and a real physical-allocation-plus-held-reservation over-budget case.
+That case still permits metadata-only protection and payload removal while
+refusing positive numeric payload growth. Legacy JSON values remain accepted.
+
+A claim generation now records whether its capacity subject has been fixed and
+which subject that is. The first bound reservation fixes it, including public
+NULL; a different subject cannot bind another reservation in that generation.
+The invoker reservation-integrity trigger enforces this for SQL as well as the
+Python binding API, under the global gate. Changing an established subject
+requires fencing the generation. Claim reassignment resets the marker only with
+its existing generation/replay transition. Account erasure fences the target's
+claim and clears both subject fields; tests reject shared A/B binding, reject
+NULL/A mixing, permit a newly fenced generation to bind, reject A's stale
+callback, and preserve B's independently held capability, private history and
+the shared Job.
+
+### R1/S2/R2 — network boundaries and compatible optional backfill
+
+The company caller inventory now includes `enrich_apply`, `run`, `worker`, both
+HTTP backfills, their DB/queue helpers, SERP, reclassify, plus Job location/prefs
+backfills and reviewer entry points. `fetch_batches` finishes every future in a
+maximum **50-company** batch before exposing results for writes; at most 5 HTTP
+workers run, and all are finished before that batch's database transaction.
+Successful results commit together; a database failure rolls back its current
+batch and leaves earlier batches durable. Candidate dictionaries are patched
+only after commit. Skipped/dead boards remain unstamped and retryable. These
+bounds apply to fetched results/futures; the pre-existing selected metadata list
+is not claimed to have a new total byte bound.
+
+Both one-time backfills use that same batch boundary. Weekly ingest commits
+before enrichment. Classification commits target/status reads before SERP,
+commits each persisted SERP result before the next request/throttle, and closes
+reads even when no enrichment succeeds. Model-client cleanup and discovery
+tracing flush run after ending any open transaction. Existing classification
+progress, cancellation, out-of-credits, retry and partial-result tests remain in
+the final covering lane. Offline callbacks inspect actual IDLE connection state
+and an independent backend's gate acquisition; SERP tests exercise the real
+adapter's throttle and HTTP boundary with local replacements for sleep/post.
+Concurrent probe callbacks serialize only their observer lock attempts, avoiding
+test observers falsely reporting each other's temporary gate locks.
+
+Greenhouse question work is once again the missing-only backlog plus admissible
+feed postings that lack a cached row. Cached questions and timestamps are not
+replaced, including a cache inserted between fetch and persistence (`DO NOTHING`
+on conflict). Invalid-title/URL feed rows are not added to optional new-ID work.
+The backlog SELECT is bounded to **100,001 IDs**, the feed contributes at most
+100,000 IDs, and at most **100,000 question fetches / 64 MiB encoded results** are
+processed. The cooperative **120-second** deadline remains checked between
+fetches; it does not preempt a blocked upstream request. Question row/byte/time
+exhaustion stops optional work and leaves the remainder retryable. It does not
+turn a complete healthy source enumeration into a board failure or prevent
+ordinary closure handling. Source-feed partial/failure/overflow still fails
+closed before admission/closure. Real repeated `run()` tests preserve cached
+payloads and prove all three optional budgets leave the poll healthy.
+
+### R3 — complete affected service lock order
+
+The explicit service sequence is gate, read IDs, sorted Job keys, then row/FK
+work. It now covers close/reopen helpers, location stamping (also used by the
+location backfill), review-floor backfill and question persistence, in addition
+to the prior upsert/mapper/prune/reviewer batch integrations. Account erasure's
+existing service-only INVOKER function now selects the union of its owner's
+seven private Job tables and reservation Job references and acquires keys in
+`COLLATE "C"` order before claim or child-row mutations. Another user's
+unrelated Job key is not acquired. Account-root gates and invoker RLS remain
+unchanged. Tests record actual service SQL order and use another backend to
+prove erasure holds precisely the relevant Job keys.
+
+Inventory disposition: company-only review/classification/reclassify and profile
+preference backfill have no Job row/FK mutations; their BEFORE STATEMENT gate
+covers the relevant table and the repaired orchestration contains no network
+wait inside a transaction. Queue claims are a single gated UPDATE whose subquery
+row lock follows its BEFORE STATEMENT trigger. Existing authenticated dashboard
+multi-row DML retains the approved statement-trigger allowance; privileged
+account erasure now prelocks explicitly. No known service Job writer from the
+expanded source inventory is deferred to Task 13. Enforced writer/readiness
+rollout remains unavailable; these changes do not certify future writer cutover.
+
+### Fix-round evidence and verification
+
+`fix1-red-security17.txt` records 20 failures / 18 passes (the inherited-role
+fixture initially also needed repeat-safe setup); its 100,000-digit repetitive
+value is shortened to `<100000-digit-number>` in the stored log, with all
+results preserved. The corrected combined RED log `fix1-red-corrected17.txt`
+records **24 failures / 18 passes**, reproducing S1/S3/S4 and all four Python
+service-order omissions. `fix1-red-callers17.txt` records **8 failures / 4 passes**
+for company/poll boundaries. `fix1-red-order17.txt` retains the initial incorrect
+seed-argument fixture attempt. Additional RED logs reproduce missing erasure
+Job locks and the unbounded backlog API before those changes.
+
+`fix1-green-attempt17.txt` records 45 passes / 4 failures: the stale callback
+correctly raised the Python API's RuntimeError, simultaneous test observers
+contended with each other, and the review fixture accidentally selected seed
+companies (which that existing query excludes). Those test defects were corrected.
+`fix1-green2-17.txt` then passed **86**, zero skips. `fix1-green-poll17.txt`
+passed **30**, zero skips. `fix1-green-expanded17.txt` passed **125** with one
+invalid integer-to-JSONB fixture insert; `fix1-green3-17.txt` passed **85** with two
+fixture errors (applied status needed its timestamp, and seeded Job 0 already
+had questions). These are preserved, corrected, and rechecked in the final lane.
+
+
+Final source state (no source edits after these runs began):
+- `fix1-final17.txt`: **344 passed, zero skipped**, actual PostgreSQL **17.11
+  (Debian 17.11-1.pgdg13+2)**, **142.97 seconds**.
+- `fix1-final16.txt`: **344 passed, zero skipped**, actual PostgreSQL **16.15
+  (Debian 16.15-1.pgdg13+2)**, **188.54 seconds**.
+- `fix1-dashboard17.txt` / `fix1-dashboard16.txt`: **5 passed each**, zero
+  skipped, on the same actual majors. Test durations 541ms / 789ms.
+- `fix1-typecheck.txt`, `fix1-eslint.txt`, `fix1-ruff.txt`: TypeScript,
+  changed dashboard test ESLint, and repository Ruff passed. ESLint is silent
+  on success. Whitespace checks and schema/migration suffix equality pass.
+- `fix1-post-install-inventory17.txt` is the refreshed actual final catalog;
+  `fix1-caller-inventory.txt` is refreshed from the final affected source.
+  The original 65 dashboard unit passes remain evidence for the original
+  unchanged dashboard runtime modules; they were not unnecessarily rerun here.
+
+Exact final covering commands, from the same owned worktree, bash/login:false:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_review_security.py tests/test_lifecycle_company_boundaries.py tests/test_lifecycle_service_order.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py tests/test_company_enrich.py tests/test_name_backfill.py tests/test_classification_worker.py tests/test_company_discovery_run.py tests/test_company_discovery_db.py tests/test_classification_jobs_db.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_job_questions.py tests/test_db_jobs.py tests/test_locations_resolution.py tests/test_reviewer_floors.py tests/test_prune.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_review_security.py tests/test_lifecycle_company_boundaries.py tests/test_lifecycle_service_order.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py tests/test_company_enrich.py tests/test_name_backfill.py tests/test_classification_worker.py tests/test_company_discovery_run.py tests/test_company_discovery_db.py tests/test_classification_jobs_db.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_job_questions.py tests/test_db_jobs.py tests/test_locations_resolution.py tests/test_reviewer_floors.py tests/test_prune.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- npm --prefix dashboard test -- lib/jobLifecycle.db.test.ts
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- npm --prefix dashboard test -- lib/jobLifecycle.db.test.ts
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/inventory_probe.py
+npm --prefix dashboard run typecheck
+(cd dashboard && ./node_modules/.bin/eslint lib/jobLifecycle.db.test.ts)
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+```
+
+This completes author Fix Round 1 only. Both independent re-review gates of the
+original scope plus the full forward fix remain pending. Task 4, Library 03
+acceptance and production activation are not claimed. All database execution
+used disposable owned harnesses, random loopback ports and local synthetic
+HTTP/model/throttle callbacks; no production/provider/paid calls occurred.
diff --git a/company_discovery/enrich_apply.py b/company_discovery/enrich_apply.py
index 44e0fe3..df734c9 100644
--- a/company_discovery/enrich_apply.py
+++ b/company_discovery/enrich_apply.py
@@ -6,20 +6,21 @@ backfill and the cron ground companies through byte-identical logic."""
 import logging
 from concurrent.futures import ThreadPoolExecutor, as_completed
 from typing import NamedTuple
 
 from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd
 
 log = logging.getLogger("company_discovery.enrich")
 
 # Board fetches share the poller's egress IP; keep concurrency small.
 MAX_WORKERS = 5
+FETCH_BATCH_SIZE = 50
 
 
 class EnrichUpdate(NamedTuple):
     display_name: str | None
     about: str | None
     about_source: str
 
 
 _UPDATE_SQL = (
     "UPDATE companies SET display_name = COALESCE(%s, display_name), about = %s, "
@@ -53,46 +54,53 @@ def plan_enrichment(ats: str, token: str) -> EnrichUpdate | None:
 
 
 def apply_enrichment(conn, company_id, plan: EnrichUpdate) -> None:
     """Persist one enrichment. Main-thread only — one psycopg connection must not
     be shared across threads."""
     with conn.cursor() as cur:
         cur.execute(_UPDATE_SQL,
                     (plan.display_name, plan.about, plan.about_source, company_id))
 
 
+def fetch_batches(rows, fetch, *, max_workers=MAX_WORKERS):
+    """Finish every HTTP future in a bounded batch before exposing DB work.
+
+    Callers close their read/write transaction before iterating and commit each
+    returned batch before requesting another. At most 50 results/futures exist;
+    a failed fetch remains a None result so successful peers still persist.
+    """
+    for start in range(0, len(rows), FETCH_BATCH_SIZE):
+        batch = rows[start:start + FETCH_BATCH_SIZE]
+        with ThreadPoolExecutor(max_workers=max_workers) as pool:
+            futures = {pool.submit(fetch, r["ats"], r["token"]): r for r in batch}
+            results = [(futures[f], f.result()) for f in as_completed(futures)]
+        yield results
+
+
 def enrich_selected(conn, candidates: list[dict], *,
                     max_workers: int = MAX_WORKERS) -> int:
-    """Ground every selected company still lacking enrichment (enriched_at IS NULL):
-    fetch board metadata, persist it, and patch the in-memory candidate dict
-    (display_name/about) so THIS run's review sees the grounding without a re-query.
-    Returns the number of companies enriched.
-
-    Dead boards / unsupported ATSes skip silently (plan_enrichment never raises): that
-    company is reviewed ungrounded this run and its enriched_at stays NULL, so it is
-    retried only when it next becomes stale (a company reviewed under the current
-    profile version is not re-selected — there is no per-run re-probe storm).
-
-    Board fetches (HTTP) run in a small thread pool — they share the poller's egress
-    IP, so max_workers stays small. DB writes stay on the calling thread; one psycopg
-    connection must not be shared across threads. Does not commit — the caller owns
-    the transaction."""
+    """Fetch outside transactions, then persist up to 50 completed enrichments.
+
+    Owns short batch commits, including closing the initial candidate read even
+    when nothing needs enrichment. Failed boards remain unstamped and retryable.
+    A DB failure rolls back only the current batch; earlier batches are durable.
+    """
     pending = [c for c in candidates if c.get("enriched_at") is None]
-    if not pending:
-        return 0
+    conn.commit()
     enriched = 0
-    with ThreadPoolExecutor(max_workers=max_workers) as pool:
-        futures = {pool.submit(plan_enrichment, c["ats"], c["token"]): c for c in pending}
-        for fut in as_completed(futures):
-            c = futures[fut]
-            plan = fut.result()  # plan_enrichment never raises (it skips instead)
-            if plan is None:
-                continue
-            apply_enrichment(conn, c["id"], plan)
-            # Mirror the UPDATE's COALESCE: display_name is only overwritten when the
-            # enricher returned one (a None name -> keep prior); about is always
-            # set to the fetched value.
+    for results in fetch_batches(pending, plan_enrichment, max_workers=max_workers):
+        updated = []
+        try:
+            for c, plan in results:
+                if plan is not None:
+                    apply_enrichment(conn, c["id"], plan)
+                    updated.append((c, plan))
+            conn.commit()
+        except BaseException:
+            conn.rollback()
+            raise
+        for c, plan in updated:
             if plan.display_name is not None:
                 c["display_name"] = plan.display_name
             c["about"] = plan.about
-            enriched += 1
+        enriched += len(updated)
     return enriched
diff --git a/company_discovery/enrich_backfill.py b/company_discovery/enrich_backfill.py
index dd8b7eb..1e35999 100644
--- a/company_discovery/enrich_backfill.py
+++ b/company_discovery/enrich_backfill.py
@@ -18,29 +18,25 @@ display_name — a display_name guard would re-probe and re-stamp it forever
 enriched_at stays NULL and it is correctly retried.
 
 The per-row decision (plan_enrichment) and persistence (apply_enrichment) live in
 company_discovery/enrich_apply.py, shared verbatim with the standing cron stage
 (enrich_selected) so both ground companies through byte-identical logic.
 
 ROLLOUT ARTIFACT — must NOT be run against the production DB during feature
 development; the operator runs it at rollout.
 """
 import logging
-from concurrent.futures import ThreadPoolExecutor, as_completed
 
-from company_discovery.enrich_apply import MAX_WORKERS, apply_enrichment, plan_enrichment
+from company_discovery.enrich_apply import apply_enrichment, fetch_batches, plan_enrichment
 
 log = logging.getLogger("enrich_backfill")
 
-# Commit cadence (rows written) so a long run is durable and resumable.
-_COMMIT_EVERY = 50
-
 # UNKNOWNS-ONLY: a company qualifies if ANY user's effective verdict is 'unknown',
 # or it has no review at all (COALESCE default 'unknown'). Currently-active/included
 # companies are deliberately NOT re-evaluated — enriching + re-screening them could
 # churn the active set, so we only rescue the unclassified. DISTINCT collapses the
 # per-review fan-out. Mirrors the effective-verdict COALESCE pattern in
 # company_discovery/db.reconcile_active (here defaulting to 'unknown' instead of
 # 'exclude'). enriched_at IS NULL makes it resumable/idempotent — an about-only /
 # JD-probe success (which leaves display_name NULL) still gets an enriched_at stamp,
 # so it is not re-selected and re-screened on a later run.
 _SCOPE_SQL = """
@@ -63,33 +59,32 @@ def select_to_enrich(conn) -> list[dict]:
 def main() -> None:
     logging.basicConfig(level=logging.INFO,
                         format="%(asctime)s %(levelname)s %(name)s %(message)s")
     from job_discovery import db as job_discovery_db  # shared connection factory
     conn = job_discovery_db.connect()
     try:
         rows = select_to_enrich(conn)
         log.info("enrichment scope: %s companies (enriched_at IS NULL, effective verdict unknown)",
                  len(rows))
         updated = 0
-        # Board fetches (HTTP) run concurrently across a small thread pool; the DB
-        # writes stay on the main thread — one psycopg connection must not be shared
-        # across threads.
-        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
-            futures = {pool.submit(plan_enrichment, r["ats"], r["token"]): r for r in rows}
-            for fut in as_completed(futures):
-                row = futures[fut]
-                plan = fut.result()  # plan_enrichment never raises (it skips instead)
-                if plan is None:
-                    continue
-                apply_enrichment(conn, row["id"], plan)
-                updated += 1
-                if updated % _COMMIT_EVERY == 0:
-                    conn.commit()
-                    log.info("enriched %s companies so far", updated)
         conn.commit()
+        for results in fetch_batches(rows, plan_enrichment):
+            batch_updated = 0
+            try:
+                for row, plan in results:
+                    if plan is None:
+                        continue
+                    apply_enrichment(conn, row["id"], plan)
+                    batch_updated += 1
+                conn.commit()
+            except BaseException:
+                conn.rollback()
+                raise
+            updated += batch_updated
+            log.info("enriched %s companies so far", updated)
         log.info("enrichment complete: updated %s of %s companies", updated, len(rows))
     finally:
         conn.close()
 
 
 if __name__ == "__main__":
     main()
diff --git a/company_discovery/name_backfill.py b/company_discovery/name_backfill.py
index bc19c4d..0b35a15 100644
--- a/company_discovery/name_backfill.py
+++ b/company_discovery/name_backfill.py
@@ -11,30 +11,26 @@ when they are next selected for review.
 Writes display_name ONLY — never about / about_source / enriched_at. Stamping
 enriched_at here would re-queue every already-reviewed company for an LLM
 re-screen (select_for_review re-selects on enriched_at > reviewed_at): cost and
 verdict churn this backfill must not cause. The display_name IS NULL guard (in
 both the scope query and the UPDATE) makes reruns idempotent; a dead board
 writes nothing, so a rerun retries it.
 
 ROLLOUT ARTIFACT — the operator runs it once at rollout; safe to rerun.
 """
 import logging
-from concurrent.futures import ThreadPoolExecutor, as_completed
 
 from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, fetch_board_name
-from company_discovery.enrich_apply import MAX_WORKERS
+from company_discovery.enrich_apply import fetch_batches
 
 log = logging.getLogger("name_backfill")
 
-# Commit cadence (rows written) so a long run is durable and resumable.
-_COMMIT_EVERY = 50
-
 _SCOPE_SQL = ("SELECT id, ats, token FROM companies "
               "WHERE active AND display_name IS NULL")
 _UPDATE_SQL = ("UPDATE companies SET display_name = %s "
                "WHERE id = %s AND display_name IS NULL")
 
 
 def fetch_name(ats: str, token: str) -> str | None:
     """Name-only fetch for one company; never raises (returns None to skip, so a
     rerun retries). lever/ashby read the board page <title>; the JSON-API ATSes
     reuse the existing enrichers and keep only the name half."""
@@ -53,35 +49,33 @@ def main() -> None:
     logging.basicConfig(level=logging.INFO,
                         format="%(asctime)s %(levelname)s %(name)s %(message)s")
     from job_discovery import db as job_discovery_db  # shared connection factory
     conn = job_discovery_db.connect()
     try:
         with conn.cursor() as cur:
             cur.execute(_SCOPE_SQL)
             rows = cur.fetchall()
         log.info("backfill scope: %s active companies without display_name", len(rows))
         updated = 0
-        # HTTP fetches run across a small thread pool (shared egress IP — keep it
-        # small); DB writes stay on the main thread — one psycopg connection must
-        # not be shared across threads.
-        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
-            futures = {pool.submit(fetch_name, r["ats"], r["token"]): r for r in rows}
-            for fut in as_completed(futures):
-                name = fut.result()  # fetch_name never raises
-                if name is None:
-                    continue
-                with conn.cursor() as cur:
-                    cur.execute(_UPDATE_SQL, (name, futures[fut]["id"]))
-                    if cur.rowcount == 0:  # lost the race to the cron / a rerun — already named
+        conn.commit()  # Close the selection read before HTTP starts.
+        for results in fetch_batches(rows, fetch_name):
+            batch_updated = 0
+            try:
+                for row, name in results:
+                    if name is None:
                         continue
-                updated += 1
-                if updated % _COMMIT_EVERY == 0:
-                    conn.commit()
-                    log.info("named %s companies so far", updated)
-        conn.commit()
+                    with conn.cursor() as cur:
+                        cur.execute(_UPDATE_SQL, (name, row["id"]))
+                        batch_updated += cur.rowcount
+                conn.commit()
+            except BaseException:
+                conn.rollback()
+                raise
+            updated += batch_updated
+            log.info("named %s companies so far", updated)
         log.info("backfill complete: named %s of %s companies", updated, len(rows))
     finally:
         conn.close()
 
 
 if __name__ == "__main__":
     main()
diff --git a/company_discovery/run.py b/company_discovery/run.py
index 5ca6ef4..348fdd1 100644
--- a/company_discovery/run.py
+++ b/company_discovery/run.py
@@ -87,22 +87,22 @@ def _review_user(conn, profile: dict) -> None:
         or compute_company_profile_version(profile.get("company_instructions"))
     run_id = db.start_discovery_run(conn)
     conn.commit()
 
     counts = {"reviewed": 0, "included": 0, "excluded": 0, "unknown": 0, "errors": 0}
     status, notes = "completed", None
     backlog = 0
     try:
         candidates = db.select_for_review(conn, user_id, pv, config.BATCH_CAP)
         enriched = enrich_selected(conn, candidates)
+        conn.commit()  # Includes the no-enrichment branch before model work.
         if enriched:
-            conn.commit()  # persist grounding before the long, credit-gated review
             log.info("enriched %s selected companies before review", enriched)
         company_block = build_company_block(profile.get("company_instructions"))
         client = CompanyReviewClient(model=profile.get("model_company"))
         results, halted = asyncio.run(
             review_batch(candidates, company_block, client, config.CONCURRENCY,
                          user_id=user_id, run_id=run_id))
 
         for cid, res, err in results:
             row = _review_row(user_id=user_id, company_id=cid, pv=pv,
                               model=client.model, res=res, err=err)
@@ -153,13 +153,14 @@ def run(conn=None) -> None:
         ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
         conn.commit()
         log.info("ingested %s new candidate companies", ingested)
         profiles = db.load_company_profiles(conn)
         if not profiles:
             log.info("no profiles with company_instructions; skipping review")
             return
         for profile in profiles:
             _review_user(conn, profile)
     finally:
+        conn.rollback()  # Close any early-return read before network tracing flush.
         tracing.flush()
         if own:
             conn.close()
diff --git a/company_discovery/worker.py b/company_discovery/worker.py
index 142671c..04f7081 100644
--- a/company_discovery/worker.py
+++ b/company_discovery/worker.py
@@ -181,39 +181,40 @@ def process_job(conn, job, classify_client=None, should_stop=None) -> None:
                 # Checked AFTER the cancel check so an admin cancel stays terminal
                 # (requeue_job is status='running'-guarded, so even a race can't un-cancel
                 # the row).
                 jobs_db.requeue_job(conn, job["id"])
                 conn.commit()
                 log.info("classification job %s requeued for graceful shutdown "
                          "(will resume on next boot)", job["id"])
                 return
             targets = jobs_db.select_targets(
                 conn, job["selection_mode"], min(CHUNK, remaining), before=before)
+            conn.commit()  # Close status/target reads before HTTP/model/throttle.
             if not targets:
                 break
             log.info("classification job %s starting chunk of %s target(s) "
                      "(spent=%s/%s, call_timeout=%ss)",
                      job["id"], len(targets), processed_total + errored_total,
                      job["company_cap"], CALL_TIMEOUT_SECONDS)
             serp_used = 0
             if job["use_serp"] and serp.serp_available():
                 for t in targets:
                     if t["web_searched_at"] is None:
                         snippets = serp.fetch_company_snippets(
                             t["display_name"] or t["name"], t["ats"])
                         if snippets:
                             serp.persist_web_description(conn, t["id"], snippets)
+                            conn.commit()
                             t["web_description"] = snippets
                         serp_used += 1
-            enriched = enrich_selected(conn, targets)   # LLM-free board-metadata fetch
-            if enriched or serp_used:
-                conn.commit()                            # persist grounding before the spend
+            enrich_selected(conn, targets)   # LLM-free board-metadata fetch
+            conn.commit()  # Also close reads when no enrichment succeeded.
             results = loop.run_until_complete(
                 _classify_batch(targets, client, config.CONCURRENCY))
             ptok = ctok = 0
             cost = 0.0
             ok = err = 0
             chunk_first_fail = None   # (target, exc) — for this chunk's one-line warning
             for target, res, raw, exc in results:
                 if isinstance(exc, OutOfCreditsError):
                     # Spend-blocked (402 insufficient credits / 403 monthly key limit):
                     # halt this job AND the global pipeline. Carry the exception text so
@@ -279,20 +280,21 @@ def process_job(conn, job, classify_client=None, should_stop=None) -> None:
                     error=f"all {errored_total} classifications failed{sample_clause}")
             else:
                 jobs_db.finish_job(
                     conn, job["id"], "done",
                     error=f"{errored_total} of {processed_total + errored_total} "
                           f"failed{sample_clause}")
         else:
             jobs_db.finish_job(conn, job["id"], "done")
         conn.commit()
     finally:
+        conn.rollback()  # Never close HTTP sockets with a failed/open DB transaction.
         # Close the self-created client's pooled sockets on the SAME loop that opened
         # them (a caller-supplied stub client is left untouched — it owns no pool), then
         # close the loop. Runs on every exit path, including the early returns above.
         if own_client:
             try:
                 loop.run_until_complete(client.aclose())
             except Exception:
                 log.exception("classify client close failed (non-fatal)")
         loop.close()
 
@@ -303,34 +305,35 @@ def _maybe_ingest(conn) -> None:
     un-enriched companies, then record a discovery_runs row. Cheap probe (max(started_at))
     so it is safe to call every poll cycle.
 
     Enrichment is LLM-free (board display_name/about fetches) but essential: without it,
     newly ingested / poller-added companies get board display names + reviewer grounding
     (c.about) ONLY if an admin classification job happens to select them. Enriching each
     weekly tick keeps that fresh, matching the old weekly cron's behavior."""
     with conn.cursor() as cur:
         cur.execute("SELECT max(started_at) AS last FROM discovery_runs")
         last = cur.fetchone()["last"]
+    conn.commit()
     if last is not None and datetime.now(timezone.utc) - last < INGEST_EVERY:
         return
     run_id = db.start_discovery_run(conn)
     ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
     # HTTP enrichment (LLM-free): fetch board metadata for a bounded batch of the newest
-    # un-enriched companies. enrich_selected does not commit — it lands in the tick's own
-    # commit below alongside the ingest and the discovery_runs row.
+    # un-enriched companies. Ingest is durable before the bounded HTTP batches.
     with conn.cursor() as cur:
         cur.execute(
             "SELECT id, ats, token, enriched_at FROM companies "
             "WHERE enriched_at IS NULL ORDER BY first_seen_at DESC LIMIT %(cap)s",
             {"cap": config.BATCH_CAP},
         )
         pending = cur.fetchall()
+    conn.commit()
     enriched = enrich_selected(conn, pending)
     db.finish_discovery_run(conn, run_id, status="completed", ingested=ingested,
                             reviewed=0, included=0, excluded=0, unknown=0,
                             errors=0, backlog=0,
                             notes=f"weekly ingest tick (enriched {enriched})")
     conn.commit()
 
 
 def process_one(conn, should_stop=None) -> bool:
     """One cycle: run the weekly ingest tick (isolated), sweep stale orphaned jobs, then
diff --git a/dashboard/lib/jobLifecycle.db.test.ts b/dashboard/lib/jobLifecycle.db.test.ts
index ca45871..d305ec4 100644
--- a/dashboard/lib/jobLifecycle.db.test.ts
+++ b/dashboard/lib/jobLifecycle.db.test.ts
@@ -52,10 +52,36 @@ test("another backend cannot pass the same global gate", async () => {
   const second=await sql.begin(async tx=>tx`SELECT pg_try_advisory_xact_lock(20916294442894917) AS locked`);
   expect(second[0].locked).toBe(false);
   release();await first;
 });
 test("actual database is PostgreSQL 16 or 17 and helpers are private",async()=>{
   const version=await sql`SHOW server_version`;
   expect(String(version[0].server_version)).toMatch(/^(16|17)\./);
   const grants=await sql`SELECT has_function_privilege('authenticated','lifecycle_private.validate_write()','EXECUTE') AS allowed`;
   expect(grants[0].allowed).toBe(false);
 });
+
+test("postgres.js commits reserved owner growth and rejects early constraint consumption", async () => {
+  await sql.begin(async tx => {
+    await tx`ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history`;
+    await tx`UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=activation_generation+1`;
+    await tx`ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history`;
+  });
+  const write = async (early: boolean) => sql.begin(async tx => {
+    const token = early ? "dashboard-early" : "dashboard-live";
+    await tx`INSERT INTO lifecycle_claims(kind,work_id,owner_token,invoking_role,lease_until)
+      VALUES ('payload',${token},${token},current_user,clock_timestamp()+interval '180 seconds')`;
+    const reservation = await tx`INSERT INTO capacity_reservations(claim_kind,claim_id,owner_token,generation,bytes)
+      VALUES ('payload',${token},${token},1,32768) RETURNING id`;
+    await tx`UPDATE capacity_reservations SET backend_pid=pg_backend_pid(),transaction_id=pg_current_xact_id(),
+      invoking_role='authenticated',subject_id=${A}::uuid,job_id='job',scope='job_reviews'
+      WHERE id=${reservation[0].id}`;
+    await tx`SELECT set_config('lifecycle.reservation',${reservation[0].id},true),
+      set_config('role','authenticated',true),set_config('request.jwt.claims',${JSON.stringify({sub:A})},true)`;
+    await tx`UPDATE job_reviews SET verdict='deny',reasoning=${token} WHERE user_id=${A}::uuid AND job_id='job'`;
+    if (early) await tx`SET CONSTRAINTS ALL IMMEDIATE`;
+  });
+  await write(false);
+  await expect(write(true)).rejects.toThrow(/standalone COMMIT/);
+  const rows = await sql`SELECT reasoning FROM job_reviews WHERE user_id=${A}::uuid AND job_id='job'`;
+  expect(rows[0].reasoning).toBe("dashboard-live");
+});
diff --git a/job_discovery/db.py b/job_discovery/db.py
index 5131550..3a9f55e 100644
--- a/job_discovery/db.py
+++ b/job_discovery/db.py
@@ -1,11 +1,11 @@
-from job_discovery.lifecycle.locks import lock_jobs
+from job_discovery.lifecycle.locks import enter_gate, lock_jobs
 import json
 import os
 
 import psycopg
 from psycopg.rows import dict_row
 
 from job_discovery.jd import extract_description
 from job_discovery.models import Posting
 
 
@@ -176,33 +176,44 @@ def compute_newly_closed(
 
 def get_open_external_ids(conn, company_id: int) -> set[str]:
     with conn.cursor() as cur:
         cur.execute(
             "SELECT external_id FROM jobs WHERE company_id = %s AND closed_at IS NULL",
             (company_id,),
         )
         return {r["external_id"] for r in cur.fetchall()}
 
 
+def _lock_company_jobs(conn, company_id, external_ids):
+    enter_gate(conn)
+    rows = conn.execute(
+        "SELECT id FROM jobs WHERE company_id=%s AND external_id=ANY(%s)",
+        (company_id, sorted(external_ids)),
+    ).fetchall()
+    lock_jobs(conn, [r["id"] for r in rows])
+
+
 def reopen_jobs(conn, company_id: int, external_ids: set[str]) -> None:
     """A listing can reopen existing jobs during maintenance without ingestion."""
     if external_ids:
+        _lock_company_jobs(conn, company_id, external_ids)
         conn.execute(
             "UPDATE jobs SET closed_at = NULL WHERE company_id = %s "
             "AND closed_at IS NOT NULL AND external_id = ANY(%s)",
             (company_id, list(external_ids)),
         )
 
 
 def close_jobs(conn, company_id: int, external_ids: set[str]) -> int:
     if not external_ids:
         return 0
+    _lock_company_jobs(conn, company_id, external_ids)
     with conn.cursor() as cur:
         cur.execute(
             "UPDATE jobs SET closed_at = now() "
             "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
             (company_id, list(external_ids)),
         )
         return cur.rowcount
 
 
 def start_run(conn) -> int:
@@ -230,39 +241,41 @@ def finish_run(
                 companies_failed = %s,
                 new_jobs         = %s,
                 closed_jobs      = %s,
                 notes            = %s
             WHERE id = %s
             """,
             (companies_ok, companies_failed, new_jobs, closed_jobs, notes, run_id),
         )
 
 
-def insert_job_questions(conn, job_id: str, questions: dict) -> None:
-    """Upsert one job's question schema (jsonb). psycopg3 needs an explicit json.dumps."""
+def insert_job_questions(conn, job_id: str, questions: dict, *, overwrite: bool = True) -> None:
+    """Store question schema; optional legacy backfill never replaces a cache."""
+    lock_jobs(conn, [job_id])
+    conflict = ("DO UPDATE SET questions = EXCLUDED.questions, fetched_at = now()"
+                if overwrite else "DO NOTHING")
     with conn.cursor() as cur:
         cur.execute(
-            """
+            f"""
             INSERT INTO job_questions (job_id, questions, fetched_at)
             VALUES (%s, %s::jsonb, now())
-            ON CONFLICT (job_id) DO UPDATE
-              SET questions = EXCLUDED.questions, fetched_at = now()
+            ON CONFLICT (job_id) {conflict}
             """,
             (job_id, json.dumps(questions)),
         )
 
 
-def greenhouse_jobs_missing_questions(conn, company_id: int) -> list[str]:
+def greenhouse_jobs_missing_questions(conn, company_id: int, *, limit: int | None = None) -> list[str]:
     """external_ids of this company's OPEN jobs that have no job_questions row yet —
     the rolling-backfill predicate (covers both new jobs and the existing backlog)."""
     with conn.cursor() as cur:
         cur.execute(
             """
             SELECT j.external_id
             FROM jobs j
             LEFT JOIN job_questions q ON q.job_id = j.id
             WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
-            ORDER BY j.external_id
+            ORDER BY j.external_id LIMIT %s
             """,
-            (company_id,),
+            (company_id, limit),
         )
         return [r["external_id"] for r in cur.fetchall()]
diff --git a/job_discovery/lifecycle/claims.py b/job_discovery/lifecycle/claims.py
index 03935d1..2309e85 100644
--- a/job_discovery/lifecycle/claims.py
+++ b/job_discovery/lifecycle/claims.py
@@ -34,21 +34,21 @@ def claim_work(conn, kind: str, id: str, lease_seconds: int) -> ClaimRef | None:
         ).fetchone()["full"]
     ):
         return None
     token = token_urlsafe(32)
     row = conn.execute(
         """INSERT INTO lifecycle_claims(kind,work_id,owner_token,lease_until,invoking_role,subject_id)
         VALUES (%s,%s,%s,clock_timestamp()+make_interval(secs=>%s),current_user,app_user_id())
         ON CONFLICT(kind,work_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
         generation=lifecycle_claims.generation+1,replay_floor=lifecycle_claims.generation,
         lease_until=EXCLUDED.lease_until,invoking_role=EXCLUDED.invoking_role,subject_id=EXCLUDED.subject_id,
-        state='active',terminal_at=NULL RETURNING *""",
+        state='active',terminal_at=NULL,reservation_subject_bound=false,reservation_subject_id=NULL RETURNING *""",
         (kind, id, token, lease_seconds),
     ).fetchone()
     if old:
         # Fence first; expiry alone never frees reservations.
         conn.execute(
             "UPDATE capacity_reservations SET state='fenced',terminal_at=clock_timestamp() WHERE claim_kind=%s AND claim_id=%s AND generation<=%s AND state='held'",
             (kind, id, old["generation"]),
         )
     return ClaimRef(token, row["generation"], row["lease_until"])
 
diff --git a/job_discovery/lifecycle/legacy_spool.py b/job_discovery/lifecycle/legacy_spool.py
index 5efe078..1128459 100644
--- a/job_discovery/lifecycle/legacy_spool.py
+++ b/job_discovery/lifecycle/legacy_spool.py
@@ -12,83 +12,95 @@ import tempfile
 import time
 
 from job_discovery.models import Posting
 
 MAX_ROWS = 100_000
 MAX_BYTES = 64 * 1024**2
 MAX_SECONDS = 120
 
 
 @contextmanager
-def spool_feed(postings):
+def spool_feed(postings, *, admissible_ids=None):
     started = time.monotonic()
     seen = set()
     size = count = 0
     with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as spool:
         try:
             for posting in postings:
                 encoded = json.dumps(asdict(posting), separators=(",", ":")) + "\n"
                 size += len(encoded.encode("utf-8"))
                 count += 1
                 if (
                     count > MAX_ROWS
                     or size > MAX_BYTES
                     or time.monotonic() - started > MAX_SECONDS
                 ):
                     raise ValueError(
                         "legacy feed spool budget exceeded; enumeration incomplete"
                     )
                 if posting.external_id:
                     seen.add(posting.external_id)
+                    if admissible_ids is not None and posting.url and posting.title:
+                        admissible_ids.add(posting.external_id)
                 spool.write(encoded)
             if not getattr(postings, "complete", True):
                 raise ValueError(
                     "source enumeration incomplete; refusing closure reconciliation"
                 )
             spool.seek(0)
             yield (Posting(**json.loads(line)) for line in spool), seen
         finally:
             close = getattr(postings, "close", None)
             if close:
                 close()
 
 
 @contextmanager
 def spool_questions(
     conn, company_id, token, get_json, parse, missing_query, extra_ids=(), log=None
 ):
     from job_discovery.adapters.greenhouse import parse_greenhouse_questions
 
     parse = parse or parse_greenhouse_questions
-    ids = set(missing_query(conn, company_id)) | set(extra_ids)
+    # Backlog plus admissible new postings, excluding every already-cached ID.
+    cached = conn.execute(
+        "SELECT j.external_id FROM jobs j JOIN job_questions q ON q.job_id=j.id "
+        "WHERE j.company_id=%s AND j.external_id=ANY(%s)",
+        (company_id, list(extra_ids)),
+    ).fetchall()
+    ids = set(missing_query(conn, company_id, limit=MAX_ROWS + 1)) | (set(extra_ids) - {r["external_id"] for r in cached})
     conn.commit()  # Close the read transaction BEFORE the first HTTP call.
-    if len(ids) > MAX_ROWS:
-        raise ValueError("legacy question spool row budget exceeded")
+    if len(ids) > MAX_ROWS and log:
+        log.warning("optional question backfill row budget reached; remainder retries")
     started = time.monotonic()
     size = 0
     with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as spool:
-        for external_id in sorted(ids):
+        for external_id in sorted(ids)[:MAX_ROWS]:
             if time.monotonic() - started > MAX_SECONDS:
-                raise ValueError("legacy question spool deadline exceeded")
+                if log:
+                    log.warning("optional question backfill deadline reached; remainder retries")
+                break
             try:
                 data = parse(
                     get_json(
                         f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{external_id}?questions=true"
                     )
                 )
             except Exception as error:
                 if log:
                     log.warning(
                         "greenhouse question fetch failed for %s:%s (%s)",
                         token,
                         external_id,
                         type(error).__name__,
                     )
                 continue
             if data and data["questions"]:
                 encoded = json.dumps([external_id, data], separators=(",", ":")) + "\n"
                 size += len(encoded.encode("utf-8"))
                 if size > MAX_BYTES:
-                    raise ValueError("legacy question spool byte budget exceeded")
+                    if log:
+                        log.warning("optional question backfill byte budget reached; remainder retries")
+                    break
                 spool.write(encoded)
         spool.seek(0)
         yield (json.loads(line) for line in spool)
diff --git a/job_discovery/locations.py b/job_discovery/locations.py
index 9475b85..ff7af43 100644
--- a/job_discovery/locations.py
+++ b/job_discovery/locations.py
@@ -5,20 +5,21 @@ then a batched LLM pass for the leftovers (each element validated back through
 the gazetteer), then a set-based re-stamp of jobs.location_canonicals. The
 re-stamp runs every call, so a manual correction to a locations row propagates
 on the next poll. LLM/API failure leaves those raws unmapped (retried next
 run) — resolution must never fail the poll.
 Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
 """
 import asyncio
 import json
 import logging
 
+from job_discovery.lifecycle.locks import enter_gate, lock_jobs
 from job_discovery.gazetteer import Resolved, resolve_fields, resolve_location
 
 log = logging.getLogger("job_discovery.locations")
 
 _NEW_RAWS_SQL = """
     SELECT DISTINCT j.location AS raw
     FROM jobs j
     LEFT JOIN locations l ON l.raw = j.location
     WHERE j.location IS NOT NULL AND j.location <> '' AND l.raw IS NULL
 """
@@ -53,20 +54,23 @@ def _insert(conn, raw: str, resolved: list[Resolved], source: str) -> None:
 
 def _insert_unmappable(conn, raw: str) -> None:
     components = [{"canonical": raw, "kind": "unmappable", "geonameid": None,
                    "country_code": None, "admin1_code": None}]
     with conn.cursor() as cur:
         cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))
 
 
 def stamp_jobs(conn) -> int:
     """Set-based re-stamp; returns rows updated. Cheap when nothing changed."""
+    enter_gate(conn)
+    rows = conn.execute("SELECT j.id FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals").fetchall()
+    lock_jobs(conn, [r["id"] for r in rows])
     with conn.cursor() as cur:
         cur.execute(_STAMP_SQL)
         return cur.rowcount
 
 
 def _validated(places) -> list[Resolved]:
     out: list[Resolved] = []
     for p in places:
         r = resolve_fields(p.city, p.state, p.country, p.remote)
         if r is not None and r not in out:
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 0e3e3b9..5167985 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -13,21 +13,21 @@ log = logging.getLogger("job_discovery")
 
 def backfill_greenhouse_questions(conn, company_id, token, *, get_json=None, log=log) -> int:
     """Fetch + persist the question schema for this Greenhouse company's open jobs that
     lack a job_questions row (rolling backfill). One HTTP call per missing job, each
     wrapped so a single failure never aborts the company. Returns the count persisted."""
     with spool_questions(conn, company_id, token, get_json or _get_json,
                          parse_greenhouse_questions, db.greenhouse_jobs_missing_questions,
                          log=log) as questions:
         fetched = 0
         for external_id, data in questions:
-            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data)
+            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
             fetched += 1
             if fetched % UPSERT_CHUNK_SIZE == 0:
                 conn.commit()
         conn.commit()
         return fetched
 
 # Upsert postings in fixed-size chunks. The workday adapter yields lazily to keep
 # peak memory bounded (A10); buffering a whole tenant into one list before a single
 # upsert would defeat that, so we flush every UPSERT_CHUNK_SIZE postings. At most
 # one chunk (plus its detail payloads) is resident at a time.
@@ -78,45 +78,46 @@ def run(dsn: str | None = None) -> dict:
         ok = failed = new_jobs = closed_jobs = 0
         failures: list[str] = []
 
         for co in companies:
             ats, token, company_id = co["ats"], co["token"], co["id"]
             try:
                 company_closed = 0
                 postings = (ADAPTERS[ats](token, fetch_details=False)
                             if over and ats in {"workday", "smartrecruiters"}
                             else ADAPTERS[ats](token))
-                with spool_feed(postings) as (buffered, seen):
+                admissible_ids = set()
+                with spool_feed(postings, admissible_ids=admissible_ids) as (buffered, seen):
                     questions_context = (spool_questions(
                         conn, company_id, token, _get_json, parse_greenhouse_questions,
-                        db.greenhouse_jobs_missing_questions, seen, log,
+                        db.greenhouse_jobs_missing_questions, admissible_ids, log,
                     ) if not over and ats == "greenhouse" else nullcontext(iter(())))
                     with questions_context as questions:
                         chunk: list = []
                         for p in buffered:
                             if over or not p.url or not p.title:
                                 continue
                             chunk.append(p)
                             if len(chunk) >= UPSERT_CHUNK_SIZE:
                                 admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
                                 conn.commit()
                                 new_jobs += admitted
                                 chunk = []
                         if chunk:
                             admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
                             conn.commit()
                             new_jobs += admitted
                         for question_index, (external_id, data) in enumerate(questions, 1):
                             # Malformed feed entries were never admitted; retain the
                             # old FK behavior by writing only existing shared Jobs.
                             if conn.execute("SELECT 1 FROM jobs WHERE id=%s", (f"greenhouse:{token}:{external_id}",)).fetchone():
-                                db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data)
+                                db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
                             if question_index % UPSERT_CHUNK_SIZE == 0:
                                 conn.commit()
                         conn.commit()
                 if over:
                     db.reopen_jobs(conn, company_id, seen)
                 open_ids = db.get_open_external_ids(conn, company_id)
                 if not seen and len(open_ids) > 20:
                     log.error(
                         "%s returned zero postings but has %d open jobs; skipping close-detection",
                         co["name"], len(open_ids),
diff --git a/migrations/2026-10-03-02-lifecycle-safety.sql b/migrations/2026-10-03-02-lifecycle-safety.sql
index 5f8f5c9..0679097 100644
--- a/migrations/2026-10-03-02-lifecycle-safety.sql
+++ b/migrations/2026-10-03-02-lifecycle-safety.sql
@@ -1,20 +1,24 @@
 -- Checkpoint A. Legacy/collect stay compatible; readiness is NOT fabricated here.
 CREATE TABLE IF NOT EXISTS lifecycle_claims (
   kind text NOT NULL, work_id text NOT NULL, PRIMARY KEY(kind,work_id),
   owner_token text NOT NULL UNIQUE, generation bigint NOT NULL DEFAULT 1 CHECK(generation>0),
   replay_floor bigint NOT NULL DEFAULT 0 CHECK(replay_floor>=0 AND replay_floor<=generation),
   invoking_role name NOT NULL, subject_id uuid,
   lease_until timestamptz NOT NULL,
   state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled','complete')),
   terminal_at timestamptz
 );
+-- Capacity subjects belong to one claim generation, independently of the service
+-- invoking identity. First binding fixes even a NULL (public) subject.
+ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_id uuid;
+ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_bound boolean NOT NULL DEFAULT false;
 CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_recovery ON lifecycle_claims(state,lease_until);
 CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_terminal ON lifecycle_claims(terminal_at) WHERE terminal_at IS NOT NULL;
 CREATE TABLE IF NOT EXISTS capacity_reservations (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   claim_kind text NOT NULL,claim_id text NOT NULL,
   FOREIGN KEY(claim_kind,claim_id) REFERENCES lifecycle_claims(kind,work_id),
   owner_token text NOT NULL,generation bigint NOT NULL CHECK(generation>0),
   bytes bigint NOT NULL CHECK(bytes>=0),critical boolean NOT NULL DEFAULT false,
   state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','settled','fenced')),
   created_at timestamptz NOT NULL DEFAULT clock_timestamp(), terminal_at timestamptz,
@@ -41,22 +45,22 @@ CREATE TABLE IF NOT EXISTS enumeration_members (
  PRIMARY KEY(enumeration_id,external_id)
 );
 CREATE TABLE IF NOT EXISTS reconciliation_checkpoints (
  enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id) ON DELETE CASCADE,
  last_external_id text,generation bigint NOT NULL CHECK(generation>0),
  reconciled_count bigint NOT NULL DEFAULT 0 CHECK(reconciled_count>=0),
  completed_at timestamptz
 );
 CREATE INDEX IF NOT EXISTS idx_checkpoints_completed ON reconciliation_checkpoints(completed_at) WHERE completed_at IS NOT NULL;
 -- Append-only receipts support total per-transaction budgets without a privileged
--- writer. Authenticated callers may add their own receipts (which only consume
--- budget), never edit/delete them. Helpers below read claims/reservations ONLY.
+-- writer. Authenticated row triggers append owner receipts; direct client
+-- INSERT/UPDATE/DELETE is forbidden. Helpers below read claims/reservations ONLY.
 CREATE TABLE IF NOT EXISTS lifecycle_write_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),backend_pid integer NOT NULL DEFAULT pg_backend_pid(),
  transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  invoking_role name NOT NULL,subject_id uuid,
  owner_token text,generation bigint,reservation_id uuid,
  job_id text,scope text,bytes bigint NOT NULL DEFAULT 0 CHECK(bytes>=0),
  row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 1),
  total_bytes numeric NOT NULL DEFAULT 0,total_rows bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
 );
@@ -135,20 +139,28 @@ BEGIN
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_check_totals() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS a_check_totals ON lifecycle_write_checks;
 CREATE TRIGGER a_check_totals BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_check_totals();
 CREATE SCHEMA IF NOT EXISTS lifecycle_private;
 REVOKE ALL ON SCHEMA lifecycle_private FROM PUBLIC,anon,authenticated;
 CREATE OR REPLACE FUNCTION lifecycle_private.validate_write() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE c public.lifecycle_claims; r public.capacity_reservations; actor name;
 BEGIN
+ -- PostgreSQL lets any caller consume a deferred constraint early. Only the
+ -- actual top-level, standalone transaction boundary may run this AFTER check.
+ -- current_query() is server-provided, not a GUC. Fail closed for comments,
+ -- multi-statements, SET CONSTRAINTS, implicit/autocommit and PREPARE TRANSACTION.
+ -- Supported writers explicitly finish with COMMIT/END [WORK|TRANSACTION].
+ IF TG_WHEN='AFTER' AND COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+  RAISE EXCEPTION 'lifecycle receipts require standalone COMMIT or END validation';
+ END IF;
  -- role is PostgreSQL's actual SET ROLE state, not a caller-supplied identity GUC.
  actor:=CASE WHEN current_setting('role')='none' THEN session_user ELSE current_setting('role') END;
  IF TG_WHEN='BEFORE' AND (NEW.invoking_role<>actor OR NEW.subject_id IS DISTINCT FROM public.app_user_id()
  OR NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id()) THEN
   RAISE EXCEPTION 'invalid lifecycle invoking identity';
  END IF;
  IF NEW.bytes>0 AND pg_database_size(current_database())+(SELECT COALESCE(sum(bytes),0) FROM public.capacity_reservations WHERE state='held')>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
  IF NEW.total_rows>500 THEN RAISE EXCEPTION 'lifecycle admission chunk exceeds 500 rows'; END IF;
  IF NEW.bytes>0 AND NEW.reservation_id IS NULL THEN RAISE EXCEPTION 'growth_without_reservation'; END IF;
  IF NEW.reservation_id IS NOT NULL THEN
@@ -174,21 +186,21 @@ REVOKE ALL ON FUNCTION lifecycle_private.validate_write() FROM PUBLIC,anon,authe
 DROP TRIGGER IF EXISTS b_validate_write ON lifecycle_write_checks;
 CREATE TRIGGER b_validate_write BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();
 DROP TRIGGER IF EXISTS z_validate_commit ON lifecycle_write_checks;
 CREATE CONSTRAINT TRIGGER z_validate_commit AFTER INSERT ON lifecycle_write_checks DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();
 
 CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
 DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
  payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
- rid uuid;
+ rid uuid; json_keys text[];
 BEGIN
  SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
  n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
  IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
  -- Task10 installs outbox pairing. Until then even test-fixture activation fails
  -- closed on eventful public writes; export_enabled is never a producer bypass.
  IF ctl.archive_ever_activated AND TG_TABLE_NAME IN ('jobs','job_questions','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions')
  AND (TG_OP<>'UPDATE' OR n IS DISTINCT FROM o) THEN
@@ -232,24 +244,30 @@ BEGIN
   RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
  END IF;
  IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
   IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
     OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
    RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
  END IF;
  -- Payload fields are charged on every rewrite, including same-size replacements;
  -- a prior DELETE or shrink never supplies physical allocation credit.
  IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
   FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
    oldpayload:=o->>k;
    IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
-     AND (jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
        OR jsonb_typeof(n->k)='string' AND
        (octet_length(payload)>256 OR (k NOT IN (
         'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
         'experience_match','confidence','work_arrangement','pay_period','status','kind',
         'description_capture_provenance','capture_provenance','description_version_id',
         'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
    THEN growth:=growth+octet_length(payload)*4+256; END IF;
   END LOOP;
   IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
  ELSE
@@ -382,37 +400,50 @@ BEGIN
  IF NEW.state='fenced' THEN
   IF c.generation<=NEW.generation OR c.replay_floor<NEW.generation THEN
    RAISE EXCEPTION 'reservation release requires fenced generation'; END IF;
  ELSIF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN
   IF c.owner_token<>NEW.owner_token OR c.generation<>NEW.generation OR c.state<>'active'
    OR c.generation<=c.replay_floor OR c.lease_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'stale, expired or fenced capacity claim'; END IF;
   IF NEW.state='settled' AND (NEW.backend_pid IS DISTINCT FROM pg_backend_pid() OR NEW.transaction_id IS DISTINCT FROM pg_current_xact_id()) THEN
    RAISE EXCEPTION 'settlement requires current backend transaction'; END IF;
  END IF;
+ IF NEW.state='held' AND NEW.backend_pid IS NOT NULL THEN
+  IF c.reservation_subject_bound AND c.reservation_subject_id IS DISTINCT FROM NEW.subject_id THEN
+   RAISE EXCEPTION 'capacity claim already bound to another subject owner'; END IF;
+  IF c.subject_id IS NOT NULL AND c.subject_id IS DISTINCT FROM NEW.subject_id THEN
+   RAISE EXCEPTION 'capacity subject differs from claim owner'; END IF;
+  IF NOT c.reservation_subject_bound THEN
+   UPDATE public.lifecycle_claims SET reservation_subject_bound=true,reservation_subject_id=NEW.subject_id
+    WHERE kind=c.kind AND work_id=c.work_id;
+  END IF;
+ END IF;
  IF NEW.state='held' THEN
   SELECT pg_database_size(current_database())+COALESCE(sum(bytes),0)+NEW.bytes INTO allocated
   FROM public.capacity_reservations WHERE state='held' AND id<>NEW.id;
   IF allocated>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
  END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_reservation_integrity() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS reservation_integrity ON capacity_reservations;
 CREATE TRIGGER reservation_integrity BEFORE INSERT OR UPDATE OR DELETE ON capacity_reservations
  FOR EACH ROW EXECUTE FUNCTION lifecycle_reservation_integrity();
 CREATE OR REPLACE FUNCTION lifecycle_claim_integrity() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'compact claim replay fence must survive cleanup'; END IF;
  IF NEW.kind<>OLD.kind OR NEW.work_id<>OLD.work_id OR NEW.generation<OLD.generation OR NEW.replay_floor<OLD.replay_floor THEN
   RAISE EXCEPTION 'claim identity and replay floor are monotonic'; END IF;
+ IF NEW.generation=OLD.generation AND OLD.reservation_subject_bound AND
+ (NOT NEW.reservation_subject_bound OR NEW.reservation_subject_id IS DISTINCT FROM OLD.reservation_subject_id) THEN
+  RAISE EXCEPTION 'capacity subject requires a fenced generation'; END IF;
  IF (NEW.owner_token<>OLD.owner_token OR NEW.state<>OLD.state OR NEW.invoking_role<>OLD.invoking_role OR NEW.subject_id IS DISTINCT FROM OLD.subject_id) AND
  (NEW.generation<=OLD.generation OR NEW.replay_floor<OLD.generation) THEN
   RAISE EXCEPTION 'claim replacement requires a fenced generation'; END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_claim_integrity() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS claim_integrity ON lifecycle_claims;
 CREATE TRIGGER claim_integrity BEFORE UPDATE OR DELETE ON lifecycle_claims FOR EACH ROW EXECUTE FUNCTION lifecycle_claim_integrity();
 
 CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
@@ -449,25 +480,39 @@ DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['source_enumerations','enumeration_members','reconciliation_checkpoints'] LOOP
   EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_staging_claim ON public.%I',t);
   EXECUTE format('CREATE TRIGGER lifecycle_staging_claim BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lifecycle_staging_fence()',t);
  END LOOP;
 END $$;
 
 -- Existing account erasure calls this service-only INVOKER function under the
 -- same gate. It touches operational state only, preserving compact replay fences.
 CREATE OR REPLACE FUNCTION lifecycle_forget_subject(target uuid) RETURNS void
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE jid text;
 BEGIN
  PERFORM pg_advisory_xact_lock(20916294442894917);
+ -- Service erasure prelocks the entire owner Job set before claim/child rows.
+ FOR jid IN SELECT job_id FROM (
+  SELECT job_id FROM public.job_reviews WHERE user_id=target
+  UNION SELECT job_id FROM public.review_corrections WHERE user_id=target
+  UNION SELECT job_id FROM public.application_packages WHERE user_id=target
+  UNION SELECT job_id FROM public.resume_scores WHERE user_id=target
+  UNION SELECT job_id FROM public.cover_letter_edits WHERE user_id=target
+  UNION SELECT job_id FROM public.generation_jobs WHERE user_id=target
+  UNION SELECT job_id FROM public.job_payload_demands WHERE user_id=target
+  UNION SELECT job_id FROM public.capacity_reservations WHERE subject_id=target
+ ) owned WHERE job_id IS NOT NULL ORDER BY job_id COLLATE "C" LOOP
+  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0));
+ END LOOP;
  UPDATE public.lifecycle_claims c SET replay_floor=generation,generation=generation+1,
- state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL
- WHERE c.subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
+ state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL,reservation_subject_id=NULL,reservation_subject_bound=false
+ WHERE c.subject_id=target OR c.reservation_subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
   WHERE r.subject_id=target AND r.state='held' AND r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation);
  UPDATE public.capacity_reservations r SET state='fenced',terminal_at=clock_timestamp()
  FROM public.lifecycle_claims c WHERE c.kind=r.claim_kind AND c.work_id=r.claim_id
   AND r.state='held' AND r.generation<c.generation;
  UPDATE public.capacity_reservations SET subject_id=NULL WHERE subject_id=target AND state<>'held';
  DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_forget_subject(uuid) FROM PUBLIC,anon,authenticated;
 
 CREATE OR REPLACE FUNCTION lifecycle_private.protect_demand_claim() RETURNS trigger
diff --git a/reviewer/backfill_floors.py b/reviewer/backfill_floors.py
index a0f019e..3001d75 100644
--- a/reviewer/backfill_floors.py
+++ b/reviewer/backfill_floors.py
@@ -6,20 +6,21 @@ Rollout artifact — run ONCE after deploying the write-time floors:
     DATABASE_URL=... python -m reviewer.backfill_floors
 
 Only rows whose value actually changes are UPDATEd, and human-overridden rows are
 never touched (WHERE r.human_override IS NOT TRUE). reviewer.floors is the single
 source of truth for the regexes, so a backfilled row lands on the same value a
 fresh write-time review would.
 """
 import logging
 
 from reviewer import floors
+from job_discovery.lifecycle.locks import enter_gate, lock_jobs
 
 log = logging.getLogger("backfill_floors")
 
 _SELECT = """
     SELECT r.user_id, r.job_id, r.seniority, r.work_arrangement, j.title, j.remote
     FROM job_reviews r
     JOIN jobs j ON j.id = r.job_id
     WHERE (r.seniority = 'unknown' OR r.work_arrangement = 'unknown')
       AND r.human_override IS NOT TRUE
 """
@@ -39,23 +40,25 @@ def compute_floor_update(row: dict) -> dict | None:
         return None
     return {"seniority": seniority, "work_arrangement": work_arrangement}
 
 
 def main() -> None:
     logging.basicConfig(level=logging.INFO,
                         format="%(asctime)s %(levelname)s %(name)s %(message)s")
     from job_discovery import db as job_discovery_db  # shared connection factory
     conn = job_discovery_db.connect()
     try:
+        enter_gate(conn)
         with conn.cursor() as cur:
             cur.execute(_SELECT)
             rows = cur.fetchall()
+        lock_jobs(conn, [r["job_id"] for r in rows])
         updated = 0
         for r in rows:
             new = compute_floor_update(r)
             if new is None:
                 continue
             with conn.cursor() as cur:
                 cur.execute(
                     "UPDATE job_reviews SET seniority = %s, work_arrangement = %s "
                     "WHERE user_id = %s AND job_id = %s",
                     (new["seniority"], new["work_arrangement"],
diff --git a/schema.sql b/schema.sql
index 2a0a9cc..5387b48 100644
--- a/schema.sql
+++ b/schema.sql
@@ -1463,20 +1463,24 @@ INSERT INTO schema_migrations(filename) VALUES ('2026-10-03-01-lifecycle-core.sq
 -- Checkpoint A. Legacy/collect stay compatible; readiness is NOT fabricated here.
 CREATE TABLE IF NOT EXISTS lifecycle_claims (
   kind text NOT NULL, work_id text NOT NULL, PRIMARY KEY(kind,work_id),
   owner_token text NOT NULL UNIQUE, generation bigint NOT NULL DEFAULT 1 CHECK(generation>0),
   replay_floor bigint NOT NULL DEFAULT 0 CHECK(replay_floor>=0 AND replay_floor<=generation),
   invoking_role name NOT NULL, subject_id uuid,
   lease_until timestamptz NOT NULL,
   state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled','complete')),
   terminal_at timestamptz
 );
+-- Capacity subjects belong to one claim generation, independently of the service
+-- invoking identity. First binding fixes even a NULL (public) subject.
+ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_id uuid;
+ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_bound boolean NOT NULL DEFAULT false;
 CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_recovery ON lifecycle_claims(state,lease_until);
 CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_terminal ON lifecycle_claims(terminal_at) WHERE terminal_at IS NOT NULL;
 CREATE TABLE IF NOT EXISTS capacity_reservations (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   claim_kind text NOT NULL,claim_id text NOT NULL,
   FOREIGN KEY(claim_kind,claim_id) REFERENCES lifecycle_claims(kind,work_id),
   owner_token text NOT NULL,generation bigint NOT NULL CHECK(generation>0),
   bytes bigint NOT NULL CHECK(bytes>=0),critical boolean NOT NULL DEFAULT false,
   state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','settled','fenced')),
   created_at timestamptz NOT NULL DEFAULT clock_timestamp(), terminal_at timestamptz,
@@ -1503,22 +1507,22 @@ CREATE TABLE IF NOT EXISTS enumeration_members (
  PRIMARY KEY(enumeration_id,external_id)
 );
 CREATE TABLE IF NOT EXISTS reconciliation_checkpoints (
  enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id) ON DELETE CASCADE,
  last_external_id text,generation bigint NOT NULL CHECK(generation>0),
  reconciled_count bigint NOT NULL DEFAULT 0 CHECK(reconciled_count>=0),
  completed_at timestamptz
 );
 CREATE INDEX IF NOT EXISTS idx_checkpoints_completed ON reconciliation_checkpoints(completed_at) WHERE completed_at IS NOT NULL;
 -- Append-only receipts support total per-transaction budgets without a privileged
--- writer. Authenticated callers may add their own receipts (which only consume
--- budget), never edit/delete them. Helpers below read claims/reservations ONLY.
+-- writer. Authenticated row triggers append owner receipts; direct client
+-- INSERT/UPDATE/DELETE is forbidden. Helpers below read claims/reservations ONLY.
 CREATE TABLE IF NOT EXISTS lifecycle_write_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),backend_pid integer NOT NULL DEFAULT pg_backend_pid(),
  transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  invoking_role name NOT NULL,subject_id uuid,
  owner_token text,generation bigint,reservation_id uuid,
  job_id text,scope text,bytes bigint NOT NULL DEFAULT 0 CHECK(bytes>=0),
  row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 1),
  total_bytes numeric NOT NULL DEFAULT 0,total_rows bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
 );
@@ -1597,20 +1601,28 @@ BEGIN
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_check_totals() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS a_check_totals ON lifecycle_write_checks;
 CREATE TRIGGER a_check_totals BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_check_totals();
 CREATE SCHEMA IF NOT EXISTS lifecycle_private;
 REVOKE ALL ON SCHEMA lifecycle_private FROM PUBLIC,anon,authenticated;
 CREATE OR REPLACE FUNCTION lifecycle_private.validate_write() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE c public.lifecycle_claims; r public.capacity_reservations; actor name;
 BEGIN
+ -- PostgreSQL lets any caller consume a deferred constraint early. Only the
+ -- actual top-level, standalone transaction boundary may run this AFTER check.
+ -- current_query() is server-provided, not a GUC. Fail closed for comments,
+ -- multi-statements, SET CONSTRAINTS, implicit/autocommit and PREPARE TRANSACTION.
+ -- Supported writers explicitly finish with COMMIT/END [WORK|TRANSACTION].
+ IF TG_WHEN='AFTER' AND COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+  RAISE EXCEPTION 'lifecycle receipts require standalone COMMIT or END validation';
+ END IF;
  -- role is PostgreSQL's actual SET ROLE state, not a caller-supplied identity GUC.
  actor:=CASE WHEN current_setting('role')='none' THEN session_user ELSE current_setting('role') END;
  IF TG_WHEN='BEFORE' AND (NEW.invoking_role<>actor OR NEW.subject_id IS DISTINCT FROM public.app_user_id()
  OR NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id()) THEN
   RAISE EXCEPTION 'invalid lifecycle invoking identity';
  END IF;
  IF NEW.bytes>0 AND pg_database_size(current_database())+(SELECT COALESCE(sum(bytes),0) FROM public.capacity_reservations WHERE state='held')>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
  IF NEW.total_rows>500 THEN RAISE EXCEPTION 'lifecycle admission chunk exceeds 500 rows'; END IF;
  IF NEW.bytes>0 AND NEW.reservation_id IS NULL THEN RAISE EXCEPTION 'growth_without_reservation'; END IF;
  IF NEW.reservation_id IS NOT NULL THEN
@@ -1636,21 +1648,21 @@ REVOKE ALL ON FUNCTION lifecycle_private.validate_write() FROM PUBLIC,anon,authe
 DROP TRIGGER IF EXISTS b_validate_write ON lifecycle_write_checks;
 CREATE TRIGGER b_validate_write BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();
 DROP TRIGGER IF EXISTS z_validate_commit ON lifecycle_write_checks;
 CREATE CONSTRAINT TRIGGER z_validate_commit AFTER INSERT ON lifecycle_write_checks DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();
 
 CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
 DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
  payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
- rid uuid;
+ rid uuid; json_keys text[];
 BEGIN
  SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
  n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
  IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
  -- Task10 installs outbox pairing. Until then even test-fixture activation fails
  -- closed on eventful public writes; export_enabled is never a producer bypass.
  IF ctl.archive_ever_activated AND TG_TABLE_NAME IN ('jobs','job_questions','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions')
  AND (TG_OP<>'UPDATE' OR n IS DISTINCT FROM o) THEN
@@ -1694,24 +1706,30 @@ BEGIN
   RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
  END IF;
  IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
   IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
     OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
    RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
  END IF;
  -- Payload fields are charged on every rewrite, including same-size replacements;
  -- a prior DELETE or shrink never supplies physical allocation credit.
  IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
   FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
    oldpayload:=o->>k;
    IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
-     AND (jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
        OR jsonb_typeof(n->k)='string' AND
        (octet_length(payload)>256 OR (k NOT IN (
         'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
         'experience_match','confidence','work_arrangement','pay_period','status','kind',
         'description_capture_provenance','capture_provenance','description_version_id',
         'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
    THEN growth:=growth+octet_length(payload)*4+256; END IF;
   END LOOP;
   IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
  ELSE
@@ -1844,37 +1862,50 @@ BEGIN
  IF NEW.state='fenced' THEN
   IF c.generation<=NEW.generation OR c.replay_floor<NEW.generation THEN
    RAISE EXCEPTION 'reservation release requires fenced generation'; END IF;
  ELSIF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN
   IF c.owner_token<>NEW.owner_token OR c.generation<>NEW.generation OR c.state<>'active'
    OR c.generation<=c.replay_floor OR c.lease_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'stale, expired or fenced capacity claim'; END IF;
   IF NEW.state='settled' AND (NEW.backend_pid IS DISTINCT FROM pg_backend_pid() OR NEW.transaction_id IS DISTINCT FROM pg_current_xact_id()) THEN
    RAISE EXCEPTION 'settlement requires current backend transaction'; END IF;
  END IF;
+ IF NEW.state='held' AND NEW.backend_pid IS NOT NULL THEN
+  IF c.reservation_subject_bound AND c.reservation_subject_id IS DISTINCT FROM NEW.subject_id THEN
+   RAISE EXCEPTION 'capacity claim already bound to another subject owner'; END IF;
+  IF c.subject_id IS NOT NULL AND c.subject_id IS DISTINCT FROM NEW.subject_id THEN
+   RAISE EXCEPTION 'capacity subject differs from claim owner'; END IF;
+  IF NOT c.reservation_subject_bound THEN
+   UPDATE public.lifecycle_claims SET reservation_subject_bound=true,reservation_subject_id=NEW.subject_id
+    WHERE kind=c.kind AND work_id=c.work_id;
+  END IF;
+ END IF;
  IF NEW.state='held' THEN
   SELECT pg_database_size(current_database())+COALESCE(sum(bytes),0)+NEW.bytes INTO allocated
   FROM public.capacity_reservations WHERE state='held' AND id<>NEW.id;
   IF allocated>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
  END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_reservation_integrity() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS reservation_integrity ON capacity_reservations;
 CREATE TRIGGER reservation_integrity BEFORE INSERT OR UPDATE OR DELETE ON capacity_reservations
  FOR EACH ROW EXECUTE FUNCTION lifecycle_reservation_integrity();
 CREATE OR REPLACE FUNCTION lifecycle_claim_integrity() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'compact claim replay fence must survive cleanup'; END IF;
  IF NEW.kind<>OLD.kind OR NEW.work_id<>OLD.work_id OR NEW.generation<OLD.generation OR NEW.replay_floor<OLD.replay_floor THEN
   RAISE EXCEPTION 'claim identity and replay floor are monotonic'; END IF;
+ IF NEW.generation=OLD.generation AND OLD.reservation_subject_bound AND
+ (NOT NEW.reservation_subject_bound OR NEW.reservation_subject_id IS DISTINCT FROM OLD.reservation_subject_id) THEN
+  RAISE EXCEPTION 'capacity subject requires a fenced generation'; END IF;
  IF (NEW.owner_token<>OLD.owner_token OR NEW.state<>OLD.state OR NEW.invoking_role<>OLD.invoking_role OR NEW.subject_id IS DISTINCT FROM OLD.subject_id) AND
  (NEW.generation<=OLD.generation OR NEW.replay_floor<OLD.generation) THEN
   RAISE EXCEPTION 'claim replacement requires a fenced generation'; END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_claim_integrity() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS claim_integrity ON lifecycle_claims;
 CREATE TRIGGER claim_integrity BEFORE UPDATE OR DELETE ON lifecycle_claims FOR EACH ROW EXECUTE FUNCTION lifecycle_claim_integrity();
 
 CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
@@ -1911,25 +1942,39 @@ DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['source_enumerations','enumeration_members','reconciliation_checkpoints'] LOOP
   EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_staging_claim ON public.%I',t);
   EXECUTE format('CREATE TRIGGER lifecycle_staging_claim BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lifecycle_staging_fence()',t);
  END LOOP;
 END $$;
 
 -- Existing account erasure calls this service-only INVOKER function under the
 -- same gate. It touches operational state only, preserving compact replay fences.
 CREATE OR REPLACE FUNCTION lifecycle_forget_subject(target uuid) RETURNS void
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE jid text;
 BEGIN
  PERFORM pg_advisory_xact_lock(20916294442894917);
+ -- Service erasure prelocks the entire owner Job set before claim/child rows.
+ FOR jid IN SELECT job_id FROM (
+  SELECT job_id FROM public.job_reviews WHERE user_id=target
+  UNION SELECT job_id FROM public.review_corrections WHERE user_id=target
+  UNION SELECT job_id FROM public.application_packages WHERE user_id=target
+  UNION SELECT job_id FROM public.resume_scores WHERE user_id=target
+  UNION SELECT job_id FROM public.cover_letter_edits WHERE user_id=target
+  UNION SELECT job_id FROM public.generation_jobs WHERE user_id=target
+  UNION SELECT job_id FROM public.job_payload_demands WHERE user_id=target
+  UNION SELECT job_id FROM public.capacity_reservations WHERE subject_id=target
+ ) owned WHERE job_id IS NOT NULL ORDER BY job_id COLLATE "C" LOOP
+  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0));
+ END LOOP;
  UPDATE public.lifecycle_claims c SET replay_floor=generation,generation=generation+1,
- state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL
- WHERE c.subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
+ state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL,reservation_subject_id=NULL,reservation_subject_bound=false
+ WHERE c.subject_id=target OR c.reservation_subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
   WHERE r.subject_id=target AND r.state='held' AND r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation);
  UPDATE public.capacity_reservations r SET state='fenced',terminal_at=clock_timestamp()
  FROM public.lifecycle_claims c WHERE c.kind=r.claim_kind AND c.work_id=r.claim_id
   AND r.state='held' AND r.generation<c.generation;
  UPDATE public.capacity_reservations SET subject_id=NULL WHERE subject_id=target AND state<>'held';
  DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_forget_subject(uuid) FROM PUBLIC,anon,authenticated;
 
 CREATE OR REPLACE FUNCTION lifecycle_private.protect_demand_claim() RETURNS trigger
diff --git a/tests/test_lifecycle_company_boundaries.py b/tests/test_lifecycle_company_boundaries.py
new file mode 100644
index 0000000..af0d067
--- /dev/null
+++ b/tests/test_lifecycle_company_boundaries.py
@@ -0,0 +1,256 @@
+"""Offline HTTP/model callbacks observe actual idle connections and a free gate."""
+
+import importlib
+from threading import Lock
+from types import SimpleNamespace
+
+from psycopg.pq import TransactionStatus
+import pytest
+
+from tests.conftest import requires_db
+from tests.test_lifecycle_safety import connect
+from tests.test_classification_worker import _new_job, _StubClient
+from company_discovery import enrich_apply, worker, jobs_db
+from company_discovery.dataset import Candidate
+
+
+_observer_lock = Lock()
+
+
+def assert_network_boundary(conn):
+    assert conn.info.transaction_status == TransactionStatus.IDLE
+    # Concurrent fake HTTP callbacks must not contend with each other's probe.
+    with _observer_lock, connect() as observer:
+        assert observer.execute(
+            "SELECT pg_try_advisory_xact_lock(20916294442894917) AS free"
+        ).fetchone()["free"]
+
+
+def companies(conn, count=3):
+    rows = []
+    for i in range(count):
+        rows.append(
+            conn.execute(
+                "INSERT INTO companies(name,ats,token,active,discovery_source) VALUES (%s,'lever',%s,true,'dataset') RETURNING *",
+                (f"Company{i}", f"c{i}"),
+            ).fetchone()
+        )
+    conn.commit()
+    return rows
+
+
+@requires_db
+def test_enrichment_batches_never_overlap_network_and_database(conn, monkeypatch):
+    rows = companies(conn, 55)
+    observed = []
+
+    def fetch(ats, token):
+        assert_network_boundary(conn)
+        observed.append(token)
+        return (
+            None
+            if token == "c1"
+            else enrich_apply.EnrichUpdate(token, "about", "ats_board")
+        )
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+    # Start with the real candidate read transaction too.
+    conn.execute("SELECT 1")
+    assert enrich_apply.enrich_selected(conn, rows, max_workers=1) == 54
+    assert len(observed) == 55
+    assert_network_boundary(conn)
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
+        ).fetchone()["n"]
+        == 54
+    )
+
+
+@requires_db
+@pytest.mark.parametrize("module_name", ["name_backfill", "enrich_backfill"])
+def test_streaming_backfills_finish_network_batch_before_writes(
+    conn, monkeypatch, module_name
+):
+    module = importlib.import_module("company_discovery." + module_name)
+    companies(conn, 55)
+
+    class Borrowed:
+        def __getattr__(self, name):
+            return getattr(conn, name)
+
+        def close(self):
+            pass
+
+    monkeypatch.setattr("job_discovery.db.connect", lambda: Borrowed())
+    seen = []
+
+    def fetch(ats, token):
+        assert_network_boundary(conn)
+        seen.append(token)
+        if token == "c1":
+            return None
+        return (
+            token
+            if module_name == "name_backfill"
+            else enrich_apply.EnrichUpdate(token, "about", "ats_board")
+        )
+
+    monkeypatch.setattr(
+        module,
+        "fetch_name" if module_name == "name_backfill" else "plan_enrichment",
+        fetch,
+    )
+    module.main()
+    assert len(seen) == 55
+    assert_network_boundary(conn)
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM companies WHERE display_name IS NOT NULL"
+        ).fetchone()["n"]
+        == 54
+    )
+
+
+@requires_db
+def test_weekly_ingest_commits_before_enrichment(conn, monkeypatch):
+    monkeypatch.setattr(
+        worker.dataset, "load_candidates", lambda _: [Candidate("New", "lever", "new")]
+    )
+    called = []
+
+    def fetch(ats, token):
+        assert_network_boundary(conn)
+        called.append(token)
+        return enrich_apply.EnrichUpdate("New", "about", "ats_board")
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+    worker._maybe_ingest(conn)
+    assert called == ["new"]
+    assert (
+        conn.execute("SELECT status FROM discovery_runs").fetchone()["status"]
+        == "completed"
+    )
+
+
+@requires_db
+@pytest.mark.parametrize("serp_enabled", [False, True])
+def test_classification_reads_serp_throttle_and_empty_enrichment_are_idle(
+    conn, monkeypatch, serp_enabled
+):
+    companies(conn)
+    _new_job(conn, company_cap=3, use_serp=serp_enabled)
+    conn.commit()
+    job = jobs_db.claim_next_job(conn)
+    conn.commit()
+    seen = []
+
+    def enrichment(ats, token):
+        assert_network_boundary(conn)
+        seen.append("enrich")
+        return None
+
+    def post(*args, **kwargs):
+        assert_network_boundary(conn)
+        seen.append("serp")
+        return SimpleNamespace(
+            raise_for_status=lambda: None,
+            json=lambda: {"organic": [{"title": "public snippets"}]},
+        )
+
+    def throttle(seconds):
+        assert seconds > 0
+        assert_network_boundary(conn)
+        seen.append("throttle")
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", enrichment)
+    monkeypatch.setenv("SERPER_API_KEY", "offline-test-key")
+    monkeypatch.setattr(worker.serp.requests, "post", post)
+    monkeypatch.setattr(
+        worker.serp, "time", SimpleNamespace(monotonic=lambda: 0, sleep=throttle)
+    )
+    monkeypatch.setattr(worker.serp, "_last_call", 0)
+    monkeypatch.setattr(worker.serp, "_MIN_INTERVAL", 0.5)
+    client = _StubClient(hook=lambda _: assert_network_boundary(conn))
+    worker.process_job(conn, job, classify_client=client)
+    assert client.calls == 3
+    assert seen.count("serp") == (3 if serp_enabled else 0)
+    assert seen.count("throttle") == (3 if serp_enabled else 0)
+    assert (
+        conn.execute("SELECT processed FROM classification_jobs").fetchone()[
+            "processed"
+        ]
+        == 3
+    )
+
+
+@requires_db
+def test_company_review_no_success_branch_closes_read_before_model(conn, monkeypatch):
+    run = importlib.import_module("company_discovery.run")
+    companies(conn)
+    seen = []
+
+    def fetch(ats, token):
+        assert_network_boundary(conn)
+        return None
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+
+    class Client:
+        model = "offline"
+
+        async def review(self, **kw):
+            assert_network_boundary(conn)
+            seen.append(kw["token"])
+            from company_discovery.schemas import CompanyReviewResult
+
+            return CompanyReviewResult(
+                verdict="unknown", confidence="high", reasoning="offline"
+            )
+
+    monkeypatch.setattr(run, "CompanyReviewClient", lambda **kw: Client())
+    run._review_user(
+        conn,
+        {
+            "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
+            "company_instructions": "software",
+        },
+    )
+    assert len(seen) == 3
+    assert (
+        conn.execute("SELECT status FROM discovery_runs").fetchone()["status"]
+        == "completed"
+    )
+
+
+@requires_db
+def test_enrichment_database_failure_rolls_back_current_bounded_batch(
+    conn, monkeypatch
+):
+    rows = companies(conn, 55)
+
+    def fetch(ats, token):
+        assert_network_boundary(conn)
+        return enrich_apply.EnrichUpdate(token, "about", "ats_board")
+
+    original = enrich_apply.apply_enrichment
+    calls = []
+
+    def apply(c, cid, plan):
+        calls.append(cid)
+        original(c, cid, plan)
+        if len(calls) == 52:
+            raise RuntimeError("second batch persistence failed")
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+    monkeypatch.setattr(enrich_apply, "apply_enrichment", apply)
+    with pytest.raises(RuntimeError, match="second batch"):
+        enrich_apply.enrich_selected(conn, rows, max_workers=1)
+    assert_network_boundary(conn)
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
+        ).fetchone()["n"]
+        == 50
+    )
+    assert all(r.get("about") is None for r in rows[50:])
diff --git a/tests/test_lifecycle_legacy_spool.py b/tests/test_lifecycle_legacy_spool.py
index c6c8213..344bfce 100644
--- a/tests/test_lifecycle_legacy_spool.py
+++ b/tests/test_lifecycle_legacy_spool.py
@@ -71,10 +71,85 @@ def test_legacy_adapters_and_question_http_observe_idle_connection(conn, monkeyp
         }
 
     monkeypatch.setitem(run.ADAPTERS, "greenhouse", adapter)
     monkeypatch.setattr(run, "_get_json", http)
     monkeypatch.setattr(locations, "resolve_new_locations", lambda c: None)
     monkeypatch.setattr(reviewer, "review_all", lambda c: None)
     result = run.run()
     assert result["failed"] == 0 and result["new_jobs"] == 3
     assert len(observations) == 6
     assert conn.execute("SELECT count(*) n FROM job_questions").fetchone()["n"] == 3
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "budget,value", [("MAX_SECONDS", -1), ("MAX_ROWS", 0), ("MAX_BYTES", 1)]
+)
+def test_poll_preserves_cached_questions_and_optional_backfill_timeout(
+    conn, monkeypatch, budget, value
+):
+    from tests.conftest import TEST_DSN
+
+    run = importlib.import_module("job_discovery.run")
+    monkeypatch.setattr(
+        run,
+        "load_targets",
+        lambda: [{"name": "Cached", "ats": "greenhouse", "token": "cached"}],
+    )
+    monkeypatch.setitem(
+        run.ADAPTERS,
+        "greenhouse",
+        lambda _: [Posting("1", "Engineer", "u"), Posting("2", "Engineer", "u")],
+    )
+    monkeypatch.setattr("job_discovery.locations.resolve_new_locations", lambda c: None)
+    monkeypatch.setattr("reviewer.run.review_all", lambda c: None)
+    calls = []
+
+    def http(url):
+        calls.append(url)
+        return {
+            "questions": [
+                {
+                    "label": "Remote",
+                    "required": False,
+                    "fields": [{"name": "q", "type": "input_text"}],
+                }
+            ]
+        }
+
+    monkeypatch.setattr(run, "_get_json", http)
+    assert run.run(TEST_DSN)["ok"] == 1
+    conn.execute("UPDATE job_questions SET questions='{}'::jsonb")
+    conn.commit()
+    calls.clear()
+    assert run.run(TEST_DSN)["ok"] == 1
+    assert calls == []
+    assert all(
+        r["questions"] == {}
+        for r in conn.execute("SELECT questions FROM job_questions").fetchall()
+    )
+    conn.execute("DELETE FROM job_questions")
+    conn.commit()
+    # Feed enumeration remains complete; only optional question backfill expires.
+    original = legacy_spool.spool_questions
+
+    def expired(*args, **kwargs):
+        monkeypatch.setattr(legacy_spool, budget, value)
+        return original(*args, **kwargs)
+
+    monkeypatch.setattr(run, "spool_questions", expired)
+    result = run.run(TEST_DSN)
+    assert result["ok"] == 1 and result["failed"] == 0
+    assert (
+        conn.execute("SELECT poll_failures FROM companies").fetchone()["poll_failures"]
+        == 0
+    )
+
+
+@requires_db
+def test_question_backlog_read_is_bounded_before_spooling(conn):
+    from job_discovery import db
+    from tests.test_lifecycle_safety import seed
+
+    seed(conn, count=3)
+    company = conn.execute("SELECT id FROM companies").fetchone()["id"]
+    assert db.greenhouse_jobs_missing_questions(conn, company, limit=1) == ["1"]
diff --git a/tests/test_lifecycle_review_security.py b/tests/test_lifecycle_review_security.py
new file mode 100644
index 0000000..26367d3
--- /dev/null
+++ b/tests/test_lifecycle_review_security.py
@@ -0,0 +1,357 @@
+"""Independent-review regressions: constraint timing, JSON scalars and tenant claims."""
+
+import json
+import time
+
+import psycopg
+import pytest
+
+from tests.conftest import as_user, requires_db
+from tests.test_lifecycle_safety import A, B, api, enforced, seed, version
+
+
+def owned_growth(conn, role="authenticated", seconds=2):
+    seed(conn)
+    vid = version(conn)
+    if role != "authenticated":
+        conn.execute(
+            "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='review_inherited') THEN CREATE ROLE review_inherited NOLOGIN INHERIT; END IF; END $$"
+        )
+        conn.execute("GRANT authenticated TO review_inherited")
+        conn.commit()
+    enforced(conn)
+    claim = api("claims").claim_work(conn, "payload", "lease-review", seconds)
+    reservation = api("capacity").reserve_capacity(conn, claim, 32768)
+    conn.commit()
+    api("capacity").bind_reservation(
+        conn,
+        reservation,
+        job_id="lever:x:0",
+        scope="job_reviews",
+        subject_id=A,
+        invoking_role=role,
+    )
+    conn.execute("SET LOCAL ROLE " + role)
+    conn.execute(
+        "SELECT set_config('request.jwt.claims',%s,true)", (json.dumps({"sub": A}),)
+    )
+    return vid
+
+
+def insert_review(conn, vid):
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,'reserved snapshot')",
+        (A, vid),
+    )
+
+
+@requires_db
+@pytest.mark.parametrize("role", ["authenticated", "review_inherited"])
+@pytest.mark.parametrize("timing", ["before", "after"])
+def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
+    vid = owned_growth(conn, role)
+    error = None
+    try:
+        if timing == "before":
+            conn.execute("SET CONSTRAINTS ALL IMMEDIATE")
+        insert_review(conn, vid)
+        if timing == "after":
+            conn.execute("SET CONSTRAINTS ALL IMMEDIATE")
+        time.sleep(2.1)
+        conn.commit()
+    except psycopg.Error as exc:
+        error = exc
+        conn.rollback()
+    assert error is not None, "expired reserved owner write committed"
+    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0
+    conn.rollback()
+    if role != "authenticated":
+        conn.execute("DROP ROLE review_inherited")
+        conn.commit()
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "command",
+    [
+        "SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT",
+        "/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE",
+        "SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT",
+        "/* receipt */ COMMIT",
+        "COMMIT; SELECT 1",
+    ],
+)
+def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
+    vid = owned_growth(conn)
+    insert_review(conn, vid)
+    with pytest.raises(psycopg.Error, match="commit|COMMIT"):
+        conn.execute(command)
+    conn.rollback()
+    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize("command", ["COMMIT", " commit work ; ", "END TRANSACTION"])
+def test_standalone_commit_boundary_accepts_live_owned_growth(conn, command):
+    vid = owned_growth(conn, seconds=180)
+    insert_review(conn, vid)
+    conn.execute(command)
+    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 1
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "field",
+    [
+        "resume_json",
+        "cover_letter_json",
+        "answers_snapshot",
+        "greenhouse_questions",
+        "prefilled_answers",
+    ],
+)
+@pytest.mark.parametrize(
+    "value",
+    ["9" * 100000, "true", '"text"', '{"a":1}', "[1]"],
+    ids=["large-number", "boolean", "string", "object", "array"],
+)
+def test_every_package_json_representation_requires_capacity(conn, field, value):
+    seed(conn)
+    vid = version(conn)
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",
+        (A, vid),
+    )
+    conn.commit()
+    enforced(conn)
+    with as_user(conn, A):
+        with pytest.raises(psycopg.Error, match="growth_without_reservation"):
+            conn.execute(
+                f"UPDATE application_packages SET {field}=%s::jsonb WHERE user_id=%s",
+                (value, A),
+            )
+
+
+@requires_db
+def test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner(conn):
+    seed(conn)
+    conn.commit()
+    claim = api("claims").claim_work(conn, "payload", "shared", 180)
+    ra = api("capacity").reserve_capacity(conn, claim, 16384)
+    rb = api("capacity").reserve_capacity(conn, claim, 16384)
+    api("capacity").bind_reservation(
+        conn,
+        ra,
+        job_id="lever:x:0",
+        scope="job_reviews",
+        subject_id=A,
+        invoking_role="authenticated",
+    )
+    conn.commit()
+    with pytest.raises(psycopg.Error, match="subject|owner"):
+        api("capacity").bind_reservation(
+            conn,
+            rb,
+            job_id="lever:x:0",
+            scope="job_reviews",
+            subject_id=B,
+            invoking_role="authenticated",
+        )
+    conn.rollback()
+    other = api("claims").claim_work(conn, "payload", "separate-b", 180)
+    separate = api("capacity").reserve_capacity(conn, other, 16384)
+    api("capacity").bind_reservation(
+        conn,
+        separate,
+        job_id="lever:x:0",
+        scope="job_reviews",
+        subject_id=B,
+        invoking_role="authenticated",
+    )
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
+        (B,),
+    )
+    conn.commit()
+    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
+    conn.commit()
+    assert (
+        conn.execute(
+            "SELECT state FROM capacity_reservations WHERE id=%s", (separate.id,)
+        ).fetchone()["state"]
+        == "held"
+    )
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM job_reviews WHERE user_id=%s", (B,)
+        ).fetchone()["n"]
+        == 1
+    )
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 1
+    with pytest.raises(RuntimeError, match="stale|fenced"):
+        api("claims").validate_claim(conn, claim)
+
+
+@requires_db
+@pytest.mark.parametrize("role", ["authenticated", "review_inherited"])
+def test_natural_expiry_rolls_back_entire_authenticated_transaction(conn, role):
+    vid = owned_growth(conn, role)
+    insert_review(conn, vid)
+    time.sleep(2.1)
+    with pytest.raises(psycopg.Error, match="expired"):
+        conn.commit()
+    conn.rollback()
+    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0
+    conn.rollback()
+    if role != "authenticated":
+        conn.execute("DROP ROLE review_inherited")
+        conn.commit()
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "table", ["job_reviews", "review_corrections", "resume_scores"]
+)
+def test_numeric_payload_guard_covers_all_private_json_columns(conn, table):
+    seed(conn)
+    vid = version(conn)
+    extra = ",profile_version" if table == "job_reviews" else ""
+    val = ",'v'" if table == "job_reviews" else ""
+    conn.execute(
+        f"INSERT INTO {table}(user_id,job_id,job_version_id{extra}) VALUES (%s,'lever:x:0',%s{val})",
+        (A, vid),
+    )
+    columns = conn.execute(
+        "SELECT attname FROM pg_attribute WHERE attrelid=%s::regclass AND atttypid='jsonb'::regtype",
+        (table,),
+    ).fetchall()
+    conn.commit()
+    enforced(conn)
+    assert columns
+    for column in columns:
+        with as_user(conn, A):
+            with pytest.raises(psycopg.Error, match="growth_without_reservation"):
+                conn.execute(
+                    f"UPDATE {table} SET {column['attname']}=repeat('9',100000)::jsonb"
+                )
+
+
+@requires_db
+def test_numeric_rewrites_consume_cumulative_reservation_and_rollback(conn):
+    seed(conn)
+    vid = version(conn)
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",
+        (A, vid),
+    )
+    claim = api("claims").claim_work(conn, "payload", "numbers", 180)
+    reservation = api("capacity").reserve_capacity(conn, claim, 810000)
+    conn.commit()
+    enforced(conn)
+    api("capacity").bind_reservation(
+        conn,
+        reservation,
+        job_id="lever:x:0",
+        scope="application_packages",
+        subject_id=A,
+        invoking_role="authenticated",
+    )
+    with as_user(conn, A):
+        for digit in ("9", "8"):
+            conn.execute(
+                "UPDATE application_packages SET resume_json=repeat(%s,100000)::jsonb",
+                (digit,),
+            )
+        assert (
+            conn.execute("SELECT sum(bytes) n FROM lifecycle_write_checks").fetchone()[
+                "n"
+            ]
+            >= 800000
+        )
+        with pytest.raises(psycopg.Error, match="budget"):
+            conn.execute(
+                "UPDATE application_packages SET resume_json=repeat('7',100000)::jsonb"
+            )
+    assert (
+        conn.execute("SELECT resume_json FROM application_packages").fetchone()[
+            "resume_json"
+        ]
+        is None
+    )
+
+
+@requires_db
+def test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed(conn):
+    seed(conn)
+    vid = version(conn)
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id,job_version_id,resume_json) VALUES (%s,'lever:x:0',%s,'12345'::jsonb)",
+        (A, vid),
+    )
+    claim = api("claims").claim_work(conn, "payload", "full", 180)
+    conn.commit()
+    allocated = conn.execute(
+        "SELECT pg_database_size(current_database()) n"
+    ).fetchone()["n"]
+    api("capacity").reserve_capacity(conn, claim, 6291456000 - allocated - 1024**2)
+    conn.commit()
+    conn.execute(
+        "UPDATE jobs SET description=(SELECT string_agg(md5(i::text),'') FROM generate_series(1,131072) i)"
+    )
+    conn.commit()
+    enforced(conn)
+    with as_user(conn, A):
+        with pytest.raises(psycopg.Error, match="physical capacity"):
+            conn.execute(
+                "UPDATE application_packages SET resume_json=repeat('9',100000)::jsonb"
+            )
+    with as_user(conn, A):
+        conn.execute(
+            "UPDATE application_packages SET status='applied',applied_at=clock_timestamp(),resume_json=NULL"
+        )
+        conn.commit()
+    assert conn.execute(
+        "SELECT status,resume_json FROM application_packages"
+    ).fetchone() == {"status": "applied", "resume_json": None}
+
+
+@requires_db
+def test_capacity_subject_including_public_null_is_fixed_until_generation_fenced(conn):
+    seed(conn)
+    conn.commit()
+    claim = api("claims").claim_work(conn, "payload", "public-first", 180)
+    public = api("capacity").reserve_capacity(conn, claim, 4096)
+    owner = api("capacity").reserve_capacity(conn, claim, 4096)
+    api("capacity").bind_reservation(conn, public, job_id="lever:x:0", scope="jobs")
+    conn.commit()
+    with pytest.raises(psycopg.Error, match="subject"):
+        api("capacity").bind_reservation(
+            conn,
+            owner,
+            job_id="lever:x:0",
+            scope="job_reviews",
+            subject_id=A,
+            invoking_role="authenticated",
+        )
+    conn.rollback()
+    api("claims").cancel_claim(conn, claim)
+    conn.commit()
+    replacement = api("claims").claim_work(conn, "payload", "public-first", 180)
+    owner = api("capacity").reserve_capacity(conn, replacement, 4096)
+    api("capacity").bind_reservation(
+        conn,
+        owner,
+        job_id="lever:x:0",
+        scope="job_reviews",
+        subject_id=A,
+        invoking_role="authenticated",
+    )
+    conn.commit()
+    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
+    conn.commit()
+    assert (
+        conn.execute("SELECT reservation_subject_id FROM lifecycle_claims").fetchone()[
+            "reservation_subject_id"
+        ]
+        is None
+    )
diff --git a/tests/test_lifecycle_service_order.py b/tests/test_lifecycle_service_order.py
new file mode 100644
index 0000000..0c253e5
--- /dev/null
+++ b/tests/test_lifecycle_service_order.py
@@ -0,0 +1,123 @@
+"""Existing service writers acquire all sorted Job keys before any row mutation."""
+
+import importlib
+
+import pytest
+from tests.conftest import requires_db
+from tests.test_lifecycle_safety import seed
+
+
+class RecordedConnection:
+    def __init__(self, conn):
+        self.conn = conn
+        self.statements = []
+
+    def __getattr__(self, name):
+        return getattr(self.conn, name)
+
+    def execute(self, sql, params=None):
+        self.statements.append((sql, params))
+        return self.conn.execute(sql, params)
+
+    def cursor(self):
+        owner = self
+
+        class Cursor:
+            def __enter__(self):
+                self.cur = owner.conn.cursor()
+                return self
+
+            def __exit__(self, *args):
+                self.cur.close()
+
+            def __getattr__(self, name):
+                return getattr(self.cur, name)
+
+            def execute(self, sql, params=None):
+                owner.statements.append((sql, params))
+                return self.cur.execute(sql, params)
+
+        return Cursor()
+
+    def close(self):
+        pass
+
+
+@requires_db
+@pytest.mark.parametrize("operation", ["close", "reopen", "stamp", "floors"])
+def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
+    seed(conn, count=3)
+    company_id = conn.execute("SELECT id FROM companies").fetchone()["id"]
+    if operation == "reopen":
+        conn.execute("UPDATE jobs SET closed_at=now()")
+    if operation == "stamp":
+        conn.execute("UPDATE jobs SET location='raw'")
+        conn.execute(
+            "INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')"
+        )
+    if operation == "floors":
+        conn.execute("UPDATE jobs SET title='Senior Engineer'")
+        conn.execute(
+            "INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs"
+        )
+    conn.commit()
+    recorded = RecordedConnection(conn)
+    db = importlib.import_module("job_discovery.db")
+    if operation == "close":
+        db.close_jobs(recorded, company_id, {"2", "0", "1"})
+    elif operation == "reopen":
+        db.reopen_jobs(recorded, company_id, {"2", "0", "1"})
+    elif operation == "stamp":
+        importlib.import_module("job_discovery.locations").stamp_jobs(recorded)
+    else:
+        monkeypatch.setattr(db, "connect", lambda: recorded)
+        importlib.import_module("reviewer.backfill_floors").main()
+    writes = [
+        i
+        for i, (sql, _) in enumerate(recorded.statements)
+        if sql.lstrip().upper().startswith("UPDATE")
+    ]
+    locks = [
+        (i, params)
+        for i, (sql, params) in enumerate(recorded.statements)
+        if "hashtextextended" in sql
+    ]
+    gates = [
+        i
+        for i, (sql, _) in enumerate(recorded.statements)
+        if "pg_advisory_xact_lock" in sql and "hashtextextended" not in sql
+    ]
+    assert writes and gates and locks, recorded.statements
+    assert min(gates) < min(i for i, _ in locks) < min(writes)
+    assert max(i for i, _ in locks) < min(writes)
+    assert [params[0] for _, params in locks] == [
+        "lifecycle:job:lever:x:0",
+        "lifecycle:job:lever:x:1",
+        "lifecycle:job:lever:x:2",
+    ]
+
+
+@requires_db
+def test_account_erasure_service_prelocks_owned_jobs(conn):
+    from tests.test_lifecycle_safety import A, B, connect
+
+    seed(conn, count=3)
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version) SELECT %s,id,'v' FROM jobs WHERE external_id IN ('0','2')",
+        (A,),
+    )
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version) VALUES (%s,'lever:x:1','v')",
+        (B,),
+    )
+    conn.commit()
+    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
+    with connect() as observer:
+        for suffix in ("0", "2"):
+            assert not observer.execute(
+                "SELECT pg_try_advisory_xact_lock(hashtextextended(%s,0)) locked",
+                ("lifecycle:job:lever:x:" + suffix,),
+            ).fetchone()["locked"]
+        assert observer.execute(
+            "SELECT pg_try_advisory_xact_lock(hashtextextended('lifecycle:job:lever:x:1',0)) locked"
+        ).fetchone()["locked"]
