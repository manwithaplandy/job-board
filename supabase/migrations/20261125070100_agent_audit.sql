SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- Agent surfaces and the audit trail (redesign plan Task 1.2, "migration 19"): the
-- generated UI the agent rendered, and every write the agent made for the user, with
-- what it changed so the user can undo it. Two new tables and four functions.
-- Both tables are owner SELECT only. The only writers are the four SECURITY DEFINER
-- functions below, called inside the tool's own user transaction so that a write and
-- its audit row commit together. They are callable with the user's own token (plan
-- Spec gaps S3): each one stamps the caller from public.app_user_id(), never from an
-- argument, and touches only the caller's rows. A forged audit row only offers its
-- author an Undo, which re-checks the live row and writes through the same validated
-- library function as a direct edit.
-- kind, actor and outcome are validated by the table CHECKs.
-- Integer columns and arguments are bigint (the squawk default); postgres.js returns
-- int8 as a string, so readers parse them with z.coerce.number().

CREATE TABLE IF NOT EXISTS public.agent_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.agent_threads (id) ON DELETE CASCADE,
  run_id uuid,
  variant bigint NOT NULL CHECK (variant IN (1, 2, 3)),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  fallback_payload jsonb CHECK (jsonb_typeof(fallback_payload) = 'object'),
  gathered jsonb NOT NULL CHECK (jsonb_typeof(gathered) = 'object'),
  outcome text NOT NULL CHECK (outcome IN ('valid', 'repaired', 'fallback')),
  failure text CHECK (char_length(failure) <= 200),
  supersedes uuid,
  rerender_of uuid,
  model text CHECK (char_length(model) <= 200),
  latency_ms bigint CHECK (latency_ms >= 0),
  output_tokens bigint CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_surfaces_thread_created_idx
  ON public.agent_surfaces (thread_id, created_at);
CREATE INDEX IF NOT EXISTS agent_surfaces_user_created_idx
  ON public.agent_surfaces (user_id, created_at DESC);
ALTER TABLE public.agent_surfaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_surfaces FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_surfaces TO authenticated;
DROP POLICY IF EXISTS agent_surfaces_owner_read ON public.agent_surfaces;
CREATE POLICY agent_surfaces_owner_read ON public.agent_surfaces FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  run_id uuid,
  thread_id uuid,
  actor text NOT NULL CHECK (actor IN ('agent', 'agent_unattended', 'user_via_surface')),
  kind text NOT NULL CHECK (kind IN (
    'shortlist.set', 'application.set_stage', 'application.add_note',
    'analytics.set_tiles', 'document.update_draft', 'profile.set_resume'
  )),
  target_key jsonb NOT NULL,
  before jsonb,
  after jsonb,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_actions_user_created_idx
  ON public.agent_actions (user_id, created_at DESC);
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_actions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.agent_actions_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_actions TO authenticated;
DROP POLICY IF EXISTS agent_actions_owner_read ON public.agent_actions;
CREATE POLICY agent_actions_owner_read ON public.agent_actions FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- Saves a rendered surface for the caller on one of the caller's threads. Payload and
-- fallback are capped at 256 kB and gathered data at 1 MiB (54000 when over).
CREATE OR REPLACE FUNCTION public.agent_save_surface(
  p_thread_id uuid, p_run_id uuid, p_variant bigint, p_payload jsonb, p_fallback jsonb,
  p_gathered jsonb, p_outcome text, p_supersedes uuid, p_rerender_of uuid, p_model text,
  p_latency_ms bigint, p_output_tokens bigint
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := public.app_user_id();
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletions WHERE user_id = caller) THEN
    RAISE EXCEPTION 'account deleted' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(octet_length(p_payload::text), 0) > 262144
     OR COALESCE(octet_length(p_fallback::text), 0) > 262144
     OR COALESCE(octet_length(p_gathered::text), 0) > 1048576 THEN
    RAISE EXCEPTION 'surface too large' USING ERRCODE = '54000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agent_threads WHERE id = p_thread_id AND user_id = caller) THEN
    RAISE EXCEPTION 'thread not found' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.agent_surfaces (
    user_id, thread_id, run_id, variant, payload, fallback_payload, gathered, outcome,
    supersedes, rerender_of, model, latency_ms, output_tokens
  ) VALUES (
    caller, p_thread_id, p_run_id, p_variant, p_payload, p_fallback, p_gathered, p_outcome,
    p_supersedes, p_rerender_of, p_model, p_latency_ms, p_output_tokens
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_save_surface(uuid, uuid, bigint, jsonb, jsonb, jsonb, text, uuid, uuid, text, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_save_surface(uuid, uuid, bigint, jsonb, jsonb, jsonb, text, uuid, uuid, text, bigint, bigint)
  TO authenticated;

-- Records how a surface ended (for example fallback after the client failed to render
-- it). Another user's surface id changes nothing.
CREATE OR REPLACE FUNCTION public.agent_set_surface_outcome(p_id uuid, p_outcome text, p_failure text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := public.app_user_id();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.agent_surfaces SET outcome = p_outcome, failure = p_failure
  WHERE id = p_id AND user_id = caller;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_set_surface_outcome(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_surface_outcome(uuid, text, text) TO authenticated;

-- Appends one audit row for the caller and returns its id. A given thread must be the
-- caller's. target_key, before and after are capped at 256 kB each (54000 when over).
CREATE OR REPLACE FUNCTION public.agent_log_action(
  p_run_id uuid, p_thread_id uuid, p_actor text, p_kind text, p_target_key jsonb,
  p_before jsonb, p_after jsonb
) RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := public.app_user_id();
  new_id bigint;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletions WHERE user_id = caller) THEN
    RAISE EXCEPTION 'account deleted' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(octet_length(p_target_key::text), 0) > 262144
     OR COALESCE(octet_length(p_before::text), 0) > 262144
     OR COALESCE(octet_length(p_after::text), 0) > 262144 THEN
    RAISE EXCEPTION 'action too large' USING ERRCODE = '54000';
  END IF;
  IF p_thread_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.agent_threads WHERE id = p_thread_id AND user_id = caller) THEN
    RAISE EXCEPTION 'thread not found' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.agent_actions (user_id, run_id, thread_id, actor, kind, target_key, before, after)
  VALUES (caller, p_run_id, p_thread_id, p_actor, p_kind, p_target_key, p_before, p_after)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_log_action(uuid, uuid, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_log_action(uuid, uuid, text, text, jsonb, jsonb, jsonb) TO authenticated;

-- Marks one of the caller's actions undone. False when it was already undone, or is
-- not the caller's.
CREATE OR REPLACE FUNCTION public.agent_mark_action_undone(p_id bigint)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := public.app_user_id();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.agent_actions SET undone_at = now()
  WHERE id = p_id AND user_id = caller AND undone_at IS NULL;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_mark_action_undone(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_mark_action_undone(bigint) TO authenticated;
