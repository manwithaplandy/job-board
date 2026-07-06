# Enrich-on-Select Cron Stage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote company enrichment from the one-time `enrich_backfill.py` script into a standing cron stage so newly-discovered and re-queued companies are grounded (real display_name + about text) before the LLM screener sees them.

**Architecture:** Extract the backfill's per-row board-fetch decision (`plan_enrichment`) and its persistence (`apply_enrichment`) into a shared `company_discovery/enrich_apply.py`. Add `enrich_selected(conn, candidates)` there — it grounds every selected company with `enriched_at IS NULL`, persists the result, and patches the in-memory candidate dict. Wire it into `company_discovery/run.py`'s `_review_user`, between `select_for_review` and the review batch. The backfill and the cron then ground companies through byte-identical logic.

**Tech Stack:** Python 3.12, psycopg 3 (dict_row), `concurrent.futures.ThreadPoolExecutor`, pytest, ruff 0.15.20.

## Global Constraints

- **`ruff check .` (0.15.20) MUST pass** — no unused imports; keep isort import ordering. If ruff reports `I001`, run `ruff check --fix` and re-run.
- **Tests MUST NOT hit the network.** `plan_enrichment` performs real HTTP. Any test that drives `_review_user`/`run()` must stub `enrich_selected`; enrichment unit tests must monkeypatch `enrich_apply.ENRICHERS` / `enrich_apply.enrich_from_jd` (never let a real board be fetched).
- **Single source of truth:** the backfill (`enrich_backfill.py`) and the cron (`enrich_selected`) MUST call the SAME `plan_enrichment` / `apply_enrichment` from `company_discovery/enrich_apply.py`. No duplicated enrichment logic.
- **`enrich_selected` does NOT commit** — the caller (`_review_user`) owns the transaction and commits grounding before the review.
- **Dead-board retry policy:** a failed/empty enrichment writes nothing and leaves `enriched_at` NULL (the company is reviewed ungrounded that run and retried only when it next becomes stale). `plan_enrichment` never raises.
- **No migration** — all columns (`display_name/about/about_source/enriched_at/web_description/web_searched_at`) already exist from the C0 migration (`2026-07-05-company-enrichment.sql`, applied to prod). **No frontend changes. SERP (C3) stays deferred** (`web_description` untouched here).
- **Test env:** DB-backed tests need `TEST_DATABASE_URL=…@localhost:55432/poller_test`. Suite: `python -m pytest tests/ -q`.

---

### Task 1: Extract shared enrichment logic into `company_discovery/enrich_apply.py`

Pure refactor — no behavior change. The existing enrichment tests (moved to target the new module) are the safety net.

**Files:**
- Create: `company_discovery/enrich_apply.py`
- Modify: `company_discovery/enrich_backfill.py` (import the moved logic instead of defining it)
- Test: `tests/test_company_enrich.py` (re-point the `test_plan_*` group at the new module)

**Interfaces:**
- Consumes: `company_discovery.enrich.ENRICHERS`, `JD_PROBE_ATS`, `enrich_from_jd` (unchanged).
- Produces (imported by Task 2 and the backfill): `EnrichUpdate` (NamedTuple `(display_name, about, about_source)`), `MAX_WORKERS: int = 5`, `plan_enrichment(ats: str, token: str) -> EnrichUpdate | None`, `apply_enrichment(conn, company_id, plan: EnrichUpdate) -> None`.

- [ ] **Step 1: Create `company_discovery/enrich_apply.py`**

