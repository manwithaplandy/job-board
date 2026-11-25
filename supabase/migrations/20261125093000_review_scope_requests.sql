SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- Scoped re-review queue (redesign plan Task 1.9, "migration 20"; decision D3): when
-- the user's search memo changes, the dashboard enqueues one request naming the jobs
-- to re-review, and the reviewer worker claims it, reviews only those jobs and
-- records how it ended. A new additive table, so one_active_review_request and
-- resume_matching() stay untouched.
-- The owner may read their requests and enqueue a fresh one: the INSERT policy admits
-- only a pending, unclaimed, unfinished row for the caller. There is no UPDATE or
-- DELETE grant; the reviewer (service role) makes every status transition, fenced by
-- claim_version. One active (pending or running) request per user.
-- user_id has no foreign key (house convention: auth.users is Supabase-managed).
-- Integer columns are bigint (the squawk default); postgres.js returns int8 as a
-- string, so readers parse them with z.coerce.number().

CREATE TABLE IF NOT EXISTS public.review_scope_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  job_ids text[] NOT NULL CHECK (cardinality(job_ids) BETWEEN 1 AND 200),
  reason text CHECK (reason IN ('memo_change')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  notes text CHECK (char_length(notes) <= 2000),
  claim_version bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_review_scope_request
  ON public.review_scope_requests (user_id) WHERE status IN ('pending', 'running');
-- The worker's claim scans pending rows oldest first, like idx_review_requests_pending.
CREATE INDEX IF NOT EXISTS review_scope_requests_pending_idx
  ON public.review_scope_requests (requested_at) WHERE status = 'pending';
ALTER TABLE public.review_scope_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_scope_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.review_scope_requests_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.review_scope_requests TO authenticated;
DROP POLICY IF EXISTS review_scope_requests_owner_read ON public.review_scope_requests;
CREATE POLICY review_scope_requests_owner_read ON public.review_scope_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
DROP POLICY IF EXISTS review_scope_requests_owner_insert ON public.review_scope_requests;
-- A user enqueues only a fresh request of their own: never a claimed, running or
-- finished row, which would skip or fake the reviewer's work.
CREATE POLICY review_scope_requests_owner_insert ON public.review_scope_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.app_user_id())
    AND status = 'pending'
    AND claim_version = 0
    AND started_at IS NULL
    AND finished_at IS NULL
    AND notes IS NULL
  );
