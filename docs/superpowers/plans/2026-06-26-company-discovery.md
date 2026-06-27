# Company Auto-Discovery + AI Review + Human Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Source companies automatically from a public ATS-board dataset, AI-classify each (include/exclude/unknown) against operator company preferences with auto-apply + sticky human override, and feed approved companies into the existing poll → job-review → Rolefit pipeline.

**Architecture:** A new `discovery/` Python package (mirroring `poller/`/`reviewer/`) ingests a dataset of board tokens, single-call-reviews each company with `deepseek-v4-flash` on name + model knowledge, writes `company_reviews`, and reconciles `companies.active`. The poller flips from `targets.json`-driven to DB-driven. A new dashboard "Companies" surface shows verdicts with override controls and an out-of-credits banner.

**Tech Stack:** Python 3 + psycopg + OpenAI SDK (OpenRouter) + pydantic; Next.js (App Router) + postgres.js + TypeScript; pytest + vitest.

## Global Constraints

- **Supported ATS only:** `greenhouse`, `lever`, `ashby` (the `companies.ats` CHECK). Filter the dataset to these.
- **DB access is direct SQL via `DATABASE_URL`** — no PostgREST/RLS in the path. Python: `psycopg` with `dict_row`, bind `user_id` as a real `uuid.UUID` (no `uuid = text` operator). TS: `postgres.js` with `prepare: false`, cast bound uuids with `::uuid`.
- **Every table gets `ENABLE ROW LEVEL SECURITY` + a permissive deny-all `no_anon_access` policy** (`FOR ALL USING (false) WITH CHECK (false)`).
- **`schema.sql` is the from-scratch schema the test harness rebuilds** (`tests/conftest.py` drops+recreates `public` from it). It MUST stay in lockstep with every migration.
- **Default review model:** `deepseek/deepseek-v4-flash` (`reviewer/llm.py:DEFAULT_MODEL`, `lib/openrouter.ts:DEFAULT_MODEL_ID`).
- **`company_profile_version` = `sha256((company_instructions ?? "").encode())`** — identical formula in Python (`discovery/profile.py`) and TS (`lib/companyProfileVersion.ts`). It is the re-review-invalidation key. Unlike `profile_version`, model choice does NOT enter it.
- **Single operator:** the "board owner" is the most-recently-updated `profiles` row (`getBoardOwnerId()`).
- **New React surfaces use inline-style objects matching the Rolefit components** (`components/rolefit/*`, `app/profile/page.tsx`); Tailwind classes are acceptable where a sibling already uses them (`ModelPicker`).
- **TDD, frequent commits.** Python tests: `pytest`, DB tests gated by `@requires_db` (`TEST_DATABASE_URL`). Dashboard tests: `vitest`, **lib-only** (no component tests in this repo). Running the dev server in a worktree needs `dashboard/.env.local` copied from the main checkout (`NEXT_PUBLIC_SUPABASE_*`).

---

## Phase 1 — Schema foundation

### Task 1: Migration + schema.sql + schema test

**Files:**
- Create: `migrations/2026-06-26-company-discovery.sql`
- Modify: `schema.sql` (add columns to `companies`/`profiles`; append `company_reviews`, `discovery_runs`, `discovery_state` + their RLS)
- Test: `tests/test_company_schema.py`

**Interfaces:**
- Produces: tables `company_reviews` (PK `(user_id, company_id)`), `discovery_runs`, `discovery_state` (single row, `id=TRUE`); `companies.discovery_source`, `companies.first_seen_at`; `profiles.company_instructions`, `profiles.company_profile_version`, `profiles.model_company`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_company_schema.py
from tests.conftest import requires_db


@requires_db
def test_company_discovery_schema(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name='companies'"
        )
        company_cols = {r["column_name"] for r in cur.fetchall()}
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name='profiles'"
        )
        profile_cols = {r["column_name"] for r in cur.fetchall()}
        cur.execute("SELECT to_regclass('public.company_reviews') AS t")
        has_reviews = cur.fetchone()["t"]
        cur.execute("SELECT to_regclass('public.discovery_runs') AS t")
        has_runs = cur.fetchone()["t"]
        cur.execute("SELECT id, halted_no_credits FROM discovery_state")
        state = cur.fetchone()

    assert {"discovery_source", "first_seen_at"} <= company_cols
    assert {"company_instructions", "company_profile_version", "model_company"} <= profile_cols
    assert has_reviews is not None and has_runs is not None
    assert state is not None and state["halted_no_credits"] is False  # seeded single row


