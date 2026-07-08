# Prefill Application (Greenhouse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vague "Prepare application" button with a Greenhouse-only "Prefill application" action that generates a tailored résumé, prefills the posting's real questions from that résumé, and generates a cover letter *only when the posting asks for one* — with the question schema fetched once at poll time and shared across users.

**Architecture:** The Python poller (`job_discovery`) fetches each new Greenhouse posting's question schema into a new shared `job_questions` table (rolling-backfill predicate). The dashboard reads questions job-level, shows them collapsed on every Greenhouse job, and the repurposed `/api/application/prepare` route (kept internally as `kind='prepare'`) runs résumé → prefill sequentially and conditionally generates a cover letter routed through the existing cover pipeline.

**Tech Stack:** Python 3 + psycopg3 (poller), Next.js 16 / React 19 / TypeScript (dashboard), Postgres (Supabase) with RLS, vitest (dashboard) + pytest (poller), OpenRouter LLM calls.

**Spec:** `docs/superpowers/specs/2026-07-07-prefill-application-design.md`

## Global Constraints

- **Never `as`-cast a jsonb column.** Every jsonb read goes through a total parser returning a valid typed value or `null` (see `dashboard/CLAUDE.md`). Reuse `parseGreenhouseQuestionsJsonb` for the new job-level read.
- **Never rewrite existing commits.** Reconcile with a new commit on top; no amend/rebase/force-push (see `CLAUDE.md`).
- **Cover-letter detection is narrow + present-not-required:** a question is a cover-letter ask iff a field's `name === "cover_letter"` OR its label matches `/cover\s*letter/i`. Fire when that field is present (required or optional). Free-form essay prompts are NOT cover-letter asks.
- **Keep `generation_jobs.kind = 'prepare'`** — do not rename to `'prefill'`. Only user-facing copy changes. Document this in `schema.sql` and the route.
- **Job-level `job_questions` is shared, non-user-scoped data** — `shared_read` RLS policy + `GRANT SELECT ... TO authenticated` (mirror `jobs`/`companies`), read via `withUserSql` (NOT `serviceSql`). Writes are poller-only (service role).
- **Prefill uses the generated résumé** (`composeResumeText(resume)`), not the profile résumé text. Résumé → prefill is sequential; a résumé-generation failure skips prefill (both retry together).
- **LLM models:** résumé `profile.model_resume ?? DEFAULT_RESUME_MODEL`; cover `profile.model_cover ?? DEFAULT_COVER_MODEL`; prefill `DEFAULT_PREFILL_MODEL`. Prefill is instruction-less (`instructions: null`).
- **Python jsonb writes** use `json.dumps(...)` bound to a `%s::jsonb` param (psycopg3 does not auto-adapt dict→jsonb).
- **Per-job poller HTTP fetches** are wrapped in their own `try/except`, log a warning on failure, and never abort the company (mirror `smartrecruiters.py` / `workday.py`).
- **Test commands:** poller — `python3 -m pytest tests/ -q` with `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test`; dashboard — `npm test` (vitest) run from `dashboard/`.

---

### Task 1: `job_questions` table + migration + document `kind='prepare'`

**Files:**
- Modify: `schema.sql` (add table, RLS policy, grant; comment on `generation_jobs.kind`)
- Create: `migrations/2026-07-07-job-questions.sql`
- Modify: `tests/test_rls_isolation.py` (add `job_questions` to the grant allowlist)

**Interfaces:**
- Produces: table `job_questions (job_id TEXT PK → jobs ON DELETE CASCADE, questions jsonb NOT NULL, fetched_at timestamptz)`, readable by `authenticated`/`anon` via `shared_read`, writable only by the service/poller role.

- [ ] **Step 1: Add the table + index to `schema.sql`**

Insert after the `jobs` table block (after `schema.sql:46`):

```sql
-- Per-job application question schema, fetched once at poll time (Greenhouse only
-- today). GLOBAL/shared job data — no user_id; keyed by jobs.id. Populated by the
-- poller; the dashboard reads it job-level (shared_read) and the Prefill route uses
-- it to draft answers + decide whether the posting asks for a cover letter.
CREATE TABLE job_questions (
  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Add RLS policy + grant (mirror the `jobs`/`companies` shared-read block)**

In the RLS section of `schema.sql` (near `schema.sql:567` where `shared_read` on `jobs`/`companies` lives), add:

```sql
ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY shared_read ON job_questions FOR SELECT TO anon, authenticated USING (true);
```

And with the grants (near `schema.sql:595`):

```sql
GRANT SELECT ON job_questions TO anon, authenticated;
```

(No INSERT/UPDATE/DELETE grant to `anon`/`authenticated` — writes are poller/service-role only.)

**Also update the grant-allowlist guard** — `tests/test_rls_isolation.py::test_grant_contract_matches_the_allowlist` asserts every public table's grants equal `EXPECTED_GRANTS` exactly (an unlisted table must have NO grants), so without this the whole poller suite goes red from Task 1 on. Add to the `EXPECTED_GRANTS` dict (matching the existing `_R(...)` helper + the `jobs`/`companies` entries' shape — confirm the exact tuple form in that file first):

```python
    "job_questions": (_R({"SELECT"}), _R({"SELECT"})),  # shared_read: anon + authenticated SELECT
```

- [ ] **Step 3: Document keeping `kind='prepare'` at the constraint**

Edit `schema.sql:423` — add a comment directly above the `generation_jobs.kind` CHECK line:

```sql
  -- kind='prepare' backs the Greenhouse "Prefill application" action (user-facing
  -- label is "Prefill"; the internal identifier stays 'prepare' to avoid a
  -- kind-constraint migration + dual-value transition). See the /api/application/prepare route.
  kind       TEXT NOT NULL CHECK (kind IN ('resume','cover','prepare')),
```

- [ ] **Step 4: Create the migration file**

`migrations/2026-07-07-job-questions.sql` — wrap in `BEGIN;…COMMIT;` and record it in the `schema_migrations` ledger, matching `migrations/2026-07-05-generation-jobs.sql` / `migrations/2026-07-07-cover-letter-edits.sql` (confirm the exact ledger column — `filename` — in one of those files):

```sql
-- Poll-time Greenhouse application-question schema, stored job-level (shared across
-- users). See docs/superpowers/specs/2026-07-07-prefill-application-design.md.
BEGIN;

