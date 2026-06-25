# Login + AI Relevance Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user AI relevance review (two-stage Haiku gate) plus Supabase email/password login and a resume/instructions profile, surfaced as new dashboard filters.

**Architecture:** A new Python `reviewer/` package runs *inside* the existing poller at the end of each run (and standalone via `python -m reviewer`). For each open job lacking a fresh verdict it runs Stage 1 (cheap title-only reject) then, if passed, Stage 2 (full JD-vs-resume eval) via the async Anthropic API, and upserts a per-`(user_id, job_id)` verdict. The Next.js dashboard gains Supabase Auth, a profile page (resume PDF/paste + instructions), and verdict/experience/industry filters that `LEFT JOIN job_reviews` scoped by the session `user_id`. All app data access stays direct-SQL; the Supabase client is used only for Auth and resume Storage.

**Tech Stack:** Python 3.12 (psycopg, httpx, **anthropic** async SDK, pydantic via anthropic); Next.js 15 App Router + React 19 (postgres.js, **@supabase/ssr**, **unpdf**); Postgres on Supabase; pytest + vitest.

## Global Constraints

These apply to **every** task. Exact values are copied from the spec (`docs/superpowers/specs/2026-06-24-login-ai-job-review-design.md`).

- **Direct SQL for all app data, scoped by `user_id`.** The Supabase JS client is used **only** for Auth (email/password, cookie sessions) and resume file Storage. No RLS, no PostREST. (spec §2, §7)
- **postgres.js must keep `prepare: false`** (Supabase transaction pooler / PgBouncer). Reuse the existing `@/lib/db` `sql` client. (dashboard/lib/db.ts)
- **Poller DB access is synchronous psycopg on both sides of the async batch.** Only Anthropic API calls are async. Candidate job data (id, title, location, ats, company name, `raw`) is read into memory *before* the async batch; async tasks never touch the DB. (spec §6)
- **Review models are env vars defaulting to `claude-haiku-4-5`:** `REVIEW_MODEL_STAGE1`, `REVIEW_MODEL_STAGE2`. (spec §2, §5)
- **`profile_version = sha256(resume_text + "\0" + instructions)`** where each missing value is treated as `""`. This exact formula must match byte-for-byte across Python and TypeScript. Vector: empty/empty → `6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d`; `"Alice resume"`/`"focus backend"` → `54ca176e51d41e4cd93a5ff3d49fc12ab756df0d81223c3f5e0c14feb425b37c`. (spec §4)
- **Per-job isolation:** one job's review error records `error` on that job's review row and the batch continues — mirroring per-company isolation. (spec §3)
- **No test makes a real Anthropic API call.** The reviewer takes an injectable client; tests pass a stub. (spec §8)
- **The poller must release its DB connection before exit.** The review phase runs before `conn.close()` and must never abort the poll (wrap in try/except). (poller/run.py, FR-6)
- **DB integration tests are gated on `TEST_DATABASE_URL`** via the existing `requires_db` marker and `conn` fixture (tests/conftest.py). `auth.users` does not exist in the throwaway Postgres, so new tables use a plain `UUID` `user_id` with **no** FK to `auth.users`.
- **Anthropic structured outputs:** use `client.messages.parse(..., output_format=PydanticModel)` and read `response.parsed_output`. The resume/instructions system block carries `cache_control: {"type": "ephemeral"}`.

---

# Part A — Database + Python reviewer (poller process)

## Task 1: Schema — reviews tables + `jobs.description`

**Files:**
- Modify: `schema.sql` (add `description` to `jobs`; append `profiles`, `job_reviews`, `review_runs`)
- Create: `migrations/2026-06-24-reviews.sql` (incremental migration for the live Supabase DB)
- Modify: `tests/test_schema.py`

**Interfaces:**
- Produces: tables `profiles(user_id UUID PK, resume_text, resume_file_path, instructions, profile_version TEXT NOT NULL, updated_at)`, `job_reviews(user_id UUID, job_id TEXT→jobs.id, profile_version, stage1_decision CHECK pass|reject, stage1_reason, verdict CHECK approve|deny, experience_match CHECK step_down|match|reach|far_reach, industry, industry_subcategory, confidence CHECK low|medium|high, reasoning, model_stage1, model_stage2, error, reviewed_at, PK(user_id, job_id))`, `review_runs(id SERIAL PK, started_at, finished_at, reviewed, gate_rejected, approved, denied, errors, notes)`; column `jobs.description TEXT`.

- [ ] **Step 1: Add the failing schema assertions**

In `tests/test_schema.py`, extend the existing `test_tables_exist` set and add two tests:

```python
@requires_db
def test_review_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        names = {r["table_name"] for r in cur.fetchall()}
    assert {"profiles", "job_reviews", "review_runs"} <= names


@requires_db
def test_jobs_has_description_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'jobs'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "description" in cols


@requires_db
def test_stage1_decision_check_constraint(conn):
    import psycopg, pytest
    # seed a company + job so the job_reviews FK is satisfiable
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X','lever','x') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:x:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        with pytest.raises(psycopg.errors.CheckViolation):
            cur.execute(
                "INSERT INTO job_reviews "
                "(user_id, job_id, profile_version, stage1_decision) "
                "VALUES (gen_random_uuid(), 'lever:x:1', 'v', 'maybe')"
            )
```

- [ ] **Step 2: Run to verify failure**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_schema.py -v`
Expected: the three new tests FAIL (tables/column/constraint do not exist yet).

- [ ] **Step 3: Edit `schema.sql`**

Add `description TEXT` to the `jobs` table (after `raw JSONB`), and append the three tables. The `jobs` block becomes:

```sql
CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,             -- '{ats}:{token}:{external_id}'
  company_id    INT NOT NULL REFERENCES companies(id),
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  location      TEXT,
  department    TEXT,
  remote        BOOLEAN,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  raw           JSONB,
  description   TEXT                          -- cached full JD text (from raw)
);
```

Append after the existing `poll_runs` table:

```sql
-- one row per user (the operator). user_id mirrors auth.users(id) in production,
-- but no FK: auth.users is Supabase-managed and absent in the throwaway test DB.
CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY,
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one current verdict per (user, job); re-review upserts in place
CREATE TABLE job_reviews (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id),
  profile_version      TEXT NOT NULL,
  stage1_decision      TEXT NOT NULL CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason        TEXT,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning            TEXT,
  model_stage1         TEXT,
  model_stage2         TEXT,
  error                TEXT,
  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);

-- accounting, mirrors poll_runs
CREATE TABLE review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,
  gate_rejected INT,
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT
);
```

- [ ] **Step 4: Create `migrations/2026-06-24-reviews.sql`** (for the already-live DB)

```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS profiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id),
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  profile_version  TEXT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_reviews (
  user_id              UUID NOT NULL REFERENCES auth.users(id),
  job_id               TEXT NOT NULL REFERENCES jobs(id),
  profile_version      TEXT NOT NULL,
  stage1_decision      TEXT NOT NULL CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason        TEXT,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning            TEXT,
  model_stage1         TEXT,
  model_stage2         TEXT,
  error                TEXT,
  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);

CREATE TABLE IF NOT EXISTS review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,
  gate_rejected INT,
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT
);
```

> NOTE: the live migration keeps the `auth.users` FKs (real auth schema present in Supabase); `schema.sql` omits them for test-DB portability. This divergence is intentional.

- [ ] **Step 5: Run to verify pass**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_schema.py -v`
Expected: PASS. (`gen_random_uuid()` is built-in on Postgres 13+.)

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-06-24-reviews.sql tests/test_schema.py
git commit -m "feat(db): add profiles, job_reviews, review_runs + jobs.description"
```

---

## Task 2: `reviewer/profile.py` — profile_version hashing

**Files:**
- Create: `reviewer/__init__.py` (empty)
- Create: `reviewer/profile.py`
- Test: `tests/test_profile.py`

**Interfaces:**
- Produces: `compute_profile_version(resume_text: str | None, instructions: str | None) -> str` — sha256 hex of `(resume_text or "") + "\0" + (instructions or "")`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_profile.py`:

```python
from reviewer.profile import compute_profile_version


def test_known_vectors():
    assert compute_profile_version("", "") == (
        "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d"
    )
    # None is treated as empty -> identical to empty/empty
    assert compute_profile_version(None, None) == compute_profile_version("", "")
    assert compute_profile_version("Alice resume", "focus backend") == (
        "54ca176e51d41e4cd93a5ff3d49fc12ab756df0d81223c3f5e0c14feb425b37c"
    )


def test_changes_when_either_field_changes():
    base = compute_profile_version("r", "i")
    assert compute_profile_version("r2", "i") != base
    assert compute_profile_version("r", "i2") != base
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/pytest tests/test_profile.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer'`.

- [ ] **Step 3: Implement**

Create empty `reviewer/__init__.py`, then `reviewer/profile.py`:

```python
import hashlib


def compute_profile_version(resume_text: str | None, instructions: str | None) -> str:
    """sha256 of the resume+instructions, the verdict-invalidation key (spec §4)."""
    payload = (resume_text or "") + "\0" + (instructions or "")
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_profile.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/__init__.py reviewer/profile.py tests/test_profile.py
git commit -m "feat(reviewer): profile_version hashing"
```

---

## Task 3: JD extraction — `reviewer/jd.py` + Greenhouse `?content=true`

**Files:**
- Create: `reviewer/jd.py`
- Modify: `poller/adapters/greenhouse.py:27` (add `?content=true` to the fetch URL)
- Test: `tests/test_jd.py`
- Test: `tests/test_greenhouse.py` (add the URL assertion)

