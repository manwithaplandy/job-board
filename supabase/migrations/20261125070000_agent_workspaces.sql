SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- Workspace tables (redesign plan Task 1.1, "migration 18"): the shortlist, the
-- application tracker and its events, uploaded documents, the versioned search memo
-- with its proposals, the versioned analytics tile layout, and displaced résumé
-- versions. Ten new tables, owner-scoped RLS, explicit grants, no functions.
-- Integer columns are bigint (the squawk default); postgres.js returns int8 as a
-- string, so readers parse them with z.coerce.number().
-- shortlist_items, applications and application_events reach jobs by foreign key,
-- so they join the lifecycle gate (lifecycle_pre_dml) like every other job child.
-- The last statement backfills one applied application, with its stage event, per
-- applied application package.

CREATE TABLE IF NOT EXISTS public.shortlist_items (
  user_id uuid NOT NULL,
  job_id text NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('suggested', 'shortlisted', 'later', 'skipped')),
  reason_code text CHECK (reason_code IN (
    'pay', 'location', 'seniority', 'schedule', 'company', 'stack', 'stale', 'other',
    'red_flag', 'deal_breaker', 'missing_pay', 'posting_age'
  )),
  reason_text text CHECK (char_length(reason_text) <= 500),
  brief_why text CHECK (char_length(brief_why) <= 300),
  brief_risk text CHECK (char_length(brief_risk) <= 300),
  set_by text NOT NULL CHECK (set_by IN ('user', 'agent', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id),
  CONSTRAINT shortlist_items_skip_has_reason CHECK (state <> 'skipped' OR reason_code IS NOT NULL)
);
-- job_id-leading index for cascade deletes from jobs.
CREATE INDEX IF NOT EXISTS shortlist_items_job_idx ON public.shortlist_items (job_id);
CREATE INDEX IF NOT EXISTS shortlist_items_user_state_idx ON public.shortlist_items (user_id, state);
ALTER TABLE public.shortlist_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shortlist_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlist_items TO authenticated;
DROP POLICY IF EXISTS shortlist_items_owner ON public.shortlist_items;
CREATE POLICY shortlist_items_owner ON public.shortlist_items FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('preparing', 'ready', 'applied', 'interviewing', 'offer', 'closed')),
  closed_reason text CHECK (closed_reason IN ('rejected', 'withdrawn', 'no_response')),
  next_step_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_user_job_key UNIQUE (user_id, job_id),
  CONSTRAINT applications_closed_has_reason CHECK ((stage = 'closed') = (closed_reason IS NOT NULL))
);
-- job_id-leading index for cascade deletes from jobs.
CREATE INDEX IF NOT EXISTS applications_job_idx ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS applications_user_stage_idx ON public.applications (user_id, stage);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
DROP POLICY IF EXISTS applications_owner ON public.applications;
CREATE POLICY applications_owner ON public.applications FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.application_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES public.applications (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('stage', 'note')),
  from_stage text CHECK (from_stage IN ('preparing', 'ready', 'applied', 'interviewing', 'offer', 'closed')),
  to_stage text CHECK (to_stage IN ('preparing', 'ready', 'applied', 'interviewing', 'offer', 'closed')),
  note text CHECK (char_length(note) <= 2000),
  actor text NOT NULL CHECK (actor IN ('user', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A stage event names the stage it moved to; a note event carries the note.
  CONSTRAINT application_events_shape CHECK (
    (kind = 'stage' AND to_stage IS NOT NULL) OR (kind = 'note' AND note IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS application_events_application_idx
  ON public.application_events (application_id, created_at);
CREATE INDEX IF NOT EXISTS application_events_user_created_idx
  ON public.application_events (user_id, created_at DESC);
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.application_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.application_events TO authenticated;
DROP POLICY IF EXISTS application_events_owner ON public.application_events;
-- The event's application must be the caller's own: a foreign key check alone would
-- accept another user's application id.
CREATE POLICY application_events_owner ON public.application_events FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (
    user_id = (SELECT public.app_user_id())
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_events.application_id AND a.user_id = (SELECT public.app_user_id())
    )
  );

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('resume', 'photo', 'other')),
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  mime text NOT NULL CHECK (char_length(mime) BETWEEN 1 AND 100),
  bytes bigint NOT NULL CHECK (bytes >= 0),
  storage_path text NOT NULL,
  extracted_text text CHECK (char_length(extracted_text) <= 60000),
  extraction text NOT NULL CHECK (extraction IN ('ok', 'empty', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_storage_path_key UNIQUE (storage_path),
  -- The object path is the caller's own doc-<id>-<name>, a direct child of their
  -- folder (documentObjectPath, Task 1.10). A row can never point at another user's
  -- object or another document's, so deleting the row's object is always safe.
  CONSTRAINT documents_storage_path_owned CHECK (
    storage_path LIKE user_id::text || '/doc-' || id::text || '-%'
    AND strpos(substr(storage_path, 38), '/') = 0
  )
);
CREATE INDEX IF NOT EXISTS documents_user_created_idx ON public.documents (user_id, created_at DESC);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;
DROP POLICY IF EXISTS documents_owner ON public.documents;
CREATE POLICY documents_owner ON public.documents FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.search_memos (
  user_id uuid PRIMARY KEY,
  version bigint NOT NULL CHECK (version >= 0),
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_memos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_memos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_memos TO authenticated;
DROP POLICY IF EXISTS search_memos_owner ON public.search_memos;
CREATE POLICY search_memos_owner ON public.search_memos FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.search_memo_versions (
  user_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version >= 0),
  doc jsonb NOT NULL,
  changed_by text NOT NULL CHECK (changed_by IN ('user', 'proposal', 'restore')),
  proposal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);
ALTER TABLE public.search_memo_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_memo_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.search_memo_versions TO authenticated;
DROP POLICY IF EXISTS search_memo_versions_owner ON public.search_memo_versions;
CREATE POLICY search_memo_versions_owner ON public.search_memo_versions FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.search_memo_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  base_version bigint NOT NULL CHECK (base_version >= 0),
  proposed_doc jsonb NOT NULL,
  rationale text CHECK (char_length(rationale) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'superseded')),
  source text NOT NULL CHECK (source IN ('interactive', 'background')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS search_memo_proposals_user_created_idx
  ON public.search_memo_proposals (user_id, created_at DESC);
ALTER TABLE public.search_memo_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_memo_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.search_memo_proposals TO authenticated;
-- A proposal's content is fixed once written; only its resolution can change.
GRANT UPDATE (status, resolved_at) ON public.search_memo_proposals TO authenticated;
DROP POLICY IF EXISTS search_memo_proposals_owner ON public.search_memo_proposals;
CREATE POLICY search_memo_proposals_owner ON public.search_memo_proposals FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.analytics_tiles (
  user_id uuid PRIMARY KEY,
  version bigint NOT NULL CHECK (version >= 0),
  layout jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_tiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_tiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_tiles TO authenticated;
DROP POLICY IF EXISTS analytics_tiles_owner ON public.analytics_tiles;
CREATE POLICY analytics_tiles_owner ON public.analytics_tiles FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE TABLE IF NOT EXISTS public.analytics_tile_versions (
  user_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version >= 0),
  layout jsonb NOT NULL,
  changed_by text NOT NULL CHECK (changed_by IN ('user', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);
ALTER TABLE public.analytics_tile_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_tile_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.analytics_tile_versions TO authenticated;
DROP POLICY IF EXISTS analytics_tile_versions_owner ON public.analytics_tile_versions;
CREATE POLICY analytics_tile_versions_owner ON public.analytics_tile_versions FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- The résumé text a replacement displaced, so set_resume can be undone and an older
-- résumé restored (spec 6.7). document_id is a plain reference, no foreign key.
CREATE TABLE IF NOT EXISTS public.resume_versions (
  user_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version >= 0),
  resume_text text NOT NULL,
  source text NOT NULL CHECK (source IN ('upload', 'agent', 'restore')),
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resume_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.resume_versions TO authenticated;
DROP POLICY IF EXISTS resume_versions_owner ON public.resume_versions;
CREATE POLICY resume_versions_owner ON public.resume_versions FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- Lifecycle gate: the same statement trigger every other job child carries
-- (schema.sql's lifecycle_pre_dml loop), so writers take the global lifecycle lock
-- before row or foreign key locks. Writes to these three go through withUserMutation.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shortlist_items','applications','application_events'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_pre_dml ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;

-- Backfill: one applications row at stage applied, plus its stage event, for every
-- applied application package. Only applications this statement inserts get an
-- event, so a second run adds nothing.
WITH inserted AS (
  INSERT INTO public.applications (user_id, job_id, stage, created_at, updated_at)
  SELECT p.user_id, p.job_id, 'applied', p.applied_at, p.applied_at
  FROM public.application_packages p
  WHERE p.status = 'applied'
  ON CONFLICT (user_id, job_id) DO NOTHING
  RETURNING id, user_id, created_at
)
INSERT INTO public.application_events (user_id, application_id, kind, to_stage, actor, created_at)
SELECT i.user_id, i.id, 'stage', 'applied', 'user', i.created_at
FROM inserted i;