CREATE TABLE IF NOT EXISTS job_questions (
  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY shared_read ON job_questions FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON job_questions TO anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-07-job-questions.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 5: Verify the schema loads (the Python `conn` fixture rebuilds from `schema.sql`)**

Run: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -c "import tests.conftest"` — no error means the module imports. Full verification happens in Task 3's DB test.

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-07-07-job-questions.sql
git commit -m "feat(prefill): add job_questions table (shared, poll-time Greenhouse Q schema) + document kind='prepare'"
```

---

### Task 2: Python Greenhouse question parser + shared fixture

**Files:**
- Modify: `job_discovery/adapters/greenhouse.py` (add `parse_greenhouse_questions`)
- Create: `tests/fixtures/greenhouse_questions.json` (shared with the dashboard drift-guard test in Task 5)
- Create: `tests/test_greenhouse_questions.py`

**Interfaces:**
- Produces: `parse_greenhouse_questions(data: dict | None) -> dict | None` returning `{"questions": [{"label": str, "required": bool, "fields": [{"name": str, "type": str, "options": [{"value": str, "label": str}]}]}]}` or `None`. Must match `dashboard/lib/rolefit/greenhouseQuestions.ts::parseGreenhouseQuestions` edge-for-edge.

- [ ] **Step 1: Create the shared fixture** (the real `?questions=true` shape, seeded from the TS test's inline fixture)

`tests/fixtures/greenhouse_questions.json`:

```json
{
  "questions": [
    {
      "label": "Why do you want to work here?",
      "required": true,
      "fields": [{ "name": "question_0", "type": "textarea", "values": [] }]
    },
    {
      "label": "Are you authorized to work in the US?",
      "required": true,
      "fields": [{
        "name": "question_1",
        "type": "multi_value_single_select",
        "values": [{ "value": 0, "label": "Yes" }, { "value": 1, "label": "No" }]
      }]
    },
    {
      "label": "Cover Letter",
      "required": false,
      "fields": [{ "name": "cover_letter", "type": "input_file", "values": [] }]
    },
    {
      "label": "",
      "required": false,
      "fields": [{ "name": "ignored", "type": "input_text", "values": [] }]
    }
  ]
}
```

- [ ] **Step 2: Write the failing parser test**

`tests/test_greenhouse_questions.py`:

```python
import json
from pathlib import Path

from job_discovery.adapters.greenhouse import parse_greenhouse_questions

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "greenhouse_questions.json").read_text()
)

# The canonical parsed shape — Task 5's TypeScript test asserts this SAME expected
# object against the SAME fixture so the two parsers cannot drift.
EXPECTED = {
    "questions": [
        {"label": "Why do you want to work here?", "required": True,
         "fields": [{"name": "question_0", "type": "textarea", "options": []}]},
        {"label": "Are you authorized to work in the US?", "required": True,
         "fields": [{"name": "question_1", "type": "multi_value_single_select",
                     "options": [{"value": "0", "label": "Yes"},
                                 {"value": "1", "label": "No"}]}]},
        {"label": "Cover Letter", "required": False,
         "fields": [{"name": "cover_letter", "type": "input_file", "options": []}]},
        # the label-less question is dropped
    ]
}


def test_parses_fixture_to_canonical_shape():
    assert parse_greenhouse_questions(FIXTURE) == EXPECTED


def test_non_object_returns_none():
    assert parse_greenhouse_questions(None) is None
    assert parse_greenhouse_questions([]) is None
    assert parse_greenhouse_questions({"questions": "nope"}) is None


def test_numeric_option_values_stringified():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": False,
                        "fields": [{"name": "f", "type": "t",
                                    "values": [{"value": 0, "label": "Zero"}]}]}]}
    )
    assert out["questions"][0]["fields"][0]["options"] == [{"value": "0", "label": "Zero"}]


def test_option_missing_label_dropped_but_empty_value_kept():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": False,
                        "fields": [{"name": "f", "type": "t",
                                    "values": [{"value": "", "label": "Keep"},
                                               {"value": "x", "label": ""}]}]}]}
    )
    assert out["questions"][0]["fields"][0]["options"] == [{"value": "", "label": "Keep"}]


def test_field_dropped_only_when_name_and_type_both_empty():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": True,
                        "fields": [{"name": "", "type": "", "values": []},
                                   {"name": "keep", "type": "", "values": []}]}]}
    )
    assert out["questions"][0]["fields"] == [{"name": "keep", "type": "", "options": []}]
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /Users/andrew/Scripts/job-board && python3 -m pytest tests/test_greenhouse_questions.py -q`
Expected: FAIL — `ImportError: cannot import name 'parse_greenhouse_questions'`.

- [ ] **Step 4: Implement the parser** (append to `job_discovery/adapters/greenhouse.py`)

```python
def _as_string(v) -> str:
    if isinstance(v, str):
        return v
    if isinstance(v, bool) or isinstance(v, (int, float)):
        return str(v)
    return ""


def _parse_options(values) -> list[dict]:
    if not isinstance(values, list):
        return []
    out = []
    for v in values:
        if not isinstance(v, dict):
            continue
        label = _as_string(v.get("label"))
        value = _as_string(v.get("value"))  # Greenhouse encodes option values as numbers
        if label:                            # drop options with no label; keep empty value
            out.append({"value": value, "label": label})
    return out


def _parse_fields(fields) -> list[dict]:
    if not isinstance(fields, list):
        return []
    out = []
    for f in fields:
        if not isinstance(f, dict):
            continue
        name = _as_string(f.get("name"))
        type_ = _as_string(f.get("type"))
        if not name and not type_:           # drop a field only when BOTH are empty
            continue
        out.append({"name": name, "type": type_, "options": _parse_options(f.get("values"))})
    return out


def parse_greenhouse_questions(data) -> dict | None:
    """Mirror of dashboard/lib/rolefit/greenhouseQuestions.ts::parseGreenhouseQuestions.
    Returns {"questions": [...]} or None. Pure and total — keep edge cases identical
    to the TS parser so the two sides of the jsonb boundary can't drift."""
    if not isinstance(data, dict):
        return None
    raw = data.get("questions")
    if not isinstance(raw, list):
        return None
    questions = []
    for q in raw:
        if not isinstance(q, dict):
            continue
        label = _as_string(q.get("label"))
        if not label:                        # skip label-less questions
            continue
        questions.append({
            "label": label,
            "required": q.get("required") is True,
            "fields": _parse_fields(q.get("fields")),
        })
    return {"questions": questions}
```

> **Parity caveat:** `_as_string` can't be byte-identical to the TS `asString` for two JSON types the fixture doesn't exercise — Python `str(True)` → `"True"` vs JS `"true"`, and a JSON `1.0` → Python `"1.0"` vs JS `"1"`. Real Greenhouse option values are integers, so this never bites in practice; leave it, but don't claim byte-parity on bools/floats. (If you want to close it: lowercase bools and render integral floats without the trailing `.0` in `_as_string`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_greenhouse_questions.py -q`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add job_discovery/adapters/greenhouse.py tests/test_greenhouse_questions.py tests/fixtures/greenhouse_questions.json
git commit -m "feat(prefill): Python Greenhouse question parser + shared fixture (mirrors TS parser)"
```

---

### Task 3: Poller DB helpers — insert questions + find jobs missing them

**Files:**
- Modify: `job_discovery/db.py` (add `insert_job_questions`, `greenhouse_jobs_missing_questions`)
- Create: `tests/test_db_job_questions.py`

**Interfaces:**
- Consumes: the `job_questions` table (Task 1), `parse_greenhouse_questions` (Task 2).
- Produces:
  - `insert_job_questions(conn, job_id: str, questions: dict) -> None` — upsert one row.
  - `greenhouse_jobs_missing_questions(conn, company_id: int) -> list[str]` — external_ids of this company's open jobs with no `job_questions` row.

- [ ] **Step 1: Write the failing DB test**

`tests/test_db_job_questions.py`:

```python
import json

import pytest

from job_discovery import db
from tests.conftest import requires_db  # marker: skips when TEST_DATABASE_URL unset


@requires_db
def test_insert_and_missing_query(conn):
    # Seed a company + two open greenhouse jobs.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','greenhouse','acme') RETURNING id"
        )
        company_id = cur.fetchone()["id"]
        for ext in ("100", "200"):
            cur.execute(
                "INSERT INTO jobs (id, company_id, external_id, title, url) "
                "VALUES (%s, %s, %s, 'Eng', 'https://x')",
                (f"greenhouse:acme:{ext}", company_id, ext),
            )
    conn.commit()

    # Both jobs are missing questions initially.
    assert sorted(db.greenhouse_jobs_missing_questions(conn, company_id)) == ["100", "200"]

    # Insert questions for one; it drops out of the missing set.
    db.insert_job_questions(conn, "greenhouse:acme:100", {"questions": [{"label": "Q", "required": True, "fields": []}]})
    conn.commit()
    assert db.greenhouse_jobs_missing_questions(conn, company_id) == ["200"]

    # Row round-trips as jsonb.
    with conn.cursor() as cur:
        cur.execute("SELECT questions FROM job_questions WHERE job_id = 'greenhouse:acme:100'")
        assert cur.fetchone()["questions"] == {"questions": [{"label": "Q", "required": True, "fields": []}]}


@requires_db
def test_insert_is_idempotent_upsert(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('B','greenhouse','b') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:1', %s, '1', 'E', 'https://x')", (cid,))
    conn.commit()
    db.insert_job_questions(conn, "greenhouse:b:1", {"questions": []})
    db.insert_job_questions(conn, "greenhouse:b:1", {"questions": [{"label": "New", "required": False, "fields": []}]})
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT questions FROM job_questions WHERE job_id = 'greenhouse:b:1'")
        assert cur.fetchone()["questions"] == {"questions": [{"label": "New", "required": False, "fields": []}]}
```

(If `requires_db` is not importable from `tests.conftest`, use `pytestmark = pytest.mark.skipif(...)` mirroring `tests/test_db_jobs.py` — check that file for the exact marker name.)

- [ ] **Step 2: Run it to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_db_job_questions.py -q`
Expected: FAIL — `AttributeError: module 'job_discovery.db' has no attribute 'insert_job_questions'`.

- [ ] **Step 3: Implement the helpers** (append to `job_discovery/db.py`; `import json` is already present — confirm, else add it)

```python
def insert_job_questions(conn, job_id: str, questions: dict) -> None:
    """Upsert one job's question schema (jsonb). psycopg3 needs an explicit json.dumps."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO job_questions (job_id, questions, fetched_at)
            VALUES (%s, %s::jsonb, now())
            ON CONFLICT (job_id) DO UPDATE
              SET questions = EXCLUDED.questions, fetched_at = now()
            """,
            (job_id, json.dumps(questions)),
        )


def greenhouse_jobs_missing_questions(conn, company_id: int) -> list[str]:
    """external_ids of this company's OPEN jobs that have no job_questions row yet —
    the rolling-backfill predicate (covers both new jobs and the existing backlog)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.external_id
            FROM jobs j
            LEFT JOIN job_questions q ON q.job_id = j.id
            WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
            ORDER BY j.external_id
            """,
            (company_id,),
        )
        return [r["external_id"] for r in cur.fetchall()]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_db_job_questions.py -q`
Expected: PASS (2 passed). If `import json` was missing at module top, add it and re-run.

- [ ] **Step 5: Commit**

```bash
git add job_discovery/db.py tests/test_db_job_questions.py
git commit -m "feat(prefill): poller db helpers — insert_job_questions + greenhouse_jobs_missing_questions"
```

---

### Task 4: Poller hook — fetch questions for Greenhouse jobs missing them

**Files:**
- Modify: `job_discovery/run.py` (add the per-company Greenhouse question-fetch hook)
- Create: `tests/test_run_question_fetch.py`

**Interfaces:**
- Consumes: `db.greenhouse_jobs_missing_questions`, `db.insert_job_questions`, `parse_greenhouse_questions`, `get_json`.
- Produces: a `backfill_greenhouse_questions(conn, company_id, token, *, get_json=..., log=...) -> int` helper (count fetched) called inside the per-company loop, so it's unit-testable without the full poll loop.

- [ ] **Step 1: Write the failing test**

`tests/test_run_question_fetch.py`:

```python
from job_discovery import db
from job_discovery.run import backfill_greenhouse_questions
from tests.conftest import requires_db


@requires_db
def test_backfill_fetches_only_missing_and_persists(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('Acme','greenhouse','acme') RETURNING id")
        cid = cur.fetchone()["id"]
        for ext in ("1", "2"):
            cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES (%s,%s,%s,'E','https://x')",
                        (f"greenhouse:acme:{ext}", cid, ext))
    conn.commit()

    calls = []

    def fake_get_json(url):
        calls.append(url)
        return {"questions": [{"label": "Why us?", "required": True, "fields": []}]}

    n = backfill_greenhouse_questions(conn, cid, "acme", get_json=fake_get_json)
    conn.commit()

    assert n == 2
    assert calls == [
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/1?questions=true",
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/2?questions=true",
    ]
    assert db.greenhouse_jobs_missing_questions(conn, cid) == []


@requires_db
def test_backfill_swallows_fetch_errors_without_aborting(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('B','greenhouse','b') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:1',%s,'1','E','https://x')", (cid,))
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:2',%s,'2','E','https://x')", (cid,))
    conn.commit()

    def flaky_get_json(url):
        if url.endswith("1?questions=true"):
            raise RuntimeError("boom")
        return {"questions": [{"label": "Q", "required": False, "fields": []}]}

    n = backfill_greenhouse_questions(conn, cid, "b", get_json=flaky_get_json)
    conn.commit()
    assert n == 1  # job 1 failed, job 2 persisted; no exception raised
    assert db.greenhouse_jobs_missing_questions(conn, cid) == ["1"]


@requires_db
def test_backfill_skips_persist_when_no_usable_questions(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('C','greenhouse','c') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:c:1',%s,'1','E','https://x')", (cid,))
    conn.commit()
    n = backfill_greenhouse_questions(conn, cid, "c", get_json=lambda url: {"no_questions_key": True})
    conn.commit()
    assert n == 0
    assert db.greenhouse_jobs_missing_questions(conn, cid) == ["1"]  # nothing persisted
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_run_question_fetch.py -q`
Expected: FAIL — `ImportError: cannot import name 'backfill_greenhouse_questions'`.

- [ ] **Step 3: Implement the helper in `job_discovery/run.py`**

Add near the top (after imports); reuse the module's existing `log` and `get_json`. Add `from job_discovery.adapters.greenhouse import parse_greenhouse_questions` and (if not already imported) `from job_discovery.http import get_json as _get_json`:

```python
def backfill_greenhouse_questions(conn, company_id, token, *, get_json=None, log=log) -> int:
    """Fetch + persist the question schema for this Greenhouse company's open jobs that
    lack a job_questions row (rolling backfill). One HTTP call per missing job, each
    wrapped so a single failure never aborts the company. Returns the count persisted."""
    get_json = get_json or _get_json
    fetched = 0
    for external_id in db.greenhouse_jobs_missing_questions(conn, company_id):
        url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{external_id}?questions=true"
        # ONLY the HTTP fetch + pure parse are swallowed. A DB write error must NOT be
        # caught here — a failed statement aborts the transaction, and continuing to
        # issue statements (all silently caught) then `conn.commit()` at run.py:106 would
        # commit an aborted tx (→ rollback), discarding the company's whole upsert_jobs
        # work with no error. Let db errors propagate to the per-company handler, which
        # rolls back correctly (mirrors smartrecruiters/workday: HTTP-only try/except).
        try:
            questions = parse_greenhouse_questions(get_json(url))
        except Exception as e:  # noqa: BLE001 — fetch/parse only; never abort the company
            log.warning("greenhouse question fetch failed for %s:%s (%s)", token, external_id, e)
            continue
        if questions and questions["questions"]:
            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", questions)
            fetched += 1
    return fetched
```

- [ ] **Step 4: Wire it into the per-company loop**

In `run.py`, inside the per-company `try` block, after the final `db.upsert_jobs(...)` / `open_ids` handling and BEFORE `conn.commit()` (around `run.py:93-106`), add:

```python
        if ats == "greenhouse":
            backfill_greenhouse_questions(conn, company_id, token)
```

- [ ] **Step 5: Run the new tests + the full poller suite**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_run_question_fetch.py -q && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/ -q`
Expected: new tests PASS (3 passed); full suite green.

- [ ] **Step 6: Commit**

```bash
git add job_discovery/run.py tests/test_run_question_fetch.py
git commit -m "feat(prefill): poller backfills Greenhouse question schemas for jobs missing them"
```

---

### Task 5: TypeScript parser drift-guard against the shared fixture

**Files:**
- Modify: `dashboard/lib/rolefit/greenhouseQuestions.test.ts` (add a test that reads the shared Python fixture)

**Interfaces:**
- Consumes: `tests/fixtures/greenhouse_questions.json` (Task 2), `parseGreenhouseQuestions`.

- [ ] **Step 1: Add the failing cross-language parity test**

Append to `dashboard/lib/rolefit/greenhouseQuestions.test.ts`. **Do NOT re-import `parseGreenhouseQuestions`** — the file already imports it at the top; add only the two Node imports (a duplicate import is a parse error that fails the whole file):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Drift guard: the SAME fixture the Python parser test asserts (tests/fixtures/
// greenhouse_questions.json) must parse to the SAME canonical shape here. If the two
// parsers diverge, one of these tests breaks. Path reaches out of dashboard/ to the repo root.
const SHARED_FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "../../../tests/fixtures/greenhouse_questions.json"), "utf8"),
);

describe("parseGreenhouseQuestions — shared fixture parity", () => {
  test("parses the shared Python fixture to the canonical shape", () => {
    expect(parseGreenhouseQuestions(SHARED_FIXTURE)).toEqual({
      questions: [
        { label: "Why do you want to work here?", required: true,
          fields: [{ name: "question_0", type: "textarea", options: [] }] },
        { label: "Are you authorized to work in the US?", required: true,
          fields: [{ name: "question_1", type: "multi_value_single_select",
                     options: [{ value: "0", label: "Yes" }, { value: "1", label: "No" }] }] },
        { label: "Cover Letter", required: false,
          fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
      ],
    });
  });
});
```

- [ ] **Step 2: Run it to verify it passes** (the TS parser already exists — this locks it to the shared fixture)

Run: `cd dashboard && npx vitest run lib/rolefit/greenhouseQuestions.test.ts`
Expected: PASS. If it FAILS, the fixture or a parser genuinely disagrees — reconcile before continuing (that is the guard working).

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/rolefit/greenhouseQuestions.test.ts
git commit -m "test(prefill): cross-language drift guard — TS parser vs shared Python fixture"
```

---

### Task 6: Cover-letter question detection helper (TS)

**Files:**
- Create: `dashboard/lib/rolefit/coverLetterQuestion.ts`
- Create: `dashboard/lib/rolefit/coverLetterQuestion.test.ts`

**Interfaces:**
- Consumes: `GreenhouseQuestions`, `GreenhouseQuestion` from `./greenhouseQuestions`.
- Produces:
  - `hasCoverLetterQuestion(gh: GreenhouseQuestions | null): boolean`
  - `stripCoverLetterQuestions(gh: GreenhouseQuestions | null): GreenhouseQuestions` — the schema minus cover-letter questions (for `toPrefillQuestions`).

- [ ] **Step 1: Write the failing test**

`dashboard/lib/rolefit/coverLetterQuestion.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "./coverLetterQuestion";
import type { GreenhouseQuestions } from "./greenhouseQuestions";

const q = (label: string, name: string): GreenhouseQuestions["questions"][number] => ({
  label, required: false, fields: [{ name, type: "input_file", options: [] }],
});

describe("hasCoverLetterQuestion", () => {
  test("true when a field name is cover_letter", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Attach a letter", "cover_letter")] })).toBe(true);
  });
  test("true when a label matches /cover letter/i (spacing/casing tolerant)", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Cover Letter", "custom_1")] })).toBe(true);
    expect(hasCoverLetterQuestion({ questions: [q("Your coverletter", "custom_2")] })).toBe(true);
  });
  test("false for essay prompts (not cover letters)", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Why do you want to work here?", "question_0")] })).toBe(false);
  });
  test("false for null / empty", () => {
    expect(hasCoverLetterQuestion(null)).toBe(false);
    expect(hasCoverLetterQuestion({ questions: [] })).toBe(false);
  });
});

