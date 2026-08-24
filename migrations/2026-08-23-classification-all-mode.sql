-- Whole-corpus re-classification mode for the admin classification queue.
--
-- classification_jobs.selection_mode previously allowed only 'unclassified' and
-- 'unknown_repass', both of which are self-limiting: they select rows whose facts are
-- missing. Moving the ENTIRE corpus onto a different model (e.g. a free one) has no
-- such predicate, so add an 'all' mode. The worker pairs 'all' with the job's
-- started_at bound (company_discovery/jobs_db._BEFORE_BOUND_MODES) so each chunk
-- advances instead of re-selecting the same top-of-order page forever.

BEGIN;

ALTER TABLE classification_jobs
  DROP CONSTRAINT IF EXISTS classification_jobs_selection_mode_check;

ALTER TABLE classification_jobs
  ADD CONSTRAINT classification_jobs_selection_mode_check
  CHECK (selection_mode IN ('unclassified', 'unknown_repass', 'all'));

COMMIT;
