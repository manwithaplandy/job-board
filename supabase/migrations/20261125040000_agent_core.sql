SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- Agent core tables (redesign plan Task 0.5, "migration 17"): conversations, their
-- messages, model runs and per-user agent settings. Four new, empty tables.
-- No functions: agent_messages and agent_runs have no write grant for authenticated,
-- so the only writer is the service role in dashboard/lib/agent/runs.ts.
-- agent_runs.error holds a short error code only, never provider or stack text,
-- because it is part of the account export.

-- Reviewed exception: variant is 1, 2 or 3 (CHECK), and int2 arrives in the
-- dashboard as a JS number, where int8 would arrive as a string.
-- squawk-ignore prefer-bigint-over-smallint
CREATE TABLE IF NOT EXISTS public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation' CHECK (char_length(title) BETWEEN 1 AND 120),
  variant smallint NOT NULL DEFAULT 1 CHECK (variant IN (1, 2, 3)),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_threads_user_updated_idx
  ON public.agent_threads (user_id, updated_at DESC);
ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_threads TO authenticated;
DROP POLICY IF EXISTS agent_threads_owner ON public.agent_threads;
CREATE POLICY agent_threads_owner ON public.agent_threads FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.agent_messages (
  thread_id uuid NOT NULL REFERENCES public.agent_threads (id) ON DELETE CASCADE,
  id text NOT NULL,
  user_id uuid NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  parts jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('complete', 'pending', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, id)
);
CREATE INDEX IF NOT EXISTS agent_messages_thread_seq_idx
  ON public.agent_messages (thread_id, seq);
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.agent_messages_seq_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_messages TO authenticated;
DROP POLICY IF EXISTS agent_messages_owner_read ON public.agent_messages;
CREATE POLICY agent_messages_owner_read ON public.agent_messages FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- Reviewed exception: variant is 1 to 3, and the per-run counters stay far below
-- 2^31 (cost_micros at the int4 limit is over $2,000 for one run, which the spend
-- ceiling stops long before). int2/int4 arrive in the dashboard as JS numbers.
-- squawk-ignore prefer-bigint-over-int, prefer-bigint-over-smallint
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.agent_threads (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('interactive', 'background', 'rerender', 'eval', 'vision', 'transcription')),
  job text,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed', 'aborted', 'over_budget')),
  model text,
  variant smallint CHECK (variant IN (1, 2, 3)),
  steps int NOT NULL DEFAULT 0 CHECK (steps >= 0),
  input_tokens int NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens int NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_micros int NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  error text CHECK (error IS NULL OR char_length(error) <= 64),
  scheduled_for timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A live interactive turn needs its thread. A finished one keeps its cost record
  -- when the user deletes the thread (ON DELETE SET NULL above).
  CONSTRAINT agent_runs_interactive_has_thread CHECK (
    thread_id IS NOT NULL OR kind <> 'interactive' OR status IN ('done', 'failed', 'aborted', 'over_budget')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_one_live_turn
  ON public.agent_runs (thread_id) WHERE status = 'running' AND kind = 'interactive';
CREATE INDEX IF NOT EXISTS agent_runs_user_created_idx
  ON public.agent_runs (user_id, created_at DESC);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_runs TO authenticated;
DROP POLICY IF EXISTS agent_runs_owner_read ON public.agent_runs;
CREATE POLICY agent_runs_owner_read ON public.agent_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- Reviewed exception: same as agent_threads.variant.
-- squawk-ignore prefer-bigint-over-smallint
CREATE TABLE IF NOT EXISTS public.agent_settings (
  user_id uuid PRIMARY KEY,
  default_variant smallint NOT NULL DEFAULT 1 CHECK (default_variant IN (1, 2, 3)),
  background_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_settings TO authenticated;
DROP POLICY IF EXISTS agent_settings_owner ON public.agent_settings;
CREATE POLICY agent_settings_owner ON public.agent_settings FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
