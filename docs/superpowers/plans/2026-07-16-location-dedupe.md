# Location Dedupe & Canonicalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map every raw `jobs.location` string to one or more canonical location strings (gazetteer-anchored, LLM-assisted for the tail), and switch every location filter from exact-raw-string matching to canonical array matching with remote as an opt-in facet.

**Architecture:** A new poller-owned `locations` table caches raw→canonicals forever. A rule pass resolves strings against the offline geonamescache gazetteer; leftovers go to a batched LLM whose output must validate back through the gazetteer (it parses, never invents). Canonicals are denormalized onto `jobs.location_canonicals TEXT[]` by a nightly set-based re-stamp. All five match sites switch to one predicate: `COALESCE(j.location_canonicals, ARRAY[j.location]) && prefs OR ('Remote' = ANY(prefs) AND j.remote IS TRUE)`.

**Tech Stack:** Python 3 / psycopg3 (poller), geonamescache 3.x (offline GeoNames data, MIT), OpenRouter via the existing `observability.llm.traced_structured_call` helper, Next.js dashboard with postgres.js, vitest + pytest.

**Spec:** `docs/superpowers/specs/2026-07-16-location-dedupe-design.md` — read it first.

## Global Constraints

- **Never rewrite existing commits** (repo CLAUDE.md). Fix forward with new commits only.
- Python tests: `python3 -m pytest tests/<file> -q` (no venv). DB-backed tests need a throwaway Postgres: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test`. Tests marked `@requires_db` skip cleanly when it's unset.
- Dashboard tests: `cd dashboard && npx vitest run <file>`; typecheck with `npx tsc --noEmit`. The dashboard DB test is gated the same way on `TEST_DATABASE_URL`.
- Canonical string formats (fixed by the spec, generated only from gazetteer entries): US city `"Austin, TX"`; non-US city `"London, United Kingdom"`; US state `"Texas"`; country `"United States"`; remote `"Remote"`; unmappable = the raw string itself.
- All remote variants collapse to the single canonical `"Remote"`. Remote is opt-in: no `'Remote'` in prefs ⇒ remote-only jobs excluded.
- gazetteer: `geonamescache>=3.0`, `GeonamesCache(min_city_population=15000)`. The LLM never mints a canonical string — every LLM answer resolves through `resolve_fields()` or the raw string is stored `unmappable`.
- LLM/API failure must never fail or block the poll; unresolved raws are simply retried next run.
- `locations` is service-only: RLS enabled, **no policies, no grants**. The dashboard reads only `jobs.location_canonicals`.
- Dashboard boundary rule (dashboard/CLAUDE.md): no bare `as` casts on values crossing the DB boundary — validate arrays field-by-field in `toJobRow`.
- The migration must be applied to Supabase **before** any deploy of code that references the new column/table (deploy-topology convention).

## File Structure

```
migrations/2026-07-16-locations-canonical.sql   new: locations table + jobs.location_canonicals + GIN + RLS
schema.sql                                      modified: same DDL for fresh test loads
job_discovery/gazetteer.py                      new: pure rule-pass resolution against geonamescache
job_discovery/location_llm.py                   new: pydantic schema + batched OpenRouter parse client
job_discovery/locations.py                      new: orchestration (scope → rule → LLM → insert → stamp)
job_discovery/location_backfill.py              new: rollout artifact (python -m), rerunnable
job_discovery/prefs_backfill.py                 new: rollout artifact — remap profiles.preferred_locations + append Remote
job_discovery/run.py                            modified: nightly resolution step after finish_run
reviewer/db.py                                  modified: select_candidates predicate
dashboard/lib/jobsQuery.ts                      modified: board predicate + select location_canonicals
dashboard/lib/types.ts                          modified: JobRowBase.location_canonicals
dashboard/lib/queries.ts                        modified: toJobRow, reviewStatsWith, distinctLocationsWith
dashboard/lib/metrics.ts                        modified: reviewAggWith, jobsByLocation
dashboard/lib/rolefit/filter.ts                 modified: client-side locs filter + facetCounts
docs/runbooks/2026-07-16-location-canonicalization-rollout.md  new: operator rollout runbook
requirements.txt / pyproject.toml               modified: + geonamescache
tests/test_locations_schema.py                  new
tests/test_gazetteer.py                         new
tests/test_location_llm.py                      new
tests/test_locations_resolution.py              new
tests/test_prefs_backfill.py                    new
tests/test_run.py                               modified: resolution-phase wiring/isolation
tests/test_reviewer_db.py                       modified: remote opt-in expectations
dashboard/lib/jobsQuery.test.ts                 modified
dashboard/lib/queries.locationScoping.db.test.ts  rewritten
dashboard/lib/rolefit/filter.test.ts            modified
```

---

### Task 1: Schema — `locations` table + `jobs.location_canonicals`

**Files:**
- Create: `migrations/2026-07-16-locations-canonical.sql`
- Modify: `schema.sql` (jobs table ~line 23-37; add locations table after the jobs indexes ~line 45)
- Test: `tests/test_locations_schema.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: table `locations(raw TEXT PK, canonicals TEXT[], components JSONB, source TEXT, created_at)`; column `jobs.location_canonicals TEXT[]` with GIN index. Every later task depends on these exact names.

- [ ] **Step 1: Write the failing test**

Create `tests/test_locations_schema.py`:

```python
import json

from tests.conftest import requires_db


@requires_db
def test_locations_table_shape(conn):
    """locations rows round-trip; the source CHECK rejects unknown values."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES (%s, %s, %s::jsonb, %s)",
            ("Austin Texas", ["Austin, TX"],
             json.dumps([{"canonical": "Austin, TX", "kind": "city",
                          "geonameid": 4671654, "country_code": "US",
                          "admin1_code": "TX"}]),
             "rule"),
        )
        cur.execute("SELECT canonicals, components, source FROM locations WHERE raw = %s",
                    ("Austin Texas",))
        row = cur.fetchone()
    assert row["canonicals"] == ["Austin, TX"]
    assert row["components"][0]["kind"] == "city"
    assert row["source"] == "rule"


@requires_db
def test_locations_source_check(conn):
    import psycopg
    import pytest
    with pytest.raises(psycopg.errors.CheckViolation):
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO locations (raw, canonicals, components, source) "
                "VALUES ('x', '{x}', '[]'::jsonb, 'guess')")
    conn.rollback()


@requires_db
def test_locations_rls_enabled_no_policies(conn):
    """Service-only table: RLS on, zero policies, zero grants to app roles."""
    with conn.cursor() as cur:
        cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname = 'locations'")
        assert cur.fetchone()["relrowsecurity"] is True
        cur.execute("SELECT count(*) AS n FROM pg_policies WHERE tablename = 'locations'")
        assert cur.fetchone()["n"] == 0


@requires_db
def test_jobs_location_canonicals_column(conn):
    """jobs.location_canonicals exists, holds arrays, and the stamp UPDATE joins work."""
    from job_discovery import db as poller_db
    from job_discovery.models import Posting
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="1", title="Eng", url="https://x",
                                 location="NYC or Remote"))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES ('NYC or Remote', %s, '[]'::jsonb, 'rule')",
            (["New York City, NY", "Remote"],))
        cur.execute("""
            UPDATE jobs SET location_canonicals = l.canonicals
            FROM locations l
            WHERE jobs.location = l.raw
              AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
        """)
        assert cur.rowcount == 1
        cur.execute("SELECT location_canonicals FROM jobs WHERE id = 'lever:acme:1'")
        assert cur.fetchone()["location_canonicals"] == ["New York City, NY", "Remote"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_locations_schema.py -q`
