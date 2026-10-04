-- Authenticated feedback: owner export reads; all writes go through the bounded RPC.
-- Requires tenant-isolation identity helper and account-deletions migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('issue', 'criticism', 'feature_request')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.feedback_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;
DROP POLICY IF EXISTS feedback_owner_read ON public.feedback;
CREATE POLICY feedback_owner_read ON public.feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_message text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE caller uuid := public.app_user_id();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  -- A fresh post-lock snapshot prevents stale-snapshot rate bypasses.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'read committed required' USING ERRCODE = '25000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('issue','criticism','feature_request')
     OR p_message IS NULL OR char_length(p_message) > 4000
     OR p_message !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('feedback:' || caller::text, 0));
  IF EXISTS (SELECT 1 FROM public.account_deletions WHERE user_id = caller) THEN
    RAISE EXCEPTION 'account deleted' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.feedback WHERE user_id = caller
      AND created_at > clock_timestamp() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'feedback rate limit' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.feedback(user_id, kind, message) VALUES (caller, p_kind, btrim(p_message));
END;
$$;
REVOKE ALL ON FUNCTION public.submit_feedback(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text) TO authenticated;
INSERT INTO schema_migrations (filename) VALUES ('2026-10-02-feedback.sql') ON CONFLICT DO NOTHING;
COMMIT;