```python
"""Shared company-enrichment logic: the per-row board-fetch decision
(plan_enrichment) and its persistence (apply_enrichment). Used by BOTH the
one-time backfill (enrich_backfill.py) and the standing cron stage
(enrich_selected, called from company_discovery/run.py). Keeping it here means the
backfill and the cron ground companies through byte-identical logic."""
import logging
from typing import NamedTuple

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd

log = logging.getLogger("company_discovery.enrich")

# Board fetches share the poller's egress IP; keep concurrency small.
MAX_WORKERS = 5


class EnrichUpdate(NamedTuple):
    display_name: str | None
    about: str | None
    about_source: str


_UPDATE_SQL = (
    "UPDATE companies SET display_name = COALESCE(%s, display_name), about = %s, "
    "about_source = %s, enriched_at = now() WHERE id = %s"
)


def plan_enrichment(ats: str, token: str) -> EnrichUpdate | None:
    """Pure per-row decision (DB-free; it does perform the board fetch): pick the
    enricher for `ats`, call it, and map the result to an UPDATE spec — or None to
    skip. A skip (unsupported ats, dead board / adapter error, or an empty result)
    writes nothing, so a later pass can retry a transiently-dead board.

    Safe to call from a worker thread: it only touches the shared, thread-safe
    httpx client via the enrichers; no DB handle is involved."""
    if ats in ENRICHERS:
        source, fetch, args = "ats_board", ENRICHERS[ats], (token,)
    elif ats in JD_PROBE_ATS:
        source, fetch, args = "jd_probe", enrich_from_jd, (ats, token)
    else:
        return None
    try:
        display_name, about = fetch(*args)
    except Exception as exc:  # 404 / dead board / malformed body -> skip, no write
        log.warning("enrich %s/%s failed (%s: %s); skipping",
                    ats, token, type(exc).__name__, exc)
        return None
    if display_name is None and about is None:
        return None
    return EnrichUpdate(display_name, about, source)


def apply_enrichment(conn, company_id, plan: EnrichUpdate) -> None:
    """Persist one enrichment. Main-thread only — one psycopg connection must not
    be shared across threads."""
    with conn.cursor() as cur:
        cur.execute(_UPDATE_SQL,
                    (plan.display_name, plan.about, plan.about_source, company_id))
```

- [ ] **Step 2: Rewrite `company_discovery/enrich_backfill.py` to import the moved logic**

Replace the whole file with (the `EnrichUpdate` class, `_UPDATE_SQL`, `plan_enrichment`, `_apply`, the `NamedTuple` import, the `from company_discovery.enrich import …` import, and the local `_MAX_WORKERS` are all gone — now imported from `enrich_apply`):

```python
"""One-time backfill: populate companies.display_name / about / about_source and
stamp enriched_at from the free ATS-board metadata the poller already fetches, so
the screener can re-run against real grounding text (T2's
`enriched_at > company_reviews.reviewed_at` predicate re-queues enriched companies).

Run against a database:  DATABASE_URL=... python -m company_discovery.enrich_backfill

Scope: UNKNOWNS ONLY — companies not yet enriched (enriched_at IS NULL) whose
effective verdict is 'unknown' (an un-classified company that grounding could
rescue; a company with no review at all is effectively 'unknown'). Currently
active/included companies are deliberately left untouched so the re-screen does
not churn the active set. Already-enriched rows (enriched_at set) are
excluded, so the run is resumable/idempotent and a later pass retries any board
that was transiently dead. Guarding on enriched_at (not display_name) matters
because a JD-probe/about-only success returns no name, so it never sets
display_name — a display_name guard would re-probe and re-stamp it forever
(re-queuing a needless LLM re-screen); a dead board writes nothing, so its
enriched_at stays NULL and it is correctly retried.

The per-row decision (plan_enrichment) and persistence (apply_enrichment) live in
company_discovery/enrich_apply.py, shared verbatim with the standing cron stage
(enrich_selected) so both ground companies through byte-identical logic.

ROLLOUT ARTIFACT — must NOT be run against the production DB during feature
development; the operator runs it at rollout.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from company_discovery.enrich_apply import MAX_WORKERS, apply_enrichment, plan_enrichment

log = logging.getLogger("enrich_backfill")

# Commit cadence (rows written) so a long run is durable and resumable.
_COMMIT_EVERY = 50

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
    SELECT DISTINCT c.id, c.name, c.ats, c.token
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id
    WHERE c.enriched_at IS NULL
      AND COALESCE(
            CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
            'unknown') = 'unknown'
"""


def select_to_enrich(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(_SCOPE_SQL)
        return cur.fetchall()


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
        # Board fetches (HTTP) run concurrently across a small thread pool; the DB
        # writes stay on the main thread — one psycopg connection must not be shared
        # across threads.
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(plan_enrichment, r["ats"], r["token"]): r for r in rows}
            for fut in as_completed(futures):
                row = futures[fut]
                plan = fut.result()  # plan_enrichment never raises (it skips instead)
                if plan is None:
                    continue
                apply_enrichment(conn, row["id"], plan)
                updated += 1
                if updated % _COMMIT_EVERY == 0:
                    conn.commit()
                    log.info("enriched %s companies so far", updated)
        conn.commit()
        log.info("enrichment complete: updated %s of %s companies", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Re-point the `test_plan_*` group in `tests/test_company_enrich.py` at `enrich_apply`**

`plan_enrichment` now lives in `enrich_apply`, so the monkeypatches must target the module where the name is looked up (patch-where-used). Add the import near the top of the file (next to the existing `import company_discovery.enrich_backfill as bf`):

```python
import company_discovery.enrich_apply as ea
```

Then in the seven `test_plan_*` functions ONLY, replace every `bf.` with `ea.` (i.e. `bf.ENRICHERS` → `ea.ENRICHERS`, `bf.enrich_from_jd` → `ea.enrich_from_jd`, `bf.plan_enrichment` → `ea.plan_enrichment`). Leave the enricher tests (which use `enrich.`) and the DB scope tests (`bf.select_to_enrich`) unchanged — `select_to_enrich` stays in the backfill. After the edit the group reads:

```python
def test_plan_greenhouse_maps_to_ats_board(monkeypatch):
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: ("Acme", "about text")})
    assert ea.plan_enrichment("greenhouse", "acme") == ("Acme", "about text", "ats_board")


