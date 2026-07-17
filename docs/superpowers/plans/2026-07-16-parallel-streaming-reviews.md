# Parallel + Streaming On-Demand Review Runs

## Context

The live-board-population UX (shipped a9ee789) streams approved jobs onto the board while a user's review runs — but two backend designs defeat it:

1. **Serial queue:** one always-on Railway worker (`python -m reviewer.worker`) processes `review_requests` strictly FIFO, one at a time. A new user's first board build queues behind other users' 20–35 min runs — the opposite of "instant onboarding feedback."
2. **Batch persistence:** within a run, `_review_user` runs ALL stage-1 gate batches, then ALL stage-2 evals, and only then persists to `job_reviews` (`reviewer/run.py:430`) and charges spend (`run.py:438`). The dashboard's cursor poll therefore sees one giant end-of-run batch — no incremental rows, and the "N roles scored so far" counter jumps instead of ticking.

Goal: a new user's run starts immediately (parallel workers) and their board shows first matches within ~1 minute of starting (streaming persistence). **No dashboard changes** — the shipped cursor-poll contract streams correctly the moment rows land incrementally. **No migrations.**

Exploration verdict (verified): the claim path (`FOR UPDATE SKIP LOCKED`, reviewer/db.py:318-334), session-level per-user advisory locks (db.py:127-152), atomic `usage_counters` upserts (db.py:182-197), per-run LLM clients, and per-run out-of-credits halt are **already parallel-safe across users**. Two hazards need fixing: (a) `recover_stale_review_requests` (db.py:346-359) blanket-fails ANY `running` row >30 min — parallel loops would reap each other's healthy long runs; (b) threads must NOT share the single psycopg connection (per-run transactions + session advisory locks) — each loop needs its own session via `job_discovery/db.py:11-21 connect()`.

## Part A — Parallelism: K worker loops as threads in one process

Chosen over Railway replicas: no dependence on unverified Railway schema features, no per-replica cost, and the in-flight-set recovery fix is complete within one process. Matches existing ThreadPool precedent (company_discovery/enrich_apply.py:83-85).

### A1. `reviewer/config.py` — new knob
```python
REVIEW_WORKER_PARALLELISM = _int_env("REVIEW_WORKER_PARALLELISM", 3)
```
Default 3 → parallelism on without Railway env changes. K=1 must behave exactly like today.

### A2. `reviewer/db.py` — recovery gains `exclude_ids`
```python
def recover_stale_review_requests(conn, minutes=30, exclude_ids=None) -> int:
    ...
    AND (%(ex)s::bigint[] IS NULL OR id <> ALL(%(ex)s::bigint[]))
```
`None` → today's behavior (cron path + existing tests untouched).

