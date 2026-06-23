# Poller + Database Implementation Plan (M0–M2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python poller that reads `targets.json`, fetches open roles from Greenhouse/Lever/Ashby, normalizes them, upserts into Supabase Postgres with new/closed detection, records each run, and exits cleanly — then deploy it as a Railway cron service.

**Architecture:** A single Python package (`poller/`) runnable via `python -m poller`. Pure adapter parsers (fixture-tested, no network) feed a thin HTTP fetch layer; a direct-SQL DB layer (psycopg v3) handles company sync, idempotent job upsert, closed-detection, and `poll_runs` accounting. A run orchestrator wires these together with per-company fault isolation and a guaranteed clean exit. This plan **owns the database schema** (`schema.sql`) as the source of truth; the dashboard plan consumes it read-only.

**Tech Stack:** Python 3.12, `httpx`, `psycopg[binary]` v3, `pytest`. Supabase (managed Postgres, free tier). Railway cron service (Nixpacks, no Dockerfile).

## Global Constraints

These apply to **every** task below. Values copied verbatim from the PRD (§6–§10).

- Python **3.12**. Single entry point: `python -m poller`.
- DB access is **direct SQL via psycopg v3** — NOT PostgREST/Data API, NOT RLS.
- The poller process **MUST close all DB connections and return** when finished (FR-6 / §9). A lingering process causes Railway to **skip** the next cron run.
- **Per-company fault isolation (FR-4):** one company's API erroring or changing shape must not abort the run or mass-close any company's jobs. Wrap each adapter call in try/except, record the failure, continue. **Closed-detection runs ONLY for companies whose fetch succeeded.**
- **Idempotent (AC-1):** re-running against the same feeds must produce **zero** new inserts and **zero** `first_seen_at` changes.
- Job primary key is the string `{ats}:{token}:{external_id}`.
- `ats` is always one of exactly: `greenhouse`, `lever`, `ashby`.
- Network calls get a **timeout and small retry-with-backoff**.
- **Never commit credentials.** The DB connection string is read from the `DATABASE_URL` environment variable.
- Remote detection is **best-effort**: `remote = True` if the ATS exposes a remote flag OR the location string matches `/remote/i`; otherwise unknown (`None`), or `False` only when the ATS explicitly says non-remote.

---

## File Structure

| Path | Responsibility |
|---|---|
| `pyproject.toml` | Package metadata, deps (`httpx`, `psycopg[binary]`), dev deps (`pytest`), pytest config. |
| `poller/__init__.py` | Marks the package (empty). |
| `poller/__main__.py` | Entry point for `python -m poller`: configure logging, call `run()`. |
| `poller/models.py` | `Posting` dataclass (normalized adapter output). |
| `poller/normalize.py` | `detect_remote()` best-effort remote heuristic. |
| `poller/http.py` | `get_json()` — HTTP GET with timeout + retry/backoff. |
| `poller/adapters/__init__.py` | `ADAPTERS` registry mapping ats → fetch function. |
| `poller/adapters/greenhouse.py` | `parse_greenhouse()` (pure) + `fetch_greenhouse()`. |
| `poller/adapters/lever.py` | `parse_lever()` (pure) + `fetch_lever()`. |
| `poller/adapters/ashby.py` | `parse_ashby()` (pure) + `fetch_ashby()`. |
| `poller/targets.py` | `load_targets()` — read/validate `targets.json`. |
| `poller/db.py` | Direct-SQL DB layer: connect, company sync, job upsert, closed-detection, poll_runs. |
| `poller/run.py` | `run()` orchestrator: load targets, sync companies, poll each with isolation, record run. |
| `targets.json` | Committed target company list (source of the `companies` table). |
| `schema.sql` | **Source-of-truth** DB schema (companies, jobs, poll_runs). |
| `tests/conftest.py` | Pytest fixtures: transactional/throwaway test DB (`TEST_DATABASE_URL`). |
| `tests/fixtures/*.json` | Captured ATS payloads for adapter unit tests. |
| `tests/test_*.py` | Unit + integration tests. |
| `.env.example` | Documents `DATABASE_URL` / `TEST_DATABASE_URL` (no real secrets). |
| `.gitignore` | Ignore `.env`, `__pycache__`, `.venv`, `.pytest_cache`. |
| `railway.json` | Railway deploy config: start command `python -m poller`. |

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`, `poller/__init__.py`, `tests/__init__.py`, `tests/test_smoke.py`, `.gitignore`, `.env.example`, `targets.json`

**Interfaces:**
- Consumes: nothing.
- Produces: an importable `poller` package and a working `pytest` command.

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "job-board-poller"
version = "0.1.0"
description = "Remote job tracker poller"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "psycopg[binary]>=3.2",
]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "integration: tests that require TEST_DATABASE_URL (a throwaway Postgres)",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools]
packages = ["poller", "poller.adapters"]
```

- [ ] **Step 2: Create empty package + test files**

`poller/__init__.py`: empty file.
`tests/__init__.py`: empty file.

`.gitignore`:
```
.env
.venv/
__pycache__/
*.pyc
.pytest_cache/
```

`.env.example`:
```
# Production / poller connection (Supabase direct connection or session pooler, port 5432)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
# Throwaway Postgres for integration tests (its public schema is DROPPED each test)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/poller_test
```

`targets.json` (seed with 2 real companies for M1 verification — adjust tokens as needed):
```json
[
  { "name": "Anthropic", "ats": "ashby", "token": "anthropic" },
  { "name": "Modal", "ats": "greenhouse", "token": "modallabs" }
]
```

- [ ] **Step 3: Write the smoke test**

`tests/test_smoke.py`:
```python
def test_package_imports():
    import poller  # noqa: F401
```

- [ ] **Step 4: Create venv, install, run the smoke test**

Run:
```bash
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest tests/test_smoke.py -v
```
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml poller/__init__.py tests/__init__.py tests/test_smoke.py .gitignore .env.example targets.json
git commit -m "chore: scaffold poller package and pytest"
```

---

## Task 2: Posting model + remote detection

**Files:**
- Create: `poller/models.py`, `poller/normalize.py`, `tests/test_normalize.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Posting(external_id: str, title: str, url: str, location: str|None=None, department: str|None=None, remote: bool|None=None, raw: dict={})`
  - `detect_remote(location: str|None, explicit: bool|None=None) -> bool|None`

- [ ] **Step 1: Write the failing test**

`tests/test_normalize.py`:
```python
from poller.models import Posting
from poller.normalize import detect_remote