def test_plan_lever_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(ea, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert ea.plan_enrichment("lever", "acme") == (None, "jd about", "jd_probe")


def test_plan_ashby_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(ea, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert ea.plan_enrichment("ashby", "acme") == (None, "jd about", "jd_probe")


def test_plan_skips_when_enricher_returns_empty(monkeypatch):
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: (None, None)})
    assert ea.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_when_enricher_raises(monkeypatch):
    def boom(t):
        raise RuntimeError("404 dead board")

    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": boom})
    assert ea.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_unsupported_ats():
    # workday has an adapter but no board-metadata / JD-probe enricher.
    assert ea.plan_enrichment("workday", "acme") is None


def test_plan_name_only_result_is_kept(monkeypatch):
    # A name-only board (about None) is still a usable enrichment.
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: ("Acme", None)})
    assert ea.plan_enrichment("greenhouse", "acme") == ("Acme", None, "ats_board")
```

- [ ] **Step 4: Run the enrichment tests + ruff — expect PASS / clean**

Run: `python -m pytest tests/test_company_enrich.py -q && ruff check .`
Expected: all `tests/test_company_enrich.py` tests PASS (the `test_plan_*` group and, with `TEST_DATABASE_URL` set, the `test_select_to_enrich_*` DB tests); ruff reports no errors. (If ruff reports `I001`, run `ruff check --fix` and re-run.)

- [ ] **Step 5: Commit**

```bash
git add company_discovery/enrich_apply.py company_discovery/enrich_backfill.py tests/test_company_enrich.py
git commit -m "refactor(discovery): extract shared enrichment logic to enrich_apply

Move plan_enrichment/apply_enrichment/EnrichUpdate/MAX_WORKERS out of the
one-time backfill into company_discovery/enrich_apply.py so the upcoming
cron stage can reuse byte-identical logic. No behavior change."
```

---

### Task 2: Add `enrich_selected` and wire it into the discovery cron

**Files:**
- Modify: `company_discovery/db.py` (`select_for_review` — return `enriched_at`)
- Modify: `company_discovery/enrich_apply.py` (add `enrich_selected`)
- Modify: `company_discovery/run.py` (`_review_user` — call `enrich_selected`)
- Test: `tests/test_company_enrich.py` (new `enrich_selected` DB test); `tests/test_company_discovery_run.py` (stub `enrich_selected` in the end-to-end run test)

**Interfaces:**
- Consumes: `plan_enrichment`, `apply_enrichment`, `MAX_WORKERS` from Task 1; `company_discovery.db.select_for_review` (now returns `enriched_at`).
- Produces: `enrich_selected(conn, candidates: list[dict], *, max_workers: int = MAX_WORKERS) -> int` — grounds every candidate with `enriched_at IS NULL` in place (mutates the dicts' `display_name`/`about`), persists via `apply_enrichment`, returns the count enriched. Does not commit.

- [ ] **Step 1: Return `enriched_at` from `select_for_review` (`company_discovery/db.py`)**

`enrich_selected` filters on `enriched_at`, so the selected candidate dicts must carry it. In `select_for_review` (only), extend the SELECT list:

```python
            SELECT c.id, c.name, c.ats, c.token,
                   c.display_name, c.about, c.web_description, c.enriched_at