describe("stripCoverLetterQuestions", () => {
  test("removes only the cover-letter question, keeps the rest", () => {
    const gh: GreenhouseQuestions = {
      questions: [q("Why us?", "question_0"), q("Cover Letter", "cover_letter")],
    };
    expect(stripCoverLetterQuestions(gh)).toEqual({ questions: [q("Why us?", "question_0")] });
  });
  test("null → empty questions", () => {
    expect(stripCoverLetterQuestions(null)).toEqual({ questions: [] });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/coverLetterQuestion.test.ts`
Expected: FAIL — cannot find module `./coverLetterQuestion`.

- [ ] **Step 3: Implement the helper**

`dashboard/lib/rolefit/coverLetterQuestion.ts`:

```ts
import type { GreenhouseQuestions, GreenhouseQuestion } from "@/lib/rolefit/greenhouseQuestions";

// A cover-letter ask, narrowly: Greenhouse's canonical `cover_letter` field name, or a
// label explicitly saying "cover letter". Deliberately does NOT match free-form essay
// prompts — those are answered by the generic prefill, which addresses the specific
// question; the cover pipeline writes a role-level letter that would ignore the prompt.
const COVER_LETTER_LABEL = /cover\s*letter/i;

export function isCoverLetterQuestion(q: GreenhouseQuestion): boolean {
  if (COVER_LETTER_LABEL.test(q.label)) return true;
  return q.fields.some((f) => f.name === "cover_letter");
}

/** True when the posting asks for a cover letter (present — required OR optional). */
export function hasCoverLetterQuestion(gh: GreenhouseQuestions | null): boolean {
  return !!gh && gh.questions.some(isCoverLetterQuestion);
}

/** The schema minus cover-letter questions, so the generic prefill never double-answers one. */
export function stripCoverLetterQuestions(gh: GreenhouseQuestions | null): GreenhouseQuestions {
  if (!gh) return { questions: [] };
  return { questions: gh.questions.filter((q) => !isCoverLetterQuestion(q)) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/rolefit/coverLetterQuestion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/coverLetterQuestion.ts dashboard/lib/rolefit/coverLetterQuestion.test.ts
git commit -m "feat(prefill): narrow cover-letter question detection helper"
```

---

### Task 7: Job-level questions read in `queries.ts`

**Files:**
- Modify: `dashboard/lib/queries.ts` (add `getJobQuestion` + `getJobQuestions`)
- Create: `dashboard/lib/queries.jobQuestions.test.ts`

**Interfaces:**
- Consumes: `withUserSql`, `parseGreenhouseQuestionsJsonb` (already imported/used in `queries.ts`).
- Produces:
  - `getJobQuestion(userId: string, jobId: string): Promise<GreenhouseQuestions | null>`
  - `getJobQuestions(userId: string, jobIds: string[]): Promise<Record<string, GreenhouseQuestions>>`

- [ ] **Step 1: Write the failing test** (mock the db executor, mirroring `queries.applicationPackages.test.ts`)

`dashboard/lib/queries.jobQuestions.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

// getJobQuestions runs a tagged-template query on the tx; stub withUserSql to hand the
// callback a tx() that returns our fake rows regardless of the SQL. (Mirrors
// queries.applicationPackages.test.ts, which stubs @/lib/db so module load succeeds.)
const rowsRef: { rows: unknown[] } = { rows: [] };
vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
  withAnonSql: (fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
}));

import { getJobQuestion, getJobQuestions } from "@/lib/queries";

const GH = { questions: [{ label: "Why us?", required: true, fields: [] }] };

describe("getJobQuestion / getJobQuestions", () => {
  test("parses a stored questions jsonb row", async () => {
    rowsRef.rows = [{ job_id: "greenhouse:acme:1", questions: GH }];
    expect(await getJobQuestion("u", "greenhouse:acme:1")).toEqual(GH);
  });

  test("returns null when no row", async () => {
    rowsRef.rows = [];
    expect(await getJobQuestion("u", "missing")).toBeNull();
  });

  test("getJobQuestions keys parsed rows by job_id and skips malformed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rowsRef.rows = [
      { job_id: "greenhouse:acme:1", questions: GH },
      { job_id: "greenhouse:acme:2", questions: "garbage" },
    ];
    const map = await getJobQuestions("u", ["greenhouse:acme:1", "greenhouse:acme:2"]);
    expect(map["greenhouse:acme:1"]).toEqual(GH);
    expect(map["greenhouse:acme:2"]).toBeUndefined(); // malformed dropped
    warn.mockRestore();
  });

  test("getJobQuestions returns {} for an empty id list without querying", async () => {
    rowsRef.rows = [{ job_id: "x", questions: GH }];
    expect(await getJobQuestions("u", [])).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run lib/queries.jobQuestions.test.ts`
Expected: FAIL — `getJobQuestion`/`getJobQuestions` not exported.

- [ ] **Step 3: Implement the reads** (add to `dashboard/lib/queries.ts`; `parseGreenhouseQuestionsJsonb` and `GreenhouseQuestions` are already referenced in this file via `toApplicationPackage`)

```ts
// One job's question schema (job-level shared data — shared_read RLS lets the
// authenticated role SELECT it; no serviceSql needed). Total-parsed, never as-cast.
export async function getJobQuestion(
  userId: string,
  jobId: string,
): Promise<GreenhouseQuestions | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`SELECT questions FROM job_questions WHERE job_id = ${jobId}`;
    if (rows.length === 0) return null;
    return parseGreenhouseQuestionsJsonb((rows[0] as { questions: unknown }).questions);
  });
}

// Question schemas for a set of jobs, keyed by job_id (malformed rows dropped). Used by
// the board loader to surface the questions panel on every Greenhouse job.
export async function getJobQuestions(
  userId: string,
  jobIds: string[],
): Promise<Record<string, GreenhouseQuestions>> {
  if (jobIds.length === 0) return {};
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT job_id, questions FROM job_questions WHERE job_id = ANY(${jobIds})
    `;
    const out: Record<string, GreenhouseQuestions> = {};
    for (const r of rows as unknown as { job_id: string; questions: unknown }[]) {
      const parsed = parseGreenhouseQuestionsJsonb(r.questions);
      if (parsed == null) {
        console.warn(`[job_questions] dropping malformed questions for job ${r.job_id}`);
        continue;
      }
      out[r.job_id] = parsed;
    }
    return out;
  });
}
```

Confirm the import line at the top of `queries.ts` includes `parseGreenhouseQuestionsJsonb` and the `GreenhouseQuestions` type (they are already used by `toApplicationPackage`). If `parseGreenhouseQuestionsJsonb` is imported under a different local name, use that name.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/queries.jobQuestions.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/queries.jobQuestions.test.ts
git commit -m "feat(prefill): job-level getJobQuestion/getJobQuestions reads (shared_read)"
```

---

### Task 8: Detach `answers_snapshot` + `greenhouse_questions` from the application package

**Files:**
- Modify: `dashboard/lib/types.ts` (drop 2 fields from `ApplicationPackage`)
- Modify: `dashboard/lib/queries.ts` (`toApplicationPackage`, `bareMarkerPredicate`, `getApplicationPackage`, `getApplicationPackages`, `upsertApplicationPackage`)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (`handleMarkApplied` literal, `handleUnapply` `hasContent`)
- Modify: `dashboard/components/rolefit/JobDetail.tsx` (temporarily stub the `greenhouseQuestions` source — Task 9 wires the real one)
- Modify: `dashboard/app/api/resume/route.ts`, `dashboard/app/api/cover-letter/route.ts`, `dashboard/app/api/application/prepare/route.ts` (drop the two upsert args — the prepare route's current `run()` still passes them until Task 10 rewrites it)
- Modify tests: `dashboard/lib/queries.applicationPackages.test.ts`, `dashboard/lib/queries.upsertApplicationPackage.test.ts`, `dashboard/lib/queries.test.ts` (drop the removed fields / update the `bareMarkerPredicate` fragment assertion)

**Ordering note:** This task narrows `ApplicationPackage` and the `upsertApplicationPackage` `data` param. TypeScript excess-property checking then flags every *object literal* still passing the removed keys — that includes `JobDetail.tsx:650` (reads `pkg?.greenhouseQuestions`, stubbed in Step 3) AND the prepare route's own `upsertApplicationPackage({ …, answersSnapshot, greenhouseQuestions, … })` call (`prepare/route.ts:205-217`), which Task 10 doesn't rewrite until later. Step 4 below deletes those two keys from the prepare route now (compatible with Task 10's full rewrite) so `tsc` stays green.

**Interfaces:**
- Produces: `ApplicationPackage` without `answersSnapshot` / `greenhouseQuestions`; `upsertApplicationPackage` `data` param without those two keys.

- [ ] **Step 1: Update the type** — `dashboard/lib/types.ts:197-220`, remove two lines:

```ts
  // DELETE these two lines from ApplicationPackage:
  answersSnapshot: ApplicationAnswers | null;
  greenhouseQuestions: GreenhouseQuestions | null;
```

Remove the now-unused `GreenhouseQuestions`/`ApplicationAnswers` imports from `types.ts:3-4` **only if** nothing else in the file uses them (grep first; `ApplicationAnswers` is likely still used elsewhere).

- [ ] **Step 2: Update `queries.ts`**

`toApplicationPackage` (`:389-390`) — delete the `answersSnapshot` and `greenhouseQuestions` lines.

`bareMarkerPredicate` (`:409-414`) — drop the two vestigial columns (they are always NULL now; keeping them is harmless but misleading). New body:

```ts
export function bareMarkerPredicate(tx: Sql | TransactionSql) {
  return tx`
    resume_json IS NULL AND cover_letter_json IS NULL
      AND prefilled_answers IS NULL AND apply_url IS NULL
  `;
}
```

`getApplicationPackage` (`:425-426`) and `getApplicationPackages` (`:446-447`) — remove `ap.answers_snapshot,` and `ap.greenhouse_questions,` from both SELECT lists.

`upsertApplicationPackage` (`:470-548`) — remove `answersSnapshot` and `greenhouseQuestions` from the `data` param type (`:476-477`), from the INSERT column list + VALUES (`:501-508`), from the ON CONFLICT SET (`:515-516`), **and from the `RETURNING` list (`:542-543`)** (kept consistent with the SELECTs; `toApplicationPackage` no longer reads them anyway). The `answers_snapshot` / `greenhouse_questions` columns remain in the table, defaulting to NULL on new inserts and preserved-as-is on conflict.

**Behavior note (intended):** with `bareMarkerPredicate` no longer testing those two columns, a legacy prod package whose *only* content is `answers_snapshot`/`greenhouse_questions` (both always written by today's prepare) now counts as a "bare marker" that un-apply deletes rather than reverts to `prepared`. This is desired — both fields are vestigial — but call it out in the commit message.

- [ ] **Step 3: Update `RolefitBoard.tsx`**

`handleMarkApplied` optimistic literal (`:1044-1059`) — delete the `answersSnapshot: null,` and `greenhouseQuestions: null,` lines.

`handleUnapply` `hasContent` (`:1086-1089`) — drop both fields from the OR-chain:

```tsx
    const hasContent = Boolean(
      prior && (prior.resume || prior.coverLetter || prior.prefilledAnswers),
    );
```

Also stub `JobDetail.tsx:650` so the type-check survives the field removal (Task 9 finalizes it): change `greenhouseQuestions={pkg?.greenhouseQuestions ?? null}` → `greenhouseQuestions={null}`.

- [ ] **Step 4: Update the three routes' upsert calls**

`app/api/resume/route.ts:104-111` — in the `upsertApplicationPackage` call, delete `answersSnapshot: null,` and `greenhouseQuestions: null,`.
`app/api/cover-letter/route.ts:103-115` — same deletion.
`app/api/application/prepare/route.ts:205-217` — delete `answersSnapshot: answers,` and `greenhouseQuestions: gh.greenhouseQuestions,` from the `upsertApplicationPackage` call. (Task 10 rewrites this route's `run()` wholesale; this keeps `tsc` green in the meantime. Leave the rest of the current route untouched.)

- [ ] **Step 5: Update the affected unit tests**

In `dashboard/lib/queries.applicationPackages.test.ts`, remove `answers_snapshot: null,` and `greenhouse_questions: null,` from `baseRow` (`:30-31`) and drop any assertion on `pkg.answersSnapshot`/`pkg.greenhouseQuestions`.
In `dashboard/lib/queries.upsertApplicationPackage.test.ts`, remove `answersSnapshot`/`greenhouseQuestions` from the `data` object(s) and the asserted column set (`:24`, `:55`, `:67`, `:82`, `:109`).
In `dashboard/lib/queries.test.ts` (`:27-34`), the `bareMarkerPredicate` test asserts the fragment text contains `greenhouse_questions is null` / `answers_snapshot is null`; update those expectations to the new 4-column fragment (`resume_json`, `cover_letter_json`, `prefilled_answers`, `apply_url`).

- [ ] **Step 6: Run the full dashboard type-check + affected tests**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run lib/queries.applicationPackages.test.ts lib/queries.upsertApplicationPackage.test.ts lib/queries.test.ts app/api/resume/route.test.ts app/api/cover-letter/route.test.ts`
Expected: `tsc` clean (it flags any missed reference to the removed fields — fix each), tests PASS. If a résumé/cover route test asserts the old upsert payload (with `answersSnapshot`/`greenhouseQuestions`), update that assertion. If `tsc` flags `RolefitBoard.test.tsx` or others referencing the removed fields, remove those references too.

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/app/api/resume/route.ts dashboard/app/api/cover-letter/route.ts dashboard/app/api/application/prepare/route.ts dashboard/lib/queries.applicationPackages.test.ts dashboard/lib/queries.upsertApplicationPackage.test.ts dashboard/lib/queries.test.ts
git commit -m "refactor(prefill): detach answers_snapshot + greenhouse_questions from application package (columns now vestigial; legacy bare-marker rows now deletable on un-apply)"
```

---

### Task 9: Thread job-level questions page → board → panel

**Files:**
- Modify: `dashboard/app/page.tsx` (load `getJobQuestions`, pass to board)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (accept `initialJobQuestions`, pass to `JobDetail`)
- Modify: `dashboard/components/rolefit/JobDetail.tsx` (accept `greenhouseQuestions`, pass to panel)
- Modify test: `dashboard/components/rolefit/RolefitBoard.test.tsx` (supply the new prop)

**Interfaces:**
- Consumes: `getJobQuestions` (Task 7), `ApplicationPanel` `greenhouseQuestions` prop (unchanged).
- Produces: `RolefitBoardProps.initialJobQuestions: Record<string, GreenhouseQuestions>`.

- [ ] **Step 1: Load questions in the server loader**

In `dashboard/app/page.tsx`, after the authed `Promise.all` resolves `jobs` (`:44-59`), add:

```tsx
const jobQuestions = await getJobQuestions(viewerId, jobs.map((j) => j.id));
```

Add `getJobQuestions` to the existing `@/lib/queries` import. Pass it to the board (`:70-89`):

```tsx
  initialJobQuestions={jobQuestions}
```

In the anon branch (`:94-116`), pass `initialJobQuestions={{}}`.

- [ ] **Step 2: Accept + forward the prop in `RolefitBoard.tsx`**

Add to `RolefitBoardProps`: `initialJobQuestions: Record<string, import("@/lib/rolefit/greenhouseQuestions").GreenhouseQuestions>;` (or add a top-of-file import and use the bare type). Destructure `initialJobQuestions` in the component signature. It's static server data — no state needed. Where `<JobDetail ... />` is rendered (`:1255-1291`), add:

```tsx
  greenhouseQuestions={initialJobQuestions[selectedJobWithDetail.id] ?? null}
```

- [ ] **Step 3: Accept + forward the prop in `JobDetail.tsx`**

Add `greenhouseQuestions: GreenhouseQuestions | null` to `JobDetailProps` (import the type from `@/lib/rolefit/greenhouseQuestions`), destructure it (`:136` area), and replace the temporary Task 8 stub at the `<ApplicationPanel>` prop wiring (`JobDetail.tsx:650`) — change:

```tsx
            greenhouseQuestions={null}
```

to:

```tsx
            greenhouseQuestions={greenhouseQuestions}
```

(`prefilledAnswers={pkg?.prefilledAnswers ?? null}` at `:651` stays — answers remain per-user on the package.)

- [ ] **Step 4: Fix the board test prop**

In `dashboard/components/rolefit/RolefitBoard.test.tsx`, add `initialJobQuestions: {}` to the `baseProps` literal (`:43-59`).

- [ ] **Step 5: Type-check + run board tests**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run components/rolefit/RolefitBoard.test.tsx`
Expected: clean + PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/page.tsx dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/RolefitBoard.test.tsx
git commit -m "feat(prefill): load Greenhouse questions job-level and thread to the application panel"
```

---

### Task 10: Repurpose the route into "Prefill application"

**Files:**
- Modify: `dashboard/app/api/application/prepare/route.ts` (Greenhouse-only guard; read job_questions + on-demand fallback; conditional cover charging; sequential résumé → prefill from generated résumé; conditional cover leg; drop answers_snapshot/greenhouse_questions writes)
- Modify: `dashboard/app/api/application/prepare/route.test.ts` (update for the new contract) — if absent, create it from the `app/api/resume/route.test.ts` template.

**Interfaces:**
- Consumes: `getJobForPackage` (returns `ats`, `company_token`, `external_id`, `description`, `url`, `about`, `requirements`, `skill_gaps`, `red_flags`), `getJobQuestion` (Task 7), `hasCoverLetterQuestion`/`stripCoverLetterQuestions` (Task 6), `toPrefillQuestions`, `generateResume` (`{resume, checks, traceId}`), `composeResumeText`, `generatePrefilledAnswers`, `generateCoverLetter` (`{letter, traceId}`), `fetchGreenhouseQuestions`, `applicationAnswersFromProfile`, `reserveGenerations`/`refundGenerations`, `createGenerationJob`/`settleGenerationJob`, `applyUrl`, `normalizeInstructions`, `getResumeSource`.

- [ ] **Step 1: Write the failing route tests** (mirror `app/api/resume/route.test.ts`; mock the new deps)

Create/replace `dashboard/app/api/application/prepare/route.test.ts`. Include these cases (full harness copied from the resume route test's `vi.hoisted` + `next/server` `after` capture + `flushBackground`; add mocks for `@/lib/rolefit/coverLetterClient`, `@/lib/rolefit/prefillClient`, and `getJobQuestion`/`getJobForPackage` on `@/lib/queries`):

```ts
// Key new-contract assertions (bodies mirror resume/route.test.ts structure):

test("non-Greenhouse job → 400, no charge, no tracking", async () => {
  mocks.getJobForPackage.mockResolvedValue({ ...JOB, ats: "lever" });
  const res = await POST(req({ jobId: "job-1" }));
  expect(res.status).toBe(400);
  expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  expect(mocks.createGenerationJob).not.toHaveBeenCalled();
});

test("Greenhouse without a cover-letter question → reserves ['resume'] only", async () => {
  mocks.getJobQuestion.mockResolvedValue({ questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }] });
  const res = await POST(req({ jobId: "job-1" }));
  expect(res.status).toBe(202);
  expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
});

test("Greenhouse WITH a cover-letter question → reserves ['resume','cover']", async () => {
  mocks.getJobQuestion.mockResolvedValue({ questions: [{ label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] }] });
  const res = await POST(req({ jobId: "job-1" }));
  expect(res.status).toBe(202);
  expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume", "cover"]);
});

test("prefill is fed the GENERATED résumé text, not the profile text", async () => {
  mocks.getJobQuestion.mockResolvedValue({ questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }] });
  mocks.generateResume.mockResolvedValue({ resume: RESUME, checks: {}, traceId: "rt" });
  await POST(req({ jobId: "job-1" }));
  await flushBackground();
  const prefillArg = mocks.generatePrefilledAnswers.mock.calls[0][0];
  expect(prefillArg.resumeText).toBe(composeResumeText(RESUME)); // NOT profile.resume_text
});

