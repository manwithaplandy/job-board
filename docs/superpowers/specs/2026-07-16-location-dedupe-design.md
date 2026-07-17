# Location Dedupe & Canonicalization — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorming session)

## Problem

`jobs.location` is free text stored verbatim from six ATS adapters (or ad-hoc
`"City, State, Country"` composites built by three of them). There is no
normalization beyond a `remote` regex, so the same place fragments into many
values: "Remote - USA" / "Remote - United States" / "Remote", "Austin Texas" /
"Austin TX" / "Austin". This breaks the system in three places:

1. **Exact-match filters silently fail.** The reviewer pre-filter
   (`reviewer/db.py:228`) and the board profile scoping
   (`dashboard/lib/jobsQuery.ts:60-66`, mirrored in `queries.ts:189` and
   `metrics.ts:130`) use `j.location = ANY(prefs)`. A user who saved
   "Austin, TX" never matches a job stored as "Austin Texas".
2. **The facet/picker list is fragmented.** `getDistinctLocations`
   (`dashboard/lib/queries.ts:211-225`) groups by the raw string, so every
   variant is its own row in the LocationPicker and analytics.
3. **Saved prefs are frozen raw strings** from whatever variant existed at
   onboarding (`dashboard/lib/preferredLocations.ts` trims and exact-dedupes
   only).

## Decisions (made during brainstorming)

- **Canonical-string dedupe, remote collapsed.** Every raw location maps to
  one or more canonical display strings. All remote variants ("Remote",
  "Remote - USA", "Remote — Worldwide") collapse to a single **"Remote"**
  bucket. No structured city/region/country columns on `jobs` (non-goal).
- **Remote becomes opt-in.** Remote jobs no longer bypass the location
  filter. "Remote" is a selectable facet entry like any city; users who don't
  select it don't get remote-only jobs. (Some users want to filter remote
  out.)
- **Existing profiles are grandfathered by migration**, not by dual
  semantics: a one-time migration appends "Remote" to every existing
  profile's `preferred_locations` so no feed silently shrinks at cutover.
- **Gazetteer-anchored canonicalization.** The place vocabulary comes from an
  existing library — **geonamescache** (MIT, offline GeoNames snapshot:
  countries + ISO codes/aliases, US states, cities with alternate names and
  admin1/country codes). We never hand-maintain a place list. The LLM only
  *parses* messy strings; its output must resolve against the gazetteer or it
  is rejected. Rejected alternatives: litecoder (US-only), libpostal (~2GB
  model, too heavy for the Railway cron), deterministic-rules-only (long tail
  never converges), external geocoding APIs (rate limits/ToS for bulk).
- **Multi-location strings map to multiple canonicals.** "NYC or Remote" →
  `{"New York, NY", "Remote"}` and matches both a New-York filter and a
  Remote filter. Raw→canonical is one-to-many; `jobs` gets an array column.

## Data model

New table, **owned by the poller** (dashboard never reads it):