**Interfaces:**
- Produces: `html_to_text(s: str) -> str`; `extract_description(ats: str, raw: dict) -> str | None`.
- Background (verified live, 2026-06-24): Lever `raw["descriptionPlain"]` (+ `lists` + `additionalPlain`), Ashby `raw["descriptionPlain"]`, and Greenhouse `raw["content"]` (HTML-entity-escaped HTML, present only when fetched with `?content=true`) all carry the JD inline. **No detail/N+1 fetch is needed** — this supersedes the spec §5 plan of a Greenhouse detail fetch.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_jd.py`:

```python
from reviewer.jd import extract_description, html_to_text


def test_html_to_text_unescapes_strips_and_collapses():
    # Greenhouse content is HTML-entity-escaped HTML.
    raw = "&lt;div&gt;&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;We build A &amp; B&lt;/p&gt;&lt;/div&gt;"
    out = html_to_text(raw)
    assert "<" not in out and "&lt;" not in out
    assert "About" in out
    assert "A & B" in out  # entity inside text decoded


def test_extract_lever_combines_opening_lists_and_additional():
    raw = {
        "descriptionPlain": "About the role",
        "lists": [
            {"text": "Responsibilities", "content": "<ul><li>Build APIs</li></ul>"},
        ],
        "additionalPlain": "Benefits included",
    }
    out = extract_description("lever", raw)
    assert "About the role" in out
    assert "Responsibilities" in out
    assert "Build APIs" in out
    assert "Benefits included" in out


def test_extract_ashby_uses_description_plain():
    assert extract_description("ashby", {"descriptionPlain": "Full JD text"}) == "Full JD text"


def test_extract_greenhouse_strips_content_html():
    raw = {"content": "&lt;p&gt;Hello world&lt;/p&gt;"}
    assert extract_description("greenhouse", raw) == "Hello world"


def test_extract_returns_none_when_absent():
    assert extract_description("greenhouse", {}) is None
    assert extract_description("lever", {}) is None
    assert extract_description("ashby", {"descriptionPlain": ""}) is None
    assert extract_description("unknown", {"descriptionPlain": "x"}) is None
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/pytest tests/test_jd.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.jd'`.

- [ ] **Step 3: Implement `reviewer/jd.py`**

```python
import html as _html
import re

_TAG_RE = re.compile(r"<[^>]+>")
_SPACES_RE = re.compile(r"[ \t]+")
_BLANKLINES_RE = re.compile(r"\n\s*\n\s*")


def html_to_text(s: str) -> str:
    """Convert (possibly entity-escaped) HTML to readable plain text."""
    unescaped = _html.unescape(s)          # &lt;div&gt; -> <div>
    no_tags = _TAG_RE.sub(" ", unescaped)  # strip tags
    text = _html.unescape(no_tags)         # decode entities inside text (&amp; -> &)
    text = _SPACES_RE.sub(" ", text)
    text = _BLANKLINES_RE.sub("\n\n", text)
    return text.strip()


def _lever(raw: dict) -> str | None:
    parts = [raw.get("descriptionPlain") or ""]
    for lst in raw.get("lists") or []:
        title = (lst.get("text") or "").strip()
        body = html_to_text(lst.get("content") or "")
        section = "\n".join(p for p in (title, body) if p)
        if section:
            parts.append(section)
    parts.append(raw.get("additionalPlain") or "")
    text = "\n\n".join(p for p in parts if p.strip())
    return text.strip() or None


def extract_description(ats: str, raw: dict) -> str | None:
    """Pull JD plain text from the stored `raw` payload. No HTTP — spec §5."""
    if not raw:
        return None
    if ats == "lever":
        return _lever(raw)
    if ats == "ashby":
        return (raw.get("descriptionPlain") or "").strip() or None
    if ats == "greenhouse":
        content = raw.get("content")
        text = html_to_text(content) if content else ""
        return text or None
    return None
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_jd.py -v`
Expected: PASS.

- [ ] **Step 5: Add the Greenhouse URL test**

Append to `tests/test_greenhouse.py`:

```python
def test_fetch_url_requests_content(monkeypatch):
    import poller.adapters.greenhouse as gh
    captured = {}

    def fake_get_json(url):
        captured["url"] = url
        return {"jobs": []}

    monkeypatch.setattr(gh, "get_json", fake_get_json)
    gh.fetch_greenhouse("acme")
    assert captured["url"] == (
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true"
    )
```

- [ ] **Step 6: Run to verify failure**

Run: `.venv/bin/pytest tests/test_greenhouse.py::test_fetch_url_requests_content -v`
Expected: FAIL (URL has no `?content=true`).

- [ ] **Step 7: Update `fetch_greenhouse`**

In `poller/adapters/greenhouse.py`, change the URL so `content` lands in each job's `raw`:

```python
def fetch_greenhouse(token: str) -> list[Posting]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    return parse_greenhouse(get_json(url))
```

- [ ] **Step 8: Run to verify pass**

Run: `.venv/bin/pytest tests/test_greenhouse.py tests/test_jd.py -v`
Expected: PASS (existing `parse_greenhouse` tests still pass — `content` is just an extra ignored key).

- [ ] **Step 9: Commit**

```bash
git add reviewer/jd.py poller/adapters/greenhouse.py tests/test_jd.py tests/test_greenhouse.py
git commit -m "feat(reviewer): JD extraction from raw; greenhouse content=true"
```

---

## Task 4: `reviewer/schemas.py` — Pydantic models + industry taxonomy + deps

**Files:**
- Modify: `pyproject.toml` (add `anthropic` dep; add `reviewer` to packages)
- Modify: `requirements.txt` (add `anthropic`)
- Create: `reviewer/schemas.py`
- Test: `tests/test_schemas.py`

**Interfaces:**
- Produces: `Stage1Result(decision: Literal["pass","reject"], reason: str)`; `Stage2Result(verdict, experience_match, industry, industry_subcategory, confidence, reasoning)` with `industry`/`industry_subcategory` as `Literal` enums from Appendix A; constants `INDUSTRIES: list[str]`, `SUBCATEGORIES: list[str]`, `TAXONOMY: dict[str, list[str]]`, `TAXONOMY_TEXT: str`.

- [ ] **Step 1: Add dependencies**

Edit `pyproject.toml` — add `anthropic` to dependencies and `reviewer` to packages:

```toml
dependencies = [
    "httpx>=0.27",
    "psycopg[binary]>=3.2",
    "anthropic>=0.100.0",
]
```

```toml
[tool.setuptools]
packages = ["poller", "poller.adapters", "reviewer"]
```

Edit `requirements.txt` — append:

```
anthropic>=0.100.0
```

Then reinstall so `reviewer` is importable and `anthropic`/`pydantic` are present:

```bash
uv pip install --python .venv -e ".[dev]"
```

- [ ] **Step 2: Write the failing test**

Create `tests/test_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from reviewer.schemas import (
    INDUSTRIES,
    SUBCATEGORIES,
    TAXONOMY,
    TAXONOMY_TEXT,
    Stage1Result,
    Stage2Result,
)


def test_stage1_parses_and_rejects_bad_decision():
    assert Stage1Result(decision="pass", reason="ok").decision == "pass"
    with pytest.raises(ValidationError):
        Stage1Result(decision="maybe", reason="x")


def test_stage2_parses_valid_pair():
    r = Stage2Result(
        verdict="approve",
        experience_match="match",
        industry="healthcare_life_sciences",
        industry_subcategory="health_tech_digital_health",
        confidence="high",
        reasoning="Relevant.",
    )
    assert r.industry == "healthcare_life_sciences"


def test_stage2_rejects_unknown_industry():
    with pytest.raises(ValidationError):
        Stage2Result(
            verdict="approve", experience_match="match",
            industry="agriculture", industry_subcategory="gaming",
            confidence="low", reasoning="x",
        )


def test_taxonomy_is_consistent():
    assert set(TAXONOMY) == set(INDUSTRIES)
    flat = [s for subs in TAXONOMY.values() for s in subs]
    assert sorted(flat) == sorted(SUBCATEGORIES)
    assert "health_tech_digital_health" in TAXONOMY_TEXT
```

- [ ] **Step 3: Run to verify failure**

Run: `.venv/bin/pytest tests/test_schemas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.schemas'`.

- [ ] **Step 4: Implement `reviewer/schemas.py`**

```python
from typing import Literal

from pydantic import BaseModel

# Appendix A — two-level, tech/SWE/DevOps-focused taxonomy.
TAXONOMY: dict[str, list[str]] = {
    "software_internet": [
        "devtools_platforms", "cloud_infrastructure", "cybersecurity",
        "data_ml_ai", "devops_observability_sre", "saas_productivity",
        "consumer_social_media", "ecommerce_marketplace_tech", "gaming",
    ],
    "fintech_finance": [
        "fintech_payments_crypto", "banking_trading_inhouse", "insurance_insurtech",
    ],
    "healthcare_life_sciences": [
        "health_tech_digital_health", "provider_hospital_inhouse",
        "biotech_pharma_software", "medical_devices",
    ],
    "commerce_consumer": [
        "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
    ],
    "industrial_hardware": [
        "manufacturing_industrial_software", "iot_embedded_robotics",
        "automotive_aerospace_defense", "energy_climate_cleantech",
    ],
    "public_education": [
        "government_govtech", "education_edtech", "nonprofit_ngo",
    ],
    "services_other": [
        "consulting_agency_staffing", "telecom_networking", "other_unclear",
    ],
}

INDUSTRIES: list[str] = list(TAXONOMY)
SUBCATEGORIES: list[str] = [s for subs in TAXONOMY.values() for s in subs]

TAXONOMY_TEXT: str = "\n".join(
    f"- {ind}: {', '.join(subs)}" for ind, subs in TAXONOMY.items()
)

Industry = Literal[
    "software_internet", "fintech_finance", "healthcare_life_sciences",
    "commerce_consumer", "industrial_hardware", "public_education", "services_other",
]
Subcategory = Literal[
    "devtools_platforms", "cloud_infrastructure", "cybersecurity", "data_ml_ai",
    "devops_observability_sre", "saas_productivity", "consumer_social_media",
    "ecommerce_marketplace_tech", "gaming", "fintech_payments_crypto",
    "banking_trading_inhouse", "insurance_insurtech", "health_tech_digital_health",
    "provider_hospital_inhouse", "biotech_pharma_software", "medical_devices",
    "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
    "manufacturing_industrial_software", "iot_embedded_robotics",
    "automotive_aerospace_defense", "energy_climate_cleantech", "government_govtech",
    "education_edtech", "nonprofit_ngo", "consulting_agency_staffing",
    "telecom_networking", "other_unclear",
]


class Stage1Result(BaseModel):
    decision: Literal["pass", "reject"]
    reason: str


class Stage2Result(BaseModel):
    verdict: Literal["approve", "deny"]
    experience_match: Literal["step_down", "match", "reach", "far_reach"]
    industry: Industry
    industry_subcategory: Subcategory
    confidence: Literal["low", "medium", "high"]
    reasoning: str
```

