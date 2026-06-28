# Job-Data Pruning & `raw` Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop persisting the giant `jobs.raw` JSONB (92% of the DB); store the distilled `description` at poll time, backfill+reclaim the existing rows, and add lifecycle pruning so scope can keep expanding under the 8 GB volume.

**Architecture:** `extract_description` moves to the poller and runs at ingest; `jobs.description` becomes the single stored JD artifact, written **insert-only** (never overwritten on re-poll) so pruning is durable. The reviewer reads the stored `description` instead of `raw`. A one-time backfill distills `description` from existing `raw` and nulls `raw`; a `VACUUM FULL` reclaims the freed space; `raw` is then dropped. A new prune sweep (denied → drop description; closed → delete after retention; deactivated-company → delete) runs at the end of each poll, batched and bounded.

**Tech Stack:** Python 3.12, psycopg (dict_row), Postgres 17 (Supabase), pytest. DB-integration tests run only when `TEST_DATABASE_URL` is set (`requires_db` mark; the `conn` fixture rebuilds `public` from `schema.sql`).

## Global Constraints

- **`description` is insert-only in the poller.** `upsert_job`'s `ON CONFLICT DO UPDATE` must NOT set `description` (nor `raw`). This is what makes pruning durable; do not "refresh" it on re-poll.
- **Nothing in deployed code may read or write `jobs.raw`** after this work. `raw` survives only as a backfill *source* (read by the one-time `poller/backfill_descriptions.py`) and is dropped from prod during rollout. `Posting.raw` stays (in-memory extraction source only).
- **All bulk DB writes are batched + bounded** (`PRUNE_BATCH_SIZE` default 2000, commit per batch; `PRUNE_MAX_ROWS_PER_RUN` default 20000 per sweep). No un-batched mass DELETE/UPDATE — that caused a prior WAL/disk outage.
- **Approved jobs (`job_reviews.verdict='approve'`) are never deleted or stripped** by any prune rule.
- **`job_reviews.job_id → jobs(id)` becomes `ON DELETE CASCADE`** so deleting a job removes its review in one statement. Do not touch the prod-only `job_reviews.user_id → auth.users` FK (absent from `schema.sql`).
- **Config via env, with safe fallback to the default on missing/malformed** (mirror the existing `db_size_ceiling_mb` helper style): `CLOSED_JOB_RETENTION_DAYS`=30, `PRUNE_BATCH_SIZE`=2000, `PRUNE_MAX_ROWS_PER_RUN`=20000.
- Tests run against the end-state schema (no `raw`); the backfill test self-provisions a `raw` column to simulate the pre-migration DB.

---

### Task 1: Move `extract_description` to the ingest layer

Extraction is now a poll-time concern. Move the pure function from `reviewer/` to `poller/` and repoint the (temporary) import; the reviewer stops calling it in Task 4.

**Files:**
- Create: `poller/jd.py` (verbatim copy of current `reviewer/jd.py`)
- Delete: `reviewer/jd.py`
- Modify: `reviewer/run.py:6` (import path)
- Modify: `tests/test_jd.py:1` (import path)

**Interfaces:**
- Produces: `poller.jd.extract_description(ats: str, raw: dict) -> str | None` and `poller.jd.html_to_text(s: str) -> str` (signatures unchanged).

- [ ] **Step 1: Update the test import to the new location (failing import)**

In `tests/test_jd.py` change line 1 to:
```python
from poller.jd import extract_description, html_to_text
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_jd.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'poller.jd'`.

- [ ] **Step 3: Create `poller/jd.py` and delete `reviewer/jd.py`**

```bash
git mv reviewer/jd.py poller/jd.py
```
(Content is unchanged — it imports only `html` and `re`, no package-relative imports.)

- [ ] **Step 4: Repoint the reviewer import (kept working; removed in Task 4)**

In `reviewer/run.py` line 6 change to:
```python
from poller.jd import extract_description
```

- [ ] **Step 5: Run the affected tests**

Run: `.venv/bin/pytest tests/test_jd.py tests/test_reviewer_run.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add poller/jd.py reviewer/run.py tests/test_jd.py
git commit -m "refactor: move extract_description to poller.jd (ingest-time concern)"
```