def test_posting_defaults():
    p = Posting(external_id="1", title="Engineer", url="https://x")
    assert p.location is None and p.department is None
    assert p.remote is None and p.raw == {}


def test_explicit_true_wins():
    assert detect_remote("New York", explicit=True) is True


def test_location_regex_when_no_flag():
    assert detect_remote("Remote - US", explicit=None) is True
    assert detect_remote("San Francisco", explicit=None) is None


def test_explicit_false_but_location_says_remote():
    # PRD: remote=True if flag OR location matches
    assert detect_remote("Remote", explicit=False) is True


def test_explicit_false_and_onsite_location():
    assert detect_remote("Berlin", explicit=False) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_normalize.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.normalize'`.

- [ ] **Step 3: Write the implementation**

`poller/models.py`:
```python
from dataclasses import dataclass, field


@dataclass
class Posting:
    external_id: str
    title: str
    url: str
    location: str | None = None
    department: str | None = None
    remote: bool | None = None
    raw: dict = field(default_factory=dict)
```

`poller/normalize.py`:
```python
import re

_REMOTE_RE = re.compile(r"remote", re.IGNORECASE)


def detect_remote(location: str | None, explicit: bool | None = None) -> bool | None:
    """Best-effort remote heuristic (PRD §6).

    True if the ATS flag is True OR the location string matches /remote/i.
    False only if the ATS explicitly says non-remote and the location does not match.
    None when unknown.
    """
    if explicit is True:
        return True
    if location and _REMOTE_RE.search(location):
        return True
    if explicit is False:
        return False
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_normalize.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add poller/models.py poller/normalize.py tests/test_normalize.py
git commit -m "feat: add Posting model and detect_remote heuristic"
```

---

## Task 3: HTTP layer (timeout + retry/backoff)

**Files:**
- Create: `poller/http.py`, `tests/test_http.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `get_json(url: str, *, retries: int=2, backoff: float=0.5, timeout: float=10.0) -> Any` — performs a GET, raises for HTTP errors, retries transient failures with exponential backoff, returns parsed JSON.

- [ ] **Step 1: Write the failing test**

`tests/test_http.py`:
```python
import httpx
import pytest

import poller.http as http_mod
from poller.http import get_json


class _Resp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


def test_returns_json_on_success(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda url, **kw: _Resp({"ok": True}))
    assert get_json("https://x") == {"ok": True}


def test_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    def flaky(url, **kw):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ConnectError("down")
        return _Resp({"ok": True})

    monkeypatch.setattr(httpx, "get", flaky)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    assert get_json("https://x", retries=2, backoff=0.01) == {"ok": True}
    assert calls["n"] == 3


def test_raises_after_exhausting_retries(monkeypatch):
    def always_fail(url, **kw):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", always_fail)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    with pytest.raises(httpx.HTTPError):
        get_json("https://x", retries=2, backoff=0.01)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_http.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.http'`.

- [ ] **Step 3: Write the implementation**

`poller/http.py`:
```python
import time
from typing import Any

import httpx

DEFAULT_TIMEOUT = 10.0
_HEADERS = {"User-Agent": "job-board-poller/0.1"}


def get_json(
    url: str,
    *,
    retries: int = 2,
    backoff: float = 0.5,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            resp = httpx.get(url, timeout=timeout, headers=_HEADERS)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(backoff * (2**attempt))
    assert last_exc is not None
    raise last_exc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_http.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add poller/http.py tests/test_http.py
git commit -m "feat: add get_json with timeout and retry/backoff"
```

---

## Task 4: Greenhouse adapter

**Files:**
- Create: `poller/adapters/__init__.py` (empty for now), `poller/adapters/greenhouse.py`, `tests/fixtures/greenhouse.json`, `tests/test_greenhouse.py`

**Interfaces:**
- Consumes: `Posting`, `detect_remote`, `get_json`.
- Produces:
  - `parse_greenhouse(data: dict) -> list[Posting]` (pure).
  - `fetch_greenhouse(token: str) -> list[Posting]` (GETs `https://boards-api.greenhouse.io/v1/boards/{token}/jobs`).

- [ ] **Step 1: Create the fixture**

`tests/fixtures/greenhouse.json` (trimmed real-shape payload):
```json
{
  "jobs": [
    {
      "id": 4012345,
      "title": "Senior Software Engineer",
      "updated_at": "2026-06-20T12:00:00-04:00",
      "location": { "name": "Remote - US" },
      "absolute_url": "https://boards.greenhouse.io/acme/jobs/4012345",
      "departments": [{ "id": 1, "name": "Engineering" }]
    },
    {
      "id": 4012346,
      "title": "Product Manager",
      "updated_at": "2026-06-19T09:00:00-04:00",
      "location": { "name": "New York, NY" },
      "absolute_url": "https://boards.greenhouse.io/acme/jobs/4012346",
      "departments": []
    }
  ],
  "meta": { "total": 2 }
}
```

- [ ] **Step 2: Write the failing test**

`tests/test_greenhouse.py`:
```python
import json
from pathlib import Path

from poller.adapters.greenhouse import parse_greenhouse

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "greenhouse.json").read_text())


def test_parses_all_postings():
    postings = parse_greenhouse(FIXTURE)
    assert len(postings) == 2


def test_field_mapping():
    eng = parse_greenhouse(FIXTURE)[0]
    assert eng.external_id == "4012345"
    assert eng.title == "Senior Software Engineer"
    assert eng.url == "https://boards.greenhouse.io/acme/jobs/4012345"
    assert eng.location == "Remote - US"
    assert eng.department == "Engineering"
    assert eng.remote is True  # location matches /remote/i
    assert eng.raw["id"] == 4012345


def test_missing_department_is_none():
    pm = parse_greenhouse(FIXTURE)[1]
    assert pm.department is None
    assert pm.remote is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_greenhouse.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.adapters.greenhouse'`.

- [ ] **Step 4: Write the implementation**

`poller/adapters/__init__.py`: empty file (registry added in Task 7).

`poller/adapters/greenhouse.py`:
```python
from poller.http import get_json
from poller.models import Posting
from poller.normalize import detect_remote


def parse_greenhouse(data: dict) -> list[Posting]:
    postings: list[Posting] = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name")
        depts = j.get("departments") or []
        dept = depts[0].get("name") if depts else None
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["title"],
                url=j["absolute_url"],
                location=loc,
                department=dept,
                remote=detect_remote(loc, None),
                raw=j,
            )
        )
    return postings


def fetch_greenhouse(token: str) -> list[Posting]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
    return parse_greenhouse(get_json(url))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_greenhouse.py -v`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add poller/adapters/__init__.py poller/adapters/greenhouse.py tests/fixtures/greenhouse.json tests/test_greenhouse.py