@requires_db
def test_company_reviews_rls_enabled(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT relrowsecurity FROM pg_class WHERE relname = 'company_reviews'"
        )
        assert cur.fetchone()["relrowsecurity"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_company_schema.py -v`
Expected: FAIL — columns/tables don't exist yet.

- [ ] **Step 3: Write the migration**

```sql
-- migrations/2026-06-26-company-discovery.sql
-- Company auto-discovery + AI review + human override (design 2026-06-26).

ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (discovery_source IN ('manual','seed','dataset','expansion'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS company_reviews (
  user_id                 UUID NOT NULL,
  company_id              INT  NOT NULL REFERENCES companies(id),
  company_profile_version TEXT NOT NULL,
  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning               TEXT,
  industry                TEXT,
  industry_subcategory    TEXT,
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_override          BOOLEAN NOT NULL DEFAULT FALSE,
  override_verdict        TEXT CHECK (override_verdict IN ('include','exclude')),
  model                   TEXT,
  error                   TEXT,
  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_reviews_user_verdict ON company_reviews (user_id, verdict);
CREATE INDEX IF NOT EXISTS idx_company_reviews_user_version ON company_reviews (user_id, company_profile_version);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_instructions    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_profile_version TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_company           TEXT;

CREATE TABLE IF NOT EXISTS discovery_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','halted_no_credits','error')),
  ingested    INT, reviewed INT, included INT, excluded INT, unknown INT,
  errors      INT, backlog  INT,
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_started_at ON discovery_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS discovery_state (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
  resume_requested_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO discovery_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON company_reviews FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_runs  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_runs  FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_state FOR ALL USING (false) WITH CHECK (false);
```

- [ ] **Step 4: Mirror the same end-state into `schema.sql`**

In `schema.sql`, add to the `companies` CREATE TABLE (after `active`):
```sql
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  discovery_source TEXT NOT NULL DEFAULT 'manual'
                     CHECK (discovery_source IN ('manual','seed','dataset','expansion')),
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats, token)
```
Add to the `profiles` CREATE TABLE (before `profile_version`):
```sql
  company_instructions    TEXT,
  company_profile_version TEXT,
  model_company           TEXT,
```
Append the `company_reviews`, `discovery_runs`, `discovery_state` CREATE statements (verbatim bodies from Step 3, without `IF NOT EXISTS`), the `INSERT INTO discovery_state`, and add three `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + `CREATE POLICY no_anon_access …` lines next to the existing RLS block.

- [ ] **Step 5: Run test to verify it passes**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_company_schema.py -v`
Expected: PASS.

- [ ] **Step 6: Verify the full existing suite still builds the schema**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_schema.py tests/test_db_companies.py -v`
Expected: PASS (no regressions from the `companies`/`profiles` changes).

- [ ] **Step 7: Commit**

```bash
git add migrations/2026-06-26-company-discovery.sql schema.sql tests/test_company_schema.py
git commit -m "feat(db): company discovery schema — company_reviews, discovery_runs/state, profile prefs"
```

---

## Phase 2 — Discovery backend (Python)

### Task 2: discovery config + dataset loader

**Files:**
- Create: `discovery/__init__.py` (empty)
- Create: `discovery/config.py`
- Create: `discovery/dataset.py`
- Create: `discovery/data/README.md` (source + license note)
- Modify: `.gitignore` (ignore bulk dataset JSON)
- Test: `tests/test_discovery_dataset.py`
- Test fixtures: `tests/fixtures/discovery/greenhouse_companies.json`, `lever_companies.json`, `ashby_companies.json`

**Interfaces:**
- Produces: `Candidate(name: str, ats: str, token: str)` (frozen dataclass); `load_candidates(dataset_dir: Path) -> list[Candidate]`; `config.BATCH_CAP: int`, `config.CONCURRENCY: int`, `config.dataset_dir() -> Path`, `config.has_api_key() -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_discovery_dataset.py
import json
from pathlib import Path

from discovery.dataset import Candidate, load_candidates

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "discovery"


def test_loads_and_normalizes_rows():
    cands = load_candidates(FIXTURES)
    by_key = {(c.ats, c.token): c for c in cands}
    assert ("greenhouse", "stripe") in by_key          # dict row {name, token}
    assert by_key[("greenhouse", "stripe")].name == "Stripe"
    assert ("lever", "netflix") in by_key              # bare-string row -> token==name
    assert ("ashby", "linear") in by_key
    assert all(c.ats in ("greenhouse", "lever", "ashby") for c in cands)


def test_dedups_and_lowercases_tokens():
    cands = load_candidates(FIXTURES)
    tokens = [(c.ats, c.token) for c in cands]
    assert len(tokens) == len(set(tokens))             # no dups
    assert all(c.token == c.token.lower() for c in cands)


def test_skips_malformed_and_missing(tmp_path):
    (tmp_path / "greenhouse_companies.json").write_text(
        json.dumps([{"token": "ok"}, {"name": "no token"}, 12345, {"token": ""}])
    )
    # no lever/ashby files present
    cands = load_candidates(tmp_path)
    assert [(c.ats, c.token) for c in cands] == [("greenhouse", "ok")]


def test_tolerates_bad_json(tmp_path):
    (tmp_path / "lever_companies.json").write_text("{not json")
    assert load_candidates(tmp_path) == []
```

Create the three fixtures:
```json
// tests/fixtures/discovery/greenhouse_companies.json
[{"name": "Stripe", "token": "Stripe"}, {"name": "Stripe", "token": "stripe"}]
```
```json
// tests/fixtures/discovery/lever_companies.json
["netflix", "Netflix"]
```
```json
// tests/fixtures/discovery/ashby_companies.json
[{"token": "linear", "name": "Linear"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery_dataset.py -v`
Expected: FAIL — `discovery.dataset` doesn't exist.

- [ ] **Step 3: Write config + dataset loader**

```python
# discovery/config.py
import os
from pathlib import Path

_DEFAULT_DATASET_DIR = Path(__file__).resolve().parent / "data"


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("DISCOVERY_CONCURRENCY", 5)
BATCH_CAP = _int_env("DISCOVERY_BATCH_CAP", 500)


def dataset_dir() -> Path:
    override = os.environ.get("DISCOVERY_DATASET_DIR")
    return Path(override) if override else _DEFAULT_DATASET_DIR


def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))
```

```python
# discovery/dataset.py
import json
from dataclasses import dataclass
from pathlib import Path

SUPPORTED_ATS = ("greenhouse", "lever", "ashby")


@dataclass(frozen=True)
class Candidate:
    name: str
    ats: str
    token: str


def _parse_row(ats: str, row) -> Candidate | None:
    if isinstance(row, str):
        token = row.strip()
        name = token
    elif isinstance(row, dict):
        token = str(row.get("token") or row.get("slug") or "").strip()
        name = str(row.get("name") or token).strip()
    else:
        return None
    if not token:
        return None
    return Candidate(name=name or token, ats=ats, token=token.lower())


def load_candidates(dataset_dir: Path) -> list[Candidate]:
    """Read `{ats}_companies.json` for each supported ATS; normalize + dedup.

    Tolerates missing files, bad JSON, and malformed rows (skips them).
    Each file is a JSON array of either bare token strings or
    `{"token"|"slug": str, "name"?: str}` objects.
    """
    seen: set[tuple[str, str]] = set()
    out: list[Candidate] = []
    for ats in SUPPORTED_ATS:
        path = Path(dataset_dir) / f"{ats}_companies.json"
        if not path.exists():
            continue
        try:
            rows = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            cand = _parse_row(ats, row)
            if cand is None:
                continue
            key = (cand.ats, cand.token)
            if key in seen:
                continue
            seen.add(key)
            out.append(cand)
    return out
```

```markdown
<!-- discovery/data/README.md -->
# Discovery dataset

Place `greenhouse_companies.json`, `lever_companies.json`, `ashby_companies.json`
here (JSON arrays of board tokens). Source: a Common-Crawl-harvested ATS board
list (e.g. the `job-board-aggregator` project, CC BY-NC 4.0 — non-commercial,
fine for this single-operator personal tool). Bulk files are gitignored; vendor a
pinned snapshot or download at deploy. Override the directory with
`DISCOVERY_DATASET_DIR`.
```

Add to `.gitignore`:
```
discovery/data/*_companies.json
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_discovery_dataset.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add discovery/__init__.py discovery/config.py discovery/dataset.py discovery/data/README.md .gitignore tests/test_discovery_dataset.py tests/fixtures/discovery/
git commit -m "feat(discovery): dataset loader + config"
```

---

### Task 3: company profile-version + review schema

**Files:**
- Create: `discovery/profile.py`
- Create: `discovery/schemas.py`
- Test: `tests/test_discovery_schemas.py`

**Interfaces:**
- Consumes: `reviewer.schemas` (`TAXONOMY_TEXT`, `Industry`, `Subcategory`).
- Produces: `compute_company_profile_version(company_instructions: str | None) -> str`; `CompanyReviewResult` (pydantic) with fields `verdict: Literal["include","exclude","unknown"]`, `confidence`, `reasoning`, `industry`, `industry_subcategory`, `tech_tags: list[str]`, `red_flags: list[str]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_discovery_schemas.py
import hashlib

from discovery.profile import compute_company_profile_version
from discovery.schemas import CompanyReviewResult


def test_version_is_sha256_of_instructions():
    assert compute_company_profile_version("prefer devtools") == \
        hashlib.sha256(b"prefer devtools").hexdigest()
    assert compute_company_profile_version(None) == hashlib.sha256(b"").hexdigest()


def test_result_parses_with_defaults():
    r = CompanyReviewResult.model_validate({"verdict": "unknown"})
    assert r.verdict == "unknown"
    assert r.confidence == "low"
    assert r.tech_tags == [] and r.red_flags == []
    assert r.industry is None


def test_result_full():
    r = CompanyReviewResult.model_validate({
        "verdict": "exclude", "confidence": "high", "reasoning": "defense",
        "industry": "industrial_hardware",
        "industry_subcategory": "automotive_aerospace_defense",
        "tech_tags": ["c++"], "red_flags": ["defense"],
    })
    assert r.verdict == "exclude" and r.tech_tags == ["c++"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery_schemas.py -v`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write profile.py + schemas.py**

```python
# discovery/profile.py
import hashlib


def compute_company_profile_version(company_instructions: str | None) -> str:
    """sha256 of the company preferences — the company-review invalidation key.

    MUST match dashboard/lib/companyProfileVersion.ts.
    """
    return hashlib.sha256((company_instructions or "").encode("utf-8")).hexdigest()
```

```python
# discovery/schemas.py
from typing import Literal

from pydantic import BaseModel, Field

from reviewer.schemas import Industry, Subcategory


class CompanyReviewResult(BaseModel):
    verdict: Literal["include", "exclude", "unknown"]
    confidence: Literal["low", "medium", "high"] = "low"
    reasoning: str = ""
    industry: Industry | None = None
    industry_subcategory: Subcategory | None = None
    tech_tags: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_discovery_schemas.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add discovery/profile.py discovery/schemas.py tests/test_discovery_schemas.py
git commit -m "feat(discovery): company review schema + profile-version"
```

---

### Task 4: company review LLM client + out-of-credits detection

**Files:**
- Create: `discovery/llm.py`
- Test: `tests/test_discovery_llm.py`

**Interfaces:**
- Consumes: `discovery.schemas.CompanyReviewResult`; `reviewer.schemas.TAXONOMY_TEXT`.
- Produces: `OutOfCreditsError(Exception)`; `build_company_block(company_instructions: str | None) -> str`; `_is_out_of_credits(exc) -> bool`; `CompanyReviewClient(client=None, model=None)` with `async review(*, company_block, name, ats, token) -> CompanyReviewResult` and attribute `.model`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_discovery_llm.py
import asyncio

import pytest

from discovery.llm import (
    CompanyReviewClient, OutOfCreditsError, _is_out_of_credits, build_company_block,
)
from discovery.schemas import CompanyReviewResult


class _Resp:
    def __init__(self, parsed):
        msg = type("M", (), {"parsed": parsed, "refusal": None})()
        self.choices = [type("C", (), {"message": msg})()]


class _Parse:
    def __init__(self, outcome):
        self._outcome = outcome

    async def parse(self, **kw):
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return _Resp(self._outcome)


class _Client:
    """Mimics AsyncOpenAI: client.beta.chat.completions.parse(...)."""

    def __init__(self, outcome):
        completions = type("Co", (), {"parse": _Parse(outcome).parse})()
        chat = type("Ch", (), {"completions": completions})()
        self.beta = type("B", (), {"chat": chat})()


class _Status402(Exception):
    status_code = 402


def test_is_out_of_credits_detects_402():
    assert _is_out_of_credits(_Status402()) is True
    assert _is_out_of_credits(RuntimeError("nope")) is False


def test_build_company_block_includes_prefs():
    assert "exclude defense" in build_company_block("exclude defense")
    assert "(none provided)" in build_company_block(None)


def test_review_returns_parsed_result():
    parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="devtools")
    client = CompanyReviewClient(client=_Client(parsed), model="m")
    out = asyncio.run(client.review(company_block="P", name="Linear", ats="ashby", token="linear"))
    assert out.verdict == "include"


def test_review_maps_402_to_out_of_credits():
    client = CompanyReviewClient(client=_Client(_Status402()), model="m")
    with pytest.raises(OutOfCreditsError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))


def test_review_propagates_other_errors():
    client = CompanyReviewClient(client=_Client(RuntimeError("boom")), model="m")
    with pytest.raises(RuntimeError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery_llm.py -v`
Expected: FAIL — `discovery.llm` doesn't exist.

- [ ] **Step 3: Write the client**

```python
# discovery/llm.py
import os

from discovery.schemas import CompanyReviewResult
from reviewer.schemas import TAXONOMY_TEXT

DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OutOfCreditsError(Exception):
    """OpenRouter returned HTTP 402 (insufficient credits). Halt the scan; do not retry."""


_INSTRUCTIONS = (
    "You are screening COMPANIES for one candidate against their company "
    "preferences. You are given only a company's name and its ATS slug — judge "
    "from what you actually know about the company.\n"
    "- verdict: 'include' if it fits the preferences, 'exclude' if it violates "
    "them, 'unknown' if you have NO real knowledge of this company. Do not guess: "
    "'unknown' is the correct answer when you don't recognize it.\n"
    "- confidence: low, medium, or high.\n"
    "- reasoning: one or two sentences naming the preference it matches or violates.\n"
    "- industry and industry_subcategory: one consistent pair from this taxonomy, "
    f"or null if unknown:\n{TAXONOMY_TEXT}\n"
    "- tech_tags: known stack keywords relevant to the preferences (e.g. 'java', "
    "'c++'); [] if unknown.\n"
    "- red_flags: short reasons the candidate might avoid it; [] if none."
)


def build_company_block(company_instructions: str | None) -> str:
    return (
        "CANDIDATE COMPANY PREFERENCES (which companies to include / exclude):\n"
        f"{company_instructions or '(none provided)'}"
    )


def _is_out_of_credits(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) == 402 or getattr(exc, "status", None) == 402:
        return True
    resp = getattr(exc, "response", None)
    if resp is not None and getattr(resp, "status_code", None) == 402:
        return True
    text = str(exc).lower()
    return "402" in text and "credit" in text


class CompanyReviewClient:
    def __init__(self, client=None, model: str | None = None):
        if client is None:
            from openai import AsyncOpenAI  # lazy: avoid import + key read at module load
            client = AsyncOpenAI(
                base_url=_OPENROUTER_BASE_URL,
                api_key=os.environ["OPENROUTER_API_KEY"],
                default_headers={"X-Title": "job-board"},
            )
        self._client = client
        self.model = model or os.environ.get("DISCOVERY_MODEL", DEFAULT_MODEL)

    async def review(self, *, company_block: str, name: str, ats: str,
                     token: str) -> CompanyReviewResult:
        try:
            resp = await self._client.beta.chat.completions.parse(
                model=self.model, max_tokens=700,
                messages=[
                    {"role": "system", "content": f"{company_block}\n\n{_INSTRUCTIONS}"},
                    {"role": "user", "content": f"Company: {name}\nATS: {ats}\nSlug: {token}"},
                ],
                response_format=CompanyReviewResult,
            )
        except Exception as exc:
            if _is_out_of_credits(exc):
                raise OutOfCreditsError(str(exc)) from exc
            raise
        msg = resp.choices[0].message
        if getattr(msg, "refusal", None):
            raise ValueError(f"model refused: {msg.refusal}")
        if msg.parsed is None:
            raise ValueError("OpenRouter returned no parsed output")
        return msg.parsed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_discovery_llm.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add discovery/llm.py tests/test_discovery_llm.py
git commit -m "feat(discovery): company review client + 402 out-of-credits halt signal"
```

---

### Task 5: discovery DB helpers

**Files:**
- Create: `discovery/db.py`
- Test: `tests/test_discovery_db.py`

**Interfaces:**
- Produces:
  - `load_company_profiles(conn) -> list[dict]` (only operators with non-empty `company_instructions`; columns `user_id, company_instructions, company_profile_version, model_company`).
  - `upsert_candidates(conn, candidates: list[Candidate]) -> int` (insert as `discovery_source='dataset'`, `active=FALSE`; returns new-row count).
  - `select_for_review(conn, user_id, company_profile_version, limit) -> list[dict]` (rows `id, name, ats, token`; unreviewed or stale-and-not-overridden; excludes seeds).
  - `upsert_company_review(conn, row: dict) -> None` (preserves `human_override`/`override_verdict` on conflict).
  - `reconcile_active(conn, user_id) -> None` (`active = seed OR effective_verdict='include'`).
  - `count_backlog(conn, user_id, company_profile_version) -> int`.
  - `start_discovery_run(conn) -> int`; `finish_discovery_run(conn, run_id, *, status, ingested, reviewed, included, excluded, unknown, errors, backlog, notes) -> None`.
  - `set_halted(conn, halted: bool) -> None`.
- The review-row columns: `_REVIEW_COLUMNS = ("user_id","company_id","company_profile_version","verdict","confidence","reasoning","industry","industry_subcategory","tech_tags","red_flags","model","error")`; `_JSONB_COLUMNS = ("tech_tags","red_flags")`. (`human_override`/`override_verdict` are deliberately NOT in the upsert update set.)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_discovery_db.py
import uuid

from discovery import db
from discovery.dataset import Candidate
from tests.conftest import requires_db

USER = "33333333-3333-3333-3333-333333333333"


def _candidate_review_row(company_id, verdict, pv="v1"):
    return {
        "user_id": USER, "company_id": company_id, "company_profile_version": pv,
        "verdict": verdict, "confidence": "high", "reasoning": "r",
        "industry": None, "industry_subcategory": None,
        "tech_tags": ["java"], "red_flags": [], "model": "m", "error": None,
    }


@requires_db
def test_upsert_candidates_inserts_inactive(conn):
    n = db.upsert_candidates(conn, [
        Candidate("Stripe", "greenhouse", "stripe"),
        Candidate("Linear", "ashby", "linear"),
    ])
    conn.commit()
    assert n == 2
    # idempotent: second call inserts nothing new
    assert db.upsert_candidates(conn, [Candidate("Stripe", "greenhouse", "stripe")]) == 0
    with conn.cursor() as cur:
        cur.execute("SELECT active, discovery_source FROM companies WHERE token='stripe'")
        row = cur.fetchone()
    assert row["active"] is False and row["discovery_source"] == "dataset"


@requires_db
def test_select_for_review_skips_overridden_and_current(conn):
    db.upsert_candidates(conn, [
        Candidate("A", "greenhouse", "a"),
        Candidate("B", "greenhouse", "b"),
        Candidate("C", "greenhouse", "c"),
    ])
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    # A reviewed at current version -> skip; B overridden -> skip; C unreviewed -> pick
    db.upsert_company_review(conn, _candidate_review_row(ids["a"], "include", pv="v1"))
    db.upsert_company_review(conn, _candidate_review_row(ids["b"], "exclude", pv="old"))
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
            "WHERE company_id=%s", (ids["b"],))
    conn.commit()
    picked = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert picked == {"c"}


@requires_db
def test_upsert_preserves_human_override(conn):
    db.upsert_candidates(conn, [Candidate("A", "greenhouse", "a")])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE token='a'")
        cid = cur.fetchone()["id"]
    db.upsert_company_review(conn, _candidate_review_row(cid, "exclude", pv="v1"))
    with conn.cursor() as cur:
        cur.execute("UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
                    "WHERE company_id=%s", (cid,))
    conn.commit()
    # re-review at a new version flips AI verdict but must keep the override
    db.upsert_company_review(conn, _candidate_review_row(cid, "include", pv="v2"))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT verdict, company_profile_version, human_override, override_verdict "
                    "FROM company_reviews WHERE company_id=%s", (cid,))
        r = cur.fetchone()
    assert r["verdict"] == "include" and r["company_profile_version"] == "v2"
    assert r["human_override"] is True and r["override_verdict"] == "include"


@requires_db
def test_reconcile_active_from_effective_verdict(conn):
    db.upsert_candidates(conn, [
        Candidate("Inc", "greenhouse", "inc"),
        Candidate("Exc", "greenhouse", "exc"),
        Candidate("Unk", "greenhouse", "unk"),
        Candidate("Ovr", "greenhouse", "ovr"),
    ])
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, active, discovery_source) "
                    "VALUES ('Seed','lever','seed', FALSE, 'seed')")
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    db.upsert_company_review(conn, _candidate_review_row(ids["inc"], "include"))
    db.upsert_company_review(conn, _candidate_review_row(ids["exc"], "exclude"))
    db.upsert_company_review(conn, _candidate_review_row(ids["unk"], "unknown"))
    db.upsert_company_review(conn, _candidate_review_row(ids["ovr"], "exclude"))
    with conn.cursor() as cur:
        cur.execute("UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
                    "WHERE company_id=%s", (ids["ovr"],))
    conn.commit()
    db.reconcile_active(conn, USER)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies")
        active = {r["token"]: r["active"] for r in cur.fetchall()}
    assert active["inc"] is True            # AI include
    assert active["exc"] is False           # AI exclude
    assert active["unk"] is False           # unknown -> inactive
    assert active["ovr"] is True            # override beats AI exclude
    assert active["seed"] is True           # seed always active


@requires_db
def test_run_and_state_helpers(conn):
    rid = db.start_discovery_run(conn)
    db.set_halted(conn, True)
    db.finish_discovery_run(conn, rid, status="halted_no_credits", ingested=5,
                            reviewed=3, included=1, excluded=1, unknown=1, errors=0,
                            backlog=2, notes="paused")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT status, backlog FROM discovery_runs WHERE id=%s", (rid,))
        run = cur.fetchone()
        cur.execute("SELECT halted_no_credits FROM discovery_state")
        st = cur.fetchone()
    assert run["status"] == "halted_no_credits" and run["backlog"] == 2
    assert st["halted_no_credits"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_discovery_db.py -v`
Expected: FAIL — `discovery.db` doesn't exist.

- [ ] **Step 3: Write discovery/db.py**

```python
# discovery/db.py
import uuid

from psycopg.types.json import Json

from discovery.dataset import Candidate

_REVIEW_COLUMNS = (
    "user_id", "company_id", "company_profile_version", "verdict", "confidence",
    "reasoning", "industry", "industry_subcategory", "tech_tags", "red_flags",
    "model", "error",
)
_JSONB_COLUMNS = ("tech_tags", "red_flags")

# UPSERT updates only AI columns — human_override / override_verdict are sticky.
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO company_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, company_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'company_id'))}"
    ", reviewed_at = now()"
)


def _uuid(v) -> uuid.UUID:
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def load_company_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, company_instructions, company_profile_version, model_company "
            "FROM profiles WHERE company_instructions IS NOT NULL AND company_instructions <> ''"
        )
        return cur.fetchall()


def upsert_candidates(conn, candidates: list[Candidate]) -> int:
    inserted = 0
    with conn.cursor() as cur:
        for c in candidates:
            cur.execute(
                "INSERT INTO companies (name, ats, token, active, discovery_source) "
                "VALUES (%s, %s, %s, FALSE, 'dataset') "
                "ON CONFLICT (ats, token) DO NOTHING",
                (c.name, c.ats, c.token),
            )
            inserted += cur.rowcount
    return inserted


def select_for_review(conn, user_id: str, company_profile_version: str,
                      limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.name, c.ats, c.token
            FROM companies c
            LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = %(uid)s
            WHERE c.discovery_source <> 'seed'
              AND (r.company_id IS NULL
                   OR (r.human_override = FALSE AND r.company_profile_version <> %(pv)s))
            ORDER BY c.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": company_profile_version, "lim": limit},
        )
        return cur.fetchall()


def upsert_company_review(conn, row: dict) -> None:
    full = {c: row.get(c) for c in _REVIEW_COLUMNS}
    full["user_id"] = _uuid(full["user_id"])
    for c in _JSONB_COLUMNS:
        full[c] = Json(full[c] if full[c] is not None else [])
    with conn.cursor() as cur:
        cur.execute(_UPSERT_REVIEW_SQL, full)


def reconcile_active(conn, user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE companies c SET active = sub.is_active
            FROM (
              SELECT c2.id,
                (c2.discovery_source = 'seed'
                 OR COALESCE(
                      CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
                      'exclude') = 'include') AS is_active
              FROM companies c2
              LEFT JOIN company_reviews r ON r.company_id = c2.id AND r.user_id = %(uid)s
            ) sub
            WHERE c.id = sub.id AND c.active IS DISTINCT FROM sub.is_active
            """,
            {"uid": _uuid(user_id)},
        )


def count_backlog(conn, user_id: str, company_profile_version: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)::int AS n
            FROM companies c
            LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = %(uid)s
            WHERE c.discovery_source <> 'seed'
              AND (r.company_id IS NULL
                   OR (r.human_override = FALSE AND r.company_profile_version <> %(pv)s))
            """,
            {"uid": _uuid(user_id), "pv": company_profile_version},
        )
        return cur.fetchone()["n"]


def start_discovery_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO discovery_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_discovery_run(conn, run_id: int, *, status: str, ingested: int,
                         reviewed: int, included: int, excluded: int, unknown: int,
                         errors: int, backlog: int, notes: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE discovery_runs SET
                finished_at = now(), status = %s, ingested = %s, reviewed = %s,
                included = %s, excluded = %s, unknown = %s, errors = %s,
                backlog = %s, notes = %s
            WHERE id = %s
            """,
            (status, ingested, reviewed, included, excluded, unknown, errors,
             backlog, notes, run_id),
        )


def set_halted(conn, halted: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE discovery_state SET halted_no_credits = %s, updated_at = now() WHERE id = TRUE",
            (halted,),
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_discovery_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add discovery/db.py tests/test_discovery_db.py
git commit -m "feat(discovery): db helpers — candidates, review upsert, active reconcile, runs/state"
```

---

### Task 6: discovery run orchestration + entrypoint

**Files:**
- Create: `discovery/run.py`
- Create: `discovery/__main__.py`
- Test: `tests/test_discovery_run.py`

**Interfaces:**
- Consumes: `discovery.{config,db,dataset}`, `discovery.llm.{CompanyReviewClient,OutOfCreditsError,build_company_block}`.
- Produces: `async review_batch(candidates: list[dict], company_block: str, client, concurrency: int) -> tuple[list[tuple[int, CompanyReviewResult | None, str | None]], bool]` (returns `(results, halted)`; each result `(company_id, parsed_or_None, error_or_None)`); `run(conn=None) -> None` (top-level: ingest dataset → upsert → per-profile review → reconcile → accounting).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_discovery_run.py
import asyncio
import os
import uuid

import pytest

from discovery.llm import OutOfCreditsError
from discovery.schemas import CompanyReviewResult
from discovery.run import review_batch
from tests.conftest import requires_db

USER = "44444444-4444-4444-4444-444444444444"


class StubClient:
    """No network. Verdict keyed off company name; CREDITS -> out of credits; BOOM -> error."""

    def __init__(self):
        self.model = "stub"
        self.calls = []

    async def review(self, *, company_block, name, ats, token):
        self.calls.append(name)
        if name == "CREDITS":
            raise OutOfCreditsError("402 insufficient credits")
        if name == "BOOM":
            raise RuntimeError("model down")
        verdict = {"Linear": "include", "Defense": "exclude"}.get(name, "unknown")
        return CompanyReviewResult(verdict=verdict, confidence="high", reasoning="r")


def _cands(*names):
    return [{"id": i, "name": n, "ats": "greenhouse", "token": n.lower()}
            for i, n in enumerate(names, start=1)]


def test_batch_halts_on_out_of_credits():
    client = StubClient()
    results, halted = asyncio.run(
        review_batch(_cands("Linear", "CREDITS", "Defense"), "P", client, concurrency=1))
    assert halted is True
    reviewed_ids = {cid for cid, res, err in results if res is not None}
    assert 1 in reviewed_ids                 # Linear reviewed before the halt
    # CREDITS produced no result row; the rest are not force-errored
    assert all(err is None for _, _, err in results)


def test_batch_isolates_errors():
    client = StubClient()
    results, halted = asyncio.run(
        review_batch(_cands("Linear", "BOOM"), "P", client, concurrency=2))
    assert halted is False
    by_id = {cid: (res, err) for cid, res, err in results}
    assert by_id[1][0].verdict == "include"
    assert by_id[2][1] is not None and "model down" in by_id[2][1]


@requires_db
def test_run_writes_reviews_and_reconciles(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('Linear','greenhouse','linear', FALSE, 'dataset'), "
            "('Defense','greenhouse','defense', FALSE, 'dataset')")
        cur.execute(
            "INSERT INTO profiles (user_id, instructions, company_instructions, "
            "company_profile_version, profile_version) "
            "VALUES (%s, 'i', 'prefer devtools, no defense', 'cv1', 'pv1')", (USER,))
    conn.commit()

    import discovery.run as run_module
    monkeypatch.setattr(run_module, "CompanyReviewClient", lambda **kw: StubClient())
    monkeypatch.setattr(run_module.dataset, "load_candidates", lambda _d: [])  # skip ingest
    run_module.run(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies ORDER BY token")
        active = {r["token"]: r["active"] for r in cur.fetchall()}
        cur.execute("SELECT status, included, excluded FROM discovery_runs ORDER BY id DESC LIMIT 1")
        run = cur.fetchone()
    assert active["linear"] is True and active["defense"] is False
    assert run["status"] == "completed" and run["included"] == 1 and run["excluded"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery_run.py -v`
Expected: FAIL — `discovery.run` doesn't exist.

- [ ] **Step 3: Write run.py + __main__.py**

```python
# discovery/run.py
import asyncio
import logging

from discovery import config, dataset, db
from discovery.llm import CompanyReviewClient, OutOfCreditsError, build_company_block
from discovery.profile import compute_company_profile_version

log = logging.getLogger("discovery")


async def review_batch(candidates: list[dict], company_block: str, client,
                       concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    halt = asyncio.Event()

    async def _guarded(c: dict):
        if halt.is_set():
            return None
        async with sem:
            if halt.is_set():
                return None
            try:
                res = await client.review(
                    company_block=company_block, name=c["name"],
                    ats=c["ats"], token=c["token"],
                )
                return (c["id"], res, None)
            except OutOfCreditsError:
                halt.set()  # stop launching new work; in-flight calls finish
                return None
            except Exception as exc:  # per-company isolation
                return (c["id"], None, f"{type(exc).__name__}: {exc}")

    out = await asyncio.gather(*[_guarded(c) for c in candidates])
    return [r for r in out if r is not None], halt.is_set()


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile.get("company_profile_version") \
        or compute_company_profile_version(profile.get("company_instructions"))
    run_id = db.start_discovery_run(conn)
    conn.commit()

    counts = {"reviewed": 0, "included": 0, "excluded": 0, "unknown": 0, "errors": 0}
    status, notes = "completed", None
    try:
        candidates = db.select_for_review(conn, user_id, pv, config.BATCH_CAP)
        company_block = build_company_block(profile.get("company_instructions"))
        client = CompanyReviewClient(model=profile.get("model_company"))
        results, halted = asyncio.run(
            review_batch(candidates, company_block, client, config.CONCURRENCY))

        for cid, res, err in results:
            row = {
                "user_id": user_id, "company_id": cid, "company_profile_version": pv,
                "model": client.model, "error": err,
            }
            if res is not None:
                row.update(
                    verdict=res.verdict, confidence=res.confidence, reasoning=res.reasoning,
                    industry=res.industry, industry_subcategory=res.industry_subcategory,
                    tech_tags=list(res.tech_tags), red_flags=list(res.red_flags),
                )
                counts["reviewed"] += 1
                counts[res.verdict] = counts.get(res.verdict, 0) + 1
            else:
                counts["errors"] += 1
            db.upsert_company_review(conn, row)

        db.reconcile_active(conn, user_id)
        backlog = db.count_backlog(conn, user_id, pv)
        if halted:
            status = "halted_no_credits"
            notes = f"out of credits; {backlog} pending"
            log.warning("discovery halted (no credits) for %s; backlog=%s", user_id, backlog)
        db.set_halted(conn, halted)
        conn.commit()
    except Exception:
        conn.rollback()
        status, notes = "error", "discovery errored; see logs"
        backlog = 0
        log.exception("discovery failed for %s", user_id)
    finally:
        db.finish_discovery_run(conn, run_id, status=status, ingested=0, backlog=backlog,
                                notes=notes, **counts)
        conn.commit()
    log.info("discovery complete for %s: %s status=%s", user_id, counts, status)


def run(conn=None) -> None:
    from poller import db as poller_db  # reuse the shared connection factory
    own = conn is None
    conn = conn or poller_db.connect()
    try:
        if not config.has_api_key():
            log.info("OPENROUTER_API_KEY not set; skipping discovery")
            return
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
        if own:
            conn.close()
```

```python
# discovery/__main__.py
import logging

from discovery.run import run


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    run()


if __name__ == "__main__":
    main()
```

Note: the DB test monkeypatches `run_module.dataset.load_candidates`; `ingested` is recorded per-run as 0 in `_review_user` (ingest is a top-level metric logged separately). This keeps the run accounting per-operator. Acceptable for v1.

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_discovery_run.py -v`
Expected: PASS.

- [ ] **Step 5: Run the whole Python suite**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest -q`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add discovery/run.py discovery/__main__.py tests/test_discovery_run.py
git commit -m "feat(discovery): run orchestration + entrypoint with credit-halt handling"
```

---

## Phase 3 — Poller refactor (DB-driven companies)

### Task 7: poller reads active companies from DB; targets.json is a seed

**Files:**
- Modify: `poller/db.py` (refactor `sync_companies` to seed-only; add `active_companies`)
- Modify: `poller/run.py` (iterate DB active companies, not `targets.json`)
- Test: `tests/test_poller_seed_refactor.py`

**Interfaces:**
- Consumes: `poller.targets.load_targets`.
- Produces: `sync_seed(conn, targets: list[dict]) -> None` (upsert each as `discovery_source='seed'`, `active=TRUE`; does NOT deactivate other companies); `active_companies(conn) -> list[dict]` (rows `id, name, ats, token` where `active`). `sync_companies` is replaced by `sync_seed` + `active_companies`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_poller_seed_refactor.py
from poller import db
from tests.conftest import requires_db


@requires_db
def test_sync_seed_does_not_deactivate_discovered(conn):
    # a discovered, AI-approved company already active
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('Disco','ashby','disco', TRUE, 'dataset')")
    conn.commit()
    db.sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "seed"}])
    conn.commit()
    active = {r["token"] for r in db.active_companies(conn)}
    assert "seed" in active        # seed upserted active
    assert "disco" in active       # discovered company NOT deactivated by seed sync


@requires_db
def test_sync_seed_marks_source_seed(conn):
    db.sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "seed"}])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT discovery_source, active FROM companies WHERE token='seed'")
        r = cur.fetchone()
    assert r["discovery_source"] == "seed" and r["active"] is True


