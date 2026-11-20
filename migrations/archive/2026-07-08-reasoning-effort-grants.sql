-- HOTFIX: extend the profiles column-level INSERT/UPDATE allowlist to the two
-- reasoning-effort columns added by 2026-07-08-reasoning-effort.sql.
--
-- profiles writes are COLUMN-LEVEL for `authenticated` (2026-07-04-cost-cap-hardening.sql,
-- finding B-COST): table-level SELECT/DELETE, but INSERT/UPDATE are granted per-column
-- over every column EXCEPT the operator-only cost lever daily_review_cap. New columns
-- default to SELECT-only (table-level SELECT covers them) and are NOT user-writable until
-- explicitly added here — the safe default, but it means upsertProfile's INSERT/UPDATE of
-- reasoning_effort_resume/cover was denied at the privilege layer. Postgres denies the
-- WHOLE statement (42501, "permission denied for table profiles") when a role lacks the
-- privilege on any targeted column, so this broke ALL profile saves, not just the new fields.
--
-- This grants ONLY the two new columns. Deliberately NOT `GRANT INSERT, UPDATE ON profiles`
-- (table-level) — that would re-open the daily_review_cap self-serve cost-cap bypass the
-- hardening migration closed.
--
-- House conventions: BEGIN/COMMIT, idempotent (GRANT is naturally so), recorded in
-- schema_migrations. schema.sql's grant block is updated to match.
BEGIN;

GRANT INSERT (reasoning_effort_resume, reasoning_effort_cover) ON profiles TO authenticated;
GRANT UPDATE (reasoning_effort_resume, reasoning_effort_cover) ON profiles TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-08-reasoning-effort-grants.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