test("résumé failure → prefill skipped, résumé refunded, cover leg still persists", async () => {
  mocks.getJobQuestion.mockResolvedValue({ questions: [{ label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] }] });
  mocks.generateResume.mockRejectedValue(new Error("502"));
  mocks.generateCoverLetter.mockResolvedValue({ letter: COVER, traceId: "ct" });
  await POST(req({ jobId: "job-1" }));
  await flushBackground();
  expect(mocks.generatePrefilledAnswers).not.toHaveBeenCalled();
  expect(mocks.refundGenerations).toHaveBeenCalledWith(USER, ["resume"]);
  const upserted = mocks.upsertApplicationPackage.mock.calls.at(-1)![2];
  expect(upserted.resume).toBeNull();
  expect(upserted.coverLetter).toEqual(COVER);
});

test("on-demand fetch fallback when no stored job_questions row", async () => {
  mocks.getJobQuestion.mockResolvedValue(null);
  mocks.fetchGreenhouseQuestions.mockResolvedValue({ questions: [{ label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] }] });
  const res = await POST(req({ jobId: "job-1" }));
  expect(res.status).toBe(202);
  expect(mocks.fetchGreenhouseQuestions).toHaveBeenCalled();
});

test("upsert never writes answersSnapshot/greenhouseQuestions", async () => {
  mocks.getJobQuestion.mockResolvedValue({ questions: [] });
  await POST(req({ jobId: "job-1" }));
  await flushBackground();
  const upserted = mocks.upsertApplicationPackage.mock.calls.at(-1)![2];
  expect(upserted).not.toHaveProperty("answersSnapshot");
  expect(upserted).not.toHaveProperty("greenhouseQuestions");
});
```

Provide `JOB` (with `ats: "greenhouse"`, `company_token`, `external_id`, etc.), `RESUME`, `COVER` fixtures and import `composeResumeText` (do NOT mock it — it's pure).

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run app/api/application/prepare/route.test.ts`
Expected: FAIL (route still has the old contract).