@requires_db
def test_active_companies_excludes_inactive(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('On','ashby','on', TRUE, 'dataset'), ('Off','ashby','off', FALSE, 'dataset')")
    conn.commit()
    tokens = {r["token"] for r in db.active_companies(conn)}
    assert "on" in tokens and "off" not in tokens
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_poller_seed_refactor.py -v`
Expected: FAIL — `sync_seed`/`active_companies` don't exist.

- [ ] **Step 3: Refactor poller/db.py**

Replace the existing `sync_companies` function with:
```python
def sync_seed(conn, targets: list[dict]) -> None:
    """Upsert targets.json as the always-included seed. Owns ONLY seed rows —
    discovery owns `active` for everything else, so this never deactivates."""
    with conn.cursor() as cur:
        for t in targets:
            cur.execute(
                """
                INSERT INTO companies (name, ats, token, active, discovery_source)
                VALUES (%(name)s, %(ats)s, %(token)s, TRUE, 'seed')
                ON CONFLICT (ats, token)
                DO UPDATE SET name = EXCLUDED.name, active = TRUE,
                             discovery_source = 'seed'
                """,
                t,
            )


def active_companies(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, ats, token FROM companies WHERE active ORDER BY id"
        )
        return cur.fetchall()
```
(Leave `upsert_job`, `compute_newly_closed`, `get_open_external_ids`, `close_jobs`, `start_run`, `finish_run` unchanged.)

- [ ] **Step 4: Update poller/run.py to iterate DB active companies**

Replace the top of `run()` — the `targets = load_targets()` / `sync_companies` / `for t in targets` structure — with seed-sync + DB iteration:
```python
def run(dsn: str | None = None) -> None:
    targets = load_targets()
    conn = db.connect(dsn)
    try:
        run_id = db.start_run(conn)
        db.sync_seed(conn, targets)
        conn.commit()
        companies = db.active_companies(conn)

        ok = failed = new_jobs = closed_jobs = 0
        failures: list[str] = []

        for co in companies:
            ats, token, company_id = co["ats"], co["token"], co["id"]
            try:
                postings = ADAPTERS[ats](token)
                seen: set[str] = set()
                for p in postings:
                    if not p.url or not p.title:
                        log.warning(
                            "skipping malformed posting (missing url/title) for %s: %r",
                            co["name"], p.external_id,
                        )
                        continue
                    if db.upsert_job(conn, company_id, ats, token, p):
                        new_jobs += 1
                    seen.add(p.external_id)
                open_ids = db.get_open_external_ids(conn, company_id)
                closed_jobs += db.close_jobs(
                    conn, company_id, db.compute_newly_closed(open_ids, seen)
                )
                conn.commit()
                ok += 1
            except Exception as exc:  # per-company isolation (incl. dead boards)
                conn.rollback()
                failed += 1
                failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                log.exception("poll failed for %s (%s:%s)", co["name"], ats, token)

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(failures) or None,
        )
        conn.commit()
        log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                 ok, failed, new_jobs, closed_jobs)

        try:
            from reviewer.run import review_all
            review_all(conn)
        except Exception:
            log.exception("review phase failed; poll results unaffected")
    finally:
        conn.close()