### A3. `reviewer/worker.py` — in-flight registry + K loops
- Module-level thread-safe set: `_mark_in_flight(id)` / `_clear_in_flight(id)` / `_in_flight_snapshot()`.
- `process_one`: pass `exclude_ids=_in_flight_snapshot()` to recovery; mark claimed id; clear in `finally` AFTER finish+commit (row is terminal by then, so the clear-gap is safe; `started_at=now()` at claim covers the claim-to-mark gap).
- Extract the loop body into `_run_loop(stop, fatal, idx)` — own `jdb.connect()` session, own `reconnect()`, 1s-sliced idle sleep checking `stop`/`fatal`.
- `main()`: K=1 → run `_run_loop` on the main thread (preserves `sys.exit(1)` propagation and today's reconnect tests). K>1 → spawn K named threads; a thread's `SystemExit` (reconnect gave up) sets a shared `fatal` `threading.Event` → siblings drain → main joins (1s-timeout loop so SIGTERM stays prompt) → `sys.exit(1)` so Railway restarts. SIGTERM/SIGINT handlers stay on the main thread; each loop finishes its in-flight request then exits (existing `_Stop` semantics).

## Part B — Streaming persistence: per-chunk pipeline

### B1. `reviewer/run.py` — `review_batch(..., on_results=None)`
Reshape from "all stage-1 → all stage-2 → return" to per-chunk pipeline: for each `STAGE1_BATCH_SIZE` (50) chunk — stage-1 gate → this chunk's passers through stage-2 (same per-run `asyncio.Semaphore(CONCURRENCY)`) → `_emit(chunk_results)` which extends the accumulated list AND calls `on_results(chunk)` when provided. Invariants preserved exactly:
- `(results, halted)` return contract unchanged (no-callback callers/tests unaffected).
- Peak LLM concurrency unchanged (semaphore per run; process peak = K×CONCURRENCY).
- `deleted_check` cadence identical (once per chunk + before each chunk's stage-2).
- Out-of-credits halt breaks the loop; already-emitted chunks stay persisted; remainder unrowed (retryable).

### B2. `reviewer/run.py` — `_review_user` persists via callback
Replace the post-batch persist/count/spend block (~384-438) with a `_persist_chunk(chunk)` closure passed as `on_results`:
- Tombstone guard per chunk (`db.user_deleted`) — M-RESURRECT-2 checked MORE often than today; deletion note takes precedence over the halt note.
- Same count branches (reviewed/gate_rejected/approved/denied/errors) accumulated across chunks → identical totals.
- `_persist_rows(conn, rows, PERSIST_CHUNK_SIZE)` + `db.add_daily_spend(conn, user_id, spent_this_chunk)` + `conn.commit()` per chunk → rows visible to the dashboard immediately, counter ticks live. Spend filter identical to today's (`stage1_decision is not None`); atomic upsert makes per-chunk increments sum to the same total. Per-chunk commits do NOT release the session advisory lock (only `unlock_user_review` does).
- Cron `review_all` uses the same path — harmless (slightly better durability).

First-paint math: chunk 1 = one stage-1 call + ≤50 passers... realistically ~9 stage-2 evals at concurrency 5 → **first approved rows in ~30–60s**. Operator lever for faster first paint: `REVIEW_STAGE1_BATCH` (no code change).

Explicitly NOT doing (YAGNI): queue priority column for first-run users (parallelism makes it moot); global LLM rate limiter (no 429 handling exists today — noted as risk); heartbeat column (only needed if Railway replicas are ever added — that's the multi-process evolution of the in-flight set).

## Files
- `reviewer/config.py` — add `REVIEW_WORKER_PARALLELISM`
- `reviewer/db.py` — `recover_stale_review_requests(exclude_ids=...)`
- `reviewer/worker.py` — in-flight registry, `_run_loop`, threaded `main()`
- `reviewer/run.py` — `review_batch(on_results=...)` pipeline + `_review_user` `_persist_chunk`
- `tests/test_reviewer_worker.py`, `tests/test_reviewer_run.py` — new tests below

## Tasks (TDD; 1–3 = Part A, 4–5 = Part B, independent)
1. db.py `exclude_ids` + tests (in-flight id survives recovery; None/[] reaps as today — extends `test_stale_running_recovery`).
2. worker.py in-flight registry + `process_one` mark/clear + tests (marked aged row survives sibling recovery; set empty after finish).
3. `_run_loop`/threaded `main()` + config knob + tests (K parallel claim loops never double-claim — generalizes the existing two-connection tests at test_reviewer_worker.py:53-83; K=1 single-thread path keeps reconnect tests green with `REVIEW_WORKER_PARALLELISM=1` monkeypatched; SIGTERM drains all loops).
4. `review_batch` pipeline + tests (chunk order: persist(chunk0) before stage1(chunk1) via instrumented stub; no-callback contract unchanged).
5. `_review_user` callback + tests (spend ticks per chunk; halt-mid-run keeps earlier chunks + correct note; totals identical vs single-batch on same fixtures; deletion tests stay green — tombstone-before-first-persist yields zeros as today).
6. Full Python suite: `python3 -m pytest` (DB tests need `TEST_DATABASE_URL=…@localhost:55432/poller_test`).

## Risks
- **OpenRouter 429s at K×5 concurrency** — no limiter/429-retry exists; failures become retryable error rows. Keep K=3 default; follow-up if observed.
- **Supabase session connections** — K threads = K direct/session-mode connections (required for advisory locks; never the :6543 txn pooler). K=3 is negligible; document ceiling.
- **LangFuse** — process-global client is share-safe (contextvar-scoped); worker never flushes per-request (pre-existing). Optional: `tracing.flush()` at `_review_user` end.

## Rollout & verification
- New branch off latest origin/main; commits forward only (repo rule). Pure Python — push to main auto-redeploys reviewer-worker (watchPatterns include `reviewer/**`). No migrations, no Railway env changes needed. The held infra commit `0037d73` (restartPolicyMaxRetries) rides the same push.
- Live verification (after deploy): enqueue requests for 2+ users at once → logs show distinct loops claiming distinct ids concurrently; a fresh user's board populates incrementally within ~1 min (the shipped cursor-poll UX) and "N scored so far" ticks per chunk; SIGTERM (redeploy) drains loops without orphaning rows; watch OpenRouter for 429s under K=3.