- [ ] **Step 5: Run to verify pass**

Run: `.venv/bin/pytest tests/test_schemas.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml requirements.txt reviewer/schemas.py tests/test_schemas.py
git commit -m "feat(reviewer): structured-output schemas + industry taxonomy + anthropic dep"
```

---

## Task 5: `reviewer/llm.py` — injectable Anthropic client wrapper

**Files:**
- Create: `reviewer/llm.py`
- Test: `tests/test_llm.py`

**Interfaces:**
- Consumes: `Stage1Result`, `Stage2Result` (Task 4).
- Produces:
  - `build_profile_block(resume_text: str | None, instructions: str | None) -> str`
  - `class ReviewClient` with `model_stage1: str`, `model_stage2: str`, and
    `async stage1(*, profile_block, title, company, location) -> Stage1Result`
    `async stage2(*, profile_block, title, company, location, jd) -> Stage2Result`
  - The constructor `ReviewClient(client=None, model_stage1=None, model_stage2=None)` defaults `client` to `anthropic.AsyncAnthropic()` and models to the env vars (`REVIEW_MODEL_STAGE1`/`REVIEW_MODEL_STAGE2`, default `claude-haiku-4-5`). Both methods call `await self._client.messages.parse(..., output_format=Model)` and return `resp.parsed_output`.

- [ ] **Step 1: Write the failing test** (stubs the low-level client; no network)

Create `tests/test_llm.py`:

```python
import asyncio
import types

from reviewer.llm import ReviewClient, build_profile_block
from reviewer.schemas import Stage1Result, Stage2Result


class _FakeMessages:
    def __init__(self):
        self.calls = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs["output_format"] is Stage1Result:
            parsed = Stage1Result(decision="pass", reason="looks relevant")
        else:
            parsed = Stage2Result(
                verdict="approve", experience_match="match",
                industry="software_internet", industry_subcategory="devtools_platforms",
                confidence="high", reasoning="Strong fit.",
            )
        return types.SimpleNamespace(parsed_output=parsed)


class _FakeClient:
    def __init__(self):
        self.messages = _FakeMessages()


def test_build_profile_block_includes_resume_and_instructions():
    block = build_profile_block("RESUME-A", "INSTR-B")
    assert "RESUME-A" in block and "INSTR-B" in block


def test_stage1_passes_title_and_caches_profile_block():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="Staff Engineer", company="Acme", location="Remote")
    )
    assert isinstance(out, Stage1Result) and out.decision == "pass"
    call = fake.messages.calls[0]
    assert call["model"] == "m1"
    assert call["output_format"] is Stage1Result
    # resume/instructions block is the cached system block
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert call["system"][0]["text"] == "P"
    # title/company/location reach the user message
    assert "Staff Engineer" in call["messages"][0]["content"]


def test_stage2_includes_jd_and_uses_stage2_model():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage2(
            profile_block="P", title="SRE", company="Acme",
            location="Remote", jd="Operate Kubernetes clusters",
        )
    )
    assert isinstance(out, Stage2Result) and out.verdict == "approve"
    call = fake.messages.calls[0]
    assert call["model"] == "m2"
    assert call["output_format"] is Stage2Result
    assert "Operate Kubernetes clusters" in call["messages"][0]["content"]


def test_models_default_from_env(monkeypatch):
    monkeypatch.setenv("REVIEW_MODEL_STAGE1", "env-s1")
    monkeypatch.delenv("REVIEW_MODEL_STAGE2", raising=False)
    rc = ReviewClient(client=_FakeClient())
    assert rc.model_stage1 == "env-s1"
    assert rc.model_stage2 == "claude-haiku-4-5"
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/pytest tests/test_llm.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.llm'`.

- [ ] **Step 3: Implement `reviewer/llm.py`**

```python
import os

from reviewer.schemas import TAXONOMY_TEXT, Stage1Result, Stage2Result

DEFAULT_MODEL = "claude-haiku-4-5"

_STAGE1_INSTRUCTIONS = (
    "You are a relevance gatekeeper. You see only a job's title, company, and "
    "location. Decide whether it could plausibly fit the candidate above. "
    "Reject ONLY obvious non-fits (e.g., a software engineer seeing 'Forklift "
    "Operator' or 'Social Media Manager'). When unsure, pass. Respond with "
    "decision='pass' or 'reject' and a one-sentence reason."
)

_STAGE2_INSTRUCTIONS = (
    "Evaluate this single job posting against the candidate's resume and "
    "instructions. Decide:\n"
    "- verdict: 'approve' if genuinely relevant and worth applying, else 'deny'.\n"
    "- experience_match: 'step_down' (below their level), 'match' (right level), "
    "'reach' (a plausible stretch), 'far_reach' (clearly beyond current experience).\n"
    "- industry and industry_subcategory: choose exactly one consistent pair from "
    "this taxonomy:\n"
    f"{TAXONOMY_TEXT}\n"
    "- confidence: low, medium, or high.\n"
    "- reasoning: 1-3 sentences.\n"
    "Honor the candidate's focus/avoid instructions."
)


def build_profile_block(resume_text: str | None, instructions: str | None) -> str:
    return (
        "You are screening jobs for one candidate.\n\n"
        "CANDIDATE RESUME:\n"
        f"{resume_text or '(none provided)'}\n\n"
        "CANDIDATE INSTRUCTIONS (focus/avoid):\n"
        f"{instructions or '(none provided)'}"
    )


def _system(profile_block: str, instructions: str) -> list[dict]:
    return [
        {"type": "text", "text": profile_block, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": instructions},
    ]


class ReviewClient:
    def __init__(self, client=None, model_stage1: str | None = None,
                 model_stage2: str | None = None):
        if client is None:
            from anthropic import AsyncAnthropic  # lazy: avoid import at module load
            client = AsyncAnthropic()
        self._client = client
        self.model_stage1 = model_stage1 or os.environ.get("REVIEW_MODEL_STAGE1", DEFAULT_MODEL)
        self.model_stage2 = model_stage2 or os.environ.get("REVIEW_MODEL_STAGE2", DEFAULT_MODEL)

    async def stage1(self, *, profile_block: str, title: str, company: str,
                     location: str | None) -> Stage1Result:
        resp = await self._client.messages.parse(
            model=self.model_stage1,
            max_tokens=512,
            system=_system(profile_block, _STAGE1_INSTRUCTIONS),
            messages=[{
                "role": "user",
                "content": f"Title: {title}\nCompany: {company}\nLocation: {location or 'n/a'}",
            }],
            output_format=Stage1Result,
        )
        return resp.parsed_output

    async def stage2(self, *, profile_block: str, title: str, company: str,
                     location: str | None, jd: str) -> Stage2Result:
        resp = await self._client.messages.parse(
            model=self.model_stage2,
            max_tokens=1024,
            system=_system(profile_block, _STAGE2_INSTRUCTIONS),
            messages=[{
                "role": "user",
                "content": (
                    f"Title: {title}\nCompany: {company}\nLocation: {location or 'n/a'}\n\n"
                    f"JOB DESCRIPTION:\n{jd}"
                ),
            }],
            output_format=Stage2Result,
        )
        return resp.parsed_output
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/pytest tests/test_llm.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/llm.py tests/test_llm.py
git commit -m "feat(reviewer): injectable two-stage Anthropic client wrapper"
```

---

## Task 6: `reviewer/db.py` — review DB helpers

**Files:**
- Create: `reviewer/db.py`
- Test: `tests/test_reviewer_db.py`

**Interfaces:**
- Consumes: `poller.db.connect` (reused via `from poller import db as poller_db` where needed; tests use the `conn` fixture).
- Produces (all take a psycopg `conn` first):
  - `load_profiles(conn) -> list[dict]` — rows `{user_id, resume_text, instructions, profile_version}`.
  - `select_candidates(conn, user_id: str, profile_version: str, limit: int) -> list[dict]` — open jobs with missing/stale verdict; rows `{id, title, location, ats, company_name, raw}`.
  - `count_stale(conn, user_id: str, profile_version: str) -> int` — total candidates ignoring `limit` (for overflow logging).
  - `upsert_review(conn, row: dict) -> None` — upsert into `job_reviews` keyed `(user_id, job_id)`; `row` keys match the table columns listed in Task 7's `ReviewResult.as_row()`.
  - `set_job_description(conn, job_id: str, description: str) -> None`.
  - `start_review_run(conn) -> int`; `finish_review_run(conn, run_id, *, reviewed, gate_rejected, approved, denied, errors, notes) -> None`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_reviewer_db.py`:

```python
import uuid

from poller import db as poller_db
from poller.models import Posting
from reviewer import db as rdb
from tests.conftest import requires_db

USER = "11111111-1111-1111-1111-111111111111"


def _seed_job(conn, external_id="1", title="Engineer"):
    cid = poller_db.sync_companies(
        conn, [{"name": "Acme", "ats": "lever", "token": "acme"}]
    )[("lever", "acme")]
    poller_db.upsert_job(
        conn, cid, "lever", "acme",
        Posting(external_id=external_id, title=title, url="https://x",
                location="Remote", raw={"descriptionPlain": "jd"}),
    )
    conn.commit()
    return f"lever:acme:{external_id}"