git commit -m "feat: add Greenhouse adapter with field-mapping tests"
```

---

## Task 5: Lever adapter

**Files:**
- Create: `poller/adapters/lever.py`, `tests/fixtures/lever.json`, `tests/test_lever.py`

**Interfaces:**
- Consumes: `Posting`, `detect_remote`, `get_json`.
- Produces:
  - `parse_lever(data: list) -> list[Posting]` (pure; Lever returns a JSON array).
  - `fetch_lever(token: str) -> list[Posting]` (GETs `https://api.lever.co/v0/postings/{token}?mode=json`).

- [ ] **Step 1: Create the fixture**

`tests/fixtures/lever.json`:
```json
[
  {
    "id": "abc-123-def",
    "text": "Staff Backend Engineer",
    "hostedUrl": "https://jobs.lever.co/acme/abc-123-def",
    "workplaceType": "remote",
    "categories": { "location": "San Francisco", "team": "Platform", "department": "Engineering" }
  },
  {
    "id": "ghi-456-jkl",
    "text": "Office Manager",
    "hostedUrl": "https://jobs.lever.co/acme/ghi-456-jkl",
    "workplaceType": "on-site",
    "categories": { "location": "Austin, TX", "team": "Operations" }
  }
]
```

- [ ] **Step 2: Write the failing test**

`tests/test_lever.py`:
```python
import json
from pathlib import Path

from poller.adapters.lever import parse_lever

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "lever.json").read_text())


def test_field_mapping_uses_text_and_hostedurl():
    eng = parse_lever(FIXTURE)[0]
    assert eng.external_id == "abc-123-def"
    assert eng.title == "Staff Backend Engineer"
    assert eng.url == "https://jobs.lever.co/acme/abc-123-def"
    assert eng.location == "San Francisco"
    assert eng.department == "Platform"  # categories.team
    assert eng.remote is True            # workplaceType == "remote"


def test_onsite_is_not_remote():
    ops = parse_lever(FIXTURE)[1]
    assert ops.remote is False
    assert ops.department == "Operations"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_lever.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.adapters.lever'`.

- [ ] **Step 4: Write the implementation**

`poller/adapters/lever.py`:
```python
from poller.http import get_json
from poller.models import Posting
from poller.normalize import detect_remote


def _explicit_remote(workplace_type: str | None) -> bool | None:
    if workplace_type == "remote":
        return True
    if workplace_type in ("on-site", "hybrid"):
        return False
    return None


def parse_lever(data: list) -> list[Posting]:
    postings: list[Posting] = []
    for j in data:
        cats = j.get("categories") or {}
        loc = cats.get("location")
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["text"],
                url=j["hostedUrl"],
                location=loc,
                department=cats.get("team") or cats.get("department"),
                remote=detect_remote(loc, _explicit_remote(j.get("workplaceType"))),
                raw=j,
            )
        )
    return postings


def fetch_lever(token: str) -> list[Posting]:
    url = f"https://api.lever.co/v0/postings/{token}?mode=json"
    return parse_lever(get_json(url))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_lever.py -v`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add poller/adapters/lever.py tests/fixtures/lever.json tests/test_lever.py
git commit -m "feat: add Lever adapter with field-mapping tests"
```

---

## Task 6: Ashby adapter

**Files:**
- Create: `poller/adapters/ashby.py`, `tests/fixtures/ashby.json`, `tests/test_ashby.py`

**Interfaces:**
- Consumes: `Posting`, `detect_remote`, `get_json`.
- Produces:
  - `parse_ashby(data: dict) -> list[Posting]` (pure; payload is `{"jobs": [...]}`).
  - `fetch_ashby(token: str) -> list[Posting]` (GETs `https://api.ashbyhq.com/posting-api/job-board/{token}`).

- [ ] **Step 1: Create the fixture**

`tests/fixtures/ashby.json`:
```json
{
  "apiVersion": "1",
  "jobs": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "title": "Research Engineer",
      "location": "San Francisco, CA",
      "department": "Research",
      "isRemote": true,
      "jobUrl": "https://jobs.ashbyhq.com/acme/11111111",
      "applyUrl": "https://jobs.ashbyhq.com/acme/11111111/application"
    },
    {
      "id": "66666666-7777-8888-9999-000000000000",
      "title": "Recruiter",
      "location": "London, UK",
      "department": "People",
      "isRemote": false,
      "jobUrl": "https://jobs.ashbyhq.com/acme/66666666"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`tests/test_ashby.py`:
```python
import json
from pathlib import Path

from poller.adapters.ashby import parse_ashby

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "ashby.json").read_text())


def test_field_mapping_uses_isremote_flag():
    eng = parse_ashby(FIXTURE)[0]
    assert eng.external_id == "11111111-2222-3333-4444-555555555555"
    assert eng.title == "Research Engineer"
    assert eng.url == "https://jobs.ashbyhq.com/acme/11111111"
    assert eng.location == "San Francisco, CA"
    assert eng.department == "Research"
    assert eng.remote is True  # isRemote flag, even though location has no "remote"


def test_non_remote_flag():
    rec = parse_ashby(FIXTURE)[1]
    assert rec.remote is False
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_ashby.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.adapters.ashby'`.

- [ ] **Step 4: Write the implementation**

`poller/adapters/ashby.py`:
```python
from poller.http import get_json
from poller.models import Posting
from poller.normalize import detect_remote


def parse_ashby(data: dict) -> list[Posting]:
    postings: list[Posting] = []
    for j in data.get("jobs", []):
        loc = j.get("location")
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["title"],
                url=j.get("jobUrl") or j.get("applyUrl"),
                location=loc,
                department=j.get("department"),
                remote=detect_remote(loc, j.get("isRemote")),
                raw=j,
            )
        )
    return postings


def fetch_ashby(token: str) -> list[Posting]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{token}"
    return parse_ashby(get_json(url))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_ashby.py -v`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add poller/adapters/ashby.py tests/fixtures/ashby.json tests/test_ashby.py