---

### Task 2: Schema end-state — drop `raw`, cascade the review FK

Move `schema.sql` to its final shape and author the prod migration. Tests recreate the DB from `schema.sql`, so doing this first means later DB tests run against the end state.

**Files:**
- Modify: `schema.sql` (jobs table: remove `raw`; job_reviews FK: add `ON DELETE CASCADE`; update the disk-safety-valve comment in `poller/db.py` is Task 3 — here just schema)
- Create: `migrations/2026-06-28-job-data-pruning.sql`
- Modify: `tests/test_schema.py` (add a cascade-delete test)

**Interfaces:**
- Produces: `jobs` has no `raw` column; deleting a `jobs` row cascades to `job_reviews`.

- [ ] **Step 1: Write the failing cascade test**

Append to `tests/test_schema.py`:
```python
@requires_db
def test_deleting_job_cascades_to_review(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Z','lever','z') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:z:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict) "
            "VALUES (gen_random_uuid(), 'lever:z:1', 'v', 'deny')"
        )
        cur.execute("DELETE FROM jobs WHERE id = 'lever:z:1'")
        cur.execute("SELECT count(*) AS n FROM job_reviews WHERE job_id = 'lever:z:1'")
        assert cur.fetchone()["n"] == 0


@requires_db
def test_jobs_has_no_raw_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'jobs'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "raw" not in cols
    assert "description" in cols
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_schema.py::test_deleting_job_cascades_to_review tests/test_schema.py::test_jobs_has_no_raw_column -q`
Expected: FAIL — cascade test leaves the review row (no CASCADE yet); raw-column test finds `raw` still present.

- [ ] **Step 3: Edit `schema.sql`**

In the `jobs` table, delete the `raw JSONB,` line (lines 25). Keep `description TEXT`. The block becomes:
```sql
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  description   TEXT                          -- cached full JD plaintext (from the ATS payload)
);
```

In the `job_reviews` table, change the FK line to cascade:
```sql
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
```

- [ ] **Step 4: Author the prod migration**

Create `migrations/2026-06-28-job-data-pruning.sql`:
```sql
-- Job-data pruning + raw elimination.
-- Apply DURING the rollout maintenance window, AFTER the description backfill
-- has run and `SELECT count(*) FROM jobs WHERE description IS NULL AND raw IS NOT NULL` = 0.

-- 1. Cascade review rows when their job is pruned.
ALTER TABLE job_reviews DROP CONSTRAINT job_reviews_job_id_fkey;
ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 2. Drop the now-distilled raw payload (instant catalog change; space is
--    returned by the separate `VACUUM FULL jobs;` run in the SQL editor).
ALTER TABLE jobs DROP COLUMN raw;
```

- [ ] **Step 5: Run the schema tests**

Run: `.venv/bin/pytest tests/test_schema.py -q`
Expected: PASS (all, including the two new tests).

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-06-28-job-data-pruning.sql tests/test_schema.py
git commit -m "feat(schema): drop jobs.raw, cascade job_reviews FK; add prod migration"
```

---

### Task 3: Poller stores `description` (insert-only), never `raw`

**Files:**
- Modify: `poller/db.py` (`upsert_job`; remove the now-unused `Json` import; update the disk-safety comment)
- Modify: `tests/test_db_jobs.py` (add description tests)

**Interfaces:**
- Consumes: `poller.jd.extract_description` (Task 1).
- Produces: `upsert_job(conn, company_id, ats, token, p) -> bool` stores `description = extract_description(ats, p.raw)` on INSERT; the conflict path refreshes only `last_seen_at`, `closed_at`, and the small scalar fields — never `description`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_db_jobs.py`:
```python
@requires_db
def test_upsert_stores_extracted_description(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Eng", url="https://x",
                raw={"descriptionPlain": "Hello JD"})
    db.upsert_job(conn, cid, "lever", "acme", p)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] == "Hello JD"


@requires_db
def test_resight_does_not_overwrite_description(conn):
    cid = _seed_company(conn)
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Original"}))
    conn.commit()
    # Simulate the JD being pruned to NULL after a deny.
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET description=NULL WHERE id='lever:acme:1'")
    conn.commit()
    # Re-poll with a different JD must NOT restore description (insert-only).
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Rewritten"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_db_jobs.py -q`
Expected: FAIL — `upsert_job` still inserts `raw` (column gone from `schema.sql`) → `UndefinedColumn`, and/or `description` not stored.