Expected: FAIL — `relation "locations" does not exist` (the conftest loads `schema.sql`, which doesn't have it yet).

- [ ] **Step 3: Write the migration**

Create `migrations/2026-07-16-locations-canonical.sql`:

```sql
-- Gazetteer-anchored location canonicalization: raw->canonicals cache + denormalized
-- jobs column. See docs/superpowers/specs/2026-07-16-location-dedupe-design.md.
BEGIN;

CREATE TABLE IF NOT EXISTS locations (
  raw         TEXT PRIMARY KEY,   -- exact string as seen on jobs.location
  canonicals  TEXT[] NOT NULL,    -- e.g. '{"New York City, NY","Remote"}'; '{raw}' if unmappable
  components  JSONB NOT NULL,     -- [{canonical, kind, geonameid, country_code, admin1_code}]
  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Poller/service-only: RLS on with NO policies and NO grants. The dashboard never
-- reads this table — jobs.location_canonicals is the denormalized read surface.
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_canonicals TEXT[];
CREATE INDEX IF NOT EXISTS idx_jobs_location_canonicals
  ON jobs USING GIN (location_canonicals);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-16-locations-canonical.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 4: Mirror the DDL in `schema.sql`**

In `CREATE TABLE jobs`, after the `remote        BOOLEAN,` line add:

```sql
  location_canonicals TEXT[],                 -- stamped from locations.canonicals; NULL = not yet resolved
```

After the jobs index block (after `idx_jobs_open` and the lifespan-index comment lines), add:

```sql
CREATE INDEX idx_jobs_location_canonicals ON jobs USING GIN (location_canonicals);

-- Raw->canonical location cache, poller-owned (service-only: RLS on, no policies,
-- no grants). See docs/superpowers/specs/2026-07-16-location-dedupe-design.md.
CREATE TABLE locations (
  raw         TEXT PRIMARY KEY,
  canonicals  TEXT[] NOT NULL,
  components  JSONB NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_locations_schema.py tests/test_schema.py -q`
Expected: PASS (test_schema.py confirms schema.sql still loads cleanly).

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-07-16-locations-canonical.sql schema.sql tests/test_locations_schema.py
git commit -m "feat(locations): locations mapping table + jobs.location_canonicals"
```

---

### Task 2: Gazetteer rule resolver

**Files:**
- Create: `job_discovery/gazetteer.py`
- Modify: `requirements.txt`, `pyproject.toml` (add `geonamescache>=3.0`)
- Test: `tests/test_gazetteer.py`

**Interfaces:**
- Consumes: geonamescache only.
- Produces (used by Tasks 3, 4):
  - `@dataclass(frozen=True) Resolved(canonical: str, kind: str, geonameid: int | None = None, country_code: str | None = None, admin1_code: str | None = None)` — kind ∈ `'city'|'state'|'country'|'remote'`
  - `REMOTE: Resolved` (the singleton `Resolved("Remote", "remote")`)
  - `resolve_location(raw: str) -> list[Resolved]` — rule pass; `[]` means "rules don't fully understand this string" (LLM takes over). All-or-nothing: if any component fails, returns `[]`.
  - `resolve_fields(city: str | None, state: str | None, country: str | None, remote: bool = False) -> Resolved | None` — validates one LLM-parsed element; `None` = rejected.

geonamescache 3.0.1 API facts (verified live): `GeonamesCache(min_city_population=15000)`; `search_cities(q, case_sensitive=False, contains_search=False)` is a case-insensitive **exact** match on alternatenames (`contains_search=True` gives garbage substring hits — never use it); `get_cities_by_name(name)` is a **case-sensitive** exact match on the primary name returning `[{geonameid_str: city}]`; city records have `name, countrycode, admin1code, population, geonameid`; `get_countries()` is keyed by ISO2 with `{iso, iso3, name}`; `get_us_states()` keyed by code with `{code, name}`. "NYC" exact-resolves to New York City (pop 8.8M) via population-max; "london" → London GB over London CA the same way.

- [ ] **Step 1: Add the dependency**

In `requirements.txt` add a line after `openai>=1.50.0`:

```
geonamescache>=3.0
```

In `pyproject.toml` `[project] dependencies` add `"geonamescache>=3.0",` after the `"openai>=1.50.0",` entry. Then run `python3 -m pip install geonamescache` (user-level; the CI/Railway installs come from requirements.txt).

- [ ] **Step 2: Write the failing tests**

Create `tests/test_gazetteer.py`:

```python
from job_discovery.gazetteer import REMOTE, Resolved, resolve_fields, resolve_location


def canonicals(raw):
    return [r.canonical for r in resolve_location(raw)]


# -- the motivating variants from the spec ------------------------------------

def test_remote_variants_collapse_to_single_bucket():
    for raw in ["Remote", "remote", "Remote - USA", "Remote - United States",
                "Remote — Worldwide", "100% Remote", "Remote (US)"]:
        assert resolve_location(raw) == [REMOTE], raw


def test_austin_variants_all_map_to_austin_tx():
    for raw in ["Austin", "Austin TX", "Austin Texas", "Austin, TX",
                "Austin, Texas", "Austin, Texas, United States"]:
        rs = resolve_location(raw)
        assert canonicals(raw) == ["Austin, TX"], raw
        assert rs[0].kind == "city"
        assert rs[0].country_code == "US" and rs[0].admin1_code == "TX"
        assert rs[0].geonameid is not None


def test_multi_location_string_maps_to_every_place():
    assert canonicals("NYC or Remote") == ["New York City, NY", "Remote"]
    assert canonicals("Berlin / London") == ["Berlin, Germany", "London, United Kingdom"]


# -- kinds beyond city ---------------------------------------------------------

def test_country_only():
    for raw in ["United States", "USA", "US"]:
        rs = resolve_location(raw)
        assert [r.canonical for r in rs] == ["United States"], raw
        assert rs[0].kind == "country" and rs[0].country_code == "US"


def test_state_only():
    rs = resolve_location("Texas")
    assert [r.canonical for r in rs] == ["Texas"]
    assert rs[0].kind == "state" and rs[0].admin1_code == "TX"


def test_state_with_country():
    assert canonicals("Texas, USA") == ["Texas"]


def test_non_us_city_canonical_uses_country_name():
    rs = resolve_location("London, United Kingdom")
    assert [r.canonical for r in rs] == ["London, United Kingdom"]
    assert rs[0].country_code == "GB"
    # bare "London" resolves to the biggest London (GB), not London, Ontario
    assert canonicals("London") == ["London, United Kingdom"]


def test_ambiguous_city_picks_population_max():
    # Austin, MN (24k) exists; population-max picks Austin, TX
    assert canonicals("Austin") == ["Austin, TX"]


def test_state_qualifier_disambiguates():
    rs = resolve_location("Austin, MN")
    assert [r.canonical for r in rs] == ["Austin, MN"]


# -- refusal paths --------------------------------------------------------------

def test_unresolvable_returns_empty():
    assert resolve_location("Multiple Locations") == []
    assert resolve_location("See posting") == []
    assert resolve_location("") == []


def test_partially_resolvable_multi_string_returns_empty():
    # all-or-nothing: rules must not half-answer; the LLM gets the whole string
    assert resolve_location("Austin, TX / Fooville Fake") == []


def test_dedupe_preserves_order():
    assert canonicals("Remote / Remote - US") == ["Remote"]


# -- resolve_fields (the LLM-output validator) ----------------------------------

def test_resolve_fields_valid_city():
    r = resolve_fields("Austin", "TX", "US")
    assert r is not None and r.canonical == "Austin, TX"


def test_resolve_fields_state_name():
    r = resolve_fields("Austin", "Texas", "United States")
    assert r is not None and r.canonical == "Austin, TX"


def test_resolve_fields_remote_wins():
    assert resolve_fields("Austin", "TX", "US", remote=True) == REMOTE


def test_resolve_fields_hallucinated_city_rejected():
    assert resolve_fields("Atlantisville", None, "US") is None


def test_resolve_fields_conflicting_state_country_rejected():
    assert resolve_fields("Austin", "TX", "Canada") is None


def test_resolve_fields_country_only():
    r = resolve_fields(None, None, "Germany")
    assert r is not None and r.canonical == "Germany" and r.kind == "country"


def test_resolve_fields_nothing_given():
    assert resolve_fields(None, None, None) is None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_gazetteer.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'job_discovery.gazetteer'`.

- [ ] **Step 4: Write the implementation**

Create `job_discovery/gazetteer.py`:

```python
"""Gazetteer-anchored location resolution (rule pass).

geonamescache is the closed vocabulary: every canonical string is generated
from a gazetteer entry (or the fixed 'Remote' bucket) — never free text. The
LLM pass (location_llm.py) parses messy strings into {city, state, country}
fields that MUST validate back through resolve_fields(); an answer that does
not resolve here is rejected. Spec:
docs/superpowers/specs/2026-07-16-location-dedupe-design.md
"""
import re
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Resolved:
    canonical: str
    kind: str  # 'city' | 'state' | 'country' | 'remote'
    geonameid: int | None = None
    country_code: str | None = None
    admin1_code: str | None = None


REMOTE = Resolved(canonical="Remote", kind="remote")

# Substring match (mirrors normalize.detect_remote): any component mentioning
# remote collapses to the single Remote bucket — "Remote - USA" and
# "Remote — Worldwide" are deliberately ONE facet entry (spec decision).
_REMOTE_RE = re.compile(r"remote|work from home|\bwfh\b", re.IGNORECASE)

# Multi-location delimiters ONLY. A " - " qualifier ("Remote - USA") is NOT a
# delimiter: that whole string is one component.
_SPLIT_RE = re.compile(r"\s+or\s+|\s*/\s*|\s*;\s*|\s*&\s*", re.IGNORECASE)

_PAREN_RE = re.compile(r"\([^)]*\)")

# Bounded spelling aliases the ISO tables don't carry. NOT place data (that all
# comes from geonamescache) — just common abbreviations of country references.
_COUNTRY_ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US",
    "united states of america": "US",
    "uk": "GB", "u.k.": "GB", "great britain": "GB",
}


@lru_cache(maxsize=1)
def _gazetteer():
    """(gc, countries_by_alias, states_by_alias), built once per process.

    countries_by_alias: lowercase name/iso2/iso3/alias -> (iso2, name)
    states_by_alias:    lowercase US state name/code   -> (code, name)
    """
    from geonamescache import GeonamesCache  # lazy: ~1s data load on first use

    gc = GeonamesCache(min_city_population=15000)
    countries: dict[str, tuple[str, str]] = {}
    for c in gc.get_countries().values():
        entry = (c["iso"], c["name"])
        for alias in (c["name"], c["iso"], c["iso3"]):
            countries[alias.lower()] = entry
    for alias, iso2 in _COUNTRY_ALIASES.items():
        countries[alias] = (iso2, gc.get_countries()[iso2]["name"])
    states: dict[str, tuple[str, str]] = {}
    for s in gc.get_us_states().values():
        entry = (s["code"], s["name"])
        states[s["name"].lower()] = entry
        states[s["code"].lower()] = entry
    return gc, countries, states


def _city_hits(gc, name: str) -> list[dict]:
    # Union of the two exact lookups: search_cities matches alternatenames
    # case-insensitively ("NYC", "münchen"); get_cities_by_name matches the
    # primary name case-sensitively. contains_search stays False — substring
    # mode returns garbage (e.g. "NYC" inside foreign alternate names).
    hits = {c["geonameid"]: c
            for c in gc.search_cities(name, case_sensitive=False, contains_search=False)}
    for d in gc.get_cities_by_name(name):
        for c in d.values():
            hits[c["geonameid"]] = c
    return list(hits.values())


def _city(gc, name: str, admin1: str | None = None,
          country: str | None = None) -> Resolved | None:
    hits = _city_hits(gc, name)
    if admin1:  # admin1 filtering is US-states-only (that's all we can parse)
        hits = [h for h in hits if h["countrycode"] == "US" and h["admin1code"] == admin1]
    if country:
        hits = [h for h in hits if h["countrycode"] == country]
    best = max(hits, key=lambda h: h["population"], default=None)
    if best is None:
        return None
    if best["countrycode"] == "US":
        canonical = f"{best['name']}, {best['admin1code']}"
    else:
        canonical = f"{best['name']}, {gc.get_countries()[best['countrycode']]['name']}"
    return Resolved(canonical, "city", int(best["geonameid"]),
                    best["countrycode"], best["admin1code"] or None)


def _state_resolved(state: tuple[str, str]) -> Resolved:
    code, name = state
    return Resolved(name, "state", country_code="US", admin1_code=code)


def _country_resolved(country: tuple[str, str]) -> Resolved:
    iso2, name = country
    return Resolved(name, "country", country_code=iso2)


def _parse_single(gc, countries, states, token: str) -> Resolved | None:
    c = countries.get(token.lower())
    if c:
        return _country_resolved(c)
    s = states.get(token.lower())
    if s:
        return _state_resolved(s)
    hit = _city(gc, token)
    if hit:
        return hit
    # Space-separated qualifier: "Austin Texas", "Austin TX", "Berlin Germany"
    words = token.split()
    if len(words) >= 2:
        head, tail = " ".join(words[:-1]), words[-1]
        s = states.get(tail.lower())
        if s:
            return _city(gc, head, admin1=s[0])
        c = countries.get(tail.lower())
        if c:
            return _city(gc, head, country=c[0])
    return None


def _parse_component(part: str) -> Resolved | None:
    gc, countries, states = _gazetteer()
    part = _PAREN_RE.sub(" ", part)
    part = re.sub(r"\s+", " ", part).strip(" ,-–—")
    if not part:
        return None
    if _REMOTE_RE.search(part):
        return REMOTE
    tokens = [t.strip() for t in part.split(",") if t.strip()]
    if not tokens:
        return None
    if len(tokens) == 1:
        return _parse_single(gc, countries, states, tokens[0])
    # Comma-form shapes seen in ATS data: [City, ST] · [City, Country] ·
    # [State, Country] · [City, ST, Country] · [City, Region, Country].
    #
    # ORDER MATTERS: US state codes collide with ISO country codes ("MN" is
    # Minnesota AND Mongolia, "CA" is California AND Canada, "DE" is Delaware
    # AND Germany). Try the STATE interpretation first, accepted only when a
    # real city resolves under that state — "Austin, MN" finds Austin,
    # Minnesota and never consults Mongolia; "Berlin, DE" finds no Berlin,
    # Delaware (< 15k pop) and correctly falls through to Germany.
    tail = tokens[-1].lower()
    state = states.get(tail)
    if state:
        hit = _city(gc, ", ".join(tokens[:-1]), admin1=state[0])
        if hit:
            return hit
    country = countries.get(tail)
    if country:
        rest = tokens[:-1]
        # [State, Country]: "Texas, USA"
        if len(rest) == 1:
            s = states.get(rest[0].lower())
            if s and country[0] == "US":
                return _state_resolved(s)
        # [City, ST, Country]: state qualifier just before the country
        if len(rest) >= 2:
            s = states.get(rest[-1].lower())
            if s and country[0] == "US":
                hit = _city(gc, ", ".join(rest[:-1]), admin1=s[0])
                if hit:
                    return hit
        # [City, Country] — and [City, Region, Country] by dropping the
        # unparseable inner region qualifier
        hit = _city(gc, ", ".join(rest), country=country[0])
        if hit:
            return hit
        if len(rest) >= 2:
            hit = _city(gc, ", ".join(rest[:-1]), country=country[0])
            if hit:
                return hit
        return None
    # Neither a state nor a country qualifier: try the whole thing as an
    # exact city name ("Washington, D.C." is a GeoNames primary name).
    return _city(gc, ", ".join(tokens))


def resolve_location(raw: str) -> list[Resolved]:
    """Rule-pass resolution of one raw location string.

    All-or-nothing: every delimiter-separated component must resolve, or []
    is returned and the LLM pass adjudicates the whole string. The result is
    deduped preserving order ("Remote / Remote - US" -> [REMOTE]).
    """
    if not raw or not raw.strip():
        return []
    out: list[Resolved] = []
    for part in _SPLIT_RE.split(raw.strip()):
        if not part.strip():
            continue
        r = _parse_component(part)
        if r is None:
            return []
        if r not in out:
            out.append(r)
    return out


def resolve_fields(city: str | None, state: str | None, country: str | None,
                   remote: bool = False) -> Resolved | None:
    """Validate one LLM-parsed element against the gazetteer. None = rejected.

    remote=True short-circuits to the Remote bucket (spec: remote variants
    collapse regardless of any stated region). A stated state/country that the
    gazetteer can't place, or a city that doesn't exist under the stated
    qualifiers, rejects the element — the LLM parses, it never invents.
    """
    if remote:
        return REMOTE
    gc, countries, states = _gazetteer()
    iso2 = admin1 = None
    if country:
        hit = countries.get(country.strip().lower())
        if hit is None:
            return None
        iso2 = hit[0]
    if state:
        s = states.get(state.strip().lower())
        if s is not None:
            admin1 = s[0]
        # a non-US "state" (e.g. Bavaria) is ignored; the country constrains
    if city:
        return _city(gc, city.strip(), admin1=admin1, country=iso2)
    if admin1:
        return _state_resolved(states[state.strip().lower()])
    if iso2:
        return _country_resolved(countries[country.strip().lower()])
    return None
```

- [ ] **Step 5: Run tests, iterate until green**

Run: `python3 -m pytest tests/test_gazetteer.py -q`
Expected: PASS. The comma-form qualifier stripping (`_parse_component`) is the fiddly part — if a case fails, fix the parser, **not** the test fixtures (the fixtures are the spec). Also run `python3 -m pytest tests/test_normalize.py -q` (must stay green — `detect_remote` is untouched).

- [ ] **Step 6: Commit**

```bash
git add job_discovery/gazetteer.py tests/test_gazetteer.py requirements.txt pyproject.toml
git commit -m "feat(locations): gazetteer rule resolver (geonamescache-anchored)"
```

---

### Task 3: LLM parse client

**Files:**
- Create: `job_discovery/location_llm.py`
- Test: `tests/test_location_llm.py`

**Interfaces:**
- Consumes: `observability.llm.traced_structured_call` (existing).
- Produces (used by Task 4):
  - `ParsedLocation(BaseModel)`: `city: str | None`, `state: str | None`, `country: str | None`, `remote: bool = False`
  - `LocationParseClient(client=None, model=None)` with `async parse_batch(raws: list[str]) -> dict[int, list[ParsedLocation]]` — an index absent from the dict means "model gave no answer for it" (caller leaves that raw unmapped to retry later)
  - `BATCH_SIZE = 40`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_location_llm.py`:

```python
import asyncio
from types import SimpleNamespace

from job_discovery.location_llm import (
    LocationParse, LocationParseBatch, LocationParseClient, ParsedLocation,
)


def make_fake_client(result):
    """Stub matching the surface traced_structured_call uses:
    client.beta.chat.completions.parse(**kwargs) -> resp with .choices[0].message.parsed."""
    async def parse(**kwargs):
        msg = SimpleNamespace(parsed=result, refusal=None)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=msg, finish_reason="stop")],
            usage=None, id=None, model="fake")
    completions = SimpleNamespace(parse=parse)
    return SimpleNamespace(beta=SimpleNamespace(chat=SimpleNamespace(completions=completions)))