git commit -m "feat: add Ashby adapter with field-mapping tests"
```

---

## Task 7: Adapter registry + targets loader

**Files:**
- Modify: `poller/adapters/__init__.py`
- Create: `poller/targets.py`, `tests/test_targets.py`

**Interfaces:**
- Consumes: `fetch_greenhouse`, `fetch_lever`, `fetch_ashby`.
- Produces:
  - `ADAPTERS: dict[str, Callable[[str], list[Posting]]]` with keys `greenhouse`, `lever`, `ashby`.
  - `load_targets(path: Path = DEFAULT_TARGETS_PATH) -> list[dict]` returning validated dicts with keys `name`, `ats`, `token`.
  - `DEFAULT_TARGETS_PATH: Path` (repo-root `targets.json`).

- [ ] **Step 1: Write the failing test**

`tests/test_targets.py`:
```python
import json

import pytest

from poller.adapters import ADAPTERS
from poller.targets import load_targets


def test_registry_has_three_adapters():
    assert set(ADAPTERS) == {"greenhouse", "lever", "ashby"}
    assert all(callable(fn) for fn in ADAPTERS.values())


def test_load_targets_reads_file(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "lever", "token": "acme"}]))
    targets = load_targets(p)
    assert targets == [{"name": "Acme", "ats": "lever", "token": "acme"}]


def test_load_targets_rejects_unknown_ats(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "workday", "token": "acme"}]))
    with pytest.raises(ValueError, match="workday"):
        load_targets(p)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_targets.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.targets'` (and `ADAPTERS` import error).

- [ ] **Step 3: Write the implementation**

`poller/adapters/__init__.py`:
```python
from collections.abc import Callable

from poller.adapters.ashby import fetch_ashby
from poller.adapters.greenhouse import fetch_greenhouse
from poller.adapters.lever import fetch_lever
from poller.models import Posting

ADAPTERS: dict[str, Callable[[str], list[Posting]]] = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
}
```

`poller/targets.py`:
```python
import json
from pathlib import Path

DEFAULT_TARGETS_PATH = Path(__file__).resolve().parent.parent / "targets.json"
_VALID_ATS = {"greenhouse", "lever", "ashby"}


def load_targets(path: Path = DEFAULT_TARGETS_PATH) -> list[dict]:
    data = json.loads(Path(path).read_text())
    for t in data:
        if t.get("ats") not in _VALID_ATS:
            raise ValueError(f"Unknown ats {t.get('ats')!r} for target {t.get('name')!r}")
        for key in ("name", "ats", "token"):
            if not t.get(key):
                raise ValueError(f"Target missing {key!r}: {t!r}")
    return data
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_targets.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add poller/adapters/__init__.py poller/targets.py tests/test_targets.py
git commit -m "feat: add ADAPTERS registry and targets loader"
```

---

## Task 8: DB schema + integration-test harness

**Files:**
- Create: `schema.sql`, `tests/conftest.py`, `tests/test_schema.py`

**Interfaces:**
- Consumes: nothing (defines the schema all later DB tasks depend on).
- Produces:
  - `schema.sql` — the exact PRD §7 schema (companies, jobs, poll_runs + indexes).
  - A pytest fixture `conn` (psycopg connection, `dict_row`) bound to `TEST_DATABASE_URL`, whose `public` schema is dropped and recreated from `schema.sql` per test.
  - A `requires_db` skip marker for tests needing the DB.

**Note on the test DB:** `TEST_DATABASE_URL` must point at a **throwaway** Postgres — the fixture DROPs its `public` schema each test. Easiest local option:
```bash
docker run -d --name poller_test_db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```
(Homebrew Postgres or a Supabase **branch** also work. If unset, DB integration tests skip cleanly.)

- [ ] **Step 1: Create `schema.sql` (verbatim PRD §7)**

```sql
CREATE TABLE companies (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby')),
  token   TEXT NOT NULL,
  active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (ats, token)
);

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
  raw           JSONB
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;

CREATE TABLE poll_runs (
  id               SERIAL PRIMARY KEY,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  companies_ok     INT,
  companies_failed INT,
  new_jobs         INT,
  closed_jobs      INT,
  notes            TEXT
);
```

- [ ] **Step 2: Create the conftest fixture**

`tests/conftest.py`:
```python
import os
from pathlib import Path

import pytest

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None

SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
TEST_DSN = os.environ.get("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(TEST_DSN is None, reason="TEST_DATABASE_URL not set")


@pytest.fixture
def conn():
    assert TEST_DSN, "TEST_DATABASE_URL required"
    connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
    try:
        with connection.cursor() as cur:
            cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
            cur.execute(SCHEMA_SQL)
        connection.commit()
        yield connection
    finally:
        connection.close()
```

- [ ] **Step 3: Write the failing test**

`tests/test_schema.py`:
```python
from tests.conftest import requires_db


@requires_db
def test_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
        names = {r["table_name"] for r in cur.fetchall()}
    assert {"companies", "jobs", "poll_runs"} <= names


@requires_db
def test_ats_check_constraint(conn):
    import psycopg

    with conn.cursor() as cur, __import__("pytest").raises(psycopg.errors.CheckViolation):
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X', 'workday', 't')"
        )
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Without a DB:
Run: `.venv/bin/pytest tests/test_schema.py -v`
Expected: `2 skipped` (no `TEST_DATABASE_URL`).

With the throwaway DB exported (see note above):
Run: `.venv/bin/pytest tests/test_schema.py -v`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add schema.sql tests/conftest.py tests/test_schema.py
git commit -m "feat: add DB schema and integration-test harness"
```

---

## Task 9: Company sync (FR-1)

**Files:**
- Create: `poller/db.py`, `tests/test_db_companies.py`

**Interfaces:**
- Consumes: `schema.sql`, the `conn` fixture.
- Produces:
  - `connect(dsn: str | None = None) -> psycopg.Connection` (reads `DATABASE_URL` if `dsn` is None; `dict_row`).
  - `sync_companies(conn, targets: list[dict]) -> dict[tuple[str, str], int]` — upserts each target by `(ats, token)`, sets `active = TRUE`; marks companies absent from `targets` `active = FALSE`. Returns `{(ats, token): company_id}` for the supplied targets.

- [ ] **Step 1: Write the failing test**