- [ ] **Step 3: Rewrite `upsert_job`**

In `poller/db.py`: remove the `from psycopg.types.json import Json` import (no longer used), add `from poller.jd import extract_description` at the top, and replace `upsert_job` with:
```python
def upsert_job(conn, company_id: int, ats: str, token: str, p: Posting) -> bool:
    job_id = f"{ats}:{token}:{p.external_id}"
    description = extract_description(ats, p.raw or {})
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, company_id, external_id, title, url,
                              location, department, remote, description)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                last_seen_at = now(),
                closed_at    = NULL,
                title        = EXCLUDED.title,
                url          = EXCLUDED.url,
                location     = EXCLUDED.location,
                department   = EXCLUDED.department,
                remote       = EXCLUDED.remote
            RETURNING (xmax = 0) AS inserted
            """,
            (
                job_id, company_id, p.external_id, p.title, p.url,
                p.location, p.department, p.remote, description,
            ),
        )
        return cur.fetchone()["inserted"]
```

Also update the disk-safety comment block above `DB_SIZE_CEILING_MB_DEFAULT` (lines 15-16) to reflect that a poll no longer writes the multi-GB `raw` blob:
```python
# The Supabase Pro volume is 8 GB. A poll now stores only the distilled JD text
# (jobs.description), so per-poll growth is modest, but we still halt well below
# the hard limit as a backstop. Override via DB_SIZE_CEILING_MB.
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_db_jobs.py -q`
Expected: PASS (including the existing idempotency/closed-at tests).

- [ ] **Step 5: Commit**

```bash
git add poller/db.py tests/test_db_jobs.py
git commit -m "feat(poller): store distilled description (insert-only); stop writing raw"
```

---

### Task 4: Reviewer reads the stored `description`

**Files:**
- Modify: `reviewer/db.py` (`select_candidates` selects `j.description`; delete `set_job_description`)
- Modify: `reviewer/run.py` (use `candidate["description"]`; drop the `extract_description` import + `ReviewResult.description` field + the `set_job_description` write-back)
- Modify: `tests/test_reviewer_run.py` (`_cand` provides `description`; drop `res.description` assertions)
- Modify: `tests/test_reviewer_db.py` (candidate exposes `description`; remove `test_set_job_description`)

**Interfaces:**
- Consumes: `jobs.description` populated by `upsert_job` (Task 3).
- Produces: `select_candidates(...)` rows include `description` (not `raw`); `review_one` sends `candidate["description"] or _NO_JD` to stage 2 and no longer writes back to `jobs`.

- [ ] **Step 1: Update the reviewer tests (failing)**

In `tests/test_reviewer_run.py`, replace `_cand` (lines 36-39) and the two JD tests (lines 50-63) with:
```python
def _cand(title, ats="lever", description="jd"):
    return {"id": f"lever:acme:{title}", "title": title, "location": "Remote",
            "ats": ats, "company_name": "Acme", "description": description}


def test_pass_runs_stage2_with_stored_jd():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    assert res.stage1_decision == "pass" and res.verdict == "approve"
    assert client.stage2_calls == ["jd"]


def test_pass_with_missing_jd_uses_placeholder():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
    assert res.verdict == "approve"
    assert client.stage2_calls and "no description" in client.stage2_calls[0].lower()
```

In `tests/test_reviewer_db.py`, change the candidate assertion in `test_candidates_missing_then_excluded_when_fresh` (line 49) from `assert cands[0]["raw"]["descriptionPlain"] == "jd"` to:
```python
    assert cands[0]["description"] == "jd"
```
and delete `test_set_job_description` (lines 134-141).

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_reviewer_run.py tests/test_reviewer_db.py -q`
Expected: FAIL — `review_one` still reads `raw`/sets `res.description`; `select_candidates` still selects `j.raw`.

- [ ] **Step 3: Update `reviewer/db.py`**

In `select_candidates`, change the SELECT (line 52) to use `description`:
```python
            SELECT j.id, j.title, j.location, j.description, c.ats, c.name AS company_name, COUNT(*) OVER() AS total_stale