```sql
CREATE TABLE locations (
  raw         TEXT PRIMARY KEY,   -- exact string as seen on jobs.location
  canonicals  TEXT[] NOT NULL,    -- '{"New York, NY","Remote"}'; '{raw}' if unmappable
  components  JSONB NOT NULL,     -- [{canonical, kind, geonameid, country_code, admin1_code}]
                                  -- kind ∈ city|state|country|remote|unmappable
  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `components` retains the gazetteer anchors (geonameid, ISO country,
  admin1) so future containment matching ("Texas" ⊇ Austin) needs no
  re-mapping work. Nothing consumes it yet.
- `source='manual'` supports hand corrections: update one row's `canonicals`;
  the nightly re-stamp propagates it to all affected jobs.
- RLS: enable with no policies and grant nothing to the dashboard roles —
  service/poller access only. No dashboard grants change (the new `jobs`
  column is covered by the existing table-level SELECT).

New column on `jobs`:

```sql
ALTER TABLE jobs ADD COLUMN location_canonicals TEXT[];
CREATE INDEX ... ON jobs USING GIN (location_canonicals);
```

Canonical string formats (generated from gazetteer entries, never free-typed):
US cities `"Austin, TX"`; non-US cities `"London, United Kingdom"`; US states
`"Texas"`; countries `"United States"`; remote `"Remote"`; unmappable = the
raw string itself.

## Resolution pipeline

New module `job_discovery/locations.py`, run as a poll step after job
upserts (and callable from the backfill script):

1. **Collect** distinct `jobs.location` values with no `locations` row.
2. **Rule pass** (no LLM): per raw string, split on delimiters
   (`" or "`, `/`, `;`, `&`) into components; per component: remote-pattern
   regex → `Remote`; else parse comma/dash-separated parts against
   geonamescache — country aliases (USA/United States/US), US state
   names↔abbreviations, city lookup including alternate names with
   state/country disambiguation. City population floor starts at **15000**
   (drop toward 500 only if the backfill shows real misses; smaller floor =
   bigger ambiguity surface).
3. **LLM pass** for unresolved strings, batched (~50/call, temperature 0,
   the same cheap OpenRouter model/client pattern the reviewer and
   company_discovery use). Output per string: a **list** of
   `{city, state, country}` objects and/or `{remote: true}`. Each element is
   validated by resolving it against the gazetteer; elements that don't
   resolve are dropped, and a string with zero surviving elements is stored
   as `kind='unmappable'`, `canonicals='{raw}'`. The LLM never mints a
   canonical string.
4. **Set-based stamp** (runs every night, which is what makes manual
   corrections self-propagate):

   ```sql
   UPDATE jobs SET location_canonicals = l.canonicals
   FROM locations l
   WHERE jobs.location = l.raw
     AND jobs.location_canonicals IS DISTINCT FROM l.canonicals;
   ```

**Error handling:** an LLM/API failure leaves strings unmapped — they are
retried the next night, and unmapped jobs degrade to raw-string behavior via
the COALESCE below. Resolution never blocks or fails the poll. Unmappable
strings appear as themselves in facets rather than vanishing.

## Matching contract

One predicate replaces `j.remote IS TRUE OR j.location = ANY(prefs)` at all
five sites — reviewer pre-filter (`reviewer/db.py:206-231`), board scoping
(`dashboard/lib/jobsQuery.ts:60-66`), review stats
(`dashboard/lib/queries.ts:189-190`), analytics scoping
(`dashboard/lib/metrics.ts:130-131`), client facet filter
(`dashboard/lib/rolefit/filter.ts:39`, plus whatever `toJobRow` must carry):

```sql
COALESCE(j.location_canonicals, ARRAY[j.location]) && prefs
OR ('Remote' = ANY(prefs) AND j.remote IS TRUE)
```

- Array overlap (`&&`) replaces equality; GIN index serves it.
- The second clause exists because `remote = TRUE` can come from explicit ATS
  flags (Lever `workplaceType`, Ashby `isRemote`, Workable `telecommuting`)
  on jobs whose location string is a plain city — selecting "Remote" must
  still surface those. Remote-only jobs are excluded for users without
  "Remote" in prefs.
- COALESCE keeps not-yet-mapped jobs matchable by raw string (today's
  behavior) instead of dropping them.
- The client-side filter implements the same logic in TS over
  `location_canonicals` + `remote` fields on the job row.

**Facets** (`getDistinctLocations`, analytics `jobsByLocation`): group by
`unnest(COALESCE(location_canonicals, ARRAY[location]))`, excluding
`'Remote'` elements, then union a computed **Remote** row whose count is
`COUNT(*) WHERE remote IS TRUE` — so its count reflects exactly what the
Remote filter matches. Keep the existing LIMIT/ordering.

**Unchanged:** the board free-text box stays `ILIKE` on the raw `location`
column; LocationPicker mechanics (it just sees cleaner options); `remote`
bool derivation (`detect_remote`); reviewer LLM prompts (still shown the raw
location — passing canonical is out of scope).

## Rollout order (no feed may silently shrink)

1. **Migration**: create `locations`; add `jobs.location_canonicals` + GIN
   index. Apply to Supabase before any dependent deploy (repo convention).
2. **Deploy poller** with the resolution step.
3. **Backfill script** (idempotent, modeled on
   `company_discovery/name_backfill.py`): resolve all existing distinct
   locations (rule pass, then batched LLM), stamp all jobs. Expected scale:
   hundreds to low thousands of distinct strings over the ~114k corpus —
   one-time LLM cost in cents.
4. **Prefs migration script**: for every profile, remap each
   `preferred_locations` entry through `locations` (an entry mapping to
   multiple canonicals expands to all of them; unmapped entries kept as-is),
   dedupe, **append "Remote"**, write back. `MAX_LOCATIONS` cap unchanged.
5. **Deploy dashboard + reviewer cutover** (new predicate + facets) — only
   after 3 and 4, so matching strictly improves at the moment remote-bypass
   is removed.

## Testing

- **Rule-parser unit tests** (Python): the motivating fixtures — "Remote -
  USA" / "Remote - United States" / "Remote" all → `{Remote}`; "Austin
  Texas" / "Austin TX" / "Austin" all → `{"Austin, TX"}`; multi-location
  "NYC or Remote" → both; composite adapter strings ("Austin, Texas, United
  States"); non-US city; state-only; country-only; junk → unmappable.
- **Gazetteer-validation test**: a hallucinated LLM city fails resolution and
  the string lands `unmappable` with `canonicals='{raw}'`.
- **Predicate DB tests** mirroring
  `dashboard/lib/queries.locationScoping.db.test.ts`: remote opt-in both ways
  (with/without "Remote" in prefs, remote via flag vs via string), array
  overlap on multi-location jobs, COALESCE fallback for unmapped jobs.
- **Reviewer pre-filter test** (Python) updated for the same predicate.
- **Prefs migration test**: remap + expand + dedupe + Remote append is
  idempotent.

## Non-goals

- Containment matching (state ⊇ city) — enabled later by `components`, not
  built now.
- Extracting additional locations from ATS payload fields beyond the single
  location string (e.g., Lever `allLocations`, Workable `locations[1..]`).
- Structured location columns on `jobs`.
- Changing reviewer prompt inputs to canonical locations.
