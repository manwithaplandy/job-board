-- R11-1: permit a new explicit approval without changing expired approval history.
-- The worker still consumes only a current operator grant; it never creates one.
ALTER TABLE public_archive_recovery_authorizations
 DROP CONSTRAINT IF EXISTS public_archive_recovery_authorizations_batch_id_key;
-- Retain at most one committed consumption per old batch, in addition to the
-- existing immutable one-old-batch supersession marker and terminal batch fence.
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_archive_recovery_one_consumption
 ON public_archive_recovery_authorizations(batch_id) WHERE consumed_at IS NOT NULL;