```
Delete the `set_job_description` function (lines 79-81).

- [ ] **Step 4: Update `reviewer/run.py`**

- Remove the import `from reviewer.jd import extract_description` (line 6).
- Remove the `description: str | None = None` field from `ReviewResult` (line 45).
- In `review_one`, replace lines 68-69 (`jd = extract_description(...)` / `res.description = jd`) with:
```python
        jd = candidate.get("description") or _NO_JD
```
  and pass `jd=jd` to `client.stage2` (the existing `jd=jd or _NO_JD` becomes just `jd=jd`).
- In `_review_user`, delete the write-back (lines 147-148):
```python
            if r.description:
                db.set_job_description(conn, r.job_id, r.description)
```

- [ ] **Step 5: Run the reviewer suite**

Run: `.venv/bin/pytest tests/test_reviewer_run.py tests/test_reviewer_db.py -q`
Expected: PASS (including the `requires_db` integration tests, where `jobs.description` is set by `upsert_job`).

- [ ] **Step 6: Commit**

```bash
git add reviewer/db.py reviewer/run.py tests/test_reviewer_run.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): read stored jobs.description instead of raw"
```

---

### Task 5: One-time backfill command

A standalone, idempotent, batched tool that distills `description` from existing `raw` and nulls `raw`. Run during rollout against prod; it is the only code that reads `jobs.raw`.

**Files:**
- Create: `poller/backfill_descriptions.py`
- Create: `tests/test_backfill.py`

**Interfaces:**
- Consumes: `poller.jd.extract_description`, `poller.db.connect`.
- Produces: `backfill(conn, batch_size: int = ...) -> int` (rows processed); runnable as `python -m poller.backfill_descriptions`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_backfill.py`:
```python
from psycopg.types.json import Json

from poller.backfill_descriptions import backfill
from tests.conftest import requires_db


def _setup(conn):
    # Simulate the pre-migration schema (schema.sql no longer has raw).
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE jobs ADD COLUMN raw jsonb")
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','lever','acme') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, raw) "
            "VALUES ('lever:acme:1', %s, '1', 'Eng', 'u', %s)",
            (cid, Json({"descriptionPlain": "Full JD"})),
        )
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, raw) "
            "VALUES ('lever:acme:2', %s, '2', 'Eng2', 'u2', %s)",
            (cid, Json({})),  # no extractable JD
        )
    conn.commit()


@requires_db
def test_backfill_populates_description_and_nulls_raw(conn):
    _setup(conn)
    assert backfill(conn, batch_size=1000) == 2
    with conn.cursor() as cur:
        cur.execute("SELECT id, description, raw FROM jobs ORDER BY id")
        rows = {r["id"]: r for r in cur.fetchall()}
    assert rows["lever:acme:1"]["description"] == "Full JD"
    assert rows["lever:acme:1"]["raw"] is None
    assert rows["lever:acme:2"]["description"] is None   # nothing to extract
    assert rows["lever:acme:2"]["raw"] is None           # still cleared


@requires_db
def test_backfill_is_idempotent(conn):
    _setup(conn)
    backfill(conn, batch_size=1000)
    assert backfill(conn, batch_size=1000) == 0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_backfill.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'poller.backfill_descriptions'`.

- [ ] **Step 3: Implement the backfill**