- [ ] **Step 3: Rewrite the synchronous prologue** in `route.ts`

Replace the profile/job load + gate block so it: loads `getJobForPackage`, **guards `job.ats !== "greenhouse"` → 400**, loads the question schema (stored, else on-demand), computes `hasCover`, and reserves conditionally:

```ts
  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForPackage(jobId, userId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });
  if (job.ats !== "greenhouse") {
    return Response.json({ error: "Prefill is available for Greenhouse postings only" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "application preparation not configured" }, { status: 500 });

  // Poll-time question schema (shared). Fall back to an on-demand fetch for a brand-new
  // job not yet backfilled — used in-memory only; the poller persists it later.
  let questions = await getJobQuestion(userId, jobId);
  if (questions == null) {
    questions = await fetchGreenhouseQuestions({ token: job.company_token, externalId: job.external_id });
  }
  const wantsCover = hasCoverLetterQuestion(questions);

  // Always charge résumé; charge cover ONLY when the posting asks for one.
  const kinds: GenerationKind[] = wantsCover ? ["resume", "cover"] : ["resume"];
  const gate = await reserveGenerations(userId, claims.email, kinds);
  if (!gate.ok) return Response.json(gateRejectionBody(gate), { status: gate.status });
```

Keep the `createGenerationJob(userId, jobId, "prepare")` tracking block exactly as today, BUT on the duplicate/failure refund paths change `["resume", "cover"]` to the `kinds` computed above (so a résumé-only prefill refunds only résumé).

