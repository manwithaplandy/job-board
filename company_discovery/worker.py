"""Always-on classification worker. LLM spend happens ONLY inside an admin-launched
classification_jobs row — the weekly tick below is LLM-free (dataset ingest + HTTP
enrichment). Mirrors reviewer/worker.py: claim -> process -> commit; belt-and-braces
per-job isolation; SIGTERM-aware sleep.

Run as: `python -m company_discovery`. Railway service config in railway.discovery.json
(always-on, no cron). Backend job -> keeps the service role (direct connection).
"""
import asyncio
import logging
import os
import signal
import sys
import time
from datetime import datetime, timedelta, timezone

from company_discovery import config, dataset, db, jobs_db, serp
from company_discovery.enrich_apply import enrich_selected
from company_discovery.llm import OutOfCreditsError
from job_discovery import db as jdb

log = logging.getLogger("company_discovery.worker")

CHUNK = 25          # targets classified+persisted per progress bump / cancel check
POLL_SECONDS = int(os.environ.get("CLASSIFY_WORKER_POLL_SECONDS", "15"))
INGEST_EVERY = timedelta(days=7)
# 'running' jobs whose progress heartbeat (last_progress_at) is older than this are
# presumed orphaned by a crashed / disconnected worker and requeued to 'pending'. Sized
# well above one chunk's wall-clock (~25 LLM calls) so an actively-progressing job — even
# one overlapping a zero-downtime deploy's old container — is never reaped as stale.
STALE_MINUTES = 15


class _Stop:
    """Cooperative shutdown flag set by SIGTERM/SIGINT. process_job checks it at every
    CHUNK boundary (via a should_stop callback): on shutdown it lets the in-flight chunk
    finish, requeues the job back to 'pending' (progress + started_at preserved), and
    returns — so the loop exits within ONE chunk (~CHUNK companies, ~seconds) instead of
    blocking on a whole company_cap-sized job, and the next boot resumes it. Railway's
    stop-grace is honored; a large job never ends in SIGKILL mid-run."""

    def __init__(self) -> None:
        self.stop = False

    def request(self, *_a) -> None:
        log.info("shutdown signal received; finishing in-flight work then exiting")
        self.stop = True


async def _classify_batch(targets, client, concurrency):
    """Mirror run.review_batch's semaphore pattern but return one tuple per target:
    (target, parsed|None, raw|None, exc|None). An OutOfCreditsError halts new launches
    (in-flight calls finish) AND is surfaced in the tuple so process_job can stop the
    whole job; any other exception is per-target isolated (parsed=None, exc set)."""
    sem = asyncio.Semaphore(concurrency)
    halt = asyncio.Event()

    async def _guarded(t):
        if halt.is_set():
            return (t, None, None, None)
        async with sem:
            if halt.is_set():
                return (t, None, None, None)
            try:
                parsed, raw = await client.classify(
                    name=t["name"], ats=t["ats"], token=t["token"],
                    display_name=t.get("display_name"), about=t.get("about"),
                    web_description=t.get("web_description"))
                return (t, parsed, raw, None)
            except OutOfCreditsError as exc:
                halt.set()  # stop launching new work; in-flight calls finish
                return (t, None, None, exc)
            except Exception as exc:  # per-target isolation
                return (t, None, None, exc)

    return await asyncio.gather(*[_guarded(t) for t in targets])