Create `poller/backfill_descriptions.py`:
```python
import logging
import os

from poller import db
from poller.jd import extract_description

log = logging.getLogger("poller.backfill")


def _batch_size() -> int:
    raw = os.environ.get("BACKFILL_BATCH_SIZE")
    if raw is None or raw.strip() == "":
        return 2000
    try:
        return int(raw)
    except ValueError:
        return 2000


def backfill(conn, batch_size: int | None = None) -> int:
    """Distill jobs.description from jobs.raw, then null raw. Batched + idempotent.
    Only touches rows that still have raw and no description, so it is safe to
    re-run and to resume after interruption."""
    size = batch_size or _batch_size()
    total = 0
    while True:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT j.id, c.ats, j.raw
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                WHERE j.description IS NULL AND j.raw IS NOT NULL
                LIMIT %s
                """,
                (size,),
            )
            rows = cur.fetchall()
        if not rows:
            break
        with conn.cursor() as cur:
            for r in rows:
                desc = extract_description(r["ats"], r["raw"] or {})
                cur.execute(
                    "UPDATE jobs SET description = %s, raw = NULL WHERE id = %s",
                    (desc, r["id"]),
                )
        conn.commit()
        total += len(rows)
        log.info("backfilled %s rows (running total %s)", len(rows), total)
    return total


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    conn = db.connect()
    try:
        n = backfill(conn)
        log.info("backfill complete: %s rows processed", n)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_backfill.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add poller/backfill_descriptions.py tests/test_backfill.py
git commit -m "feat(poller): one-time description backfill from raw (batched, idempotent)"
```

---

### Task 6: Lifecycle pruning sweep

**Files:**
- Create: `poller/prune.py`
- Create: `tests/test_prune.py`

**Interfaces:**
- Produces: `poller.prune.prune_jobs(conn) -> dict` with keys `denied_descriptions_dropped`, `closed_deleted`, `inactive_company_deleted`. Relies on the `ON DELETE CASCADE` from Task 2 so deleting a job removes its review.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_prune.py`:
```python
from poller import db
from poller.models import Posting
from poller.prune import prune_jobs
from tests.conftest import requires_db

USER = "33333333-3333-3333-3333-333333333333"


def _company(conn, token, active=True):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active) "
            "VALUES (%s,'lever',%s,%s) RETURNING id",
            (token, token, active),
        )
        return cur.fetchone()["id"]


def _job(conn, cid, ext, *, description="jd", closed_days=None):
    db.upsert_job(conn, cid, "lever", _token(conn, cid),
                  Posting(external_id=ext, title="Eng", url="u",
                          raw={"descriptionPlain": description} if description else {}))
    jid = f"lever:{_token(conn, cid)}:{ext}"
    if closed_days is not None:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE jobs SET closed_at = now() - make_interval(days => %s) WHERE id=%s",
                (closed_days, jid),
            )
    conn.commit()
    return jid


def _token(conn, cid):
    with conn.cursor() as cur:
        cur.execute("SELECT token FROM companies WHERE id=%s", (cid,))
        return cur.fetchone()["token"]


def _review(conn, jid, verdict=None, stage1="pass"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, stage1_decision, verdict) "
            "VALUES (%s,%s,'v',%s,%s)",
            (USER, jid, stage1, verdict),
        )
    conn.commit()


@requires_db
def test_rule_a_drops_denied_descriptions_keeps_row(conn):
    cid = _company(conn, "acme")
    denied = _job(conn, cid, "1")
    _review(conn, denied, verdict="deny")
    gate = _job(conn, cid, "2")
    _review(conn, gate, verdict=None, stage1="reject")
    approved = _job(conn, cid, "3")
    _review(conn, approved, verdict="approve")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id, description FROM jobs ORDER BY id")
        desc = {r["id"]: r["description"] for r in cur.fetchall()}
        cur.execute("SELECT count(*) AS n FROM job_reviews")
        n_reviews = cur.fetchone()["n"]
    assert desc[denied] is None          # denied -> stripped
    assert desc[gate] is None            # gate-reject -> stripped
    assert desc[approved] == "jd"        # approved -> kept
    assert n_reviews == 3                # records preserved
    assert counts["denied_descriptions_dropped"] == 2


@requires_db
def test_rule_b_deletes_old_closed_unless_approved(conn):
    cid = _company(conn, "acme")
    old_closed = _job(conn, cid, "1", closed_days=40)
    old_closed_approved = _job(conn, cid, "2", closed_days=40)
    _review(conn, old_closed_approved, verdict="approve")
    recently_closed = _job(conn, cid, "3", closed_days=5)
    open_job = _job(conn, cid, "4")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM jobs ORDER BY id")
        ids = {r["id"] for r in cur.fetchall()}
    assert old_closed not in ids                 # deleted
    assert old_closed_approved in ids            # approved spared
    assert recently_closed in ids                # inside retention window
    assert open_job in ids
    assert counts["closed_deleted"] == 1


