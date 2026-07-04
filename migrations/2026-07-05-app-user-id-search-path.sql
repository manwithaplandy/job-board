-- Pin public.app_user_id()'s search_path (Supabase advisor: function_search_path_mutable).
--
-- app_user_id() is the SECURITY-critical resolver every RLS policy calls to read the
-- JWT `sub` — a function with a MUTABLE search_path is a hardening gap (a caller could,
-- in principle, shadow a referenced object via a schema earlier on the path). The
-- function only touches pg_catalog built-ins (current_setting, the json ->> operator,
-- the ::json / ::uuid casts), so pinning search_path to pg_catalog leaves behaviour
-- identical — verified: the function still resolves the JWT sub to the right uuid.
--
-- Idempotent (ALTER FUNCTION ... SET is declarative; guarded on the function existing so
-- a partial/out-of-order state is a clean no-op), recorded in schema_migrations. Mirrored
-- into the app_user_id() definition in schema.sql so schema.sql stays canonical.
--
-- >>> LIVE / MANUAL STEP <<< apply to the live Supabase project; re-check get_advisors —
-- the function_search_path_mutable warning for public.app_user_id should clear.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.app_user_id()') IS NOT NULL THEN
    ALTER FUNCTION public.app_user_id() SET search_path = pg_catalog;
  END IF;
END
$$;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-05-app-user-id-search-path.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
