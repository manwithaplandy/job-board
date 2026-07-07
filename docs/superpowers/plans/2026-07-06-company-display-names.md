# Company Display-Name Casing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real, correctly-cased company names everywhere by fetching them from public ATS board pages (deterministic HTTP — no LLM) and coalescing `display_name` on every dashboard surface.

**Architecture:** Extend the existing enrichment layer (`company_discovery/enrich.py`) with a lever/ashby board-page `<title>` name fetcher; add a one-time, name-only backfill that writes `companies.display_name` without touching `enriched_at` (so no LLM re-review is triggered); switch the remaining dashboard queries from bare `c.name` to `COALESCE(c.display_name, c.name)`.

**Tech Stack:** Python 3 (httpx, psycopg), Postgres, Next.js dashboard (postgres.js, vitest).

**Spec:** `docs/superpowers/specs/2026-07-06-company-name-casing-design.md`

## Global Constraints

- No LLM inference anywhere in this feature (user requirement).
- The backfill must NOT set `enriched_at` / `about` / `about_source` — stamping `enriched_at` re-queues already-reviewed companies for LLM re-screen via the `enriched_at > reviewed_at` predicate in `company_discovery/db.select_for_review`.
- Never rewrite `companies.name` (slug identity used by `ON CONFLICT (ats, token)` dedup and seed sync).
- Repo git rule: never amend/rebase; new commits only.
- Python tests: run `python3 -m pytest` (no venv). DB-marked tests need `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test`; without it they skip — that is acceptable.
- Dashboard tests: run from `dashboard/` with `npx vitest run`; run `npm install` there first (worktrees lack `node_modules`).

---

### Task 1: `get_text` in the shared HTTP helper

**Files:**
- Modify: `job_discovery/http.py` (`_request` at lines 28–68; add `get_text` after `get_json`)
- Test: `tests/test_http.py`

**Interfaces:**
- Produces: `get_text(url: str, *, retries: int = 2, backoff: float = 0.5, timeout: float = 10.0) -> str` — GET with the same retry/backoff/shared-client contract as `get_json`, returning `resp.text`.

- [ ] **Step 1: Write the failing tests** — append to `tests/test_http.py`. The existing `_Resp` stand-in only has `.json()`; give it a `text` attribute (default `""`) in its `__init__` (add `self.text = text` with a `text=""` keyword — existing callers are unaffected):

```python
# In _Resp.__init__, add parameter text="" and line:
#     self.text = text

def test_get_text_returns_body(monkeypatch):
    monkeypatch.setattr(http_mod._client, "request",
                        lambda method, url, **kw: _Resp(None, text="<title>X</title>"))
    assert get_text("https://x") == "<title>X</title>"


def test_get_text_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    def flaky(method, url, **kw):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ConnectError("down")
        return _Resp(None, text="body")

    monkeypatch.setattr(http_mod._client, "request", flaky)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    monkeypatch.setattr(http_mod.random, "uniform", lambda *_: 0)
    assert get_text("https://x", retries=2, backoff=0.01) == "body"
    assert calls["n"] == 3
```

Also update the import line: `from job_discovery.http import get_json, get_text`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_http.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_text'`

- [ ] **Step 3: Implement** — in `job_discovery/http.py`, generalize `_request`'s response handling and add `get_text`. In `_request`, add keyword `parse=None` and replace `return resp.json()` with:

```python
            return parse(resp) if parse is not None else resp.json()
```

Then add after `get_json`:

```python
def get_text(
    url: str,
    *,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    timeout: float = _TIMEOUT,
) -> str:
    """GET a page and return its body text. Same retry/backoff contract as
    get_json — used for ATS board HTML pages that carry the company name in
    <title> (lever/ashby expose no JSON org-name endpoint)."""
    return _request("GET", url, retries=retries, backoff=backoff, timeout=timeout,
                    parse=lambda r: r.text)
```

- [ ] **Step 4: Run the full http suite**