@requires_db
def test_rule_c_deletes_inactive_company_jobs_unless_approved(conn):
    inactive = _company(conn, "dead", active=False)
    j1 = _job(conn, inactive, "1")
    j2 = _job(conn, inactive, "2")
    _review(conn, j2, verdict="approve")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM jobs ORDER BY id")
        ids = {r["id"] for r in cur.fetchall()}
    assert j1 not in ids                  # inactive-company job deleted
    assert j2 in ids                      # approved spared
    assert counts["inactive_company_deleted"] == 1


@requires_db
def test_delete_cascades_to_reviews(conn):
    cid = _company(conn, "acme")
    j = _job(conn, cid, "1", closed_days=40)
    _review(conn, j, verdict="deny")
    prune_jobs(conn)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM job_reviews WHERE job_id=%s", (j,))
        assert cur.fetchone()["n"] == 0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_prune.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'poller.prune'`.

- [ ] **Step 3: Implement `poller/prune.py`**

```python
import logging
import os

log = logging.getLogger("poller.prune")


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _run_batched(conn, sql: str, params_prefix: tuple, batch: int, cap: int) -> int:
    """Run a LIMIT-bounded write repeatedly until it stops affecting rows or the
    per-sweep cap is hit, committing each batch to keep WAL bounded."""
    done = 0
    while done < cap:
        limit = min(batch, cap - done)
        with conn.cursor() as cur:
            cur.execute(sql, params_prefix + (limit,))
            n = cur.rowcount
        conn.commit()
        if n == 0:
            break
        done += n
    return done