def test_parse_batch_maps_indexes():
    result = LocationParseBatch(parses=[
        LocationParse(index=0, locations=[
            ParsedLocation(city="Boston", state="MA", country="US", remote=False)]),
        LocationParse(index=1, locations=[]),
    ])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["Greater Boston Area", "Gibberish"]))
    assert out[0][0].city == "Boston"
    assert out[1] == []


def test_parse_batch_drops_out_of_range_indexes():
    result = LocationParseBatch(parses=[
        LocationParse(index=7, locations=[ParsedLocation(city="Boston")]),
    ])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["only one input"]))
    assert out == {}


def test_missing_index_is_absent_not_empty():
    result = LocationParseBatch(parses=[LocationParse(index=0, locations=[])])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["a", "b"]))
    assert 0 in out and 1 not in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_location_llm.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'job_discovery.location_llm'`.

- [ ] **Step 3: Write the implementation**

Create `job_discovery/location_llm.py`:

```python
"""Batched LLM parse of raw location strings the gazetteer rules can't resolve.

The model PARSES text into {city, state, country, remote} fields; it never
produces canonical strings. Every element is validated back through
gazetteer.resolve_fields() by the caller (locations.py) — an element that
doesn't resolve is dropped, and a string with zero surviving elements is
stored unmappable. Mirrors company_discovery/llm.py's client shape.
"""
import os

from pydantic import BaseModel

from observability.llm import traced_structured_call

DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
BATCH_SIZE = 40

_INSTRUCTIONS = (
    "You normalize job-posting LOCATION strings. For each numbered input "
    "string, extract EVERY distinct place it names.\n"
    "- Return exactly one `parses` entry per input, carrying that input's "
    "index number.\n"
    "- Each place is {city, state, country, remote}. Use English exonyms "
    "('Munich', not 'München'). state: US state name or 2-letter code; null "
    "outside the US. country: country name or ISO code; null if unstated.\n"
    "- remote: true when that part of the string offers remote work "
    "('Remote', 'Remote - USA', 'WFH', 'anywhere'); leave city/state/country "
    "null for a purely remote mention.\n"
    "- A string naming several places ('NYC or Remote', 'Berlin / London') "
    "yields several entries in `locations`.\n"
    "- locations: [] when the string names no resolvable real-world place "
    "('Multiple Locations', 'See posting', team or building names).\n"
    "- Never invent a place that is not clearly named in the string."
)


class ParsedLocation(BaseModel):
    city: str | None = None
    state: str | None = None
    country: str | None = None
    remote: bool = False


class LocationParse(BaseModel):
    index: int
    locations: list[ParsedLocation]


class LocationParseBatch(BaseModel):
    parses: list[LocationParse]