- [ ] **Step 4: Rewrite the `run()` background legs**

Replace the `greenhousePrefill` closure and the `Promise.allSettled` legs with sequential résumé→prefill + a conditional cover leg:

```ts
  const answers = applicationAnswersFromProfile(profile);
  const { resumeText } = getResumeSource(profile);
  const prefillQuestions = toPrefillQuestions(stripCoverLetterQuestions(questions));

  const run = async () => {
    let resumeTraceId: string | null = null;
    let coverLetterTraceId: string | null = null;

    // Résumé leg → prefill chained on the GENERATED résumé. A résumé failure rejects the
    // whole leg (prefill skipped, retried together). A prefill failure is swallowed
    // (best-effort) so the résumé still persists.
    const resumeLeg = (async (): Promise<{ resume: TailoredResume; prefilled: PrefilledAnswer[] | null }> => {
      const { resume, traceId } = await generateResume({
        resumeText,
        instructions: resumeInstructions,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
      });
      resumeTraceId = traceId;
      let prefilled: PrefilledAnswer[] | null = null;
      if (prefillQuestions.length > 0) {
        try {
          prefilled = await generatePrefilledAnswers({
            resumeText: composeResumeText(resume), // the tailored résumé, not profile text
            instructions: null,                    // prefill is instruction-less (spec)
            answers,
            job: { title: job.title, company: job.company_name, description: job.description },
            questions: prefillQuestions,
            model: DEFAULT_PREFILL_MODEL,
            apiKey,
          });
        } catch (e) {
          console.error("greenhouse prefill failed", e); // best-effort: keep the résumé
        }
      }
      return { resume, prefilled };
    })();

    // Cover leg — only when the posting asks. Independent of the résumé (uses profile text).
    const coverLeg = wantsCover
      ? (async (): Promise<TailoredCoverLetter> => {
          const { letter, traceId } = await generateCoverLetter({
            resumeText,
            candidateName: profile.full_name ?? null,
            instructions: coverLetterInstructions,
            job: {
              title: job.title, company: job.company_name, description: job.description,
              about: job.about, requirements: job.requirements,
              skillGaps: job.skill_gaps, redFlags: job.red_flags,
            },
            model: profile.model_cover ?? DEFAULT_COVER_MODEL,
            apiKey,
          });
          coverLetterTraceId = traceId;
          return letter;
        })()
      : Promise.reject(new Error("no cover requested")); // sentinel; not counted as a failure

    const [resumeResult, coverResult] = await Promise.allSettled([resumeLeg, coverLeg]);

    const resume = resumeResult.status === "fulfilled" ? resumeResult.value.resume : null;
    const prefilledAnswers = resumeResult.status === "fulfilled" ? resumeResult.value.prefilled : null;
    const coverLetter = coverResult.status === "fulfilled" ? coverResult.value : null;

    if (resumeResult.status === "rejected") console.error("resume generation failed", resumeResult.reason);
    if (wantsCover && coverResult.status === "rejected") console.error("cover letter generation failed", coverResult.reason);

    await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
      resumeTraceId,
      coverLetterTraceId,
      resumeInstructions,
      coverLetterInstructions,
      profileVersion: profile.profile_version,
    });

    // Refund charged legs that failed. Cover is only charged (and only "failed") when wanted.
    const refundKinds: GenerationKind[] = [
      ...(resumeResult.status === "rejected" ? (["resume"] as const) : []),
      ...(wantsCover && coverResult.status === "rejected" ? (["cover"] as const) : []),
    ];
    if (refundKinds.length) await refundGenerations(userId, refundKinds);

    // Settle: failed only when nothing new persisted; partial note when one wanted leg failed.
    const resumeFailed = resumeResult.status === "rejected";
    const coverFailed = wantsCover && coverResult.status === "rejected";
    if (resumeFailed && (coverFailed || !wantsCover)) {
      await settle({ status: "failed", error: "Generation failed — try again." });
    } else {
      const note = resumeFailed
        ? "Couldn’t generate the résumé — you can retry it from the job pane."
        : coverFailed
          ? "Couldn’t generate the cover letter — you can retry it from the job pane."
          : null;
      await settle({ status: "ready", error: note });
    }
  };
```