`tests/test_db_companies.py`:
```python
from poller import db
from tests.conftest import requires_db


@requires_db
def test_sync_inserts_and_returns_ids(conn):
    targets = [
        {"name": "Acme", "ats": "lever", "token": "acme"},
        {"name": "Globex", "ats": "ashby", "token": "globex"},
    ]
    ids = db.sync_companies(conn, targets)
    assert set(ids) == {("lever", "acme"), ("ashby", "globex")}
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM companies WHERE active")
        assert cur.fetchone()["n"] == 2


@requires_db
def test_sync_is_idempotent_and_updates_name(conn):
    db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    ids = db.sync_companies(conn, [{"name": "Acme Inc", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, max(name) AS name FROM companies")
        row = cur.fetchone()
    assert row["n"] == 1
    assert row["name"] == "Acme Inc"
    assert list(ids) == [("lever", "acme")]


@requires_db
def test_sync_deactivates_missing(conn):
    db.sync_companies(conn, [
        {"name": "Acme", "ats": "lever", "token": "acme"},
        {"name": "Globex", "ats": "ashby", "token": "globex"},
    ])
    db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies ORDER BY token")
        rows = {r["token"]: r["active"] for r in cur.fetchall()}
    assert rows == {"acme": True, "globex": False}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_db_companies.py -v`
Expected: FAIL with `AttributeError: module 'poller.db' has no attribute 'sync_companies'` (or skip if no DB).

- [ ] **Step 3: Write the implementation**

`poller/db.py`:
```python
import os

import psycopg
from psycopg.rows import dict_row


def connect(dsn: str | None = None) -> psycopg.Connection:
    dsn = dsn or os.environ["DATABASE_URL"]
    return psycopg.connect(dsn, row_factory=dict_row)


def sync_companies(conn, targets: list[dict]) -> dict[tuple[str, str], int]:
    ids: dict[tuple[str, str], int] = {}
    with conn.cursor() as cur:
        for t in targets:
            cur.execute(
                """
                INSERT INTO companies (name, ats, token, active)
                VALUES (%(name)s, %(ats)s, %(token)s, TRUE)
                ON CONFLICT (ats, token)
                DO UPDATE SET name = EXCLUDED.name, active = TRUE
                RETURNING id, ats, token
                """,
                t,
            )
            row = cur.fetchone()
            ids[(row["ats"], row["token"])] = row["id"]

        keys = [f'{t["ats"]}:{t["token"]}' for t in targets]
        cur.execute(
            "UPDATE companies SET active = FALSE "
            "WHERE active = TRUE AND (ats || ':' || token) <> ALL(%s)",
            (keys,),
        )
    return ids
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_db_companies.py -v`
Expected: `3 passed` (with the throwaway DB exported).

- [ ] **Step 5: Commit**

```bash
git add poller/db.py tests/test_db_companies.py
git commit -m "feat: add company sync (upsert + deactivate missing)"
```

---

## Task 10: Job upsert with first_seen preservation (FR-3)

**Files:**
- Modify: `poller/db.py`
- Create: `tests/test_db_jobs.py`

**Interfaces:**
- Consumes: `Posting`, `sync_companies`, the `conn` fixture.
- Produces: `upsert_job(conn, company_id: int, ats: str, token: str, p: Posting) -> bool` — inserts (returns `True`) or updates existing by PK `{ats}:{token}:{external_id}` (returns `False`). On update: refresh `last_seen_at = now()`, clear `closed_at`, refresh mutable fields; **never** change `first_seen_at`.

- [ ] **Step 1: Write the failing test**

`tests/test_db_jobs.py`:
```python
from poller import db
from poller.models import Posting
from tests.conftest import requires_db


def _seed_company(conn):
    return db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])[
        ("lever", "acme")
    ]


@requires_db
def test_insert_then_idempotent_update(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x", location="Remote")

    assert db.upsert_job(conn, cid, "lever", "acme", p) is True
    with conn.cursor() as cur:
        cur.execute("SELECT id, first_seen_at FROM jobs WHERE id = 'lever:acme:1'")
        first = cur.fetchone()

    # Second sighting: not a new insert, first_seen_at unchanged (AC-1)
    assert db.upsert_job(conn, cid, "lever", "acme", p) is False
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, first_seen_at FROM jobs GROUP BY first_seen_at")
        again = cur.fetchone()
    assert again["n"] == 1
    assert again["first_seen_at"] == first["first_seen_at"]


@requires_db
def test_resighting_clears_closed_at(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x")
    db.upsert_job(conn, cid, "lever", "acme", p)
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = 'lever:acme:1'")
    conn.commit()

    db.upsert_job(conn, cid, "lever", "acme", p)  # reopened
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:acme:1'")
        assert cur.fetchone()["closed_at"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_db_jobs.py -v`
Expected: FAIL with `AttributeError: module 'poller.db' has no attribute 'upsert_job'`.

- [ ] **Step 3: Write the implementation (append to `poller/db.py`)**

Add imports at top of `poller/db.py`:
```python
from psycopg.types.json import Json

from poller.models import Posting
```

Add the function:
```python
def upsert_job(conn, company_id: int, ats: str, token: str, p: Posting) -> bool:
    job_id = f"{ats}:{token}:{p.external_id}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, company_id, external_id, title, url,
                              location, department, remote, raw)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                last_seen_at = now(),
                closed_at    = NULL,
                title        = EXCLUDED.title,
                url          = EXCLUDED.url,
                location     = EXCLUDED.location,
                department   = EXCLUDED.department,
                remote       = EXCLUDED.remote,
                raw          = EXCLUDED.raw
            RETURNING (xmax = 0) AS inserted
            """,
            (
                job_id, company_id, p.external_id, p.title, p.url,
                p.location, p.department, p.remote, Json(p.raw),
            ),
        )
        return cur.fetchone()["inserted"]
```

> `xmax = 0` is the standard Postgres idiom for "this row was freshly inserted (not updated) by this statement," used here to count new jobs.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_db_jobs.py -v`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add poller/db.py tests/test_db_jobs.py
git commit -m "feat: add idempotent job upsert preserving first_seen_at"
```

---

## Task 11: Closed detection (FR-4)

**Files:**
- Modify: `poller/db.py`
- Create: `tests/test_db_closed.py`

**Interfaces:**
- Consumes: `upsert_job`, `sync_companies`, the `conn` fixture.
- Produces:
  - `compute_newly_closed(open_external_ids: set[str], seen_external_ids: set[str]) -> set[str]` (pure set diff).
  - `get_open_external_ids(conn, company_id: int) -> set[str]`.
  - `close_jobs(conn, company_id: int, external_ids: set[str]) -> int` — sets `closed_at = now()` on the listed open jobs; returns rows affected.