_DROP_DENIED = """
UPDATE jobs SET description = NULL
WHERE id IN (
    SELECT j.id FROM jobs j
    WHERE j.description IS NOT NULL
      AND EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                  AND (r.verdict = 'deny' OR r.stage1_decision = 'reject'))
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""

_DELETE_CLOSED = """
DELETE FROM jobs WHERE id IN (
    SELECT j.id FROM jobs j
    WHERE j.closed_at IS NOT NULL
      AND j.closed_at < now() - make_interval(days => %s)
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""

_DELETE_INACTIVE = """
DELETE FROM jobs WHERE id IN (
    SELECT j.id FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE c.active = FALSE
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""


def prune_jobs(conn) -> dict:
    """Lifecycle pruning, run at the end of each poll. Each rule is batched and
    bounded per sweep so a single run can never generate a large WAL burst;
    remaining work is picked up on the next poll. Deletes cascade to job_reviews."""
    batch = _int_env("PRUNE_BATCH_SIZE", 2000)
    cap = _int_env("PRUNE_MAX_ROWS_PER_RUN", 20000)
    days = _int_env("CLOSED_JOB_RETENTION_DAYS", 30)
    counts = {
        "denied_descriptions_dropped": _run_batched(conn, _DROP_DENIED, (), batch, cap),
        "closed_deleted": _run_batched(conn, _DELETE_CLOSED, (days,), batch, cap),
        "inactive_company_deleted": _run_batched(conn, _DELETE_INACTIVE, (), batch, cap),
    }
    log.info("prune complete: %s", counts)
    return counts
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_prune.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add poller/prune.py tests/test_prune.py
git commit -m "feat(poller): lifecycle pruning sweep (denied/closed/deactivated), batched"
```

---

### Task 7: Wire pruning into the poll run

**Files:**
- Modify: `poller/run.py` (call `prune_jobs` after the review phase)
- Modify: `tests/test_run.py` (assert prune runs)

**Interfaces:**
- Consumes: `poller.prune.prune_jobs` (Task 6).

- [ ] **Step 1: Inspect the existing run test to match its style**

Run: `sed -n '1,60p' tests/test_run.py` and read how `run()` is exercised (it monkeypatches adapters/`review_all`). Add a test in that same style asserting `prune_jobs` is invoked once per run, e.g.:
```python
def test_run_invokes_prune(monkeypatch):
    calls = {"prune": 0}
    import poller.run as run_module
    monkeypatch.setattr(run_module.db, "connect", lambda dsn=None: _FakeConn())  # reuse the file's fake/stub
    monkeypatch.setattr(run_module.db, "over_size_ceiling", lambda c: (False, 1.0, 6000.0))
    monkeypatch.setattr("poller.prune.prune_jobs", lambda conn: calls.__setitem__("prune", calls["prune"] + 1))
    monkeypatch.setattr(run_module, "load_targets", lambda: [])
    # ...stub start_run/sync_seed/active_companies/finish_run as the existing tests do...
    run_module.run()
    assert calls["prune"] == 1
```
Adapt the stubs to whatever `tests/test_run.py` already defines (do not invent a new fake if one exists — reuse it).

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/pytest tests/test_run.py -q`
Expected: FAIL — `prune_jobs` not called.

- [ ] **Step 3: Wire it into `poller/run.py`**

After the review block (lines 66-70), before the `finally`, add:
```python
        try:
            from poller.prune import prune_jobs
            prune_jobs(conn)
        except Exception:
            conn.rollback()
            log.exception("prune phase failed; poll results unaffected")
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_run.py -q`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `.venv/bin/pytest -q` (with `TEST_DATABASE_URL` set for DB tests)
Expected: all green.
```bash
git add poller/run.py tests/test_run.py
git commit -m "feat(poller): run lifecycle pruning at end of each poll"
```

---

### Task 8: Docs

**Files:**
- Modify: `README.md` (Deployment section)

- [ ] **Step 1: Document the new env vars + one-time backfill**

In `README.md`, under the poller/deployment notes, add a short subsection:
```markdown
- **Job-data retention** → the poller distils each role's JD into `jobs.description`
  at poll time (no raw payload is stored) and prunes at the end of every run:
  denied roles lose their `description` (the review record is kept), and closed or
  deactivated-company roles are deleted after `CLOSED_JOB_RETENTION_DAYS` (default 30)
  unless approved. Tuning: `PRUNE_BATCH_SIZE` (2000), `PRUNE_MAX_ROWS_PER_RUN` (20000).
  One-time migration of pre-existing rows: `python -m poller.backfill_descriptions`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document description storage, pruning, and backfill"
```

---

## Production Rollout (assistant-executed, poller paused)

Run **after** all tasks merge. The poller is paused for the whole window so no
old-code poll hits the dropped column and no job is reviewed without a JD. Order:

1. **Pause the poller** (Railway: set the cron service so it won't fire, or stop it).
   Confirm no poll is mid-run.
2. **Backfill** prod from the worktree (needs prod `DATABASE_URL`; fetch from
   Railway or have the operator paste it):
   `DATABASE_URL="postgres://…prod…" .venv/bin/python -m poller.backfill_descriptions`
3. **Verify** via Supabase MCP:
   `SELECT count(*) FROM jobs WHERE description IS NULL AND raw IS NOT NULL;` → must be `0`.
4. **Apply the migration** (`migrations/2026-06-28-job-data-pruning.sql`) via Supabase MCP
   `apply_migration` — adds the cascade FK and `DROP COLUMN raw`.
5. **Reclaim disk** — in the **Supabase dashboard SQL editor** (NOT MCP, which wraps
   statements in a transaction): `VACUUM FULL jobs;` Confirm `pg_database_size` dropped.
6. **Deploy** the merged branch (poller code no longer references `raw`).
7. **Resume the poller**; watch one poll run clean (poll → review → prune) and confirm
   `pg_database_size` stable.

## Self-Review

- **Spec coverage:** raw→description (T1, T3, T4); insert-only (T3 + Global Constraints); backfill (T5); denied→drop description (T6 Rule A); closed→delete after retention unless approved (T6 Rule B); deactivated→delete unless approved (T6 Rule C); cascade FK (T2); drop column + reclaim (T2 migration + Rollout); config (T6); rollout safety (Rollout). All spec sections map to a task.
- **Placeholders:** none — all code is concrete except T7 Step 1, which intentionally directs the implementer to reuse the existing `tests/test_run.py` fakes (inspect-first) rather than duplicate them.
- **Type consistency:** `extract_description(ats, raw)` (poller.jd) used by T3/T5; `prune_jobs(conn) -> dict` keys match the T6 tests; `backfill(conn, batch_size=None) -> int` matches the T5 tests; `select_candidates` now yields `description` consumed by `review_one` in T4.