def process_job(conn, job, classify_client=None, should_stop=None) -> None:
    """Drain one classification_jobs row: classify select_targets in CHUNK bites,
    optionally SERP-grounding first, stamping progress each chunk and honoring an
    admin cancel / a graceful-shutdown request / an out-of-credits halt. Owns no
    transaction of its own beyond the per-chunk commits it issues; the caller committed
    the claim before invoking us.

    `should_stop` (optional `() -> bool`): checked at each chunk boundary. When it returns
    True (SIGTERM), the in-flight chunk finishes, the job is requeued to 'pending' (progress
    + started_at preserved) and we return, so the worker exits within one chunk and the next
    boot resumes the job — never mid-classification, never blocking on a whole large job.

    Resume-aware: `remaining` is company_cap minus progress already spent (processed +
    errored), so a job requeued after a crash / graceful shutdown does NOT re-spend its
    cap from zero — it only classifies what is left of the budget."""
    from company_discovery.llm import CompanyClassifyClient
    own_client = classify_client is None
    client = classify_client or CompanyClassifyClient(model=job["model"])
    source = "job_serp" if job["use_serp"] else "job"
    # unknown_repass would re-select a company that stays 'unknown' after this run's
    # classification forever; bound select_targets to rows classified BEFORE this run
    # started (classified_at < started_at) so a re-classified-but-still-unknown company
    # is not picked again. Ignored for 'unclassified' (classified_at IS NULL there).
    before = job["started_at"] if job["selection_mode"] == "unknown_repass" else None
    # Deduct progress already spent by a prior (crashed / gracefully-stopped) attempt so a
    # resumed job honors its ORIGINAL company_cap across attempts rather than restarting it.
    remaining = job["company_cap"] - job["processed"] - job["errored"]
    # Run EVERY chunk of this job on ONE event loop. `client` owns a single pooled
    # httpx.AsyncClient (via AsyncOpenAI); calling asyncio.run() per chunk would spin up
    # and tear down a fresh loop each chunk, so from chunk 2 on the shared pool's
    # keep-alive connections and lazily-bound async primitives belong to a prior, now-
    # CLOSED loop — the next request can raise 'RuntimeError: Event loop is closed' and,
    # once a keep-alive passes keepalive_expiry mid-chunk, the eviction path wedges the
    # pool into PoolTimeout. _classify_batch's per-target guard would silently fold every
    # such failure into `err`, so a job with company_cap > CHUNK would burn its whole
    # remaining cap as errors with zero classifications. Every production caller in this
    # repo (reviewer/run.py, company_discovery/run.py) scopes one client to exactly one
    # asyncio.run for this reason; we hold that invariant across the sync chunk loop with
    # a single long-lived loop, closing it (and the self-created client's sockets) in the
    # finally so nothing outlives the loop its connections were created on.
    loop = asyncio.new_event_loop()
    # Job-level failure surfacing. _classify_batch's per-target guard captures each
    # exception, but the pre-hardening loop discarded them: an all-failed run reported
    # 'done' processed=0 with a NULL error and no log lines (the 2026-07-22 monthly-key-
    # limit incident). Track the first exception seen and running totals (seeded with any
    # progress a resumed attempt already spent) so the terminal transition can name what
    # went wrong on the row + in the log.
    first_exc = None
    processed_total = job["processed"]
    errored_total = job["errored"]
    try:
        while remaining > 0:
            if jobs_db.job_status(conn, job["id"]) == "canceled":
                jobs_db.finish_job(conn, job["id"], "canceled")
                conn.commit()
                return
            if should_stop is not None and should_stop():
                # Graceful shutdown between chunks: requeue for resume on the next boot.
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
            if not targets:
                break
            serp_used = 0
            if job["use_serp"] and serp.serp_available():
                for t in targets:
                    if t["web_searched_at"] is None:
                        snippets = serp.fetch_company_snippets(
                            t["display_name"] or t["name"], t["ats"])
                        if snippets:
                            serp.persist_web_description(conn, t["id"], snippets)
                            t["web_description"] = snippets
                        serp_used += 1
            enriched = enrich_selected(conn, targets)   # LLM-free board-metadata fetch
            if enriched or serp_used:
                conn.commit()                            # persist grounding before the spend
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
                    # the operator sees WHICH block hit, not a bare 'out of credits'.
                    jobs_db.finish_job(conn, job["id"], "error",
                                       error=f"out of credits: {str(exc)[:400]}")
                    db.set_halted(conn, True)
                    conn.commit()
                    return
                if res is None:
                    err += 1
                    if exc is not None:
                        if first_exc is None:
                            first_exc = exc
                        if chunk_first_fail is None:
                            chunk_first_fail = (target, exc)
                    continue
                jobs_db.apply_classification(conn, target["id"], res,
                                             model=client.model, source=source)
                ok += 1
                usage = getattr(raw, "usage", None)
                ptok += getattr(usage, "prompt_tokens", 0) or 0
                ctok += getattr(usage, "completion_tokens", 0) or 0
                cost += float(getattr(usage, "cost", 0) or 0)
            if chunk_first_fail is not None:
                # Log the FIRST failure of this chunk with company + exception detail (one
                # line, not 25) so a bad chunk is visible in the worker log; a count stands
                # in for the rest instead of spamming a line per target.
                ft, fexc = chunk_first_fail
                more = f"; and {err - 1} more error(s) this chunk" if err > 1 else ""
                log.warning("classification job %s: company %s (%s) classify failed: %s%s",
                            job["id"], ft["id"], ft.get("display_name") or ft["name"],
                            repr(fexc), more)
            jobs_db.bump_progress(conn, job["id"], processed=ok, errored=err, serp=serp_used,
                                  prompt_tokens=ptok, completion_tokens=ctok,
                                  cost=cost or None)
            conn.commit()
            processed_total += ok
            errored_total += err
            remaining -= len(targets)
            # Belt-and-braces: even with the started_at bound above, stop when a repass
            # chunk made no net progress (every target still matches the mode after apply)
            # so a pathological all-error chunk cannot spin.
            if job["selection_mode"] == "unknown_repass" and ok == 0 and err == len(targets):
                break
        # Terminal transition: surface per-target failures on the row so the admin panel
        # sees them (it was blind to them before). An all-failed run finishes 'error' —
        # reporting it 'done' is misleading; a partially-failed run stays 'done' but records
        # the failure count + a sample exception.
        if errored_total > 0:
            # first_exc is None only when every error came from a PRIOR attempt (seeded into
            # errored_total from the claimed row) and this attempt saw no exception — a
            # crash/SIGTERM requeue edge. Don't emit a dangling 'sample: ' with nothing after
            # it (reads as a bug in the admin panel); mark the sample unavailable instead.
            sample_clause = (f"; sample: {repr(first_exc)[:400]}" if first_exc is not None
                             else "; sample unavailable (errors from a prior attempt)")
            if processed_total == 0:
                jobs_db.finish_job(
                    conn, job["id"], "error",
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
        # Close the self-created client's pooled sockets on the SAME loop that opened
        # them (a caller-supplied stub client is left untouched — it owns no pool), then
        # close the loop. Runs on every exit path, including the early returns above.
        if own_client:
            try:
                loop.run_until_complete(client.aclose())
            except Exception:
                log.exception("classify client close failed (non-fatal)")
        loop.close()


def _maybe_ingest(conn) -> None:
    """LLM-free weekly tick: if the last discovery run is >= INGEST_EVERY old (or there
    are none), ingest the shipped company dataset AND HTTP-enrich a bounded batch of
    un-enriched companies, then record a discovery_runs row. Cheap probe (max(started_at))
    so it is safe to call every poll cycle.

    Enrichment is LLM-free (board display_name/about fetches) but essential: without it,
    newly ingested / poller-added companies get board display names + reviewer grounding
    (c.about) ONLY if an admin classification job happens to select them. Enriching each
    weekly tick keeps that fresh, matching the old weekly cron's behavior."""
    with conn.cursor() as cur:
        cur.execute("SELECT max(started_at) AS last FROM discovery_runs")
        last = cur.fetchone()["last"]
    if last is not None and datetime.now(timezone.utc) - last < INGEST_EVERY:
        return
    run_id = db.start_discovery_run(conn)
    ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
    # HTTP enrichment (LLM-free): fetch board metadata for a bounded batch of the newest
    # un-enriched companies. enrich_selected does not commit — it lands in the tick's own
    # commit below alongside the ingest and the discovery_runs row.
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, ats, token, enriched_at FROM companies "
            "WHERE enriched_at IS NULL ORDER BY first_seen_at DESC LIMIT %(cap)s",
            {"cap": config.BATCH_CAP},
        )
        pending = cur.fetchall()
    enriched = enrich_selected(conn, pending)
    db.finish_discovery_run(conn, run_id, status="completed", ingested=ingested,
                            reviewed=0, included=0, excluded=0, unknown=0,
                            errors=0, backlog=0,
                            notes=f"weekly ingest tick (enriched {enriched})")
    conn.commit()