Update imports at the top of `route.ts`: add `getJobQuestion` from `@/lib/queries`; `hasCoverLetterQuestion`, `stripCoverLetterQuestions` from `@/lib/rolefit/coverLetterQuestion`; `composeResumeText` from `@/lib/rolefit/resumeText`; `PrefilledAnswer` type from `@/lib/rolefit/prefillSchema`. Remove now-unused `GreenhouseQuestions` import if the `greenhousePrefill` closure is gone. Keep `fetchGreenhouseQuestions`.

Update the outer `after()` catch's refund from `["resume", "cover"]` to the computed `kinds`.

Add a comment at the top of the route: `// User-facing label is "Prefill application"; kind stays 'prepare' (see schema.sql).`

**Update the `maxDuration` comment (`route.ts:22-25`).** Its budget analysis assumed the legs *overlap* (slowest leg ≈ 242s bounds the run). Prefill now runs **after** the résumé, so the worst case is résumé + prefill serially (≈ 2× the single-leg budget), which can exceed the 300s Vercel-Pro ceiling and get killed mid-`after()` — leaving the row `pending` with the reserved kinds un-refunded (the staleness sweep fails the row but does not refund). Rewrite the comment to state the sequential reality, and bound the prefill leg by passing a shorter per-attempt budget (prefill is best-effort and its failure is already swallowed, so a tight cap is safe). If the prefill client doesn't expose a timeout/retry knob, note that the résumé leg dominates and typical (p50) runs are ~60s; treat a hard bound as a follow-up if the client can't be capped here.

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `cd dashboard && npx vitest run app/api/application/prepare/route.test.ts && npx tsc --noEmit`
Expected: PASS + clean type-check.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/api/application/prepare/route.ts dashboard/app/api/application/prepare/route.test.ts
git commit -m "feat(prefill): route generates résumé + prefill (from generated résumé) + posting-driven cover letter"
```

---

### Task 11: UI — Greenhouse-only "Prefill" button, collapsible questions panel, copy

**Files:**
- Modify: `dashboard/components/rolefit/ApplicationPanel.tsx` (button label + Greenhouse-only gate; collapsible questions panel; subtitle copy)
- Modify: `dashboard/lib/generationNotifications.ts` (prepare toast copy → prefill wording)
- Modify test: `dashboard/components/rolefit/ApplicationPanel.test.tsx`
- Modify test: `dashboard/lib/generationNotifications.test.ts` (if it asserts the prepare titles — grep first)

**Interfaces:**
- Consumes: `job.ats`, `greenhouseQuestions`, `prefilledAnswers`, `onPrepare` (all existing props).

- [ ] **Step 1: Write failing panel tests**

Add to `dashboard/components/rolefit/ApplicationPanel.test.tsx`. Import `fireEvent` (add it to the existing `@testing-library/react` import: `import { cleanup, fireEvent, render, screen } from "@testing-library/react";`).

```ts
test("Greenhouse job shows a 'Prefill application' button", () => {
  renderPanel({ job: makeJob({ ats: "greenhouse" }) });
  expect(screen.getByRole("button", { name: /Prefill application/ })).toBeTruthy();
});