- [ ] **Step 1: Write the failing test**

`tests/test_db_closed.py`:
```python
from poller import db
from poller.models import Posting
from tests.conftest import requires_db


def test_compute_newly_closed_is_pure_set_diff():
    assert db.compute_newly_closed({"1", "2", "3"}, {"2", "3"}) == {"1"}
    assert db.compute_newly_closed({"1"}, {"1"}) == set()
    assert db.compute_newly_closed(set(), {"5"}) == set()


@requires_db
def test_close_jobs_sets_closed_at(conn):
    cid = db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])[
        ("lever", "acme")
    ]
    for ext in ("1", "2"):
        db.upsert_job(conn, cid, "lever", "acme", Posting(external_id=ext, title="T", url="u"))

    open_ids = db.get_open_external_ids(conn, cid)
    assert open_ids == {"1", "2"}

    to_close = db.compute_newly_closed(open_ids, {"1"})  # "2" disappeared
    assert db.close_jobs(conn, cid, to_close) == 1

    with conn.cursor() as cur:
        cur.execute("SELECT external_id FROM jobs WHERE closed_at IS NOT NULL")
        assert {r["external_id"] for r in cur.fetchall()} == {"2"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_db_closed.py -v`
Expected: FAIL with `AttributeError: module 'poller.db' has no attribute 'compute_newly_closed'`.

- [ ] **Step 3: Write the implementation (append to `poller/db.py`)**

```python
def compute_newly_closed(
    open_external_ids: set[str], seen_external_ids: set[str]
) -> set[str]:
    return open_external_ids - seen_external_ids


def get_open_external_ids(conn, company_id: int) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT external_id FROM jobs WHERE company_id = %s AND closed_at IS NULL",
            (company_id,),
        )
        return {r["external_id"] for r in cur.fetchall()}


def close_jobs(conn, company_id: int, external_ids: set[str]) -> int:
    if not external_ids:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET closed_at = now() "
            "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
            (company_id, list(external_ids)),
        )
        return cur.rowcount
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_db_closed.py -v`
Expected: `2 passed` (the pure test runs even without a DB).

- [ ] **Step 5: Commit**

```bash
git add poller/db.py tests/test_db_closed.py
git commit -m "feat: add closed-detection (compute + apply)"
```

---

## Task 12: poll_runs accounting (FR-5)

**Files:**
- Modify: `poller/db.py`
- Create: `tests/test_db_runs.py`

**Interfaces:**
- Consumes: the `conn` fixture.
- Produces:
  - `start_run(conn) -> int` — inserts a `poll_runs` row, returns its `id`.
  - `finish_run(conn, run_id: int, *, companies_ok: int, companies_failed: int, new_jobs: int, closed_jobs: int, notes: str | None) -> None` — fills in `finished_at = now()` and the counts.

- [ ] **Step 1: Write the failing test**

`tests/test_db_runs.py`:
```python
from poller import db
from tests.conftest import requires_db


@requires_db
def test_start_then_finish_run(conn):
    run_id = db.start_run(conn)
    assert isinstance(run_id, int)

    db.finish_run(
        conn, run_id,
        companies_ok=3, companies_failed=1,
        new_jobs=5, closed_jobs=2, notes="Bad: HTTPStatusError",
    )

    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs WHERE id = %s", (run_id,))
        row = cur.fetchone()
    assert row["finished_at"] is not None
    assert row["companies_ok"] == 3
    assert row["companies_failed"] == 1
    assert row["new_jobs"] == 5
    assert row["closed_jobs"] == 2
    assert "Bad" in row["notes"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_db_runs.py -v`
Expected: FAIL with `AttributeError: module 'poller.db' has no attribute 'start_run'`.

- [ ] **Step 3: Write the implementation (append to `poller/db.py`)**

```python
def start_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO poll_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_run(
    conn,
    run_id: int,
    *,
    companies_ok: int,
    companies_failed: int,
    new_jobs: int,
    closed_jobs: int,
    notes: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE poll_runs SET
                finished_at      = now(),
                companies_ok     = %s,
                companies_failed = %s,
                new_jobs         = %s,
                closed_jobs      = %s,
                notes            = %s
            WHERE id = %s
            """,
            (companies_ok, companies_failed, new_jobs, closed_jobs, notes, run_id),
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_db_runs.py -v`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add poller/db.py tests/test_db_runs.py
git commit -m "feat: add poll_runs start/finish accounting"
```

---

## Task 13: Run orchestrator + clean exit (FR-2, FR-6)

**Files:**
- Create: `poller/run.py`, `poller/__main__.py`, `tests/test_run.py`

**Interfaces:**
- Consumes: `load_targets`, `ADAPTERS`, `db.connect/start_run/sync_companies/upsert_job/get_open_external_ids/compute_newly_closed/close_jobs/finish_run`.
- Produces:
  - `run(dsn: str | None = None) -> None` — full poll: open one connection, start a run, sync companies, poll each active company **with per-company try/except isolation**, upsert jobs, run closed-detection **only for companies that fetched successfully**, record the run, commit, and **close the connection**.
  - `python -m poller` entry point via `__main__.main()`.

- [ ] **Step 1: Write the failing test**

`tests/test_run.py`:
```python
import os

import poller.run as run_module
from poller import db
from poller.adapters import ADAPTERS
from poller.models import Posting
from tests.conftest import requires_db


@requires_db
def test_run_isolates_failures_and_records(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(
        run_module, "load_targets",
        lambda: [
            {"name": "Good", "ats": "greenhouse", "token": "good"},
            {"name": "Bad", "ats": "lever", "token": "bad"},
        ],
    )
    monkeypatch.setitem(
        ADAPTERS, "greenhouse",
        lambda token: [Posting(external_id="1", title="Engineer", url="u")],
    )

    def boom(token):
        raise RuntimeError("api down")

    monkeypatch.setitem(ADAPTERS, "lever", boom)

    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1  # Good company's job inserted
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        last = cur.fetchone()
    assert last["companies_ok"] == 1
    assert last["companies_failed"] == 1
    assert last["new_jobs"] == 1
    assert last["finished_at"] is not None
    assert "Bad" in (last["notes"] or "")


@requires_db
def test_failed_company_does_not_close_its_jobs(conn, monkeypatch):
    # AC-3: an API error must NOT mass-close the failing company's open jobs.
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])

    # Seed an open job for "Bad" via a first successful run.
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Bad", "ats": "lever", "token": "bad"}])
    monkeypatch.setitem(ADAPTERS, "lever",
                        lambda token: [Posting(external_id="9", title="Eng", url="u")])
    run_module.run()

    # Now the same company's fetch fails.
    def boom(token):
        raise RuntimeError("api down")

    monkeypatch.setitem(ADAPTERS, "lever", boom)
    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:bad:9'")
        assert cur.fetchone()["closed_at"] is None  # still open


