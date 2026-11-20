-- Make the grant contract self-healing for FUTURE tables (go-public SaaS, review
-- finding minor 6). migrations/2026-07-04-cost-cap-hardening.sql REVOKEs Supabase's
-- default anon/authenticated privileges on EXISTING tables and re-grants a positive
-- allowlist. But that blanket REVOKE is a one-time snapshot: Supabase configures
-- `ALTER DEFAULT PRIVILEGES ... GRANT` so that EVERY newly-created table re-acquires full
-- anon/authenticated privileges. So the next migration that adds a service-write / deny-all
-- table (another billing mirror, ledger, queue, snapshot table, …) would silently ship it
-- WRITABLE-BY-authenticated until someone remembers to REVOKE — RLS would be the only gate
-- again, which is exactly the single-point-of-failure B-COST closed.
--
-- Fix the DEFAULT itself so new tables are deny-by-default. After this, a freshly created
-- public table starts with NO anon/authenticated privilege, and the migration that creates
-- it must EXPLICITLY GRANT the intended subset (the safe direction — forgetting to grant
-- yields "no access", not "full access").
--
-- SCOPE: ALTER DEFAULT PRIVILEGES with no FOR ROLE applies to objects created by the
-- CURRENT role. Our migrations + schema.sql create tables as the owner/service role
-- (postgres), so this covers every table we ship. The owner itself is unaffected by
-- grants + RLS (it owns the objects), so the reviewer, pollers, discovery, the Stripe
-- webhook, invites, and account deletion keep working. Sequences get the same treatment
-- so a future SERIAL/BIGSERIAL PK doesn't hand its sequence to anon/authenticated either.
--
-- House conventions: BEGIN/COMMIT, idempotent (ALTER DEFAULT PRIVILEGES is declarative),
-- recorded in schema_migrations. schema.sql mirrors this in its grant block.
--
-- >>> LIVE / MANUAL STEP (cannot be done from here) <<<
--  * Apply to the live Supabase project (remote DBs are never touched from CI/local).
--  * Verify after apply:
--      CREATE TABLE public._defpriv_probe (id int);
--      SELECT privilege_type FROM information_schema.role_table_grants
--        WHERE table_name = '_defpriv_probe' AND grantee IN ('anon','authenticated');
--      -- must return ZERO rows, then:  DROP TABLE public._defpriv_probe;

BEGIN;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-05-default-privileges-revoke.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
