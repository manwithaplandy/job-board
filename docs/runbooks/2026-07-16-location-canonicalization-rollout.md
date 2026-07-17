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
- Next nightly poll log line: `locations: rule=... llm=... unmappable=... stamped=...`.
- LangFuse: `location-parse` generations appear only for new raw strings.

## Rollback
The predicates COALESCE to raw strings and the column/table are additive, so
reverting the merge commit restores old behavior without touching data. Do NOT
drop the locations table — remapped prefs reference canonical values, and the
old exact-match predicate still matches jobs whose raw equals the canonical.
Note: prefs remapping is not automatically reversible; restore from the
profiles backup Supabase PITR if a full revert is ever needed.