@requires_db
def test_disappeared_role_closes_then_reopens(conn, monkeypatch):
    # AC-4
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Acme", "ats": "ashby", "token": "acme"}])

    monkeypatch.setitem(ADAPTERS, "ashby",
                        lambda token: [Posting(external_id="7", title="Eng", url="u")])
    run_module.run()

    monkeypatch.setitem(ADAPTERS, "ashby", lambda token: [])  # role gone
    run_module.run()
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'ashby:acme:7'")
        assert cur.fetchone()["closed_at"] is not None

    monkeypatch.setitem(ADAPTERS, "ashby",
                        lambda token: [Posting(external_id="7", title="Eng", url="u")])
    run_module.run()  # role back
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'ashby:acme:7'")
        assert cur.fetchone()["closed_at"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_run.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'poller.run'`.

- [ ] **Step 3: Write the implementation**

`poller/run.py`:
```python
import logging

from poller import db
from poller.adapters import ADAPTERS
from poller.targets import load_targets

log = logging.getLogger("poller")


def run(dsn: str | None = None) -> None:
    targets = load_targets()
    conn = db.connect(dsn)
    try:
        run_id = db.start_run(conn)
        company_ids = db.sync_companies(conn, targets)
        conn.commit()

        ok = failed = new_jobs = closed_jobs = 0
        failures: list[str] = []

        for t in targets:
            ats, token = t["ats"], t["token"]
            company_id = company_ids[(ats, token)]
            try:
                postings = ADAPTERS[ats](token)
            except Exception as exc:  # per-company isolation (FR-4)
                failed += 1
                failures.append(f"{t['name']}: {type(exc).__name__}: {exc}")
                log.exception("fetch failed for %s (%s:%s)", t["name"], ats, token)
                continue

            seen: set[str] = set()
            for p in postings:
                if db.upsert_job(conn, company_id, ats, token, p):
                    new_jobs += 1
                seen.add(p.external_id)

            open_ids = db.get_open_external_ids(conn, company_id)
            closed_jobs += db.close_jobs(
                conn, company_id, db.compute_newly_closed(open_ids, seen)
            )
            ok += 1
            conn.commit()

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(failures) or None,
        )
        conn.commit()
        log.info(
            "run complete: ok=%s failed=%s new=%s closed=%s",
            ok, failed, new_jobs, closed_jobs,
        )
    finally:
        conn.close()  # FR-6: release all DB connections before exit
```

`poller/__main__.py`:
```python
import logging

from poller.run import run


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    run()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_run.py -v`
Expected: `3 passed` (with the throwaway DB exported).

- [ ] **Step 5: Run the full suite**

Run: `.venv/bin/pytest -v`
Expected: all pass (DB integration tests skip if `TEST_DATABASE_URL` unset, otherwise pass).

- [ ] **Step 6: Commit**

```bash
git add poller/run.py poller/__main__.py tests/test_run.py
git commit -m "feat: add run orchestrator with fault isolation and clean exit"
```

---

## Task 14: Provision Supabase + apply schema (M0)

This is an **infrastructure** task (no TDD cycle). Execution uses the Supabase MCP tools.

**Interfaces:**
- Consumes: `schema.sql`.
- Produces: a live Supabase project, the schema applied, and a `DATABASE_URL` (direct/session-pooler) for the poller.

- [ ] **Step 1: Pick the org and confirm cost**

Run tool `mcp__plugin_supabase_supabase__list_organizations` → note the `id`.
Run tool `mcp__plugin_supabase_supabase__get_cost` with `{ "type": "project", "organization_id": "<org id>" }`.
Run tool `mcp__plugin_supabase_supabase__confirm_cost` with the returned details → note the `confirm_cost_id`.

- [ ] **Step 2: Create the project**

Run tool `mcp__plugin_supabase_supabase__create_project` with:
```json
{
  "name": "job-board",
  "organization_id": "<org id>",
  "confirm_cost_id": "<confirm_cost_id>",
  "region": "us-east-1"
}
```
Wait until `get_project` reports status `ACTIVE_HEALTHY`.

- [ ] **Step 3: Apply the schema as a migration**

Run tool `mcp__plugin_supabase_supabase__apply_migration` with:
```json
{ "project_id": "<project ref>", "name": "init_schema", "query": "<contents of schema.sql>" }
```

- [ ] **Step 4: Verify the tables**

Run tool `mcp__plugin_supabase_supabase__list_tables` with `{ "project_id": "<project ref>", "schemas": ["public"] }`.
Expected: `companies`, `jobs`, `poll_runs` present.
Run tool `mcp__plugin_supabase_supabase__get_advisors` with `{ "project_id": "<project ref>", "type": "security" }` and skim for blocking issues.

- [ ] **Step 5: Capture the connection string for the poller**

From the Supabase dashboard → Project Settings → Database, copy the **direct connection** or **session pooler** URI (port 5432). This becomes the poller's `DATABASE_URL` in Task 16. Record it in your secrets manager — **do not commit it**.

- [ ] **Step 6: Add a railway deploy config + commit**

`railway.json`:
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "python -m poller" }
}
```

```bash
git add railway.json
git commit -m "chore: add Railway deploy config (python -m poller)"
```

---

## Task 15: Local end-to-end run + idempotency verification (M1 / AC-1)

Infrastructure/verification task — run the real poller against real feeds.

**Interfaces:**
- Consumes: the live Supabase `DATABASE_URL`, `targets.json`, the full poller.
- Produces: a populated DB and recorded evidence that re-running is idempotent.

- [ ] **Step 1: Point the poller at Supabase and run it once**

```bash
export DATABASE_URL="<supabase direct/session-pooler URI>"
.venv/bin/python -m poller
```
Expected: logs end with `run complete: ok=N failed=M ...` and the process **exits to the shell prompt** (FR-6).

- [ ] **Step 2: Inspect the first run**