@requires_db
def test_load_profiles(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    conn.commit()
    profiles = rdb.load_profiles(conn)
    assert profiles == [
        {"user_id": uuid.UUID(USER), "resume_text": "r", "instructions": "i",
         "profile_version": "v1"}
    ]


@requires_db
def test_candidates_missing_then_excluded_when_fresh(conn):
    job_id = _seed_job(conn)
    cands = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [c["id"] for c in cands] == [job_id]
    assert cands[0]["ats"] == "lever"
    assert cands[0]["company_name"] == "Acme"
    assert cands[0]["raw"]["descriptionPlain"] == "jd"

    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "stage1_reason": None, "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "model_stage1": "m1", "model_stage2": "m2", "error": None,
    })
    conn.commit()
    # fresh verdict -> excluded
    assert rdb.select_candidates(conn, USER, "v1", limit=10) == []
    # stale profile_version -> re-selected
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v2", limit=10)] == [job_id]


@requires_db
def test_closed_jobs_excluded_and_limit_and_count(conn):
    j1 = _seed_job(conn, "1")
    j2 = _seed_job(conn, "2")
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = %s", (j2,))
    conn.commit()
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)] == [j1]
    assert rdb.count_stale(conn, USER, "v1") == 1
    # limit caps the rows returned
    _seed_job(conn, "3")
    assert len(rdb.select_candidates(conn, USER, "v1", limit=1)) == 1
    assert rdb.count_stale(conn, USER, "v1") == 2


@requires_db
def test_upsert_review_replaces_in_place(conn):
    job_id = _seed_job(conn)
    base = {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target", "verdict": None,
        "experience_match": None, "industry": None, "industry_subcategory": None,
        "confidence": None, "reasoning": None, "model_stage1": "m1",
        "model_stage2": None, "error": None,
    }
    rdb.upsert_review(conn, base)
    rdb.upsert_review(conn, {**base, "stage1_decision": "pass", "verdict": "deny"})
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, max(verdict) AS v FROM job_reviews")
        row = cur.fetchone()
    assert row["n"] == 1 and row["v"] == "deny"


@requires_db
def test_set_job_description(conn):
    job_id = _seed_job(conn)
    rdb.set_job_description(conn, job_id, "full text")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id = %s", (job_id,))
        assert cur.fetchone()["description"] == "full text"


@requires_db
def test_review_run_lifecycle(conn):
    rid = rdb.start_review_run(conn)
    rdb.finish_review_run(conn, rid, reviewed=5, gate_rejected=2, approved=2,
                          denied=1, errors=0, notes="ok")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM review_runs WHERE id = %s", (rid,))
        row = cur.fetchone()
    assert row["reviewed"] == 5 and row["approved"] == 2 and row["finished_at"] is not None
```

- [ ] **Step 2: Run to verify failure**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_reviewer_db.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.db'`.

- [ ] **Step 3: Implement `reviewer/db.py`**

```python
import uuid

_REVIEW_COLUMNS = (
    "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
    "verdict", "experience_match", "industry", "industry_subcategory",
    "confidence", "reasoning", "model_stage1", "model_stage2", "error",
)


def _uuid(v) -> uuid.UUID:
    # Bind user_id as a real uuid so comparisons are `uuid = uuid`, not `uuid = text`
    # (Postgres has no `uuid = text` operator for typed params).
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def load_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, resume_text, instructions, profile_version FROM profiles"
        )
        return cur.fetchall()


def select_candidates(conn, user_id: str, profile_version: str, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id, j.title, j.location, j.raw, c.ats, c.name AS company_name
            FROM jobs j
            JOIN companies c ON c.id = j.company_id
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
            WHERE j.closed_at IS NULL
              AND (r.job_id IS NULL OR r.profile_version <> %(pv)s)
            ORDER BY j.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": profile_version, "lim": limit},
        )
        return cur.fetchall()


def count_stale(conn, user_id: str, profile_version: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) AS n
            FROM jobs j
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
            WHERE j.closed_at IS NULL
              AND (r.job_id IS NULL OR r.profile_version <> %(pv)s)
            """,
            {"uid": _uuid(user_id), "pv": profile_version},
        )
        return cur.fetchone()["n"]


def upsert_review(conn, row: dict) -> None:
    row = {**row, "user_id": _uuid(row["user_id"])}
    cols = ", ".join(_REVIEW_COLUMNS)
    placeholders = ", ".join(f"%({c})s" for c in _REVIEW_COLUMNS)
    updates = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in _REVIEW_COLUMNS if c not in ("user_id", "job_id")
    )
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO job_reviews ({cols}, reviewed_at)
            VALUES ({placeholders}, now())
            ON CONFLICT (user_id, job_id) DO UPDATE SET
                {updates}, reviewed_at = now()
            """,
            row,
        )


def set_job_description(conn, job_id: str, description: str) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET description = %s WHERE id = %s", (description, job_id))


def start_review_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_review_run(conn, run_id: int, *, reviewed: int, gate_rejected: int,
                      approved: int, denied: int, errors: int, notes: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE review_runs SET
                finished_at   = now(),
                reviewed      = %s,
                gate_rejected = %s,
                approved      = %s,
                denied        = %s,
                errors        = %s,
                notes         = %s
            WHERE id = %s
            """,
            (reviewed, gate_rejected, approved, denied, errors, notes, run_id),
        )
```

- [ ] **Step 4: Run to verify pass**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_reviewer_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): review DB helpers (candidates, upsert, runs)"
```

---

## Task 7: `reviewer/run.py` + `reviewer/config.py` — orchestration

**Files:**
- Create: `reviewer/config.py`
- Create: `reviewer/run.py`
- Test: `tests/test_reviewer_run.py`

**Interfaces:**
- Consumes: `reviewer.db` (Task 6), `reviewer.llm.ReviewClient`/`build_profile_block` (Task 5), `reviewer.jd.extract_description` (Task 3).
- Produces:
  - `reviewer/config.py`: `CONCURRENCY: int` (`REVIEW_CONCURRENCY`, default 5), `MAX_JOBS_PER_RUN: int` (`REVIEW_MAX_JOBS_PER_RUN`, default 200), `has_api_key() -> bool`.
  - `@dataclass ReviewResult` with all `job_reviews` fields + `description: str | None`; `.as_row(user_id, profile_version) -> dict` producing the dict `upsert_review` expects.
  - `async review_one(candidate: dict, profile_block: str, client) -> ReviewResult`
  - `async review_batch(candidates, profile_block, client, concurrency) -> list[ReviewResult]`
  - `review_all(conn) -> None` — sync orchestration: load profiles, per profile select candidates, run the async batch, upsert rows + descriptions, write a `review_runs` row. No-op (logged) when `has_api_key()` is False.

- [ ] **Step 1: Write the failing tests** (stub client — no network)

Create `tests/test_reviewer_run.py`:

```python
import asyncio

import pytest

from reviewer.run import ReviewResult, review_batch, review_one
from reviewer.schemas import Stage1Result, Stage2Result


class StubClient:
    """Drives review_one without network. Behavior keyed off the title."""

    def __init__(self):
        self.model_stage1 = "m1"
        self.model_stage2 = "m2"
        self.stage2_calls = []

    async def stage1(self, *, profile_block, title, company, location):
        if title == "BOOM1":
            raise RuntimeError("stage1 down")
        decision = "reject" if title == "Forklift Operator" else "pass"
        return Stage1Result(decision=decision, reason="r")

    async def stage2(self, *, profile_block, title, company, location, jd):
        self.stage2_calls.append(jd)
        if title == "BOOM2":
            raise RuntimeError("stage2 down")
        return Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="fit",
        )


def _cand(title, ats="lever", raw=None):
    return {"id": f"lever:acme:{title}", "title": title, "location": "Remote",
            "ats": ats, "company_name": "Acme", "raw": raw or {"descriptionPlain": "jd"}}


def test_gate_reject_skips_stage2():
    client = StubClient()
    res = asyncio.run(review_one(_cand("Forklift Operator"), "P", client))
    assert res.stage1_decision == "reject"
    assert res.verdict is None and res.industry is None
    assert client.stage2_calls == []  # stage 2 never ran


def test_pass_runs_stage2_with_extracted_jd():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    assert res.stage1_decision == "pass" and res.verdict == "approve"
    assert res.description == "jd"
    assert client.stage2_calls == ["jd"]


def test_pass_with_missing_jd_uses_placeholder():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", raw={}), "P", client))
    assert res.verdict == "approve"
    assert res.description is None
    assert client.stage2_calls and "no description" in client.stage2_calls[0].lower()


def test_stage1_error_isolated():
    client = StubClient()
    res = asyncio.run(review_one(_cand("BOOM1"), "P", client))
    assert res.error is not None and "stage1 down" in res.error
    assert res.stage1_decision is None


def test_stage2_error_isolated_keeps_stage1():
    client = StubClient()
    res = asyncio.run(review_one(_cand("BOOM2"), "P", client))
    assert res.stage1_decision == "pass"
    assert res.verdict is None
    assert res.error is not None and "stage2 down" in res.error


def test_batch_continues_past_one_failure():
    client = StubClient()
    cands = [_cand("BOOM1"), _cand("SRE"), _cand("Forklift Operator")]
    results = asyncio.run(review_batch(cands, "P", client, concurrency=2))
    assert len(results) == 3
    by_title = {r.job_id.split(":")[-1]: r for r in results}
    assert by_title["BOOM1"].error is not None
    assert by_title["SRE"].verdict == "approve"
    assert by_title["Forklift Operator"].stage1_decision == "reject"


def test_as_row_maps_all_columns():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    row = res.as_row(user_id="u", profile_version="v1")
    assert row["user_id"] == "u" and row["profile_version"] == "v1"
    assert row["job_id"] == "lever:acme:SRE"
    assert set(row) == {
        "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
        "verdict", "experience_match", "industry", "industry_subcategory",
        "confidence", "reasoning", "model_stage1", "model_stage2", "error",
    }