test("non-Greenhouse job hides the prefill button (résumé/cover panels remain)", () => {
  renderPanel({ job: makeJob({ ats: "lever" }) });
  expect(screen.queryByRole("button", { name: /Prefill application/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Prepare application/ })).toBeNull();
  expect(screen.getByRole("button", { name: /Generate cover letter/ })).toBeTruthy();
});

test("Greenhouse questions render collapsed by default, expand on click", () => {
  renderPanel({
    job: makeJob({ ats: "greenhouse" }),
    greenhouseQuestions: { questions: [
      { label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] },
      { label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
    ] },
    prefilledAnswers: null,
  });
  // The single toggle button carries the summary; its accessible name (concatenated
  // child text) uniquely contains "Application questions". Query it specifically to
  // avoid getByText's multiple-match throw.
  const toggle = screen.getByRole("button", { name: /Application questions/i });
  expect(toggle.textContent).toMatch(/cover letter requested/i); // flag shown while collapsed
  expect(screen.queryByText("Why us?")).toBeNull();               // labels hidden until expanded
  fireEvent.click(toggle);
  expect(screen.getByText("Why us?")).toBeTruthy();
});

test("cover-letter-only posting (file field) still shows the panel + flag", () => {
  renderPanel({
    job: makeJob({ ats: "greenhouse" }),
    greenhouseQuestions: { questions: [
      { label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
    ] },
    prefilledAnswers: null,
  });
  // mergeGreenhouseQuestions drops file fields (ghRows is empty), but the panel must
  // still render so the charged cover-letter leg is signalled (spec transparency).
  const toggle = screen.getByRole("button", { name: /Application questions/i });
  expect(toggle.textContent).toMatch(/cover letter requested/i);
});
```

Confirm the `makeJob` factory accepts `ats` in `overrides` (it does; default is greenhouse — pass `ats: "lever"` with a matching non-greenhouse `url` for the negative case).

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run components/rolefit/ApplicationPanel.test.tsx`
Expected: FAIL — button still reads "Prepare application"; questions panel not collapsible.

- [ ] **Step 3: Gate the button on Greenhouse + relabel** — `ApplicationPanel.tsx:296-308`

Wrap the header `<Button onClick={onPrepare}>` in `isAuthed && job.ats === "greenhouse" && (...)` and change the label:

```tsx
        {isAuthed && job.ats === "greenhouse" && (
          <Button
            variant={applyHref || prepared ? "secondary" : "primary"}
            onClick={onPrepare}
            disabled={preparing || generating}
            style={{ flex: "0 0 auto" }}
          >
            <span style={{ fontSize: "15px" }}>✦</span>
            {preparing ? "Prefilling… ~30s" : prepared ? "Re-prefill" : "Prefill application"}
          </Button>
        )}
```

Update the header subtitle (`:255`) to reflect posting-driven behavior:

```tsx
            Tailored résumé, prefilled answers, and — when this posting asks — a cover letter.
```

- [ ] **Step 4: Make the questions panel collapsible (collapsed by default)** — `ApplicationPanel.tsx:661-789`

Add a `useState` near the other panel state (`:119`): `const [questionsOpen, setQuestionsOpen] = useState(false);`. Import `hasCoverLetterQuestion` from `@/lib/rolefit/coverLetterQuestion` and compute `const coverRequested = hasCoverLetterQuestion(greenhouseQuestions);` (same detection the route uses — checks the `cover_letter` field name, not just the label). Replace the panel's always-expanded body with a header row (always shown) + the `ghRows.map(...)` list gated on `questionsOpen`:

```tsx
      {isAuthed && (hasGreenhouse || coverRequested) && (
        <Panel style={{ marginTop: "18px", padding: "17px 19px" }}>
          <button
            type="button"
            onClick={() => setQuestionsOpen((v) => !v)}
            aria-expanded={questionsOpen}
            style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%",
                     background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
          >
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
              Application questions
            </div>
            <Chip color="var(--success)" bg="var(--success-bg)" border="var(--success-border)"
              style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: ".4px",
                       textTransform: "uppercase", borderRadius: "6px", padding: "3px 8px" }}>
              Greenhouse
            </Chip>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
              {[
                ghRows.length > 0 ? `${ghRows.length} question${ghRows.length === 1 ? "" : "s"}` : null,
                coverRequested ? "cover letter requested" : null,
              ].filter(Boolean).join(" · ")}
              {ghRows.length > 0 ? ` · ${questionsOpen ? "Hide" : "Show"}` : ""}
            </div>
          </button>

          {/* Only the text-answerable questions expand; a cover-letter-only posting has an
              empty ghRows, so the panel is just the summary flag. */}
          {questionsOpen && ghRows.length > 0 && (
            <>
              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "12px", fontWeight: 500 }}>
                Pre-filled from your profile and résumé where possible — review before submitting,
                and fill in anything still marked “Needs your answer” on the form.
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* keep the EXISTING ghRows.map(...) block verbatim from :701-786 here */}
              </div>
            </>
          )}
        </Panel>
      )}
```

(`coverRequested` from Step 4's `hasCoverLetterQuestion(greenhouseQuestions)` import drives the summary flag — no local regex needed.)

- [ ] **Step 5: Update the toast copy** — `dashboard/lib/generationNotifications.ts:77-86`

```ts
const READY_TITLE: Record<GenerationJobView["kind"], string> = {
  resume: "Résumé ready",
  cover: "Cover letter ready",
  prepare: "Application prefilled",
};
const FAILED_TITLE: Record<GenerationJobView["kind"], string> = {
  resume: "Résumé generation failed",
  cover: "Cover letter generation failed",
  prepare: "Prefill failed",
};
```

If `dashboard/lib/generationNotifications.test.ts` asserts the old prepare titles, update those expectations.

- [ ] **Step 6: Run panel + notification tests + full type-check**

Run: `cd dashboard && npx vitest run components/rolefit/ApplicationPanel.test.tsx lib/generationNotifications.test.ts && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 7: Run the FULL dashboard test suite**

Run: `cd dashboard && npm test`
Expected: green. Fix any residual references to the old "Prepare application" label or removed package fields.

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/rolefit/ApplicationPanel.tsx dashboard/lib/generationNotifications.ts dashboard/components/rolefit/ApplicationPanel.test.tsx dashboard/lib/generationNotifications.test.ts
git commit -m "feat(prefill): Greenhouse-only Prefill button + collapsible questions panel + prefill toast copy"
```

---

## Rollout (after all tasks land)

1. **Apply the migration** `migrations/2026-07-07-job-questions.sql` to Supabase BEFORE deploying dashboard code that reads `job_questions` (migration-coupled-code discipline).
2. **Deploy the poller** (Railway) — the next poll(s) rolling-backfill `job_questions` for the open Greenhouse backlog; new jobs fill on ingest. The route's on-demand fetch covers not-yet-backfilled jobs.
3. **Deploy the dashboard** (push to main → Vercel). Nothing destructive; `answers_snapshot`/`greenhouse_questions` columns remain vestigial.
4. **Later, separate cleanup:** an optional migration to `DROP COLUMN application_packages.answers_snapshot, greenhouse_questions`, sequenced after this code has soaked. Not part of this plan.

## Verification (manual, post-deploy)

- Open a Greenhouse job on the board → "Application questions" panel shows collapsed with a count (+ "cover letter requested" when applicable); Apply stays the top CTA.
- Click "Prefill application" on a Greenhouse job WITHOUT a cover-letter field → résumé + prefilled answers appear; no cover letter; usage shows one résumé charged.
- Click it on a Greenhouse job WITH a cover-letter field → résumé + answers + a cover letter (downloadable); usage shows résumé + cover charged.
- Open a non-Greenhouse job → no Prefill button; standalone résumé/cover "Generate" buttons still work.