class LocationParseClient:
    def __init__(self, client=None, model: str | None = None):
        if client is None:
            from openai import AsyncOpenAI  # lazy: avoid import + key read at module load
            client = AsyncOpenAI(
                base_url=_OPENROUTER_BASE_URL,
                api_key=os.environ["OPENROUTER_API_KEY"],
                default_headers={"X-Title": "job-board"},
            )
        self._client = client
        self.model = model or os.environ.get("LOCATION_MODEL", DEFAULT_MODEL)

    async def parse_batch(self, raws: list[str]) -> dict[int, list[ParsedLocation]]:
        """Parse up to BATCH_SIZE raw strings in one call.

        Returns {input_index: places}. An index the model didn't answer is
        ABSENT (not []): the caller leaves that raw unmapped so a later run
        retries it, whereas an explicit [] means "no real place named" and
        becomes an unmappable row.
        """
        numbered = "\n".join(f"{i}: {r}" for i, r in enumerate(raws))
        parsed, _ = await traced_structured_call(
            self._client,
            model=self.model,
            messages=[
                {"role": "system", "content": _INSTRUCTIONS},
                {"role": "user", "content": numbered},
            ],
            schema=LocationParseBatch,
            name="location-parse",
            metadata={"batch_size": len(raws)},
            # Deterministic parsing (spec: temperature 0). traced_structured_call
            # merges extra_body into the request JSON, so this reaches OpenRouter.
            extra_body={"temperature": 0},
        )
        return {p.index: p.locations for p in parsed.parses if 0 <= p.index < len(raws)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_location_llm.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add job_discovery/location_llm.py tests/test_location_llm.py
git commit -m "feat(locations): batched LLM location-parse client"
```

---

### Task 4: Resolution orchestration (`locations.py`)

**Files:**
- Create: `job_discovery/locations.py`
- Test: `tests/test_locations_resolution.py`

**Interfaces:**
- Consumes: `gazetteer.resolve_location`, `gazetteer.resolve_fields`, `gazetteer.Resolved`, `location_llm.LocationParseClient`, `location_llm.BATCH_SIZE`, tables from Task 1.
- Produces (used by Tasks 5, 6):
  - `resolve_new_locations(conn, parse_client=None) -> dict` with counts `{'rule','llm','unmappable','stamped'}`; commits internally (durable/resumable); never raises on LLM failure
  - `stamp_jobs(conn) -> int`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_locations_resolution.py`:

```python
from job_discovery import db as poller_db
from job_discovery.location_llm import ParsedLocation
from job_discovery.locations import resolve_new_locations, stamp_jobs
from job_discovery.models import Posting
from tests.conftest import requires_db


def _seed_job(conn, ext, location):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id=ext, title="Eng", url="https://x",
                                 location=location))
    conn.commit()
    return f"lever:acme:{ext}"


def _canonicals(conn, job_id):
    with conn.cursor() as cur:
        cur.execute("SELECT location_canonicals FROM jobs WHERE id = %s", (job_id,))
        return cur.fetchone()["location_canonicals"]


class FakeParseClient:
    """mapping: raw -> list[ParsedLocation]; raws absent from mapping get no answer."""
    def __init__(self, mapping=None, boom=False):
        self.mapping = mapping or {}
        self.boom = boom
        self.calls = 0

    async def parse_batch(self, raws):
        self.calls += 1
        if self.boom:
            raise RuntimeError("llm down")
        return {i: self.mapping[raw] for i, raw in enumerate(raws) if raw in self.mapping}


@requires_db
def test_rule_pass_inserts_and_stamps(conn):
    jid = _seed_job(conn, "1", "Austin Texas")
    counts = resolve_new_locations(conn, parse_client=FakeParseClient())
    assert counts["rule"] == 1 and counts["stamped"] == 1
    assert _canonicals(conn, jid) == ["Austin, TX"]
    with conn.cursor() as cur:
        cur.execute("SELECT canonicals, source FROM locations WHERE raw = 'Austin Texas'")
        row = cur.fetchone()
    assert row["canonicals"] == ["Austin, TX"] and row["source"] == "rule"


@requires_db
def test_multi_location_stamps_array(conn):
    jid = _seed_job(conn, "1", "NYC or Remote")
    resolve_new_locations(conn, parse_client=FakeParseClient())
    assert _canonicals(conn, jid) == ["New York City, NY", "Remote"]


@requires_db
def test_llm_pass_validates_against_gazetteer(conn):
    jid = _seed_job(conn, "1", "Greater Boston Area")
    fake = FakeParseClient({"Greater Boston Area": [
        ParsedLocation(city="Boston", state="MA", country="US"),
        ParsedLocation(city="Atlantisville", country="US"),  # hallucination -> dropped
    ]})
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["llm"] == 1
    assert _canonicals(conn, jid) == ["Boston, MA"]
    with conn.cursor() as cur:
        cur.execute("SELECT source FROM locations WHERE raw = 'Greater Boston Area'")
        assert cur.fetchone()["source"] == "llm"


@requires_db
def test_llm_empty_answer_becomes_unmappable(conn):
    jid = _seed_job(conn, "1", "Multiple Locations")
    fake = FakeParseClient({"Multiple Locations": []})
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["unmappable"] == 1
    assert _canonicals(conn, jid) == ["Multiple Locations"]
    with conn.cursor() as cur:
        cur.execute("SELECT canonicals, components FROM locations WHERE raw = 'Multiple Locations'")
        row = cur.fetchone()
    assert row["canonicals"] == ["Multiple Locations"]
    assert row["components"][0]["kind"] == "unmappable"


@requires_db
def test_llm_failure_leaves_raw_unmapped_and_does_not_raise(conn):
    jid = _seed_job(conn, "1", "Greater Boston Area")
    counts = resolve_new_locations(conn, parse_client=FakeParseClient(boom=True))
    assert counts["llm"] == 0 and counts["unmappable"] == 0
    assert _canonicals(conn, jid) is None  # COALESCE fallback keeps it matchable by raw
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM locations WHERE raw = 'Greater Boston Area'")
        assert cur.fetchone()["n"] == 0  # absent -> retried next run


@requires_db
def test_unanswered_index_left_unmapped(conn):
    _seed_job(conn, "1", "Greater Boston Area")
    fake = FakeParseClient(mapping={})  # answers nothing, but doesn't raise
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts == {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}


@requires_db
def test_manual_correction_propagates_on_restamp(conn):
    jid = _seed_job(conn, "1", "Austin Texas")
    resolve_new_locations(conn, parse_client=FakeParseClient())
    with conn.cursor() as cur:
        cur.execute("UPDATE locations SET canonicals = %s, source = 'manual' "
                    "WHERE raw = 'Austin Texas'", (["Austin, MN"],))
    conn.commit()
    assert stamp_jobs(conn) == 1
    conn.commit()
    assert _canonicals(conn, jid) == ["Austin, MN"]


@requires_db
def test_already_mapped_raws_not_reprocessed(conn):
    _seed_job(conn, "1", "Austin Texas")
    fake = FakeParseClient()
    resolve_new_locations(conn, parse_client=fake)
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["rule"] == 0 and counts["stamped"] == 0
    assert fake.calls == 0  # nothing unresolved -> LLM never invoked
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_locations_resolution.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'job_discovery.locations'`.

- [ ] **Step 3: Write the implementation**

Create `job_discovery/locations.py`:

```python
"""Raw-location resolution + nightly re-stamp.

locations is the permanent raw->canonicals cache. Rule pass first (gazetteer),
then a batched LLM pass for the leftovers (each element validated back through
the gazetteer), then a set-based re-stamp of jobs.location_canonicals. The
re-stamp runs every call, so a manual correction to a locations row propagates
on the next poll. LLM/API failure leaves those raws unmapped (retried next
run) — resolution must never fail the poll.
Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
"""
import asyncio
import json
import logging

from job_discovery.gazetteer import Resolved, resolve_fields, resolve_location

log = logging.getLogger("job_discovery.locations")

_NEW_RAWS_SQL = """
    SELECT DISTINCT j.location AS raw
    FROM jobs j
    LEFT JOIN locations l ON l.raw = j.location
    WHERE j.location IS NOT NULL AND j.location <> '' AND l.raw IS NULL
"""

# ON CONFLICT DO NOTHING: a concurrent run (or rerun after a partial commit)
# may have inserted the row already; first write wins, corrections go via
# source='manual' UPDATEs.
_INSERT_SQL = """
    INSERT INTO locations (raw, canonicals, components, source)
    VALUES (%s, %s, %s::jsonb, %s)
    ON CONFLICT (raw) DO NOTHING
"""

_STAMP_SQL = """
    UPDATE jobs SET location_canonicals = l.canonicals
    FROM locations l
    WHERE jobs.location = l.raw
      AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
"""


def _component(r: Resolved) -> dict:
    return {"canonical": r.canonical, "kind": r.kind, "geonameid": r.geonameid,
            "country_code": r.country_code, "admin1_code": r.admin1_code}


def _insert(conn, raw: str, resolved: list[Resolved], source: str) -> None:
    with conn.cursor() as cur:
        cur.execute(_INSERT_SQL, (raw, [r.canonical for r in resolved],
                                  json.dumps([_component(r) for r in resolved]), source))


def _insert_unmappable(conn, raw: str) -> None:
    components = [{"canonical": raw, "kind": "unmappable", "geonameid": None,
                   "country_code": None, "admin1_code": None}]
    with conn.cursor() as cur:
        cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))


def stamp_jobs(conn) -> int:
    """Set-based re-stamp; returns rows updated. Cheap when nothing changed."""
    with conn.cursor() as cur:
        cur.execute(_STAMP_SQL)
        return cur.rowcount


def _validated(places) -> list[Resolved]:
    out: list[Resolved] = []
    for p in places:
        r = resolve_fields(p.city, p.state, p.country, p.remote)
        if r is not None and r not in out:
            out.append(r)
    return out


def resolve_new_locations(conn, parse_client=None) -> dict:
    """Resolve every raw jobs.location that has no locations row, then re-stamp.

    Returns counts {'rule','llm','unmappable','stamped'}. Commits after the
    rule pass and after each LLM batch (durable and resumable, like
    name_backfill). An LLM element that fails gazetteer validation is dropped;
    a raw whose answered elements ALL fail (or that the model answers []) is
    stored unmappable; a raw the model doesn't answer, or any LLM/API error,
    leaves the raw absent so a later run retries it.
    """
    with conn.cursor() as cur:
        cur.execute(_NEW_RAWS_SQL)
        raws = [r["raw"] for r in cur.fetchall()]
    counts = {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}
    leftovers: list[str] = []
    for raw in raws:
        resolved = resolve_location(raw)
        if resolved:
            _insert(conn, raw, resolved, "rule")
            counts["rule"] += 1
        else:
            leftovers.append(raw)
    conn.commit()

    if leftovers:
        try:
            from job_discovery.location_llm import BATCH_SIZE, LocationParseClient
            client = parse_client or LocationParseClient()
            for start in range(0, len(leftovers), BATCH_SIZE):
                batch = leftovers[start:start + BATCH_SIZE]
                answers = asyncio.run(client.parse_batch(batch))
                for i, raw in enumerate(batch):
                    if i not in answers:
                        continue  # unanswered -> retry on a later run
                    resolved = _validated(answers[i])
                    if resolved:
                        _insert(conn, raw, resolved, "llm")
                        counts["llm"] += 1
                    else:
                        _insert_unmappable(conn, raw)
                        counts["unmappable"] += 1
                conn.commit()
        except Exception:
            conn.rollback()
            log.exception("location LLM pass failed; %s unresolved raws retry next run",
                          len(leftovers) - counts["llm"] - counts["unmappable"])

    counts["stamped"] = stamp_jobs(conn)
    conn.commit()
    log.info("locations: rule=%(rule)s llm=%(llm)s unmappable=%(unmappable)s "
             "stamped=%(stamped)s", counts)
    return counts
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_locations_resolution.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add job_discovery/locations.py tests/test_locations_resolution.py
git commit -m "feat(locations): resolution orchestration + nightly re-stamp"
```

---

### Task 5: Wire resolution into the nightly poll

**Files:**
- Modify: `job_discovery/run.py` (after `finish_run`/commit ~line 168, before the review phase)
- Test: `tests/test_run.py` (append; mirror `test_run_invokes_review_phase_isolated` / `test_run_survives_review_phase_error` at lines 129-172)

**Interfaces:**
- Consumes: `job_discovery.locations.resolve_new_locations(conn)`.
- Produces: the poll pipeline order — upserts → finish_run → **location resolution** → review phase → prune. Resolution runs before reviews so the same night's reviews use fresh canonicals.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_run.py` (reuse the file's existing imports/fixtures; mirror the review-phase tests' monkeypatch style — they stub `load_targets`, `ADAPTERS`, and reviewer's `review_all`; copy the same scaffold):