def process_one(conn, should_stop=None) -> bool:
    """One cycle: run the weekly ingest tick (isolated), sweep stale orphaned jobs, then
    claim + process one job. Returns True if a job was handled (poll again immediately),
    False if the queue was empty (sleep). Per-job isolation: a job failure is recorded on
    the row and never propagates out. `should_stop` is threaded into process_job so a
    SIGTERM requeues the in-flight job at the next chunk boundary rather than blocking the
    drain until the whole job finishes."""
    # Weekly ingest tick — ISOLATED. A persistent tick failure (malformed committed
    # dataset, missing DISCOVERY_DATASET_DIR in the image, any repeatable load/enrich
    # error) must NOT propagate: once the last discovery_run ages past INGEST_EVERY the
    # probe passes on EVERY cycle, and an unguarded raise here would be misdiagnosed by
    # main()'s cycle-error handler as a dropped connection — churning a healthy conn every
    # cycle while the classification queue starves. Swallow + roll back the tick's partial
    # work and fall through to the queue. A genuinely dead connection is still surfaced by
    # the recovery sweep / claim below (which then reconnects via main()).
    try:
        _maybe_ingest(conn)
    except Exception:
        log.exception("weekly ingest tick failed; continuing to the job queue")
        try:
            conn.rollback()
        except Exception:
            pass
    # Recover stale orphaned 'running' jobs EACH cycle (not boot-only). A connection drop
    # mid-job can strand a row 'running' while the process keeps looping after a successful
    # reconnect; a boot-only sweep would then hang that row until the next reboot — which an
    # always-on service may not get for weeks. Heartbeat-gated (STALE_MINUTES), so an
    # actively-owned job (e.g. an overlapping deploy's old container, or this worker's own
    # just-claimed job) is never reaped.
    recovered = jobs_db.recover_orphaned_jobs(conn, STALE_MINUTES)
    if recovered:
        log.warning("requeued %s stale 'running' classification job(s); they will resume",
                    recovered)
    conn.commit()
    job = jobs_db.claim_next_job(conn)
    conn.commit()
    if not job:
        return False
    log.info("processing classification job %s (mode=%s cap=%s serp=%s model=%s)",
             job["id"], job["selection_mode"], job["company_cap"], job["use_serp"],
             job["model"])
    try:
        process_job(conn, job, should_stop=should_stop)
    except Exception as exc:  # belt-and-braces: never let one job kill the loop
        try:
            conn.rollback()
        except Exception:
            pass
        try:
            jobs_db.finish_job(conn, job["id"], "error", error=str(exc)[:500])
            conn.commit()
        except Exception:
            # The connection is likely dead, so we could not record the failure. The row
            # stays 'running'; the per-cycle stale-job sweep (recover_orphaned_jobs) in a
            # later process_one requeues it to 'pending' once its heartbeat ages past
            # STALE_MINUTES, so it resumes (started_at + progress preserved) instead of
            # hanging forever — even though this always-on worker never rebooted.
            pass
        log.exception("classification job %s failed", job["id"])
    return True