```

- [ ] **Step 5: Fix the old-signature usages in existing tests**

`grep -rn "sync_companies" tests/` finds callers (e.g. `tests/test_reviewer_run.py`, `tests/test_db_companies.py`). For each, replace the `sync_companies(conn, [...])[(ats, token)]` pattern. Since `sync_seed` returns `None`, update those call sites to seed then look up the id:
```python
# was: cid = poller_db.sync_companies(conn, [{...}])[("lever", "acme")]
poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
with conn.cursor() as cur:
    cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
    cid = cur.fetchone()["id"]
```
Apply to every `sync_companies` call site. (If `tests/test_db_companies.py` asserts the old deactivation behavior, rewrite those assertions against `sync_seed` semantics: seed rows active, no deactivation of non-seed rows.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest tests/test_poller_seed_refactor.py tests/test_reviewer_run.py tests/test_db_companies.py tests/test_run.py -v`
Expected: PASS.

- [ ] **Step 7: Full suite**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest -q`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add poller/db.py poller/run.py tests/
git commit -m "refactor(poller): poll DB active companies; targets.json becomes a seed"
```

---

## Phase 4 — Dashboard data layer (TypeScript)

### Task 8: types + company profile-version + verdict format helper

**Files:**
- Modify: `dashboard/lib/types.ts` (extend `ProfileRow`; add `CompanyReviewRow`, `DiscoveryStateRow`)
- Create: `dashboard/lib/companyProfileVersion.ts`
- Create: `dashboard/lib/companies/format.ts`
- Test: `dashboard/lib/companyProfileVersion.test.ts`
- Test: `dashboard/lib/companies/format.test.ts`