```python
@requires_db
def test_run_invokes_location_resolution(conn, monkeypatch):
    _stub_minimal_poll(monkeypatch)  # reuse/extract the same stubbing the review-phase tests use
    import job_discovery.locations as locations_mod
    calls = []
    monkeypatch.setattr(locations_mod, "resolve_new_locations",
                        lambda conn: calls.append(True) or {})
    run_module.run(dsn=TEST_DSN)
    assert calls == [True]


@requires_db
def test_run_survives_location_resolution_error(conn, monkeypatch):
    _stub_minimal_poll(monkeypatch)
    import job_discovery.locations as locations_mod

    def boom(conn):
        raise RuntimeError("resolution down")

    monkeypatch.setattr(locations_mod, "resolve_new_locations", boom)
    result = run_module.run(dsn=TEST_DSN)  # must not raise
    assert result["failed"] == 0
```

Note: `tests/test_run.py` already has helpers/imports for driving `run()` against the test DB (see `test_run_invokes_review_phase_isolated`, line 129). If there is no shared `_stub_minimal_poll` helper, extract one from that test's body rather than duplicating its monkeypatching, and use the file's existing names for `run_module` / `TEST_DSN`.

- [ ] **Step 2: Run to verify they fail**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_run.py -q -k location_resolution`
Expected: FAIL — `resolve_new_locations` never called (`calls == []`).

- [ ] **Step 3: Wire it in**

In `job_discovery/run.py`, immediately after the `conn.commit()` that follows `db.finish_run(...)` (line ~168) and **before** the `try: from reviewer.run import review_all` block, insert:

```python
        # Location canonicalization: resolve any raw location strings first
        # seen this poll, then re-stamp jobs.location_canonicals (also
        # propagates manual corrections). Runs before the review phase so
        # tonight's reviews filter on fresh canonicals. Failure is isolated —
        # unresolved raws just retry tomorrow.
        try:
            from job_discovery.locations import resolve_new_locations
            resolve_new_locations(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            log.exception("location resolution failed; poll results unaffected")
```

- [ ] **Step 4: Run the full Python suite**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/ -q`
Expected: PASS (the location tests plus everything pre-existing).

- [ ] **Step 5: Commit**

```bash
git add job_discovery/run.py tests/test_run.py
git commit -m "feat(locations): nightly resolution step in the poll pipeline"
```

---

### Task 6: Rollout scripts — location backfill + prefs migration

**Files:**
- Create: `job_discovery/location_backfill.py`, `job_discovery/prefs_backfill.py`
- Test: `tests/test_prefs_backfill.py`

**Interfaces:**
- Consumes: `locations.resolve_new_locations` (Task 4); tables from Task 1.
- Produces:
  - `python -m job_discovery.location_backfill` — resolves ALL distinct raws + stamps all jobs (identical operation to the nightly step; rerunnable)
  - `prefs_backfill.remap(prefs: list[str], mapping: dict[str, list[str]]) -> list[str]` (pure)
  - `prefs_backfill.run(conn) -> dict` and `python -m job_discovery.prefs_backfill` — remaps every profile's `preferred_locations` through `locations` and appends `"Remote"`; idempotent

- [ ] **Step 1: Write the failing tests**

Create `tests/test_prefs_backfill.py`:

```python
from job_discovery.prefs_backfill import remap, run
from tests.conftest import requires_db

U1 = "11111111-1111-1111-1111-111111111111"


def test_remap_expands_dedupes_and_appends_remote():
    mapping = {"Austin Texas": ["Austin, TX"],
               "NYC or Remote": ["New York City, NY", "Remote"]}
    assert remap(["Austin Texas", "Austin, TX", "NYC or Remote"], mapping) == \
        ["Remote", "Austin, TX", "New York City, NY"]


def test_remap_keeps_unmapped_entries_verbatim():
    assert remap(["Fooville"], {}) == ["Remote", "Fooville"]


def test_remap_is_idempotent():
    mapping = {"Austin Texas": ["Austin, TX"]}
    once = remap(["Austin Texas"], mapping)
    assert remap(once, mapping) == once


def test_remap_caps_at_100_without_dropping_remote():
    prefs = [f"City {i}" for i in range(150)]
    out = remap(prefs, {})
    assert len(out) == 100 and out[0] == "Remote"


@requires_db
def test_run_remaps_profiles(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            "preferred_locations) VALUES (%s, 'r', 'i', 'v1', %s)",
            (U1, ["Austin Texas", "Berlin, Germany"]))
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES ('Austin Texas', %s, '[]'::jsonb, 'rule')", (["Austin, TX"],))
    conn.commit()
    counts = run(conn)
    assert counts["updated"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT preferred_locations FROM profiles WHERE user_id = %s", (U1,))
        prefs = cur.fetchone()["preferred_locations"]
    assert prefs == ["Remote", "Austin, TX", "Berlin, Germany"]
    # second run is a no-op
    assert run(conn)["updated"] == 0
```

- [ ] **Step 2: Run to verify they fail**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_prefs_backfill.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write both scripts**

Create `job_discovery/location_backfill.py`:

```python
"""One-time rollout backfill: resolve EVERY existing distinct jobs.location and
stamp jobs.location_canonicals.

Run against a database:  DATABASE_URL=... OPENROUTER_API_KEY=... python -m job_discovery.location_backfill

This is exactly the nightly resolution step (locations.resolve_new_locations)
run outside a poll: the scope query already targets "raws with no locations
row", so a rerun only touches what the previous run missed (e.g. after an LLM
outage). Safe to rerun; commits per batch, so an interrupt loses nothing.

ROLLOUT ARTIFACT — run once at rollout, BEFORE deploying the dashboard/reviewer
predicate cutover and BEFORE prefs_backfill (which needs the mapping rows).
"""
import logging

from job_discovery import db
from job_discovery.locations import resolve_new_locations


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = db.connect()
    try:
        counts = resolve_new_locations(conn)
        logging.getLogger("location_backfill").info("backfill complete: %s", counts)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

Create `job_discovery/prefs_backfill.py`:

```python
"""One-time rollout migration: remap every profile's preferred_locations
through the locations table and append 'Remote'.

Run against a database:  DATABASE_URL=... python -m job_discovery.prefs_backfill

Remote-bypass removal makes remote OPT-IN; appending 'Remote' to every
existing profile preserves each user's current feed exactly (spec decision —
no feed may silently shrink at cutover). Entries with no mapping row are kept
verbatim (they still match via the predicate's COALESCE raw fallback).
Idempotent: remapping canonical values is a no-op and 'Remote' is set-guarded;
the UPDATE only fires when the array actually changes.

ROLLOUT ARTIFACT — run once at rollout, AFTER location_backfill.
"""
import logging

log = logging.getLogger("prefs_backfill")

_MAX_LOCATIONS = 100  # dashboard/lib/preferredLocations.ts MAX_LOCATIONS


def remap(prefs: list[str], mapping: dict[str, list[str]]) -> list[str]:
    """Pure remap: expand each entry through the mapping (multi-location raws
    expand to all their canonicals), dedupe preserving order, ensure 'Remote'
    (prepended so the MAX_LOCATIONS cap can never drop it)."""
    out: list[str] = ["Remote"]
    seen = {"Remote"}
    for p in prefs:
        for c in mapping.get(p, [p]):
            if c not in seen:
                seen.add(c)
                out.append(c)
    return out[:_MAX_LOCATIONS]


def run(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT raw, canonicals FROM locations")
        mapping = {r["raw"]: r["canonicals"] for r in cur.fetchall()}
        cur.execute("SELECT user_id, preferred_locations FROM profiles")
        profiles = cur.fetchall()
    updated = 0
    for p in profiles:
        new = remap(p["preferred_locations"] or [], mapping)
        if new == (p["preferred_locations"] or []):
            continue
        with conn.cursor() as cur:
            cur.execute("UPDATE profiles SET preferred_locations = %s WHERE user_id = %s",
                        (new, p["user_id"]))
        updated += 1
    conn.commit()
    log.info("prefs remap complete: %s of %s profiles updated", updated, len(profiles))
    return {"profiles": len(profiles), "updated": updated}


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db
    conn = db.connect()
    try:
        run(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_prefs_backfill.py -q`
Expected: PASS. (If the `profiles` INSERT fails on NOT NULL columns beyond the four provided, mirror the INSERT used in `tests/test_reviewer_db.py::test_load_profiles` and add only what it adds.)

- [ ] **Step 5: Commit**

```bash
git add job_discovery/location_backfill.py job_discovery/prefs_backfill.py tests/test_prefs_backfill.py
git commit -m "feat(locations): rollout backfills — locations mapping + prefs remap with Remote append"
```

---

### Task 7: Reviewer pre-filter predicate

**Files:**
- Modify: `reviewer/db.py` (`select_candidates`, lines ~206-231)
- Test: `tests/test_reviewer_db.py` (rewrite `test_candidates_filtered_by_preferred_locations`, extend `_seed_loc`)

**Interfaces:**
- Consumes: `jobs.location_canonicals` (Task 1).
- Produces: the canonical predicate in psycopg named-param form (the reference implementation the dashboard mirrors):

```sql
AND (NOT %(has_prefs)s
     OR COALESCE(j.location_canonicals, ARRAY[j.location]) && %(prefs)s::text[]
     OR ('Remote' = ANY(%(prefs)s::text[]) AND j.remote IS TRUE))
```

- [ ] **Step 1: Update the test to the new contract**

In `tests/test_reviewer_db.py`, extend `_seed_loc` (line 93) with an optional canonicals parameter:

```python
def _seed_loc(conn, ext, location, remote, canonicals=None):
    job_id = _seed_job(conn, ext)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET location = %s, remote = %s, location_canonicals = %s "
            "WHERE id = %s",
            (location, remote, canonicals, job_id),
        )
    conn.commit()
    return job_id
```

Replace `test_candidates_filtered_by_preferred_locations` (line 104) with:

```python
@requires_db
def test_candidates_filtered_by_preferred_locations(conn):
    berlin = _seed_loc(conn, "1", "Berlin, Germany", False,
                       canonicals=["Berlin, Germany"])
    # raw differs from pref; only the stamped canonicals can match it
    berlin_raw = _seed_loc(conn, "2", "Berlin Germany", False,
                           canonicals=["Berlin, Germany"])
    # deliberately unstamped (canonicals NULL): exercises the COALESCE raw fallback
    ny = _seed_loc(conn, "3", "New York, NY", False)
    blank = _seed_loc(conn, "4", None, False)
    # remote flag set, city location, not yet stamped (canonicals NULL)
    remote = _seed_loc(conn, "5", "Anywhere", True)

    # no preference -> every open job is a candidate (NOT has_prefs branch)
    rows, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert {c["id"] for c in rows} == {berlin, berlin_raw, ny, blank, remote}

    # include-list without 'Remote' -> canonicals-overlap only; remote job EXCLUDED
    rows2, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=["Berlin, Germany"])
    assert {c["id"] for c in rows2} == {berlin, berlin_raw}

    # 'Remote' in the include-list -> remote-flagged jobs come back (opt-in)
    rows3, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10,
        preferred_locations=["Berlin, Germany", "Remote"])
    assert {c["id"] for c in rows3} == {berlin, berlin_raw, remote}

    # unstamped job (canonicals NULL) still matches by raw via the COALESCE fallback
    rows4, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=["New York, NY"])
    assert {c["id"] for c in rows4} == {ny}

    # empty list behaves like no preference
    rows5, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=[])
    assert {c["id"] for c in rows5} == {berlin, berlin_raw, ny, blank, remote}