def reconnect(conn):
    """Close a (possibly dead) connection and return a fresh one. If the reconnect
    itself fails (DB genuinely down) exit nonzero so Railway restarts the service
    rather than hot-spinning on a dead connection. Mirrors reviewer/worker.reconnect."""
    try:
        conn.close()
    except Exception:
        pass
    try:
        return jdb.connect()
    except Exception:
        log.exception("worker DB reconnect failed; exiting nonzero for a Railway restart")
        sys.exit(1)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    if not config.has_api_key():
        log.warning("OPENROUTER_API_KEY not set; classification jobs will fail until it "
                    "is configured (the weekly ingest tick is LLM-free and still runs)")

    stop = _Stop()
    signal.signal(signal.SIGTERM, stop.request)
    signal.signal(signal.SIGINT, stop.request)

    conn = jdb.connect()
    # Orphan recovery is per-cycle inside process_one (heartbeat-gated), NOT boot-only:
    # the first loop iteration sweeps any job stranded 'running' by a prior crash, and a
    # mid-run connection drop (after which the process reconnects and keeps looping) is
    # recovered on a later cycle too — a boot-only sweep would hang that row until a reboot
    # this always-on service may not get for weeks. The gate keeps a live overlapping-deploy
    # job safe from being reaped.
    log.info("classification worker started (poll=%ss, chunk=%s, ingest_every=%s, stale=%smin)",
             POLL_SECONDS, CHUNK, INGEST_EVERY, STALE_MINUTES)
    try:
        while not stop.stop:
            try:
                handled = process_one(conn, should_stop=lambda: stop.stop)
            except Exception:
                # A failure in ingest/claim itself (e.g. a dropped connection) must not
                # kill the loop nor leave us spinning on a dead psycopg connection.
                log.exception("worker cycle error; reconnecting")
                conn = reconnect(conn)
                handled = False
            if not handled:
                # Idle: sleep in 1s slices so a SIGTERM (stop) is honored promptly.
                for _ in range(POLL_SECONDS):
                    if stop.stop:
                        break
                    time.sleep(1)
    finally:
        try:
            conn.close()
        except Exception:
            pass
        log.info("classification worker stopped")


if __name__ == "__main__":
    main()