**Interfaces:**
- Produces: `companyProfileVersion(companyInstructions: string | null): string`; `verdictMeta(verdict: string): { label: string; color: string; bg: string }`; types `CompanyReviewRow`, `DiscoveryStateRow`.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/lib/companyProfileVersion.test.ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { companyProfileVersion } from "@/lib/companyProfileVersion";

describe("companyProfileVersion", () => {
  it("matches sha256 of the raw instructions (parity with discovery/profile.py)", () => {
    const expected = createHash("sha256").update("prefer devtools", "utf8").digest("hex");
    expect(companyProfileVersion("prefer devtools")).toBe(expected);
  });
  it("hashes empty string for null", () => {
    const expected = createHash("sha256").update("", "utf8").digest("hex");
    expect(companyProfileVersion(null)).toBe(expected);
  });
});
```

```ts
// dashboard/lib/companies/format.test.ts
import { describe, it, expect } from "vitest";
import { verdictMeta } from "@/lib/companies/format";

describe("verdictMeta", () => {
  it("labels the three verdicts distinctly", () => {
    expect(verdictMeta("include").label).toBe("Included");
    expect(verdictMeta("exclude").label).toBe("Excluded");
    expect(verdictMeta("unknown").label).toBe("Unknown");
  });
  it("falls back for unexpected input", () => {
    expect(verdictMeta("garbage").label).toBe("Unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/companyProfileVersion.test.ts lib/companies/format.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write the modules + types**

```ts
// dashboard/lib/companyProfileVersion.ts
import { createHash } from "node:crypto";

// MUST match discovery/profile.py: sha256(company_instructions ?? "").
export function companyProfileVersion(companyInstructions: string | null): string {
  return createHash("sha256").update(companyInstructions ?? "", "utf8").digest("hex");
}
```

```ts
// dashboard/lib/companies/format.ts
// Rolefit visual tokens for company verdicts (greens/greys to match the board).
export function verdictMeta(verdict: string): { label: string; color: string; bg: string } {
  switch (verdict) {
    case "include":
      return { label: "Included", color: "#2f7d54", bg: "#e8f6ee" };
    case "exclude":
      return { label: "Excluded", color: "#b4471f", bg: "#fdece4" };
    default:
      return { label: "Unknown", color: "#8a93a3", bg: "#eef1f5" };
  }
}
```

In `dashboard/lib/types.ts`, extend `ProfileRow` (add after `model_resume`):
```ts
  company_instructions: string | null;
  company_profile_version: string | null;
  model_company: string | null;
```
And append:
```ts
export interface CompanyReviewRow {
  id: number;
  name: string;
  ats: string;
  token: string;
  discovery_source: string;
  active: boolean;
  verdict: string | null;
  override_verdict: string | null;
  human_override: boolean;
  effective_verdict: string;
  confidence: string | null;
  reasoning: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  tech_tags: string[] | null;
  red_flags: string[] | null;
}

export interface DiscoveryStateRow {
  halted_no_credits: boolean;
  resume_requested_at: string | null;
  backlog: number;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/companyProfileVersion.test.ts lib/companies/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/companyProfileVersion.ts dashboard/lib/companies/ dashboard/lib/companyProfileVersion.test.ts
git commit -m "feat(dashboard): company types, profile-version, verdict format helper"
```

---

### Task 9: company queries + profile upsert extension

**Files:**
- Modify: `dashboard/lib/queries.ts` (add company queries; extend `upsertProfile`)
- Modify: `dashboard/app/actions/profile.ts` (`saveProfileResume` preserves company fields)
- Test: `dashboard/lib/queries.test.ts` (add cases — or create if absent)

**Interfaces:**
- Produces:
  - `getCompanyReviews(userId, bucket: "include"|"exclude"|"unknown", limit?: number): Promise<CompanyReviewRow[]>`
  - `getCompanyVerdictCounts(userId): Promise<{ include: number; exclude: number; unknown: number }>`
  - `getDiscoveryState(userId): Promise<DiscoveryStateRow>`
  - `upsertProfile(...)` gains `companyInstructions: string | null` and `modelCompany: string | null` in its `data` arg; computes + persists `company_profile_version`.

- [ ] **Step 1: Write the failing test** (pure SQL-builder portions are hard to unit-test without a DB; assert the `upsertProfile` signature via a type-level smoke test and verify version wiring)

```ts
// dashboard/lib/queries.test.ts  (append; create file if it doesn't exist)
import { describe, it, expect } from "vitest";
import { companyProfileVersion } from "@/lib/companyProfileVersion";

// Guards the parity contract the queries layer relies on: the version persisted
// by upsertProfile is exactly sha256(company_instructions) and matches Python.
describe("company profile-version wiring", () => {
  it("derives a stable version from instructions", () => {
    const v1 = companyProfileVersion("prefer devtools, no defense");
    const v2 = companyProfileVersion("prefer devtools, no defense");
    const v3 = companyProfileVersion("different");
    expect(v1).toBe(v2);
    expect(v1).not.toBe(v3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `cd dashboard && npx vitest run lib/queries.test.ts`
Expected: PASS for the version case (it exercises Task 8 code). This task's substance is verified by `tsc` + the build in Step 5; the test locks the parity contract.

- [ ] **Step 3: Extend `upsertProfile` in `lib/queries.ts`**

Change the `data` param type to add:
```ts
    modelResume: string | null;
    companyInstructions: string | null;
    modelCompany: string | null;
```
Inside the function, after `const version = profileVersion(...)`, add:
```ts
  const companyVersion = companyProfileVersion(data.companyInstructions);
```
Add an import at top: `import { companyProfileVersion } from "@/lib/companyProfileVersion";`
Extend the INSERT column list + VALUES + ON CONFLICT SET:
```ts
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          model_stage1, model_stage2, preferred_locations, model_resume,
                          company_instructions, company_profile_version, model_company,
                          profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${data.modelStage1}, ${data.modelStage2},
            ${data.preferredLocations}, ${data.modelResume},
            ${data.companyInstructions}, ${companyVersion}, ${data.modelCompany},
            ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text             = EXCLUDED.resume_text,
      instructions            = EXCLUDED.instructions,
      resume_file_path        = EXCLUDED.resume_file_path,
      model_stage1            = EXCLUDED.model_stage1,
      model_stage2            = EXCLUDED.model_stage2,
      preferred_locations     = EXCLUDED.preferred_locations,
      model_resume            = EXCLUDED.model_resume,
      company_instructions    = EXCLUDED.company_instructions,
      company_profile_version = EXCLUDED.company_profile_version,
      model_company           = EXCLUDED.model_company,
      profile_version         = EXCLUDED.profile_version,
      updated_at              = now()
  `;
```

- [ ] **Step 4: Add the company query functions to `lib/queries.ts`**

Add `CompanyReviewRow`, `DiscoveryStateRow` to the type import from `@/lib/types`, then:
```ts
export async function getCompanyReviews(
  userId: string,
  bucket: "include" | "exclude" | "unknown",
  limit = 200,
): Promise<CompanyReviewRow[]> {
  const rows = await sql`
    SELECT c.id, c.name, c.ats, c.token, c.discovery_source, c.active,
           r.verdict, r.override_verdict, r.human_override,
           COALESCE(
             CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
             CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
           ) AS effective_verdict,
           r.confidence, r.reasoning, r.industry, r.industry_subcategory,
           r.tech_tags, r.red_flags
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
    WHERE c.discovery_source <> 'manual'
      AND COALESCE(
            CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
            CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
          ) = ${bucket}
    ORDER BY c.name
    LIMIT ${limit}
  `;
  return rows as unknown as CompanyReviewRow[];
}

export async function getCompanyVerdictCounts(
  userId: string,
): Promise<{ include: number; exclude: number; unknown: number }> {
  const rows = await sql`
    SELECT
      (count(*) FILTER (WHERE eff = 'include'))::int AS include,
      (count(*) FILTER (WHERE eff = 'exclude'))::int AS exclude,
      (count(*) FILTER (WHERE eff = 'unknown'))::int AS unknown
    FROM (
      SELECT COALESCE(
               CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
               CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
             ) AS eff
      FROM companies c
      LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
      WHERE c.discovery_source <> 'manual'
    ) s
  `;
  return (rows[0] as unknown as { include: number; exclude: number; unknown: number })
    ?? { include: 0, exclude: 0, unknown: 0 };
}

export async function getDiscoveryState(userId: string): Promise<DiscoveryStateRow> {
  const rows = await sql`
    SELECT s.halted_no_credits, s.resume_requested_at,
      (SELECT count(*)::int
       FROM companies c
       LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
       JOIN profiles p ON p.user_id = ${userId}::uuid
       WHERE c.discovery_source <> 'seed'
         AND (r.company_id IS NULL
              OR (r.human_override = FALSE
                  AND r.company_profile_version IS DISTINCT FROM p.company_profile_version))
      ) AS backlog
    FROM discovery_state s WHERE s.id = TRUE
  `;
  return (rows[0] as unknown as DiscoveryStateRow)
    ?? { halted_no_credits: false, resume_requested_at: null, backlog: 0 };
}
```

- [ ] **Step 5: Update `saveProfileResume` in `app/actions/profile.ts` to preserve company fields**

In the `upsertProfile(...)` call, add:
```ts
    modelResume: existing?.model_resume ?? null,
    companyInstructions: existing?.company_instructions ?? null,
    modelCompany: existing?.model_company ?? null,
```

- [ ] **Step 6: Typecheck + test**

Run: `cd dashboard && npx vitest run lib/queries.test.ts && npx tsc --noEmit`
Expected: vitest PASS; `tsc` clean (no callers of `upsertProfile` left without the new fields — `saveProfile` in `app/profile/page.tsx` is updated in Task 13, so if `tsc` flags it here, temporarily pass `companyInstructions: null, modelCompany: null` there and finalize in Task 13).

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/app/actions/profile.ts dashboard/lib/queries.test.ts
git commit -m "feat(dashboard): company review queries + profile company-prefs persistence"
```

---

### Task 10: server actions (override, refresh) + OpenRouter credits

**Files:**
- Create: `dashboard/app/actions/companies.ts`
- Modify: `dashboard/lib/openrouter.ts` (add `getOpenRouterCredits`)
- Test: `dashboard/lib/openrouter.test.ts` (add a credits case)

**Interfaces:**
- Produces: `getOpenRouterCredits(fetchImpl?, apiKey?): Promise<number | null>` (remaining credits, or `null` if unknown/error); server actions `setCompanyOverride(companyId: number, verdict: "include"|"exclude"): Promise<void>`, `refreshDiscoveryStatus(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// dashboard/lib/openrouter.test.ts  (append)
import { getOpenRouterCredits } from "@/lib/openrouter";

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () =>
    ({ ok, json: async () => body })) as unknown as typeof fetch;
}

describe("getOpenRouterCredits", () => {
  it("returns remaining = total - usage", async () => {
    const f = fakeFetch({ data: { total_credits: 10, total_usage: 3 } });
    expect(await getOpenRouterCredits(f, "key")).toBe(7);
  });
  it("returns null without an api key", async () => {
    expect(await getOpenRouterCredits(fakeFetch({}), "")).toBeNull();
  });
  it("returns null on a failed response", async () => {
    expect(await getOpenRouterCredits(fakeFetch({}, false), "key")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/openrouter.test.ts`
Expected: FAIL — `getOpenRouterCredits` undefined.

- [ ] **Step 3: Add `getOpenRouterCredits` to `lib/openrouter.ts`**

```ts
const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

// Remaining OpenRouter credits (total - usage), or null when unknown (no key,
// transient error). Used by the out-of-credits banner's Refresh to self-clear.
export async function getOpenRouterCredits(
  fetchImpl: typeof fetch = fetch,
  apiKey: string | undefined = process.env.OPENROUTER_API_KEY,
): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchImpl(OPENROUTER_CREDITS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const d = json?.data;
    if (!d || typeof d.total_credits !== "number" || typeof d.total_usage !== "number") {
      return null;
    }
    return d.total_credits - d.total_usage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write the server actions**

```ts
// dashboard/app/actions/companies.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getOpenRouterCredits } from "@/lib/openrouter";

// Sticky human override. Upserts the override onto the review row (creating a
// minimal row if the company was never AI-reviewed), then flips companies.active.
export async function setCompanyOverride(
  companyId: number,
  verdict: "include" | "exclude",
): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO company_reviews
      (user_id, company_id, company_profile_version, human_override, override_verdict, reviewed_at)
    VALUES (${userId}::uuid, ${companyId}, '', TRUE, ${verdict}, now())
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      human_override = TRUE, override_verdict = ${verdict}, reviewed_at = now()
  `;
  await sql`UPDATE companies SET active = ${verdict === "include"} WHERE id = ${companyId}`;
  revalidatePath("/companies");
}

// Refresh: re-check credits; clear the halt if topped up; flag a resume so the
// next discovery run drains the backlog.
export async function refreshDiscoveryStatus(): Promise<void> {
  await requireUserId();
  const remaining = await getOpenRouterCredits();
  const hasCredits = remaining === null ? false : remaining > 0;
  await sql`
    UPDATE discovery_state SET
      halted_no_credits = CASE WHEN ${hasCredits} THEN FALSE ELSE halted_no_credits END,
      resume_requested_at = now(),
      updated_at = now()
    WHERE id = TRUE
  `;
  revalidatePath("/companies");
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `cd dashboard && npx vitest run lib/openrouter.test.ts && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/actions/companies.ts dashboard/lib/openrouter.ts dashboard/lib/openrouter.test.ts
git commit -m "feat(dashboard): override + refresh server actions; OpenRouter credits check"
```

---

## Phase 5 — Dashboard UI

### Task 11: company components (credit banner, card, list)

**Files:**
- Create: `dashboard/components/companies/CreditBanner.tsx`
- Create: `dashboard/components/companies/CompanyCard.tsx`
- Create: `dashboard/components/companies/CompanyList.tsx`

**Interfaces:**
- Consumes: `CompanyReviewRow`, `DiscoveryStateRow` (`@/lib/types`); `verdictMeta` (`@/lib/companies/format`); `setCompanyOverride`, `refreshDiscoveryStatus` (`@/app/actions/companies`).
- Produces: `<CreditBanner state={...} refresh={...} />`, `<CompanyCard company={...} override={...} />`, `<CompanyList included={...} excluded={...} unknown={...} counts={...} state={...} />` (client component owning tab state).

- [ ] **Step 1: Write CreditBanner.tsx**

```tsx
// dashboard/components/companies/CreditBanner.tsx
"use client";

import { useTransition } from "react";
import type { DiscoveryStateRow } from "@/lib/types";

export function CreditBanner({
  state, refresh,
}: { state: DiscoveryStateRow; refresh: () => Promise<void> }) {
  const [pending, start] = useTransition();
  if (!state.halted_no_credits) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 16px", margin: "0 0 16px",
      background: "#fdf3e6", border: "1px solid #f3d9ad",
      borderRadius: "12px", color: "#8a5a12", fontSize: "13px", fontWeight: 600,
    }}>
      <span>⚠️ Company scan paused — OpenRouter out of credits.
        {state.backlog > 0 ? ` ${state.backlog.toLocaleString()} companies still pending.` : ""}
      </span>
      <button
        onClick={() => start(async () => { await refresh(); })}
        disabled={pending}
        style={{
          marginLeft: "auto", fontWeight: 700, fontSize: "12.5px", color: "#fff",
          background: "#3b6fd4", border: "none", borderRadius: "9px",
          padding: "8px 14px", cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write CompanyCard.tsx**

```tsx
// dashboard/components/companies/CompanyCard.tsx
"use client";

import { useTransition } from "react";
import type { CompanyReviewRow } from "@/lib/types";
import { verdictMeta } from "@/lib/companies/format";

export function CompanyCard({
  company, override,
}: {
  company: CompanyReviewRow;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const meta = verdictMeta(company.effective_verdict);
  const tags = [...(company.tech_tags ?? []), ...(company.red_flags ?? [])];

  const act = (verdict: "include" | "exclude") =>
    start(async () => { await override(company.id, verdict); });

  return (
    <div style={{
      background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px",
      padding: "16px 18px", marginBottom: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", color: "#161d29" }}>{company.name}</div>
        <span style={{
          fontSize: "11px", fontWeight: 700, color: meta.color, background: meta.bg,
          borderRadius: "20px", padding: "3px 9px",
        }}>{meta.label}{company.human_override ? " · you" : ""}</span>
        <span style={{ fontSize: "11.5px", color: "#9aa3b0", marginLeft: "auto" }}>
          {company.ats} · {company.token}
        </span>
      </div>
      {company.reasoning && (
        <div style={{ fontSize: "12.5px", color: "#5b6472", marginTop: "8px", lineHeight: 1.5 }}>
          {company.reasoning}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
          {tags.map((t) => (
            <span key={t} style={{
              fontSize: "11px", fontWeight: 600, color: "#6b7585",
              background: "#f3f5f9", borderRadius: "7px", padding: "3px 8px",
            }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={() => act("include")} disabled={pending}
          style={overrideBtn(company.effective_verdict === "include")}>
          Include
        </button>
        <button onClick={() => act("exclude")} disabled={pending}
          style={overrideBtn(company.effective_verdict === "exclude")}>
          Exclude
        </button>
      </div>
    </div>
  );
}

function overrideBtn(active: boolean): React.CSSProperties {
  return {
    fontWeight: 700, fontSize: "12.5px",
    color: active ? "#fff" : "#5b6472",
    background: active ? "#3b6fd4" : "#fff",
    border: `1px solid ${active ? "#3b6fd4" : "#dfe3ea"}`,
    borderRadius: "9px", padding: "7px 14px", cursor: "pointer",
  };
}
```

- [ ] **Step 3: Write CompanyList.tsx**

```tsx
// dashboard/components/companies/CompanyList.tsx
"use client";

import { useState } from "react";
import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreditBanner } from "@/components/companies/CreditBanner";

type Bucket = "include" | "exclude" | "unknown";

export function CompanyList({
  included, excluded, unknown, counts, state, override, refresh,
}: {
  included: CompanyReviewRow[];
  excluded: CompanyReviewRow[];
  unknown: CompanyReviewRow[];
  counts: { include: number; exclude: number; unknown: number };
  state: DiscoveryStateRow;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Bucket>("include");
  const rows = tab === "include" ? included : tab === "exclude" ? excluded : unknown;
  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "include", label: "Included", n: counts.include },
    { key: "exclude", label: "Excluded", n: counts.exclude },
    { key: "unknown", label: "Unknown", n: counts.unknown },
  ];

  return (
    <div>
      <CreditBanner state={state} refresh={refresh} />
      <div style={{ display: "inline-flex", background: "#eef1f5", borderRadius: "10px",
        padding: "3px", marginBottom: "16px" }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              padding: "8px 16px", borderRadius: "8px",
              background: active ? "#fff" : "transparent",
              color: active ? "#1f2430" : "#8a93a3",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}>
              {t.label} <span style={{ color: "#9aa3b0" }}>{t.n}</span>
            </button>
          );
        })}
      </div>
      {rows.length === 0
        ? <div style={{ fontSize: "13px", color: "#9aa3b0", padding: "20px 0" }}>No companies here yet.</div>
        : rows.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/companies/
git commit -m "feat(dashboard): company review components — banner, card, tabbed list"
```

---

### Task 12: Companies page + nav link

**Files:**
- Create: `dashboard/app/companies/page.tsx`
- Modify: `dashboard/components/rolefit/Header.tsx` (add a "Companies" nav link)

**Interfaces:**
- Consumes: `getBoardOwnerId`, `getCompanyReviews`, `getCompanyVerdictCounts`, `getDiscoveryState` (`@/lib/queries`); `setCompanyOverride`, `refreshDiscoveryStatus` (`@/app/actions/companies`); `<CompanyList />`.

- [ ] **Step 1: Write the page**

```tsx
// dashboard/app/companies/page.tsx
import { getBoardOwnerId, getCompanyReviews, getCompanyVerdictCounts, getDiscoveryState }
  from "@/lib/queries";
import { setCompanyOverride, refreshDiscoveryStatus } from "@/app/actions/companies";
import { CompanyList } from "@/components/companies/CompanyList";
import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "40px 20px 64px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: "780px", margin: "0 auto",
};

export default async function CompaniesPage() {
  const userId = await getBoardOwnerId();
  if (!userId) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <a href="/" style={{ fontSize: "12.5px", fontWeight: 600, color: "#5b6472", textDecoration: "none" }}>← Back</a>
          <h1 style={{ marginTop: "16px", fontSize: "22px", fontWeight: 800 }}>Companies</h1>
          <p style={{ fontSize: "13px", color: "#8a93a3" }}>
            Set up a profile with company preferences to start discovering companies.
          </p>
        </div>
      </main>
    );
  }

  const [included, excluded, unknown, counts, state]: [
    CompanyReviewRow[], CompanyReviewRow[], CompanyReviewRow[],
    { include: number; exclude: number; unknown: number }, DiscoveryStateRow,
  ] = await Promise.all([
    getCompanyReviews(userId, "include"),
    getCompanyReviews(userId, "exclude"),
    getCompanyReviews(userId, "unknown"),
    getCompanyVerdictCounts(userId),
    getDiscoveryState(userId),
  ]);

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <a href="/" style={{ fontSize: "12.5px", fontWeight: 600, color: "#5b6472", textDecoration: "none" }}>← Back to board</a>
        <h1 style={{ margin: "16px 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Companies
        </h1>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#8a93a3", marginBottom: "22px" }}>
          AI-classified against your company preferences. Override any decision — it sticks.{" "}
          <a href="/profile" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
            Edit preferences →
          </a>
        </div>
        <CompanyList
          included={included} excluded={excluded} unknown={unknown}
          counts={counts} state={state}
          override={setCompanyOverride} refresh={refreshDiscoveryStatus}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add a nav link in Header.tsx**

In `components/rolefit/Header.tsx`, in the right cluster `<div>` (the one holding operator signals + profile button), add a link before the profile button:
```tsx
        <a href="/companies" style={{
          fontWeight: 700, fontSize: "13px", color: "#3b6fd4",
          textDecoration: "none", padding: "9px 6px",
        }}>
          Companies
        </a>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd dashboard && npx tsc --noEmit && npm run build`
Expected: clean typecheck; build succeeds (`next build` does not run middleware against requests, so it passes without `NEXT_PUBLIC_SUPABASE_*`).

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/companies/ dashboard/components/rolefit/Header.tsx
git commit -m "feat(dashboard): Companies page + header nav link"
```

---

### Task 13: company preferences on the Profile page

**Files:**
- Modify: `dashboard/app/profile/page.tsx` (add `company_instructions` textarea + `model_company` picker; wire `saveProfile`)

**Interfaces:**
- Consumes: `upsertProfile` (extended in Task 9), `ModelPicker`, `validateModelId`, `getStructuredModels`, `CURATED_MODELS`, `DEFAULT_MODEL_ID`.

- [ ] **Step 1: Extend the `saveProfile` server action**

In `app/profile/page.tsx`, inside `saveProfile`, after the existing `model_resume` validation, add a company-preferences read + model validation:
```ts
  const companyInstructions =
    (String(formData.get("company_instructions") ?? "")).trim() || null;
  const mc = validateModelId(String(formData.get("model_company") ?? ""), catalogIds);
  if (!mc.ok) throw new Error(mc.reason);
```
Then extend the `upsertProfile(...)` call:
```ts
  await upsertProfile(userId, {
    resumeText, instructions, resumeFilePath,
    modelStage1: s1.value, modelStage2: s2.value,
    preferredLocations, modelResume: r.value,
    companyInstructions, modelCompany: mc.value,
  });
```

- [ ] **Step 2: Add the form fields**

After the existing `Instructions (focus / avoid)` `<label>` block (and before `<LocationPicker>`), add the company-preferences textarea, mirroring the instructions field:
```tsx
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Company preferences (include / exclude)</span>
            <span style={hintStyle}>
              Which companies to surface or skip — used by company discovery.
            </span>
            <textarea
              name="company_instructions"
              rows={4}
              defaultValue={profile?.company_instructions ?? ""}
              placeholder="e.g. prefer devtools & AI infra; exclude defense; avoid legacy Java/C/C++ shops"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
```
Inside the `modelsCardStyle` `<div>` (the review-models block), add a fourth picker after the résumé one:
```tsx
            <ModelPicker
              label="Company review model"
              name="model_company" models={models} curated={CURATED_MODELS}
              defaultValue={profile?.model_company ?? null} placeholder={DEFAULT_MODEL_ID} />
```

- [ ] **Step 3: Typecheck + build**

Run: `cd dashboard && npx tsc --noEmit && npm run build`
Expected: clean. (`upsertProfile` now receives `companyInstructions`/`modelCompany` from every caller — resolves any temporary stub left in Task 9 Step 6.)

- [ ] **Step 4: Full dashboard test run**

Run: `cd dashboard && npx vitest run`
Expected: PASS (all lib tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/profile/page.tsx
git commit -m "feat(dashboard): company-preferences textarea + model on profile page"
```

---

## Final verification

- [ ] **Python:** `TEST_DATABASE_URL=$TEST_DATABASE_URL pytest -q` — all pass.
- [ ] **Dashboard:** `cd dashboard && npx vitest run && npx tsc --noEmit && npm run build` — all clean.
- [ ] **Manual smoke (optional, needs `dashboard/.env.local` copied from main checkout):** copy env, `npm run dev`, visit `/companies` and `/profile`; confirm the page renders, tabs switch, and the profile saves company preferences.
- [ ] **One-time real run (operator):** place dataset JSON in `discovery/data/` (or set `DISCOVERY_DATASET_DIR`), set `OPENROUTER_API_KEY`, set company preferences via `/profile`, then `python -m discovery`. Confirm `discovery_runs` row, `company_reviews` populated, and approved companies become `active` and start polling on the next `python -m poller`.

---

## Operational notes (post-merge, not code)
- **Cron:** add a slow Railway cron for `python -m discovery` (e.g. weekly) separate from the 2–4h poll. The first full pass (~$10 at `deepseek-v4-flash`) can be run manually.
- **Backlog drain:** if a run halts on credits, top up, then click **Refresh** on `/companies` (clears the halt + flags resume) and let the next discovery run drain the pending companies — `select_for_review` resumes automatically.