```

- [ ] **Step 2: Run to verify the new expectations fail**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_reviewer_db.py -q -k preferred_locations`
Expected: FAIL — old predicate still includes `remote` in rows2 and doesn't match `berlin_raw`.

- [ ] **Step 3: Change the predicate**

In `reviewer/db.py` `select_candidates`, replace the comment block (lines 206-208) and the location line (line 228):

```python
    # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
    # guard makes the whole OR true). When set: match the job's canonical
    # locations (array overlap; falls back to the raw string for jobs not yet
    # stamped), and remote jobs ONLY when the user opted in by selecting
    # 'Remote' (spec 2026-07-16: remote no longer bypasses the filter).
```

and in `_where`:

```sql
          AND (NOT %(has_prefs)s
               OR COALESCE(j.location_canonicals, ARRAY[j.location]) && %(prefs)s::text[]
               OR ('Remote' = ANY(%(prefs)s::text[]) AND j.remote IS TRUE))
```

- [ ] **Step 4: Run the reviewer suite**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_reviewer_db.py tests/test_reviewer_run.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py tests/test_reviewer_db.py
git commit -m "feat(locations): reviewer pre-filter — canonical overlap, remote opt-in"
```

---

### Task 8: Dashboard board predicate + row shape

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts` (lines 60-66 predicate; line 95-99 selectCols)
- Modify: `dashboard/lib/types.ts` (`JobRowBase`, after `location`)
- Modify: `dashboard/lib/queries.ts` (`toJobRow`, line 29)
- Test: `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: `jobs.location_canonicals`.
- Produces: `JobRowBase.location_canonicals: string[] | null` — every board row carries it; Task 11's client filter reads it.

- [ ] **Step 1: Update the failing tests**

In `dashboard/lib/jobsQuery.test.ts`, replace the test at line 128 (`"owner preferred locations add a remote-or-exact-match clause at $2"`) with:

```ts
  test("owner preferred locations add a canonical-overlap clause with remote opt-in", () => {
    const q = buildJobsQuery(base, UID, ["Austin, TX", "Remote"]);
    expect(q.text).toContain(
      "(COALESCE(j.location_canonicals, ARRAY[j.location]) && $2" +
      " OR ('Remote' = ANY($2) AND j.remote IS TRUE))",
    );
    expect(q.values[1]).toEqual(["Austin, TX", "Remote"]);
  });

  test("board rows select location_canonicals", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).toContain("j.location_canonicals");
  });
```

Keep the adjacent `"empty owner preferred locations add no baseline clause"` test as-is (still valid).

- [ ] **Step 2: Run to verify they fail**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL — clause not present.

- [ ] **Step 3: Implement**

`dashboard/lib/jobsQuery.ts` — replace lines 60-66 with:

```ts
  // The viewer's location include-list (profile.preferred_locations, canonical
  // values). Mirrors the reviewer pre-filter (reviewer/db.py select_candidates)
  // EXACTLY: canonical-array overlap with a raw-string COALESCE fallback for
  // not-yet-stamped jobs, and remote jobs only when the viewer selected
  // "Remote" (opt-in — remote no longer bypasses the filter). Empty list =>
  // no clause. Applies with or without reviews.
  if (viewerLocations.length) {
    const p = ph();
    where.push(
      `(COALESCE(j.location_canonicals, ARRAY[j.location]) && ${p}` +
      ` OR ('Remote' = ANY(${p}) AND j.remote IS TRUE))`,
    );
    values.push(viewerLocations);
  }
```

In `selectCols` (line 95), change the first line to include the new column:

```ts
  const selectCols = [
    "j.id", "j.title", "j.location", "j.location_canonicals", "j.remote",
    "j.first_seen_at", "j.closed_at", "COALESCE(c.display_name, c.name) AS company_name",
    "c.ats",
  ];
```

`dashboard/lib/types.ts` — in `JobRowBase`, after `location: string | null;` add:

```ts
  // Canonical location strings stamped by the poller (locations.canonicals);
  // null = not yet resolved (filters fall back to the raw location string).
  location_canonicals: string[] | null;
```

`dashboard/lib/queries.ts` — in `toJobRow` (line 29), after the `location:` line add (boundary-validated, no bare cast — dashboard/CLAUDE.md):

```ts
    location_canonicals: Array.isArray(row.location_canonicals)
      ? (row.location_canonicals as unknown[]).filter(
          (v): v is string => typeof v === "string")
      : null,