```

Leave `count_backlog` and the rest of the query (JOIN/WHERE/ORDER/LIMIT) unchanged. (The extra column is ignored by `review_company_one`.)

- [ ] **Step 2: Write the failing `enrich_selected` test in `tests/test_company_enrich.py`**

Append (uses the file's existing `USER` constant and `requires_db` import):

```python
@requires_db
def test_enrich_selected_grounds_pending_patches_dicts_and_skips(conn, monkeypatch):
    """enrich_selected grounds only enriched_at-IS-NULL candidates: it persists the
    board result + stamps enriched_at, patches the in-memory dict so this run's
    review sees it, skips dead boards (no write, dict untouched, enriched_at stays
    NULL), and never re-fetches an already-enriched company."""
    from company_discovery import db

    def _dead(token):
        raise RuntimeError("404 dead board")

    monkeypatch.setattr(ea, "ENRICHERS", {
        "greenhouse": lambda token: (f"Name-{token}", f"About {token}."),
        "deadco": _dead,
    })
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('pend','greenhouse','pendtok', FALSE, 'dataset'),"
            "('dead','deadco','deadtok', FALSE, 'dataset'),"
            "('done','greenhouse','donetok', FALSE, 'dataset')")
        # 'done' is already enriched -> enrich_selected must skip it (no re-fetch).
        cur.execute("UPDATE companies SET display_name='Already', about='old about', "
                    "about_source='ats_board', enriched_at=now() WHERE token='donetok'")
    conn.commit()

    # Real select_for_review returns candidate dicts INCLUDING enriched_at (Step 1),
    # which enrich_selected filters on. No reviews exist, so all three are selected.
    candidates = db.select_for_review(conn, USER, "pv-current", 100)
    by_token = {c["token"]: c for c in candidates}
    assert by_token["donetok"]["enriched_at"] is not None   # column present + set
    assert by_token["pendtok"]["enriched_at"] is None

    n = ea.enrich_selected(conn, candidates)
    conn.commit()
    assert n == 1                                           # only 'pend' enriched

    # in-memory dict patched for the pending greenhouse company...
    assert by_token["pendtok"]["display_name"] == "Name-pendtok"
    assert by_token["pendtok"]["about"] == "About pendtok."
    # dead board: skipped, dict untouched (reviewed ungrounded this run)
    assert by_token["deadtok"]["display_name"] is None
    assert by_token["deadtok"]["about"] is None
    # already-enriched: not re-fetched/overwritten
    assert by_token["donetok"]["display_name"] == "Already"
    assert by_token["donetok"]["about"] == "old about"

    # ...and persisted to the DB, enriched_at stamped; dead board stays NULL.
    with conn.cursor() as cur:
        cur.execute("SELECT token, display_name, about, about_source, enriched_at "
                    "FROM companies WHERE token IN ('pendtok','deadtok','donetok')")
        rows = {r["token"]: r for r in cur.fetchall()}
    assert rows["pendtok"]["display_name"] == "Name-pendtok"
    assert rows["pendtok"]["about"] == "About pendtok."
    assert rows["pendtok"]["about_source"] == "ats_board"
    assert rows["pendtok"]["enriched_at"] is not None
    assert rows["deadtok"]["enriched_at"] is None           # dead board: no write
    assert rows["donetok"]["display_name"] == "Already"     # untouched
```

- [ ] **Step 3: Run the new test — expect FAIL**

Run: `python -m pytest tests/test_company_enrich.py::test_enrich_selected_grounds_pending_patches_dicts_and_skips -q`
Expected: FAIL with `AttributeError: module 'company_discovery.enrich_apply' has no attribute 'enrich_selected'`.

- [ ] **Step 4: Add `enrich_selected` to `company_discovery/enrich_apply.py`**

Add the import at the top (sorted: after `import logging`, before `from typing import NamedTuple`):

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
```

Append the function at the end of the module:

```python
def enrich_selected(conn, candidates: list[dict], *,
                    max_workers: int = MAX_WORKERS) -> int:
    """Ground every selected company still lacking enrichment (enriched_at IS NULL):
    fetch board metadata, persist it, and patch the in-memory candidate dict
    (display_name/about) so THIS run's review sees the grounding without a re-query.
    Returns the number of companies enriched.

    Dead boards / unsupported ATSes skip silently (plan_enrichment never raises): that
    company is reviewed ungrounded this run and its enriched_at stays NULL, so it is
    retried only when it next becomes stale (a company reviewed under the current
    profile version is not re-selected — there is no per-run re-probe storm).

    Board fetches (HTTP) run in a small thread pool — they share the poller's egress
    IP, so max_workers stays small. DB writes stay on the calling thread; one psycopg
    connection must not be shared across threads. Does not commit — the caller owns
    the transaction."""
    pending = [c for c in candidates if c.get("enriched_at") is None]
    if not pending:
        return 0
    enriched = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(plan_enrichment, c["ats"], c["token"]): c for c in pending}
        for fut in as_completed(futures):
            c = futures[fut]
            plan = fut.result()  # plan_enrichment never raises (it skips instead)
            if plan is None:
                continue
            apply_enrichment(conn, c["id"], plan)
            # Mirror the UPDATE's COALESCE: display_name is only overwritten when the
            # board returned one (JD-probe returns None -> keep prior); about is always
            # set to the fetched value.
            if plan.display_name is not None:
                c["display_name"] = plan.display_name
            c["about"] = plan.about
            enriched += 1
    return enriched
```