```

Also add a DB integration test for `review_all` at the end of the same file:

```python
import os
import uuid

from poller import db as poller_db
from poller.models import Posting
from reviewer import db as rdb
from tests.conftest import requires_db

USER = "22222222-2222-2222-2222-222222222222"


@requires_db
def test_review_all_writes_verdicts_and_run(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    cid = poller_db.sync_companies(
        conn, [{"name": "Acme", "ats": "lever", "token": "acme"}]
    )[("lever", "acme")]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="1", title="SRE", url="u",
                                 raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    conn.commit()

    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda: StubClient())
    run_module.review_all(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT verdict, profile_version FROM job_reviews WHERE user_id = %s",
                    (USER,))
        rev = cur.fetchone()
        cur.execute("SELECT description FROM jobs WHERE id = 'lever:acme:1'")
        desc = cur.fetchone()["description"]
        cur.execute("SELECT * FROM review_runs ORDER BY id DESC LIMIT 1")
        rr = cur.fetchone()
    assert rev["verdict"] == "approve" and rev["profile_version"] == "v1"
    assert desc == "jd"
    assert rr["approved"] == 1 and rr["finished_at"] is not None
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/pytest tests/test_reviewer_run.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.run'`.

- [ ] **Step 3: Implement `reviewer/config.py`**

```python
import os


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("REVIEW_CONCURRENCY", 5)
MAX_JOBS_PER_RUN = _int_env("REVIEW_MAX_JOBS_PER_RUN", 200)


def has_api_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))
```

- [ ] **Step 4: Implement `reviewer/run.py`**

```python
import asyncio
import logging
from dataclasses import dataclass

from reviewer import config, db
from reviewer.jd import extract_description
from reviewer.llm import ReviewClient, build_profile_block

log = logging.getLogger("reviewer")

_NO_JD = "(no description available)"


@dataclass
class ReviewResult:
    job_id: str
    stage1_decision: str | None = None
    stage1_reason: str | None = None
    verdict: str | None = None
    experience_match: str | None = None
    industry: str | None = None
    industry_subcategory: str | None = None
    confidence: str | None = None
    reasoning: str | None = None
    model_stage1: str | None = None
    model_stage2: str | None = None
    error: str | None = None
    description: str | None = None  # written to jobs.description (not job_reviews)

    def as_row(self, *, user_id: str, profile_version: str) -> dict:
        return {
            "user_id": user_id,
            "job_id": self.job_id,
            "profile_version": profile_version,
            "stage1_decision": self.stage1_decision,
            "stage1_reason": self.stage1_reason,
            "verdict": self.verdict,
            "experience_match": self.experience_match,
            "industry": self.industry,
            "industry_subcategory": self.industry_subcategory,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "model_stage1": self.model_stage1,
            "model_stage2": self.model_stage2,
            "error": self.error,
        }


async def review_one(candidate: dict, profile_block: str, client) -> ReviewResult:
    res = ReviewResult(job_id=candidate["id"])
    try:
        s1 = await client.stage1(
            profile_block=profile_block, title=candidate["title"],
            company=candidate["company_name"], location=candidate.get("location"),
        )
        res.model_stage1 = client.model_stage1
        res.stage1_decision = s1.decision
        res.stage1_reason = s1.reason
        if s1.decision == "reject":
            return res

        jd = extract_description(candidate["ats"], candidate.get("raw") or {})
        res.description = jd
        s2 = await client.stage2(
            profile_block=profile_block, title=candidate["title"],
            company=candidate["company_name"], location=candidate.get("location"),
            jd=jd or _NO_JD,
        )
        res.model_stage2 = client.model_stage2
        res.verdict = s2.verdict
        res.experience_match = s2.experience_match
        res.industry = s2.industry
        res.industry_subcategory = s2.industry_subcategory
        res.confidence = s2.confidence
        res.reasoning = s2.reasoning
    except Exception as exc:  # per-job isolation (spec §3)
        res.error = f"{type(exc).__name__}: {exc}"
        log.warning("review failed for %s: %s", candidate["id"], res.error)
    return res


async def review_batch(candidates: list[dict], profile_block: str, client,
                       concurrency: int) -> list[ReviewResult]:
    sem = asyncio.Semaphore(concurrency)

    async def _guarded(c: dict) -> ReviewResult:
        async with sem:
            return await review_one(c, profile_block, client)

    return await asyncio.gather(*[_guarded(c) for c in candidates])


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile["profile_version"]
    run_id = db.start_review_run(conn)
    conn.commit()

    total = db.count_stale(conn, user_id, pv)
    candidates = db.select_candidates(conn, user_id, pv, config.MAX_JOBS_PER_RUN)
    overflow = total - len(candidates)
    notes = f"overflow: {overflow} job(s) deferred to next run" if overflow > 0 else None
    if overflow > 0:
        log.info("review overflow: %s job(s) over cap %s, deferred",
                 overflow, config.MAX_JOBS_PER_RUN)

    profile_block = build_profile_block(profile["resume_text"], profile["instructions"])
    client = ReviewClient()
    results = asyncio.run(review_batch(candidates, profile_block, client, config.CONCURRENCY))

    counts = {"reviewed": 0, "gate_rejected": 0, "approved": 0, "denied": 0, "errors": 0}
    for r in results:
        db.upsert_review(conn, r.as_row(user_id=user_id, profile_version=pv))
        if r.description:
            db.set_job_description(conn, r.job_id, r.description)
        if r.error:
            counts["errors"] += 1
        if r.stage1_decision is not None:
            counts["reviewed"] += 1
        if r.stage1_decision == "reject":
            counts["gate_rejected"] += 1
        if r.verdict == "approve":
            counts["approved"] += 1
        elif r.verdict == "deny":
            counts["denied"] += 1
    conn.commit()

    db.finish_review_run(conn, run_id, notes=notes, **counts)
    conn.commit()
    log.info("review complete for %s: %s", user_id, counts)


def review_all(conn) -> None:
    if not config.has_api_key():
        log.info("ANTHROPIC_API_KEY not set; skipping review phase")
        return
    profiles = db.load_profiles(conn)
    if not profiles:
        log.info("no profiles; skipping review phase")
        return
    for profile in profiles:
        _review_user(conn, profile)
```

- [ ] **Step 5: Run to verify pass**

Run: `.venv/bin/pytest tests/test_reviewer_run.py -v`
Then with DB: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_reviewer_run.py -v`
Expected: PASS (unit tests run without DB; the `review_all` test runs only with `TEST_DATABASE_URL`).

- [ ] **Step 6: Commit**

```bash
git add reviewer/config.py reviewer/run.py tests/test_reviewer_run.py
git commit -m "feat(reviewer): review orchestration (batch, isolation, accounting)"
```

---

## Task 8: Poller integration + standalone entry + deploy config

**Files:**
- Modify: `poller/run.py` (call `review_all` before `conn.close()`, isolated)
- Create: `reviewer/__main__.py`
- Modify: `tests/test_run.py` (assert the poll still works with review stubbed/absent)
- Modify: `README.md` (document the review phase, env, `python -m reviewer`)

**Interfaces:**
- Consumes: `reviewer.run.review_all` (Task 7).
- Produces: `python -m reviewer` standalone entry; poller `run()` now also runs the review phase.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_run.py`:

```python
@requires_db
def test_run_invokes_review_phase_isolated(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    calls = {"n": 0}

    def fake_review_all(conn):
        calls["n"] += 1

    import reviewer.run as reviewer_run
    monkeypatch.setattr(reviewer_run, "review_all", fake_review_all)

    run_module.run()  # must not raise
    assert calls["n"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1


@requires_db
def test_run_survives_review_phase_error(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    import reviewer.run as reviewer_run

    def boom(conn):
        raise RuntimeError("anthropic down")

    monkeypatch.setattr(reviewer_run, "review_all", boom)

    run_module.run()  # review error must not abort the poll
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        assert cur.fetchone()["finished_at"] is not None
```

- [ ] **Step 2: Run to verify failure**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_run.py::test_run_invokes_review_phase_isolated -v`
Expected: FAIL (review phase not wired in; `calls["n"] == 0`).

- [ ] **Step 3: Wire the review phase into `poller/run.py`**

Insert, inside the `try:` block, after the existing `db.finish_run(...)` + `conn.commit()` and the `log.info("run complete...")`, but before the `finally:` that closes the connection:

```python
        # Review phase (spec §6): event-driven, folded into the poll. Isolated so a
        # reviewer/Anthropic failure never aborts the poll or its accounting.
        try:
            from reviewer.run import review_all
            review_all(conn)
        except Exception:
            log.exception("review phase failed; poll results unaffected")
```

(Keep the `finally: conn.close()` exactly as-is.)

- [ ] **Step 4: Create `reviewer/__main__.py`**

```python
import logging