```

- [ ] **Step 4: Typecheck and fix fixture fallout**

Run: `cd dashboard && npx tsc --noEmit`
Expected: errors in test fixtures that build `JobRow`/`ReviewedJobRow` literals. Add `location_canonicals: null,` to each flagged fixture (mechanical; the compiler lists every site). Then:

Run: `cd dashboard && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib && git commit -m "feat(locations): board query — canonical overlap predicate, remote opt-in, row carries canonicals"
```

---

### Task 9: reviewStatsWith + reviewAggWith + real-DB scoping test

**Files:**
- Modify: `dashboard/lib/queries.ts` (`reviewStatsWith`, lines 171-194)
- Modify: `dashboard/lib/metrics.ts` (`reviewAggWith`, lines 111-135)
- Test: rewrite `dashboard/lib/queries.locationScoping.db.test.ts`

**Interfaces:**
- Consumes: `jobs.location_canonicals`.
- Produces: both aggregate pools stay in LOCKSTEP with `buildJobsQuery`'s predicate (Task 8) — same overlap + remote-opt-in semantics, with the profile subquery kept in **array form** (COALESCE to `'{}'::text[]` — the 42883 regression this test file exists for).

- [ ] **Step 1: Rewrite the DB test to the new contract**

Replace the whole body of `dashboard/lib/queries.locationScoping.db.test.ts` with:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { distinctLocationsWith, reviewStatsWith } from "@/lib/queries";
import { reviewAggWith } from "@/lib/metrics";

// Real-Postgres guard for the location-scoping predicate (and heir to the
// b0a2689 42883 regression test): the profile subquery MUST stay in ARRAY form
// — COALESCE((SELECT ...), '{}'::text[]) — never the bare-subquery form of
// ANY/&&, which Postgres rejects at plan time (text = text[] / text[] && text).
//
// Contract under test (spec 2026-07-16-location-dedupe-design.md):
//   COALESCE(j.location_canonicals, ARRAY[j.location]) && prefs
//   OR ('Remote' = ANY(prefs) AND j.remote IS TRUE)
// Remote is OPT-IN: no 'Remote' in prefs -> remote-only jobs drop out.
//
// Gated on TEST_DATABASE_URL (unset -> suite skips). Session-local TEMP tables
// shadow public.*; max: 1 pins the connection they live on.

const TEST_DSN = process.env.TEST_DATABASE_URL;

const U1 = "11111111-1111-1111-1111-111111111111"; // {Phoenix, AZ; Remote} — migrated user
const U2 = "22222222-2222-2222-2222-222222222222"; // no profiles row
const U3 = "33333333-3333-3333-3333-333333333333"; // {Phoenix, AZ} — remote opted out

describe.skipIf(!TEST_DSN)("location-scoping predicate — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    await sql`CREATE TEMP TABLE jobs (
      id TEXT PRIMARY KEY, location TEXT, location_canonicals TEXT[],
      remote BOOLEAN, closed_at TIMESTAMPTZ
    )`;
    await sql`CREATE TEMP TABLE job_reviews (
      user_id UUID, job_id TEXT, stage1_decision TEXT, verdict TEXT,
      human_override BOOLEAN NOT NULL DEFAULT FALSE, error TEXT,
      PRIMARY KEY (user_id, job_id)
    )`;
    await sql`CREATE TEMP TABLE profiles (
      user_id UUID PRIMARY KEY, preferred_locations TEXT[] NOT NULL DEFAULT '{}'
    )`;

    await sql`INSERT INTO profiles (user_id, preferred_locations) VALUES
      (${U1}, ARRAY['Phoenix, AZ','Remote']::text[]),
      (${U3}, ARRAY['Phoenix, AZ']::text[])`;

    // Trailing comment = how the predicate should treat the row for U1 / U3.
    await sql`INSERT INTO jobs (id, location, location_canonicals, remote, closed_at) VALUES
      ('j-remote-sd',   'San Diego, CA',   ARRAY['San Diego, CA'],  true,  NULL),  -- U1 via Remote; U3 out
      ('j-remote-err',  'Remote',          ARRAY['Remote'],         true,  NULL),  -- U1 via Remote (error row); U3 out
      ('j-remote-gate', 'Anywhere',        NULL,                    true,  NULL),  -- unstamped remote: U1 via flag; U3 out
      ('j-office-phx',  'Phoenix, AZ',     ARRAY['Phoenix, AZ'],    false, NULL),  -- U1+U3 via canonicals
      ('j-office-phx2', 'Phoenix Arizona', ARRAY['Phoenix, AZ'],    false, NULL),  -- raw≠pref: only canonicals match
      ('j-unmapped-phx','Phoenix, AZ',     NULL,                    false, NULL),  -- COALESCE raw fallback
      ('j-office-sd',   'San Diego, CA',   ARRAY['San Diego, CA'],  false, NULL),  -- out of location
      ('j-closed-phx',  'Phoenix, AZ',     ARRAY['Phoenix, AZ'],    false, now())  -- closed
    `;

    await sql`INSERT INTO job_reviews (user_id, job_id, stage1_decision, verdict, human_override, error) VALUES
      (${U1}, 'j-remote-sd',   'pass',   'approve', false, NULL),
      (${U1}, 'j-remote-err',  NULL,     NULL,      false, 'boom'),
      (${U1}, 'j-remote-gate', 'reject', NULL,      false, NULL),
      (${U1}, 'j-office-phx2', 'pass',   'deny',    true,  NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  // U1 pool: remote-sd, remote-err, remote-gate (Remote opt-in) + office-phx,
  // office-phx2, unmapped-phx (canonicals / raw fallback) = 6.
  it("reviewStatsWith: canonical overlap + opted-in remote", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U1));
    expect(stats).toEqual({ reviewed: 4, unreviewed: 2, errors: 1 });
  });

  it("reviewAggWith aggregates the same viewer pool (lockstep)", async () => {
    const agg = await sql.begin((tx) => reviewAggWith(tx, U1));
    expect(agg).toEqual({
      reviewed: 4, gate_rejected: 1, approved: 1, denied: 1, manual_rejected: 1,
    });
  });

  // U3 never selected 'Remote': all three remote jobs drop out. Pool =
  // office-phx, office-phx2, unmapped-phx = 3, none reviewed.
  it("remote is opt-in: no 'Remote' pref -> remote jobs excluded", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U3));
    expect(stats).toEqual({ reviewed: 0, unreviewed: 3, errors: 0 });
  });

  // No profiles row -> prefs '{}' -> empty pool (remote no longer auto-included).
  // Also the COALESCE-empty-array 42883 guard path.
  it("no profile row -> empty pool, no plan-time error", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U2));
    expect(stats).toEqual({ reviewed: 0, unreviewed: 0, errors: 0 });
    const agg = await sql.begin((tx) => reviewAggWith(tx, U2));
    expect(agg).toEqual({
      reviewed: 0, gate_rejected: 0, approved: 0, denied: 0, manual_rejected: 0,
    });
  });

  // Facet list: unnest canonicals (raw fallback), Remote computed from the flag.
  // Open jobs -> Phoenix, AZ ×3 (phx, phx2, unmapped-phx), Remote ×3 (flag),
  // San Diego, CA ×2, Anywhere ×1 (unstamped raw). Ties break location ASC.
  it("distinctLocationsWith unnests canonicals and computes the Remote row", async () => {
    const rows = await sql.begin((tx) => distinctLocationsWith(tx));
    expect(rows).toEqual([
      { location: "Phoenix, AZ", count: 3 },
      { location: "Remote", count: 3 },
      { location: "San Diego, CA", count: 2 },
      { location: "Anywhere", count: 1 },
    ]);
  });
});
```

Note: `distinctLocationsWith` is added in Task 10 — until then, comment out that final `it` block and its import, and re-enable both in Task 10, Step 1. (Tasks stay independently green.)

- [ ] **Step 2: Run to verify the new expectations fail**

Run: `cd dashboard && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.locationScoping.db.test.ts`
Expected: FAIL — old predicate includes remote unconditionally and misses `j-office-phx2`.

- [ ] **Step 3: Implement both predicates**

`dashboard/lib/queries.ts` — in `reviewStatsWith`, replace the WHERE (lines 188-190) with:

```ts
    WHERE j.closed_at IS NULL
      AND (
        COALESCE(j.location_canonicals, ARRAY[j.location]) && COALESCE(
          (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
          '{}'::text[])
        OR ('Remote' = ANY(COALESCE(
          (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
          '{}'::text[])) AND j.remote IS TRUE)
      )
```

Update the function's doc comment (lines 174-177) to say: pool = open jobs whose canonical locations (raw fallback) overlap `preferred_locations`, plus remote jobs when `'Remote'` is selected — mirroring `lib/jobsQuery.ts` and `reviewer/db.py` exactly; empty/missing prefs ⇒ empty pool.

`dashboard/lib/metrics.ts` — in `reviewAggWith`, replace the WHERE (lines 129-131) with the identical block. Keep (and reword) the array-form/42883 warning comment — it applies to `&&` exactly as it did to `= ANY`.

- [ ] **Step 4: Run tests**

Run: `cd dashboard && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.locationScoping.db.test.ts && npx vitest run`
Expected: PASS (db suite with the facet block still commented out, full suite green).

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/queries.ts lib/metrics.ts lib/queries.locationScoping.db.test.ts && git commit -m "feat(locations): stats/analytics pools — canonical overlap, remote opt-in"
```

---

### Task 10: Facet queries — picker options + analytics

**Files:**
- Modify: `dashboard/lib/queries.ts` (`getDistinctLocations`, lines 211-225 → executor-taking `distinctLocationsWith` + wrapper)
- Modify: `dashboard/lib/metrics.ts` (`jobsByLocation` arm, lines 292-294)
- Test: re-enable the facet block in `dashboard/lib/queries.locationScoping.db.test.ts` (written in Task 9)

**Interfaces:**
- Consumes: `jobs.location_canonicals`, `jobs.remote`.
- Produces: `distinctLocationsWith(tx: TransactionSql): Promise<{ location: string; count: number }[]>` (exported for the DB test); `getDistinctLocations(userId)` keeps its existing signature — `LocationPicker` and its callers need **no** changes.

- [ ] **Step 1: Re-enable the failing facet test**

Uncomment the `distinctLocationsWith` import and the final `it` block from Task 9 Step 1.

Run: `cd dashboard && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.locationScoping.db.test.ts`
Expected: FAIL — `distinctLocationsWith` is not exported.

- [ ] **Step 2: Implement**

`dashboard/lib/queries.ts` — replace `getDistinctLocations` (lines 211-225) with:

```ts
// Executor-taking impl (mirrors reviewStatsWith) so the real-DB scoping test can
// drive the actual query. Distinct CANONICAL locations from open jobs (raw-string
// fallback for not-yet-stamped rows), most common first — the option set for the
// profile LocationPicker. The 'Remote' row is computed from the remote flag (not
// the unnest) so its count reflects exactly what selecting "Remote" matches;
// canonical 'Remote' elements are excluded from the unnest to avoid a double row.
export async function distinctLocationsWith(
  tx: TransactionSql,
): Promise<{ location: string; count: number }[]> {
  const rows = await tx`
    SELECT location, count FROM (
      SELECT loc AS location, count(*)::int AS count
      FROM jobs j
      CROSS JOIN LATERAL unnest(COALESCE(j.location_canonicals, ARRAY[j.location])) AS loc
      WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
      GROUP BY loc
      UNION ALL
      SELECT 'Remote', count(*)::int FROM jobs
      WHERE closed_at IS NULL AND remote IS TRUE
      HAVING count(*) > 0
    ) t
    ORDER BY count DESC, location ASC
    LIMIT 500
  `;
  return rows as unknown as { location: string; count: number }[];
}

export async function getDistinctLocations(
  userId: string,
): Promise<{ location: string; count: number }[]> {
  return withUserSql(userId, (tx) => distinctLocationsWith(tx));
}
```

`dashboard/lib/metrics.ts` — replace the `jobsByLocation` arm (lines 292-294) with:

```ts
    () => tx`SELECT location AS label, count FROM (
        SELECT loc AS location, count(*)::int AS count
        FROM jobs j
        CROSS JOIN LATERAL unnest(COALESCE(j.location_canonicals, ARRAY[j.location])) AS loc
        WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
        GROUP BY loc
        UNION ALL
        SELECT 'Remote', count(*)::int FROM jobs
        WHERE closed_at IS NULL AND remote IS TRUE
        HAVING count(*) > 0
      ) t ORDER BY count DESC LIMIT ${TOP_N}`,
```

- [ ] **Step 3: Run tests**

Run: `cd dashboard && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add lib/queries.ts lib/metrics.ts lib/queries.locationScoping.db.test.ts && git commit -m "feat(locations): canonical facet lists with computed Remote row"
```

---

### Task 11: Client-side board filter + facet counts

**Files:**
- Modify: `dashboard/lib/rolefit/filter.ts` (`applyFilters` line 39, `facetCounts` lines 62-76)
- Test: `dashboard/lib/rolefit/filter.test.ts`

**Interfaces:**
- Consumes: `JobRow.location_canonicals` (Task 8), `JobRow.remote`.
- Produces: same exported signatures (`applyFilters`, `facetCounts`) with canonical semantics matching the SQL predicate.

- [ ] **Step 1: Write the failing tests**

Open `dashboard/lib/rolefit/filter.test.ts` and locate its existing `JobRow` fixture/factory (the file already builds rows for `applyFilters`). Using that factory (spread-override an existing fixture row rather than writing a full literal), append a describe block:

```ts
describe("canonical location filtering (remote opt-in)", () => {
  // build from an existing fixture row in this file, overriding only these fields
  const phx = { ...baseJob, id: "phx", location: "Phoenix Arizona",
    location_canonicals: ["Phoenix, AZ"], remote: false };
  const multi = { ...baseJob, id: "multi", location: "NYC or Remote",
    location_canonicals: ["New York City, NY", "Remote"], remote: true };
  const remoteFlag = { ...baseJob, id: "rflag", location: "Austin, TX",
    location_canonicals: ["Austin, TX"], remote: true };
  const unstamped = { ...baseJob, id: "raw", location: "Phoenix, AZ",
    location_canonicals: null, remote: false };
  const all = [phx, multi, remoteFlag, unstamped];

  it("matches on canonicals, not the raw string", () => {
    const out = applyFilters(all, { ...DEFAULT_FILTERS, locs: ["Phoenix, AZ"] });
    expect(out.map((j) => j.id).sort()).toEqual(["phx", "raw"]);
  });

  it("multi-location rows match any of their canonicals", () => {
    const out = applyFilters(all, { ...DEFAULT_FILTERS, locs: ["New York City, NY"] });
    expect(out.map((j) => j.id)).toEqual(["multi"]);
  });

  it("Remote facet matches the remote flag, including city-listed remote jobs", () => {
    const out = applyFilters(all, { ...DEFAULT_FILTERS, locs: ["Remote"] });
    expect(out.map((j) => j.id).sort()).toEqual(["multi", "rflag"]);
  });

  it("facetCounts unnests canonicals and computes Remote from the flag", () => {
    const { locations } = facetCounts(all);
    expect(locations).toEqual({
      "Phoenix, AZ": 2,          // phx (canonical) + unstamped (raw fallback)
      "New York City, NY": 1,
      "Austin, TX": 1,
      Remote: 2,                 // multi + rflag via the remote flag
    });
  });
});
```

(Use the factory/fixture name the file actually defines in place of `baseJob`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd dashboard && npx vitest run lib/rolefit/filter.test.ts`
Expected: FAIL — current code matches `st.locs.includes(j.location)` on the raw string.

- [ ] **Step 3: Implement**

In `dashboard/lib/rolefit/filter.ts`, add a helper above `applyFilters`:

```ts
// A job's filterable location values: stamped canonicals, else the raw string —
// mirroring SQL's COALESCE(j.location_canonicals, ARRAY[j.location]).
function locationsOf(j: JobRow): string[] {
  if (j.location_canonicals?.length) return j.location_canonicals;
  return j.location ? [j.location] : [];
}
```

Replace line 39 (`if (st.locs.length && !(j.location && st.locs.includes(j.location))) return false;`) with:

```ts
    if (st.locs.length) {
      const locs = locationsOf(j);
      const hit = st.locs.some((l) => locs.includes(l)) ||
        (st.locs.includes("Remote") && j.remote === true);
      if (!hit) return false;
    }
```

In `facetCounts`, replace the location line (line 72) with:

```ts
    for (const l of locationsOf(j)) {
      if (l !== "Remote") locations[l] = (locations[l] ?? 0) + 1;
    }
    if (j.remote === true) locations["Remote"] = (locations["Remote"] ?? 0) + 1;
```

- [ ] **Step 4: Run tests**

Run: `cd dashboard && npx vitest run lib/rolefit/ && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/rolefit/filter.ts lib/rolefit/filter.test.ts && git commit -m "feat(locations): client board filter — canonicals + opt-in Remote facet"
```

---

### Task 12: Rollout runbook

**Files:**
- Create: `docs/runbooks/2026-07-16-location-canonicalization-rollout.md`

**Interfaces:** none (operator documentation). The ordering below is load-bearing: push-to-main auto-deploys Vercel + Railway, so **both backfills run from the feature branch against prod BEFORE the merge lands** — the predicate cutover must never deploy against unstamped data / un-remapped prefs.

- [ ] **Step 1: Write the runbook**

```markdown
# Location canonicalization — rollout runbook

Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
Order is load-bearing: no user's feed may shrink at cutover, and push-to-main
auto-deploys everything at once — so the migration and both backfills happen
BEFORE the merge to main.

## 1. Apply the migration (Supabase, before anything else)
Apply `migrations/2026-07-16-locations-canonical.sql` via the SQL editor or psql.
Verify: `\d locations` and `\d jobs` (location_canonicals + gin index present).
Purely additive — deployed code is unaffected.

## 2. Run the location backfill (from the feature branch, against prod)
    DATABASE_URL=<session-mode pooler DSN> OPENROUTER_API_KEY=<key> \
      python3 -m job_discovery.location_backfill
Expect: rule pass resolves the bulk; LLM batches handle the tail (cents).
Rerunnable — reruns only touch raws that are still missing.
Verify:
    SELECT source, count(*) FROM locations GROUP BY source;
    SELECT count(*) FROM jobs WHERE location IS NOT NULL AND location <> ''
      AND location_canonicals IS NULL AND closed_at IS NULL;   -- should be ~0
    SELECT unnest(location_canonicals) c, count(*) FROM jobs
      WHERE closed_at IS NULL GROUP BY c ORDER BY 2 DESC LIMIT 25;  -- eyeball sanity
Spot-check ~20 mappings: SELECT raw, canonicals, source FROM locations
  ORDER BY random() LIMIT 20;  -- fix any bad row via UPDATE ... source='manual'

## 3. Run the prefs migration (after 2)
    DATABASE_URL=... python3 -m job_discovery.prefs_backfill
Every profile gets canonical prefs + 'Remote' appended (feed-preserving).
Verify: SELECT user_id, preferred_locations FROM profiles;  -- all contain 'Remote'
Idempotent — safe to rerun.

## 4. Merge + push to main (the cutover deploy)
Vercel (dashboard predicate/facets) and Railway (poller nightly step, reviewer
predicate) deploy together. From this moment matching is canonical + remote
opt-in, against fully stamped data.

## 5. Post-deploy verification
- Board renders for an authed user; location facet shows merged entries
  (one "Remote", one "Austin, TX", ...).
- Profile job-preferences picker options are canonical; saving works.
- Next nightly poll log line: `locations: rule=... llm=... stamped=...`.
- LangFuse: `location-parse` generations appear only for new raw strings.

## Rollback
The predicates COALESCE to raw strings and the column/table are additive, so
reverting the merge commit restores old behavior without touching data. Do NOT
drop the locations table — remapped prefs reference canonical values, and the
old exact-match predicate still matches jobs whose raw equals the canonical.
Note: prefs remapping is not automatically reversible; restore from the
profiles backup Supabase PITR if a full revert is ever needed.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-07-16-location-canonicalization-rollout.md
git commit -m "docs(locations): rollout runbook"
```

---

## Final verification (after all tasks)

- [ ] `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/ -q` — all green
- [ ] `cd dashboard && npx tsc --noEmit && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run` — all green
- [ ] `python3 -m ruff check job_discovery reviewer` (matches the dev deps) — clean
- [ ] Grep guard: `grep -rn "j.location = ANY" dashboard reviewer` returns nothing (all five sites cut over)