- [ ] **Step 5: Run the new test + ruff — expect PASS / clean**

Run: `python -m pytest tests/test_company_enrich.py::test_enrich_selected_grounds_pending_patches_dicts_and_skips -q && ruff check .`
Expected: PASS; ruff clean. (Fix any `I001` with `ruff check --fix`.)

- [ ] **Step 6: Wire `enrich_selected` into `_review_user` (`company_discovery/run.py`) and stub it in the run test**

Add the import (sorted, right after `from company_discovery import config, dataset, db`):

```python
from company_discovery.enrich_apply import enrich_selected
```

In `_review_user`, insert the enrichment stage between `select_for_review` and `build_company_block`:

```python
        candidates = db.select_for_review(conn, user_id, pv, config.BATCH_CAP)
        enriched = enrich_selected(conn, candidates)
        if enriched:
            conn.commit()  # persist grounding before the long, credit-gated review
            log.info("enriched %s selected companies before review", enriched)
        company_block = build_company_block(profile.get("company_instructions"))
```

Then, in `tests/test_company_discovery_run.py::test_run_writes_reviews_and_reconciles`, stub `enrich_selected` so the end-to-end run does NOT perform real greenhouse HTTP (Linear/Defense have `enriched_at IS NULL`). Add this line alongside the other `monkeypatch.setattr(run_module, …)` lines (after line 122), and assert the wiring fired:

```python
    enrich_calls = []
    monkeypatch.setattr(
        run_module, "enrich_selected",
        lambda conn, cands: (enrich_calls.append({c["token"] for c in cands}) or 0))
```

Add, at the end of that test's assertions:

```python
    assert enrich_calls == [{"linear", "defense"}]  # enrich_selected ran on the batch
```

- [ ] **Step 7: Run the run tests + full suite + ruff — expect PASS / clean**

Run: `python -m pytest tests/test_company_discovery_run.py tests/test_company_enrich.py tests/test_company_discovery_db.py -q && ruff check .`
Expected: all PASS; ruff clean. Then the full suite:
Run: `python -m pytest tests/ -q`
Expected: PASS (no network calls; no regressions).

- [ ] **Step 8: Commit**

```bash
git add company_discovery/db.py company_discovery/enrich_apply.py company_discovery/run.py tests/test_company_enrich.py tests/test_company_discovery_run.py
git commit -m "feat(discovery): enrich companies on-select in the review cron

Add enrich_selected() and call it in _review_user between select_for_review
and the review batch: any selected company with enriched_at IS NULL is grounded
(free ATS-board metadata) and persisted before the LLM screens it. Fixes new
companies recurring as 'unknown' and ungrounded re-review of the pv-stale
backlog. select_for_review now returns enriched_at. No migration."
```

---

## Self-Review

**Spec coverage:**
- Enrich-on-select stage between select and review → Task 2 Step 6. ✓
- Reuse `plan_enrichment` verbatim / single source of truth → Task 1 (extraction) + Task 2 (`enrich_selected` calls it). ✓
- Persist + patch in-memory dict → `enrich_selected` (Task 2 Step 4) + test (Step 2). ✓
- Already-enriched pass-through; dead-board skip leaves `enriched_at` NULL → test asserts both. ✓
- `max_workers=5` throttle → `MAX_WORKERS` default. ✓
- Caller commits, `enrich_selected` doesn't → Task 2 Step 6 commit + function docstring. ✓
- Keep the backfill script (shares extracted logic) → Task 1 Step 2. ✓
- No migration / no frontend / SERP deferred → Global Constraints; no DDL in any step. ✓
- Network-free tests → run-test stub (Step 6) + monkeypatched `ENRICHERS` in the unit test. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `plan_enrichment`/`apply_enrichment`/`EnrichUpdate`/`MAX_WORKERS` defined in Task 1 and consumed by the same names in Task 2 and the backfill; `enrich_selected` signature is identical in the function, the run-test stub, and the `_review_user` call site (`(conn, candidates)`). `select_for_review` gains `enriched_at`, which the `enrich_selected` test reads. ✓