```bash
.venv/bin/python - <<'PY'
import os, psycopg
from psycopg.rows import dict_row
c = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
with c.cursor() as cur:
    cur.execute("SELECT count(*) AS jobs FROM jobs")
    print("jobs:", cur.fetchone()["jobs"])
    cur.execute("SELECT companies_ok, companies_failed, new_jobs, closed_jobs FROM poll_runs ORDER BY id DESC LIMIT 1")
    print("last run:", cur.fetchone())
c.close()
PY
```
Expected: `jobs > 0`, `new_jobs == jobs`, `companies_failed` matches any bad tokens in `targets.json`.

- [ ] **Step 3: Capture the first-run baseline**

```bash
.venv/bin/python - <<'PY'
import os, psycopg
from psycopg.rows import dict_row
c = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
with c.cursor() as cur:
    cur.execute("SELECT count(*) AS n, max(first_seen_at) AS latest FROM jobs")
    print("baseline:", cur.fetchone())
c.close()
PY
```
Record `n` and `latest`.

- [ ] **Step 4: Run the poller a second time (AC-1)**

```bash
.venv/bin/python -m poller
```
Then re-run the Step 3 snippet.
Expected: `n` is **unchanged**, `latest` is **unchanged**, and the newest `poll_runs` row has `new_jobs == 0`. This satisfies **AC-1** (zero new inserts, zero `first_seen_at` changes on re-run).

- [ ] **Step 5: Record the result**

No commit needed (no code change). Note the AC-1 evidence in the PR/checkpoint description: first-run job count, both `new_jobs` values (`>0` then `0`), and unchanged `first_seen_at`.

---

## Task 16: Deploy to Railway as a cron service (M2 / AC-2)

Infrastructure task — execution uses the Railway MCP tools (and the Railway dashboard for the cron schedule field).

**Interfaces:**
- Consumes: the committed repo (with `railway.json`), the Supabase `DATABASE_URL`.
- Produces: a deployed Railway cron service that runs `python -m poller` on schedule and reaches **Completed**.

- [ ] **Step 1: Confirm auth + create the project/service**

Run tool `mcp__plugin_railway_railway__whoami` to confirm the account.
Run tool `mcp__plugin_railway_railway__create_project` with `{ "name": "job-board-poller" }` (note the project + environment ids).
Connect the GitHub repo (or use `railway up`) so the service builds from this repo. Create the service via `mcp__plugin_railway_railway__create_service` (or the dashboard's "Deploy from GitHub repo").

- [ ] **Step 2: Set the connection string variable**

Run tool `mcp__plugin_railway_railway__set_variables` with:
```json
{
  "projectId": "<project id>",
  "environmentId": "<env id>",
  "serviceId": "<service id>",
  "variables": { "DATABASE_URL": "<supabase direct/session-pooler URI>" }
}
```
(Never commit this value; it lives only in Railway service variables.)

- [ ] **Step 3: Set the cron schedule**

In the Railway dashboard → the poller service → **Settings → Cron Schedule**, set:
```
0 */2 * * *
```
(UTC, every 2 hours — within Railway's 5-minute-minimum / not-minute-precise constraints, §9.) Confirm the start command resolves to `python -m poller` (from `railway.json`).

- [ ] **Step 4: Deploy and watch the first run**

Run tool `mcp__plugin_railway_railway__deploy` for the service (or push to the connected branch).
Run tool `mcp__plugin_railway_railway__get_logs` and confirm the run logs `run complete: ...`.

- [ ] **Step 5: Verify Completed status (AC-2)**

Run tool `mcp__plugin_railway_railway__list_deployments` for the service.
Expected: the latest deployment reaches **Completed** (the process exited, no lingering connections). This is **AC-2** — a Completed status is what guarantees the next scheduled run is not skipped.

- [ ] **Step 6: Confirm a second scheduled run is not skipped**

After the next cron tick (≤2h, or trigger a manual redeploy to simulate), re-check `list_deployments` and `get_logs`: a second run executed and also reached **Completed**, and `poll_runs` has a new row. Record this as AC-2 evidence.

---

## Self-Review

**Spec coverage (PRD §8 functional requirements + §12 acceptance criteria):**

| Requirement | Task |
|---|---|
| FR-1 load targets, upsert companies | 7 (loader), 9 (sync) |
| FR-2 per active company, call adapter, collect postings | 13 |
| FR-3 upsert keyed `{ats}:{token}:{external_id}`, first_seen on insert, last_seen + clear closed on sighting | 10 |
| FR-4 closed-detection; skip for failed fetches | 11 (logic), 13 (skip-on-failure) |
| FR-5 record run in poll_runs (counts + failures in notes) | 12, 13 |
| FR-6 close all connections and exit | 13 (`finally: conn.close()`), 15/16 (verified) |
| Adapters Greenhouse/Lever/Ashby + normalized schema | 4, 5, 6 |
| Remote best-effort | 2 |
| Adapter contract + ADAPTERS registry | 7 |
| Data model (schema) | 8 |
| Resilience: timeout + retry/backoff | 3 |
| Idempotency | 10 (unit), 15 (live AC-1) |
| AC-1 re-run zero new inserts / no first_seen change | 10, 15 |
| AC-2 Railway Completed, next run not skipped | 16 |
| AC-3 failing company isolated, no mass-close, failure recorded | 13 |
| AC-4 disappeared role closes; re-added clears | 13 |
| M0 scaffold + Supabase + schema | 1, 8, 14 |
| M1 poller core runs locally, populates Supabase | 13, 15 |
| M2 deploy to Railway cron, reaches Completed | 16 |

AC-5/AC-6 (dashboard keyword filter, "New" badge) are owned by the **dashboard plan** (`2026-06-23-dashboard.md`). AC-7 (free-tier budgets / no Supabase pause) is an operational property satisfied by the deployed topology and observed over time, not a code task.

**Type consistency:** `Posting` field names and `detect_remote` signature are identical across Tasks 2/4/5/6/13. `db` function names (`connect`, `sync_companies`, `upsert_job`, `get_open_external_ids`, `compute_newly_closed`, `close_jobs`, `start_run`, `finish_run`) are referenced consistently in Task 13 and the self-review. Job PK format `{ats}:{token}:{external_id}` is identical in Tasks 10, 11, 13.

**Placeholder scan:** the only non-literal values are infrastructure IDs that genuinely do not exist until execution (Supabase org/project ref, Railway project/env/service ids, the Supabase connection URI). Each is marked `<...>` with the exact tool that produces it. Task 10's test file deliberately includes a `@readd`/placeholder marker **with an explicit instruction to delete it** — when writing that file, include only the two real test functions.