from poller import db
from reviewer.run import review_all


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    conn = db.connect()
    try:
        review_all(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run to verify pass + full suite**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest -v`
Expected: PASS (all poller + reviewer tests).

- [ ] **Step 6: Update `README.md`**

Add a "Review phase" subsection under Poller describing: runs at the end of each poll (and standalone via `python -m reviewer`); requires `ANTHROPIC_API_KEY`; env `REVIEW_MODEL_STAGE1`/`REVIEW_MODEL_STAGE2` (default `claude-haiku-4-5`), `REVIEW_CONCURRENCY` (default 5), `REVIEW_MAX_JOBS_PER_RUN` (default 200); no-ops when no API key or no profile exists. Note: in the Railway service, set these env vars and (in the Railway dashboard) extend the poller's watch patterns to include `reviewer/**` so reviewer-only commits redeploy the poller.

- [ ] **Step 7: Commit**

```bash
git add poller/run.py reviewer/__main__.py tests/test_run.py README.md
git commit -m "feat(poller): run review phase after poll; python -m reviewer entry"
```

---

# Part B — Dashboard (Next.js): auth, profile, review filters

> Run all dashboard commands from `dashboard/`. Tests: `npm test` (vitest). Type/build check: `npm run build`.

## Task 9: `lib/profileVersion.ts` — cross-language hash parity

**Files:**
- Create: `dashboard/lib/profileVersion.ts`
- Test: `dashboard/lib/profileVersion.test.ts`

**Interfaces:**
- Produces: `profileVersion(resumeText: string | null, instructions: string | null): string` — must equal the Python `compute_profile_version` for the same inputs.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/profileVersion.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { profileVersion } from "@/lib/profileVersion";

describe("profileVersion (parity with Python compute_profile_version)", () => {
  test("empty/empty and null/null match the Python vector", () => {
    const empty = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    expect(profileVersion("", "")).toBe(empty);
    expect(profileVersion(null, null)).toBe(empty);
  });

  test("populated vector matches Python", () => {
    expect(profileVersion("Alice resume", "focus backend")).toBe(
      "54ca176e51d41e4cd93a5ff3d49fc12ab756df0d81223c3f5e0c14feb425b37c",
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- profileVersion`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `dashboard/lib/profileVersion.ts`:

```ts
import { createHash } from "node:crypto";

// MUST match reviewer/profile.py: sha256((resume ?? "") + "\0" + (instructions ?? "")).
export function profileVersion(
  resumeText: string | null,
  instructions: string | null,
): string {
  const payload = `${resumeText ?? ""}\0${instructions ?? ""}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- profileVersion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/profileVersion.ts dashboard/lib/profileVersion.test.ts
git commit -m "feat(dashboard): profileVersion hash (parity with reviewer)"
```

---

## Task 10: Supabase auth scaffolding + login

**Files:**
- Modify: `dashboard/package.json` (add `@supabase/ssr`, `@supabase/supabase-js`)
- Create: `dashboard/lib/paths.ts`
- Create: `dashboard/lib/supabase/server.ts`
- Create: `dashboard/lib/supabase/middleware.ts`
- Create: `dashboard/middleware.ts`
- Create: `dashboard/lib/auth.ts`
- Create: `dashboard/app/login/page.tsx`
- Test: `dashboard/lib/paths.test.ts`

**Interfaces:**
- Produces:
  - `lib/paths.ts`: `isPublicPath(pathname: string): boolean` — **pure**, imports nothing from `next/*` so `middleware.ts` can use it without dragging `next/headers` into the edge runtime.
  - `createClient()` (server) in `lib/supabase/server.ts` — cookie-bound Supabase client for Server Components/Actions.
  - `updateSession(request: NextRequest): Promise<NextResponse>` in `lib/supabase/middleware.ts`.
  - `lib/auth.ts`: `getUserId(): Promise<string | null>` and `requireUserId(): Promise<string>` (redirects to `/login` when absent).
  - `signIn(formData: FormData)` server action on the login page.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/ssr@^0.12.0 @supabase/supabase-js@^2
```

- [ ] **Step 2: Write the failing test** (the pure helper is the unit-testable piece)

Create `dashboard/lib/paths.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { isPublicPath } from "@/lib/paths";

describe("isPublicPath", () => {
  test("login and auth callback are public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });
  test("everything else is private", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- paths`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `lib/paths.ts`** (pure — no `next/*` imports)

```ts
const PUBLIC_PREFIXES = ["/login", "/auth"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
```

- [ ] **Step 5: Implement `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — middleware refreshes the session instead
          }
        },
      },
    },
  );
}
```

- [ ] **Step 6: Implement `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/paths";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 7: Implement `lib/auth.ts`**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}
```

- [ ] **Step 8: Implement `dashboard/middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 9: Implement `dashboard/app/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm px-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <form action={signIn} className="mt-4 flex flex-col gap-3">
        <input name="email" type="email" required placeholder="email"
          className="rounded border px-2 py-1 text-sm" />
        <input name="password" type="password" required placeholder="password"
          className="rounded border px-2 py-1 text-sm" />
        <button type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
          Sign in
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 10: Run to verify pass + build**

Run: `npm test -- paths` (PASS), then `npm run build`.
Expected: tests PASS; build succeeds. (Build needs `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `DATABASE_URL` present — set them in `.env.local`; values can be the real Supabase project's.)

- [ ] **Step 11: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/lib/paths.ts dashboard/lib/paths.test.ts dashboard/lib/supabase dashboard/middleware.ts dashboard/lib/auth.ts dashboard/app/login
git commit -m "feat(dashboard): Supabase email/password auth + login + route guard"
```

---

## Task 11: Profile page — resume (PDF/paste) + instructions

**Files:**
- Modify: `dashboard/package.json` (add `unpdf`)
- Create: `dashboard/lib/pdf.ts`
- Modify: `dashboard/lib/queries.ts` (add `getProfile`, `upsertProfile`)
- Modify: `dashboard/lib/types.ts` (add `ProfileRow`)
- Create: `dashboard/app/profile/page.tsx`
- Test: `dashboard/lib/pdf.test.ts`

**Interfaces:**
- Consumes: `profileVersion` (Task 9), `requireUserId` (Task 10), `createClient` (Task 10), `sql` (`@/lib/db`).
- Produces:
  - `extractPdfText(bytes: Uint8Array): Promise<string>` in `lib/pdf.ts`.
  - `getProfile(userId): Promise<ProfileRow | null>` and `upsertProfile(userId, { resumeText, instructions, resumeFilePath }): Promise<void>` in `lib/queries.ts`.
  - `ProfileRow { user_id, resume_text, resume_file_path, instructions, profile_version, updated_at }`.
  - `saveProfile(formData)` server action on the profile page (uploads PDF to Storage `resumes/{userId}/...`, extracts text when a PDF is supplied, else uses pasted text; recomputes `profile_version`).

- [ ] **Step 1: Install dependency**

```bash
npm install unpdf@^1.6.2
```

- [ ] **Step 2: Write the failing test** (guards the empty-bytes edge; `unpdf` is mocked to avoid bundling a real PDF)

Create `dashboard/lib/pdf.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("unpdf", () => ({
  extractText: vi.fn(async () => ({ text: ["Hello", "World"], totalPages: 1 })),
  getDocumentProxy: vi.fn(async () => ({})),
}));

import { extractPdfText } from "@/lib/pdf";

describe("extractPdfText", () => {
  test("joins page text", async () => {
    expect(await extractPdfText(new Uint8Array([1, 2, 3]))).toBe("Hello\nWorld");
  });

  test("empty input returns empty string without calling the parser", async () => {
    expect(await extractPdfText(new Uint8Array())).toBe("");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- pdf`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `lib/pdf.ts`**

```ts
import { extractText, getDocumentProxy } from "unpdf";

// Extract plain text from PDF bytes (server-side). Returns "" for empty input.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) return "";
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.join("\n").trim();
}
```

- [ ] **Step 5: Add `ProfileRow` to `lib/types.ts`**

```ts
export interface ProfileRow {
  user_id: string;
  resume_text: string | null;
  resume_file_path: string | null;
  instructions: string | null;
  profile_version: string;
  updated_at: string;
}
```

- [ ] **Step 6: Add profile queries to `lib/queries.ts`**

```ts
import type { ProfileRow } from "@/lib/types";
import { profileVersion } from "@/lib/profileVersion";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  // ::uuid — postgres.js binds the JS string as text; the uuid column needs the cast.
  const rows = await sql`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`;
  return (rows[0] as unknown as ProfileRow) ?? null;
}

export async function upsertProfile(
  userId: string,
  data: { resumeText: string | null; instructions: string | null; resumeFilePath: string | null },
): Promise<void> {
  const version = profileVersion(data.resumeText, data.instructions);
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text      = EXCLUDED.resume_text,
      instructions     = EXCLUDED.instructions,
      resume_file_path = EXCLUDED.resume_file_path,
      profile_version  = EXCLUDED.profile_version,
      updated_at       = now()
  `;
}
```

- [ ] **Step 7: Implement `dashboard/app/profile/page.tsx`**

```tsx
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
  let resumeText = (String(formData.get("resume_text") ?? "")).trim() || null;
  let resumeFilePath: string | null = null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
  }

  await upsertProfile(userId, { resumeText, instructions, resumeFilePath });
}

export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  return (
    <main className="mx-auto mt-12 max-w-2xl px-6">
      <h1 className="text-lg font-semibold">Profile</h1>
      <form action={saveProfile} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col text-sm text-gray-700">
          Resume PDF (optional — overrides pasted text when it extracts cleanly)
          <input name="resume_pdf" type="file" accept="application/pdf" className="mt-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Resume text
          <textarea name="resume_text" rows={12} defaultValue={profile?.resume_text ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Instructions (focus / avoid)
          <textarea name="instructions" rows={4} defaultValue={profile?.instructions ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm"
            placeholder="e.g. focus on backend/infra; avoid pure-frontend roles" />
        </label>
        <button type="submit"
          className="self-start rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
          Save
        </button>
        {profile && (
          <p className="text-xs text-gray-500">
            Last saved {new Date(profile.updated_at).toLocaleString()} · version{" "}
            {profile.profile_version.slice(0, 8)}
          </p>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Run to verify pass + build**

Run: `npm test -- pdf` (PASS), then `npm run build`.
Expected: tests PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/lib/pdf.ts dashboard/lib/pdf.test.ts dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/app/profile
git commit -m "feat(dashboard): profile page (resume PDF/paste + instructions)"
```

---

## Task 12: Extend filters — verdict / experience / industry / subcategory

**Files:**
- Modify: `dashboard/lib/filters.ts`
- Modify: `dashboard/lib/filters.test.ts`

**Interfaces:**
- Produces: extended `Filters` with `verdict: Verdict` (`"approve" | "deny" | "gate_rejected" | "pending" | "all"`, default `"approve"`), `experience: string`, `industry: string`, `subcategory: string` (each `""` when unset). `parseFilters` reads `verdict`, `experience`, `industry`, `subcategory` params.

- [ ] **Step 1: Write the failing tests**

Replace `dashboard/lib/filters.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { parseFilters } from "@/lib/filters";

const D = { include: ["engineer"] };

describe("parseFilters", () => {
  test("empty params → defaults incl. verdict=approve", () => {
    expect(parseFilters({}, D)).toEqual({
      companies: [],
      include: ["engineer"],
      exclude: [],
      remoteOnly: false,
      status: "open",
      verdict: "approve",
      experience: "",
      industry: "",
      subcategory: "",
    });
  });

  test("any filter param present suppresses default include", () => {
    expect(parseFilters({ status: "all" }, D).include).toEqual([]);
  });

  test("parses review dimensions", () => {
    const f = parseFilters(
      { verdict: "deny", experience: "reach", industry: "software_internet",
        subcategory: "cybersecurity" },
      D,
    );
    expect(f.verdict).toBe("deny");
    expect(f.experience).toBe("reach");
    expect(f.industry).toBe("software_internet");
    expect(f.subcategory).toBe("cybersecurity");
  });

  test("invalid verdict falls back to approve", () => {
    expect(parseFilters({ verdict: "bogus" }, D).verdict).toBe("approve");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- filters`
Expected: FAIL (Filters lacks the new keys; defaults mismatch).

- [ ] **Step 3: Update `lib/filters.ts`**

```ts
export type Status = "open" | "closed" | "all";
export type Verdict = "approve" | "deny" | "gate_rejected" | "pending" | "all";

export interface Filters {
  companies: number[];
  include: string[];
  exclude: string[];
  remoteOnly: boolean;
  status: Status;
  verdict: Verdict;
  experience: string;
  industry: string;
  subcategory: string;
}

const FILTER_KEYS = [
  "company", "include", "exclude", "remote", "status",
  "verdict", "experience", "industry", "subcategory",
] as const;

const VERDICTS: Verdict[] = ["approve", "deny", "gate_rejected", "pending", "all"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function csv(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  defaults: { include: string[] },
): Filters {
  const hasAnyFilter = FILTER_KEYS.some((k) => first(params[k]) !== undefined);
  const status = first(params.status);
  const validStatus: Status =
    status === "closed" || status === "all" ? status : "open";
  const verdictRaw = first(params.verdict);
  const verdict: Verdict =
    verdictRaw && VERDICTS.includes(verdictRaw as Verdict)
      ? (verdictRaw as Verdict)
      : "approve";

  return {
    companies: csv(first(params.company)).map(Number).filter((n) => Number.isInteger(n)),
    include: hasAnyFilter ? csv(first(params.include)) : defaults.include,
    exclude: csv(first(params.exclude)),
    remoteOnly: first(params.remote) === "1",
    status: validStatus,
    verdict,
    experience: first(params.experience) ?? "",
    industry: first(params.industry) ?? "",
    subcategory: first(params.subcategory) ?? "",
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- filters`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/filters.ts dashboard/lib/filters.test.ts
git commit -m "feat(dashboard): verdict/experience/industry filter parsing"
```

---

## Task 13: Extend `buildJobsQuery` — reviews join + new filters

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts`
- Modify: `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: extended `Filters` (Task 12).
- Produces: `buildJobsQuery(f: Filters, userId: string): SqlQuery`. The query `LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1` (userId is always `values[0]`), selects review columns, and adds WHERE clauses for verdict/experience/industry/subcategory.

- [ ] **Step 1: Rewrite the tests**

Replace `dashboard/lib/jobsQuery.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";

const UID = "user-123";
const base: Filters = {
  companies: [],
  include: [],
  exclude: [],
  remoteOnly: false,
  status: "open",
  verdict: "approve",
  experience: "",
  industry: "",
  subcategory: "",
};

describe("buildJobsQuery", () => {
  test("joins job_reviews scoped to the user via $1", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid",
    );
    expect(q.values[0]).toBe(UID);
    expect(q.text).toContain("r.verdict");
    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
  });

  test("default verdict=approve filters on r.verdict", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.verdict = 'approve'");
  });

  test("verdict=gate_rejected / pending / all", () => {
    expect(buildJobsQuery({ ...base, verdict: "gate_rejected" }, UID).text)
      .toContain("r.stage1_decision = 'reject'");
    expect(buildJobsQuery({ ...base, verdict: "pending" }, UID).text)
      .toContain("r.job_id IS NULL");
    const all = buildJobsQuery({ ...base, verdict: "all" }, UID);
    expect(all.text).not.toContain("r.verdict =");
    expect(all.text).not.toContain("r.stage1_decision =");
  });

  test("company filter placeholder shifts to $2 (userId is $1)", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, UID);
    expect(q.text).toContain("j.company_id = ANY($2)");
    expect(q.values).toEqual([UID, [1, 2]]);
  });

  test("experience/industry/subcategory become equality filters in lockstep", () => {
    const q = buildJobsQuery(
      { ...base, experience: "reach", industry: "software_internet", subcategory: "gaming" },
      UID,
    );
    expect(q.text).toContain("r.experience_match = $2");
    expect(q.text).toContain("r.industry = $3");
    expect(q.text).toContain("r.industry_subcategory = $4");
    expect(q.values).toEqual([UID, "reach", "software_internet", "gaming"]);
  });

  test("include/exclude keep placeholders aligned after userId + verdict", () => {
    const q = buildJobsQuery({ ...base, include: ["engineer"], exclude: ["manager"] }, UID);
    expect(q.text).toContain("j.title ILIKE $2");
    expect(q.text).toContain("j.title NOT ILIKE $3");
    expect(q.values).toEqual([UID, "%engineer%", "%manager%"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- jobsQuery`
Expected: FAIL (signature + join + filters not present).

- [ ] **Step 3: Rewrite `lib/jobsQuery.ts`**

```ts
import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(f: Filters, userId: string): SqlQuery {
  const values: unknown[] = [userId]; // userId is always $1 (used by the join)
  const ph = () => `$${values.length + 1}`;
  const where: string[] = [];

  if (f.status === "open") where.push("j.closed_at IS NULL");
  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");

  if (f.verdict === "approve") where.push("r.verdict = 'approve'");
  else if (f.verdict === "deny") where.push("r.verdict = 'deny'");
  else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
  else if (f.verdict === "pending") where.push("r.job_id IS NULL");
  // "all" adds no verdict clause

  if (f.companies.length) {
    where.push(`j.company_id = ANY(${ph()})`);
    values.push(f.companies);
  }
  for (const kw of f.include) {
    where.push(`j.title ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  for (const kw of f.exclude) {
    where.push(`j.title NOT ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  if (f.remoteOnly) where.push("j.remote IS TRUE");
  if (f.experience) {
    where.push(`r.experience_match = ${ph()}`);
    values.push(f.experience);
  }
  if (f.industry) {
    where.push(`r.industry = ${ph()}`);
    values.push(f.industry);
  }
  if (f.subcategory) {
    where.push(`r.industry_subcategory = ${ph()}`);
    values.push(f.subcategory);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    "SELECT j.id, j.title, j.url, j.location, j.remote,",
    "       j.first_seen_at, j.closed_at, c.name AS company_name, c.ats,",
    "       r.verdict, r.experience_match, r.industry, r.industry_subcategory,",
    "       r.confidence, r.reasoning, r.stage1_decision, r.stage1_reason",
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid",
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- jobsQuery`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat(dashboard): jobs query joins reviews + verdict/experience/industry filters"
```

---

## Task 14: Wire queries + types for reviews & review-run health

**Files:**
- Modify: `dashboard/lib/queries.ts` (`getJobs(f, userId)`, `getLatestReviewRun()`)
- Modify: `dashboard/lib/types.ts` (`JobRow` review fields, `ReviewRunRow`)
- Modify: `dashboard/vitest.config.ts` (provide a dummy `DATABASE_URL` for tests — see Step 1b)
- Test: `dashboard/lib/smoke.test.ts` (extend the existing smoke test to cover the new exports compile/shape)

> **PLAN FIX (verified 2026-06-24):** vitest does **not** load `.env.local`, so
> `process.env.DATABASE_URL` is unset under vitest. The smoke test imports
> `@/lib/queries`, which imports `@/lib/db`, which throws `"DATABASE_URL is not
> set"` at module load — the test cannot even import. postgres.js connects
> lazily, so a dummy value is enough. Set it in `vitest.config.ts` (Step 1b).

**Interfaces:**
- Consumes: `buildJobsQuery(f, userId)` (Task 13).
- Produces: `getJobs(f: Filters, userId: string): Promise<JobRow[]>`; `getLatestReviewRun(): Promise<ReviewRunRow | null>`; `JobRow` gains `verdict`, `experience_match`, `industry`, `industry_subcategory`, `confidence`, `reasoning`, `stage1_decision`, `stage1_reason` (all nullable); `ReviewRunRow`.

- [ ] **Step 1: Inspect the existing smoke test**

Read `dashboard/lib/smoke.test.ts` to match its style (it imports modules to assert they load). Add assertions that `getJobs` and `getLatestReviewRun` are exported functions:

```ts
import { describe, expect, test } from "vitest";
import * as queries from "@/lib/queries";

describe("queries module exports", () => {
  test("exposes getJobs and getLatestReviewRun", () => {
    expect(typeof queries.getJobs).toBe("function");
    expect(typeof queries.getLatestReviewRun).toBe("function");
  });
});
```

(If `smoke.test.ts` already imports `@/lib/queries`, add only the new `expect` lines rather than duplicating the import.)

- [ ] **Step 1b: Give vitest a dummy `DATABASE_URL`** (required — see PLAN FIX note above)

In `dashboard/vitest.config.ts`, add an `env` entry to the `test` block so importing `@/lib/db` (transitively, via `@/lib/queries`) does not throw. postgres.js connects lazily, so no real DB is contacted:

```ts
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- smoke`
Expected: FAIL (`getLatestReviewRun` not exported). It must fail on the missing
export / assertion — NOT on `"DATABASE_URL is not set"`. If you see the latter,
Step 1b was not applied.

- [ ] **Step 3: Extend `lib/types.ts`**

Add review fields to `JobRow` and a new `ReviewRunRow`:

```ts
export interface JobRow {
  id: string;
  title: string;
  url: string;
  location: string | null;
  remote: boolean | null;
  first_seen_at: string;
  closed_at: string | null;
  company_name: string;
  ats: string;
  verdict: string | null;
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  reasoning: string | null;
  stage1_decision: string | null;
  stage1_reason: string | null;
}

export interface ReviewRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  reviewed: number | null;
  gate_rejected: number | null;
  approved: number | null;
  denied: number | null;
  errors: number | null;
  notes: string | null;
}
```

- [ ] **Step 4: Update `lib/queries.ts`**

Change `getJobs` to take `userId` and add `getLatestReviewRun`:

```ts
import type { CompanyRow, JobRow, PollRunRow, ReviewRunRow } from "@/lib/types";

export async function getJobs(f: Filters, userId: string): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f, userId);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}

export async function getLatestReviewRun(): Promise<ReviewRunRow | null> {
  const rows = await sql`
    SELECT * FROM review_runs ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] as unknown as ReviewRunRow) ?? null;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- smoke`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/types.ts dashboard/lib/smoke.test.ts dashboard/vitest.config.ts
git commit -m "feat(dashboard): getJobs(userId) + getLatestReviewRun + review row types"
```

---

## Task 15: UI wiring — page auth gate, filter controls, verdict columns, review health

**Files:**
- Modify: `dashboard/app/page.tsx` (auth gate; pass `userId`; fetch review run)
- Modify: `dashboard/lib/config.ts` (taxonomy options for the filter dropdowns)
- Modify: `dashboard/components/FilterBar.tsx` (verdict/experience/industry/subcategory controls)
- Modify: `dashboard/components/JobsTable.tsx` (verdict/experience/industry columns + reasoning)
- Modify: `dashboard/components/Header.tsx` (review-run health + Profile/Sign-out links)

**Interfaces:**
- Consumes: `requireUserId` (Task 10), `getJobs(f, userId)`/`getLatestReviewRun` (Task 14), extended `Filters` (Task 12).
- Produces: the authenticated dashboard showing approved jobs by default with verdict metadata and review health.

- [ ] **Step 1: Add taxonomy + verdict options to `lib/config.ts`**

Append (the subcategory list mirrors `reviewer/schemas.py` Appendix A; keep them in sync):

```ts
export const VERDICT_OPTIONS = ["approve", "deny", "gate_rejected", "pending", "all"] as const;
export const EXPERIENCE_OPTIONS = ["step_down", "match", "reach", "far_reach"] as const;
export const INDUSTRY_OPTIONS = [
  "software_internet", "fintech_finance", "healthcare_life_sciences",
  "commerce_consumer", "industrial_hardware", "public_education", "services_other",
] as const;
export const SUBCATEGORY_OPTIONS = [
  "devtools_platforms", "cloud_infrastructure", "cybersecurity", "data_ml_ai",
  "devops_observability_sre", "saas_productivity", "consumer_social_media",
  "ecommerce_marketplace_tech", "gaming", "fintech_payments_crypto",
  "banking_trading_inhouse", "insurance_insurtech", "health_tech_digital_health",
  "provider_hospital_inhouse", "biotech_pharma_software", "medical_devices",
  "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
  "manufacturing_industrial_software", "iot_embedded_robotics",
  "automotive_aerospace_defense", "energy_climate_cleantech", "government_govtech",
  "education_edtech", "nonprofit_ngo", "consulting_agency_staffing",
  "telecom_networking", "other_unclear",
] as const;
```

- [ ] **Step 2: Update `app/page.tsx`** (auth gate + userId + review run)

```tsx
import { parseFilters } from "@/lib/filters";
import { getCompanies, getJobs, getLatestPollRun, getLatestReviewRun } from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { requireUserId } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun, lastReview] = await Promise.all([
    getJobs(filters, userId),
    getCompanies(),
    getLatestPollRun(),
    getLatestReviewRun(),
  ]);

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} lastReview={lastReview} />
      <FilterBar companies={companies} filters={filters} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS} />
    </main>
  );
}
```

- [ ] **Step 3: Update `components/FilterBar.tsx`** — add the review controls

Add these `<label>` blocks inside the `<form>` (before the Apply button), and import the option lists:

```tsx
import {
  VERDICT_OPTIONS, EXPERIENCE_OPTIONS, INDUSTRY_OPTIONS, SUBCATEGORY_OPTIONS,
} from "@/lib/config";
```

```tsx
      <label className="flex flex-col text-xs text-gray-600">
        Verdict
        <select name="verdict" defaultValue={filters.verdict}
          className="mt-1 rounded border px-2 py-1 text-sm">
          {VERDICT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Experience
        <select name="experience" defaultValue={filters.experience}
          className="mt-1 rounded border px-2 py-1 text-sm">
          <option value="">any</option>
          {EXPERIENCE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Industry
        <select name="industry" defaultValue={filters.industry}
          className="mt-1 rounded border px-2 py-1 text-sm">
          <option value="">any</option>
          {INDUSTRY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Subcategory
        <select name="subcategory" defaultValue={filters.subcategory}
          className="mt-1 rounded border px-2 py-1 text-sm">
          <option value="">any</option>
          {SUBCATEGORY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
```

- [ ] **Step 4: Update `components/JobsTable.tsx`** — show verdict metadata

Add a "Match" column header and a cell rendering verdict/experience/industry + reasoning. Add after the Location `<th>`:

```tsx
          <th className="px-6 py-2">Match</th>
```

And after the Location `<td>` in the row:

```tsx
            <td className="px-6 py-2 text-gray-600">
              {j.verdict ? (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {j.verdict}
                    {j.experience_match ? ` · ${j.experience_match}` : ""}
                  </span>
                  {j.industry && (
                    <span className="text-xs text-gray-500">
                      {j.industry}{j.industry_subcategory ? ` / ${j.industry_subcategory}` : ""}
                    </span>
                  )}
                  {j.reasoning && (
                    <span className="text-xs text-gray-400" title={j.reasoning}>
                      {j.reasoning.length > 80 ? `${j.reasoning.slice(0, 80)}…` : j.reasoning}
                    </span>
                  )}
                </span>
              ) : j.stage1_decision === "reject" ? (
                <span className="text-xs text-gray-400" title={j.stage1_reason ?? ""}>gate-rejected</span>
              ) : (
                <span className="text-xs text-gray-400">pending</span>
              )}
            </td>
```

- [ ] **Step 5: Update `components/Header.tsx`** — review health + nav links

Add a `lastReview` prop and render review counts + Profile/Sign-out links:

```tsx
import type { Health } from "@/lib/status";
import type { PollRunRow, ReviewRunRow } from "@/lib/types";

// ...DOT / LABEL unchanged...

export function Header({
  lastRun,
  health,
  lastReview,
}: {
  lastRun: PollRunRow | null;
  health: Health;
  lastReview: ReviewRunRow | null;
}) {
  const finished = lastRun?.finished_at
    ? new Date(lastRun.finished_at).toLocaleString()
    : "never";
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <h1 className="text-lg font-semibold">Remote Job Tracker</h1>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>Last poll: {finished}</span>
        <span className={`inline-block h-3 w-3 rounded-full ${DOT[health]}`}
          title={LABEL[health]} aria-label={LABEL[health]} />
        {lastReview && (
          <span className="text-gray-500">
            Reviews: {lastReview.approved ?? 0}✓ / {lastReview.denied ?? 0}✗
            {(lastReview.errors ?? 0) > 0 ? ` / ${lastReview.errors}⚠` : ""}
          </span>
        )}
        <a href="/profile" className="text-blue-700 hover:underline">Profile</a>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-blue-700 hover:underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Add the sign-out route**

Create `dashboard/app/auth/signout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
```

- [ ] **Step 7: Run the full dashboard suite + build**

Run: `npm test` then `npm run build`.
Expected: all vitest pass; build succeeds.

- [ ] **Step 8: Manual verification** (requires Supabase env + a created user + applied migration)

With `.env.local` set (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
1. In Supabase: enable email/password auth, create one user, create a private `resumes` Storage bucket, and apply `migrations/2026-06-24-reviews.sql`.
2. `npm run dev` → visiting `/` redirects to `/login`; sign in; land on `/`.
3. `/profile` → paste resume + instructions, save; confirm a `profiles` row exists.
4. Run the poller locally with `ANTHROPIC_API_KEY` set (`DATABASE_URL=... ANTHROPIC_API_KEY=... .venv/bin/python -m reviewer`); confirm `job_reviews` rows appear and the dashboard shows approved jobs with verdicts and review health.

- [ ] **Step 9: Commit**

```bash
git add dashboard/app/page.tsx dashboard/lib/config.ts dashboard/components dashboard/app/auth
git commit -m "feat(dashboard): auth-gated jobs view with verdict filters + review health"
```

---

## Deployment checklist (after all tasks)

- **Supabase:** apply `migrations/2026-06-24-reviews.sql`; enable email/password auth; create one user; create a **private** `resumes` Storage bucket.
- **Railway (poller service):** set `ANTHROPIC_API_KEY`, optionally `REVIEW_MODEL_STAGE1`/`REVIEW_MODEL_STAGE2`/`REVIEW_CONCURRENCY`/`REVIEW_MAX_JOBS_PER_RUN`; extend watch patterns to include `reviewer/**`.
- **Vercel (dashboard):** set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plus existing `DATABASE_URL`).