Run: `python3 -m pytest tests/test_http.py -v`
Expected: all PASS (existing `get_json` tests prove the `parse` refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add job_discovery/http.py tests/test_http.py
git commit -m "feat(http): get_text for HTML board pages"
```

---

### Task 2: lever/ashby board-title name fetcher, wired into the JD probe

**Files:**
- Modify: `company_discovery/enrich.py`
- Test: `tests/test_company_enrich.py` (new tests + update the five existing `enrich_from_jd` tests)

**Interfaces:**
- Consumes: `get_text` from Task 1.
- Produces: `fetch_board_name(ats: str, token: str) -> str | None` (may raise on network failure — callers guard); `enrich_from_jd(ats, token)` now returns `(name | None, about | None)` instead of always-`None` name.

- [ ] **Step 1: Write the failing tests** — in `tests/test_company_enrich.py`, add under the `enrich_from_jd` section:

```python
# --------------------------------------------------------------------------
# fetch_board_name (lever / ashby board-page <title>)
# --------------------------------------------------------------------------
def test_fetch_board_name_lever_plain_title(monkeypatch):
    def fake_get_text(url):
        assert url == "https://jobs.lever.co/pushpress"
        return "<html><head><title>PushPress</title></head></html>"

    monkeypatch.setattr(enrich, "get_text", fake_get_text)
    assert enrich.fetch_board_name("lever", "pushpress") == "PushPress"


def test_fetch_board_name_ashby_strips_jobs_suffix(monkeypatch):
    def fake_get_text(url):
        assert url == "https://jobs.ashbyhq.com/modal"
        return "<title>Modal Jobs</title>"

    monkeypatch.setattr(enrich, "get_text", fake_get_text)
    assert enrich.fetch_board_name("ashby", "modal") == "Modal"


def test_fetch_board_name_unescapes_entities(monkeypatch):
    monkeypatch.setattr(enrich, "get_text",
                        lambda url: "<title>AT&amp;T Careers Jobs</title>")
    assert enrich.fetch_board_name("ashby", "t") == "AT&T Careers"


def test_fetch_board_name_missing_or_blank_title(monkeypatch):
    monkeypatch.setattr(enrich, "get_text", lambda url: "<html><body>hi</body></html>")
    assert enrich.fetch_board_name("lever", "t") is None
    monkeypatch.setattr(enrich, "get_text", lambda url: "<title>   </title>")
    assert enrich.fetch_board_name("lever", "t") is None


def test_fetch_board_name_unsupported_ats_no_fetch(monkeypatch):
    def boom(url):
        raise AssertionError("must not fetch for unsupported ats")

    monkeypatch.setattr(enrich, "get_text", boom)
    assert enrich.fetch_board_name("greenhouse", "t") is None


def test_enrich_from_jd_includes_board_title_name(monkeypatch):
    posting = _posting("Eng", {"descriptionPlain": "We build infra."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"ashby": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: "Modal")
    name, about = enrich.enrich_from_jd("ashby", "modal")
    assert name == "Modal"
    assert "We build infra." in about


def test_enrich_from_jd_title_failure_does_not_sink_probe(monkeypatch):
    posting = _posting("Eng", {"descriptionPlain": "Still grounded."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})

    def boom(ats, token):
        raise RuntimeError("page down")

    monkeypatch.setattr(enrich, "fetch_board_name", boom)
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert "Still grounded." in about


def test_enrich_from_jd_name_even_without_jd(monkeypatch):
    posting = _posting("T", {"id": "1"})  # no extractable JD
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: "Acme Inc")
    assert enrich.enrich_from_jd("lever", "acme") == ("Acme Inc", None)
```

Then update the FIVE existing `enrich_from_jd` tests (`test_enrich_from_jd_derives_about_with_title_header`, `_truncates_to_2000`, `_no_extractable_jd`, `_skips_to_first_posting_with_jd`, `_ashby`): each gets one added line so no real HTTP happens:

```python
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
```

(their `assert name is None` expectations then still hold).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `python3 -m pytest tests/test_company_enrich.py -v -k "board_name or from_jd"`
Expected: new tests FAIL with `AttributeError: ... has no attribute 'fetch_board_name'` / `'get_text'`; updated existing tests still pass.

- [ ] **Step 3: Implement** — in `company_discovery/enrich.py`:

Add imports (top of file):

```python
import logging
import re
from html import unescape
```

and change the `job_discovery.http` import to `from job_discovery.http import get_json, get_text`. Add after the imports:

```python
log = logging.getLogger("company_discovery.enrich")
```

Add near `JD_PROBE_ATS`:

```python
# Public board pages for the JD-probe ATSes: their JSON APIs carry no org name,
# but the page <title> does. lever titles are the bare name ("PushPress", "CIC");
# ashby appends " Jobs" ("Modal Jobs").
_BOARD_PAGES = {
    "lever": "https://jobs.lever.co/{token}",
    "ashby": "https://jobs.ashbyhq.com/{token}",
}
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_JOBS_SUFFIX_RE = re.compile(r"\s+jobs\s*$", re.IGNORECASE)


def fetch_board_name(ats: str, token: str) -> str | None:
    """Company display name from the public job-board page <title>. Returns None
    for ATSes without a mapped page or when the page has no usable title; network
    failures propagate (callers guard)."""
    page = _BOARD_PAGES.get(ats)
    if page is None:
        return None
    m = _TITLE_RE.search(get_text(page.format(token=token)))
    if not m:
        return None
    return _clean(_JOBS_SUFFIX_RE.sub("", unescape(m.group(1)).strip()))
```

Replace `enrich_from_jd` with:

```python
def enrich_from_jd(ats: str, token: str) -> tuple[str | None, str | None]:
    """Probe-poll a lever/ashby board once: display name from the board page
    <title> (best-effort — its failure must not sink the probe) and grounding
    text from the first posting whose JD is extractable. The adapter raises on a
    404 / dead board, which the caller catches so a later pass can retry."""
    name = None
    try:
        name = fetch_board_name(ats, token)
    except Exception as exc:
        log.warning("board-title fetch %s/%s failed (%s: %s); continuing without name",
                    ats, token, type(exc).__name__, exc)
    for posting in ADAPTERS[ats](token):
        text = extract_description(ats, posting.raw or {})
        if text:
            header = f"Job postings from this company's board include: {posting.title}\n\n"
            return name, (header + text)[:_ABOUT_MAX]
    return name, None
```

Also update the stale comment above `JD_PROBE_ATS` ("ATSes with no board-level name/about endpoint" → note the name now comes from the board page title) and the module docstring's "(display_name, about)" description if it contradicts.

- [ ] **Step 4: Run the enrich suite**

Run: `python3 -m pytest tests/test_company_enrich.py -v`
Expected: all PASS (DB-marked tests may skip without TEST_DATABASE_URL).

- [ ] **Step 5: Commit**

```bash
git add company_discovery/enrich.py tests/test_company_enrich.py
git commit -m "feat(enrich): real display names for lever/ashby via board-page title"
```

---

### Task 3: name-only backfill script

**Files:**
- Create: `company_discovery/name_backfill.py`
- Test: `tests/test_name_backfill.py`

**Interfaces:**
- Consumes: `fetch_board_name`, `ENRICHERS`, `JD_PROBE_ATS` from `company_discovery.enrich`; `MAX_WORKERS` from `company_discovery.enrich_apply`.
- Produces: `fetch_name(ats: str, token: str) -> str | None` (never raises); `main()` runnable via `python -m company_discovery.name_backfill`.

- [ ] **Step 1: Write the failing tests** — create `tests/test_name_backfill.py`:

```python
"""Name-only backfill: per-ATS dispatch is unit-tested (no network); the scope
query + display_name-only write contract are validated behind requires_db."""
import company_discovery.name_backfill as nb
from tests.conftest import requires_db


def test_fetch_name_lever_uses_board_title(monkeypatch):
    monkeypatch.setattr(nb, "fetch_board_name", lambda ats, token: "PushPress")
    assert nb.fetch_name("lever", "pushpress") == "PushPress"


def test_fetch_name_greenhouse_uses_enricher_name_half(monkeypatch):
    monkeypatch.setattr(nb, "ENRICHERS",
                        {"greenhouse": lambda token: ("Acme Corp", "about text")})
    assert nb.fetch_name("greenhouse", "acme") == "Acme Corp"


def test_fetch_name_swallows_fetch_errors(monkeypatch):
    def boom(ats, token):
        raise RuntimeError("dead board")

    monkeypatch.setattr(nb, "fetch_board_name", boom)
    assert nb.fetch_name("ashby", "t") is None


def test_fetch_name_unsupported_ats():
    assert nb.fetch_name("workday", "t:wd1:site") is None


@requires_db
def test_scope_active_without_display_name_only(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('needsname','lever','needsname', TRUE, 'dataset'),"
            "('inactive','lever','inactive', FALSE, 'dataset'),"
            "('hasname','greenhouse','hasname', TRUE, 'dataset')"
        )
        cur.execute("UPDATE companies SET display_name='Has Name' WHERE token='hasname'")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(nb._SCOPE_SQL)
        rows = cur.fetchall()
    assert [r["token"] for r in rows] == ["needsname"]


@requires_db
def test_update_writes_display_name_only_and_respects_guard(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('acme','lever','acme', TRUE, 'dataset') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(nb._UPDATE_SQL, ("Acme Inc", cid))
        cur.execute("SELECT display_name, about, about_source, enriched_at "
                    "FROM companies WHERE id = %s", (cid,))
        row = cur.fetchone()
    assert row["display_name"] == "Acme Inc"
    # display_name ONLY: enrichment fields untouched -> no LLM re-review queued.
    assert row["about"] is None and row["about_source"] is None and row["enriched_at"] is None
    # Guard: a concurrent/prior name is never overwritten.
    with conn.cursor() as cur:
        cur.execute(nb._UPDATE_SQL, ("Other Name", cid))
        assert cur.rowcount == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_name_backfill.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'company_discovery.name_backfill'` (DB tests skip without TEST_DATABASE_URL).

- [ ] **Step 3: Implement** — create `company_discovery/name_backfill.py`:

```python
"""One-time backfill: populate companies.display_name for ACTIVE companies that
lack one, from free public ATS-board metadata (no LLM inference anywhere).

Run against a database:  DATABASE_URL=... python -m company_discovery.name_backfill

Scope: active AND display_name IS NULL — the set users actually see (jobs only
come from active companies; the dashboard renders COALESCE(display_name, name)).
Unknown/inactive companies keep getting names via the standing enrichment stage
when they are next selected for review.

Writes display_name ONLY — never about / about_source / enriched_at. Stamping
enriched_at here would re-queue every already-reviewed company for an LLM
re-screen (select_for_review re-selects on enriched_at > reviewed_at): cost and
verdict churn this backfill must not cause. The display_name IS NULL guard (in
both the scope query and the UPDATE) makes reruns idempotent; a dead board
writes nothing, so a rerun retries it.

ROLLOUT ARTIFACT — the operator runs it once at rollout; safe to rerun.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, fetch_board_name
from company_discovery.enrich_apply import MAX_WORKERS

log = logging.getLogger("name_backfill")

# Commit cadence (rows written) so a long run is durable and resumable.
_COMMIT_EVERY = 50

_SCOPE_SQL = ("SELECT id, name, ats, token FROM companies "
              "WHERE active AND display_name IS NULL")
_UPDATE_SQL = ("UPDATE companies SET display_name = %s "
               "WHERE id = %s AND display_name IS NULL")


def fetch_name(ats: str, token: str) -> str | None:
    """Name-only fetch for one company; never raises (returns None to skip, so a
    rerun retries). lever/ashby read the board page <title>; the JSON-API ATSes
    reuse the existing enrichers and keep only the name half."""
    try:
        if ats in JD_PROBE_ATS:
            return fetch_board_name(ats, token)
        if ats in ENRICHERS:
            return ENRICHERS[ats](token)[0]
    except Exception as exc:
        log.warning("name fetch %s/%s failed (%s: %s); skipping",
                    ats, token, type(exc).__name__, exc)
    return None


def main() -> None:
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
        # HTTP fetches run across a small thread pool (shared egress IP — keep it
        # small); DB writes stay on the main thread — one psycopg connection must
        # not be shared across threads.
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(fetch_name, r["ats"], r["token"]): r for r in rows}
            for fut in as_completed(futures):
                name = fut.result()  # fetch_name never raises
                if name is None:
                    continue
                with conn.cursor() as cur:
                    cur.execute(_UPDATE_SQL, (name, futures[fut]["id"]))
                updated += 1
                if updated % _COMMIT_EVERY == 0:
                    conn.commit()
                    log.info("named %s companies so far", updated)
        conn.commit()
        log.info("backfill complete: named %s of %s companies", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests**

Run: `python3 -m pytest tests/test_name_backfill.py -v`
Expected: unit tests PASS; DB tests PASS if `TEST_DATABASE_URL` is exported, else SKIP.

- [ ] **Step 5: Commit**

```bash
git add company_discovery/name_backfill.py tests/test_name_backfill.py
git commit -m "feat(discovery): name-only display_name backfill for active companies"
```

---

### Task 4: dashboard — coalesce display_name on the remaining surfaces

**Files:**
- Modify: `dashboard/lib/queries.ts` (fragment ~line 601; `getCompanyReviews` ~lines 613–631)
- Modify: `dashboard/lib/generationJobs.ts` (~line 125)
- Modify: `dashboard/app/actions/corrections.ts` (~line 34)
- Modify: `dashboard/app/actions/resumeScores.ts` (~line 34)
- Modify: `dashboard/lib/accountExport.ts` (~lines 92, 95, 98)
- Test: `dashboard/lib/queries.test.ts` (fragment tests ~lines 51–80)

**Interfaces:**
- Consumes: existing `display_name` column; no type changes — every alias (`name`, `company`, `company_name`) keeps its name and string type.

- [ ] **Step 1: Setup** — `cd dashboard && npm install` (worktrees lack `node_modules`).

- [ ] **Step 2: Update the fragment tests to the two-parameter contract** — in `dashboard/lib/queries.test.ts`, the `companyNameSearchFragment` describe block: search must now match slug OR display name, so the term binds twice. Update assertions:

```ts
  it("emits ILIKE and binds the wrapped term as a parameter (injection-safe)", () => {
    const f = introspect("vanta");
    expect(f.strings.join(" ").toLowerCase()).toContain("ilike");
    expect(f.args).toEqual(["%vanta%", "%vanta%"]);
  });

  it("trims the term before wrapping", () => {
    expect(introspect("  zapier  ").args).toEqual(["%zapier%", "%zapier%"]);
  });
```

If the injection-payload test asserts `.args` length/content, update it the same way (payload bound twice, never in `.strings`).

- [ ] **Step 3: Run to verify the updated tests fail**

Run: `npx vitest run lib/queries.test.ts`
Expected: FAIL — args are `["%vanta%"]` (one bind) against expected two.

- [ ] **Step 4: Implement the query changes**

`dashboard/lib/queries.ts` — fragment (keep the doc comment, note it matches slug or display name):

```ts
export function companyNameSearchFragment(tx: Sql | TransactionSql, search?: string) {
  const term = (search ?? "").trim();
  const like = "%" + term + "%";
  return term ? tx`AND (c.name ILIKE ${like} OR c.display_name ILIKE ${like})` : tx``;
}
```

`getCompanyReviews` SELECT list: replace `c.name,` with `COALESCE(c.display_name, c.name) AS name,` and `ORDER BY c.name` with `ORDER BY COALESCE(c.display_name, c.name)`.

`dashboard/lib/generationJobs.ts` (~125): `c.name AS company` → `COALESCE(c.display_name, c.name) AS company`.

`dashboard/app/actions/corrections.ts` (~34): `c.name AS company_name` → `COALESCE(c.display_name, c.name) AS company_name`.

`dashboard/app/actions/resumeScores.ts` (~34): same replacement.

`dashboard/lib/accountExport.ts` (~92, 95, 98): all three `c.name AS company_name` → `COALESCE(c.display_name, c.name) AS company_name`.

Then sweep for stragglers — every remaining bare read must be intentional (identity/slug contexts like admin token lists are fine; anything user- or LLM-facing must coalesce):

```bash
grep -rn "c\.name" dashboard/lib dashboard/app --include="*.ts" --include="*.tsx" | grep -v display_name | grep -v test
```

- [ ] **Step 5: Run the dashboard suite**

Run: `npx vitest run` (from `dashboard/`)
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/queries.test.ts dashboard/lib/generationJobs.ts dashboard/lib/accountExport.ts dashboard/app/actions/corrections.ts dashboard/app/actions/resumeScores.ts
git commit -m "feat(dashboard): coalesce company display_name on all remaining surfaces"
```

---

### Task 5: full verification

**Files:** none new.

- [ ] **Step 1: Full Python suite** — from repo root:

Run: `python3 -m pytest`
Expected: PASS (DB tests skip without `TEST_DATABASE_URL`; if local PG at `localhost:55432` is up, export `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test` and expect PASS including the new DB tests). The `parseProfile` binary-fixture skip is expected in a worktree.

- [ ] **Step 2: Full dashboard suite + typecheck**

Run (from `dashboard/`): `npx vitest run && npx tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 3: Live smoke of the name fetcher (no DB writes)** — one-off script, real network, 3 boards:

Run: `python3 -c "from company_discovery.enrich import fetch_board_name; print(fetch_board_name('lever','pushpress'), '|', fetch_board_name('lever','cic'), '|', fetch_board_name('ashby','modal'))"`
Expected: `PushPress | CIC | Modal`

- [ ] **Step 4: Commit any remaining changes; branch is ready for review/merge.**

---

## Rollout (post-merge, operator steps)

1. Merge to `origin/main` (auto-deploys Vercel dashboard + Railway workers; no migrations).
2. Run the backfill once against prod: `DATABASE_URL=<prod session-mode pooler DSN> python3 -m company_discovery.name_backfill` (~5.8k rows, 5 workers; resumable).
3. Verify with SQL (visible companies missing display_name → near 0 for greenhouse/lever/ashby minus dead boards) and eyeball the board + Companies page for cased names.
