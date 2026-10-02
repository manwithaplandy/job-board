BEGIN;
-- Existing users receive a seven-day rollout grace period. No historical GET,
-- last login, profile updated_at or background job is treated as meaningful activity.
CREATE TABLE IF NOT EXISTS matching_activity (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  last_meaningful_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz
);
ALTER TABLE matching_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read ON matching_activity;
CREATE POLICY owner_read ON matching_activity FOR SELECT TO authenticated
  USING (user_id = public.app_user_id());
REVOKE ALL ON matching_activity FROM anon,authenticated;
GRANT SELECT ON matching_activity TO authenticated;
INSERT INTO matching_activity(user_id) SELECT user_id FROM profiles ON CONFLICT DO NOTHING;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS resume_requested boolean NOT NULL DEFAULT false;
-- Fences late completions after stale recovery/reclaim across worker processes.
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS claim_version bigint NOT NULL DEFAULT 0;

-- Only the actual, non-trial paid subscription mirror qualifies. Align expiry's
-- three-day grace with the existing entitlement resolver, ignoring comp/override tiers.
CREATE OR REPLACE FUNCTION matching_paused(uid uuid) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
 SELECT NOT EXISTS (
   SELECT 1 FROM subscriptions s WHERE s.user_id=uid AND s.plan IN ('standard','pro')
     AND s.status='active' AND nullif(s.stripe_subscription_id,'') IS NOT NULL
     AND s.current_period_end + interval '3 days' > clock_timestamp()
 ) AND EXISTS (
   SELECT 1 FROM matching_activity a WHERE a.user_id=uid
     AND (a.paused_at IS NOT NULL OR a.last_meaningful_at <= clock_timestamp()-interval '7 days')
 )
$$;
REVOKE ALL ON FUNCTION matching_paused(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION matching_paused(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION track_matching_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
BEGIN
 IF TG_TABLE_NAME='profiles' AND TG_OP='INSERT' THEN
   INSERT INTO matching_activity(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
 ELSIF current_setting('role',true)='authenticated' AND actor=public.app_user_id()
       AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE user_id=actor) THEN
   -- Preserve the expiry BEFORE advancing activity. Only explicit resume clears it.
   UPDATE matching_activity SET
     paused_at=CASE WHEN public.matching_paused(actor) THEN coalesce(paused_at,clock_timestamp()) ELSE paused_at END,
     last_meaningful_at=clock_timestamp() WHERE user_id=actor;
 END IF;
 RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION track_matching_activity() FROM PUBLIC;
DROP TRIGGER IF EXISTS initialize_matching_activity ON profiles;
CREATE TRIGGER initialize_matching_activity AFTER INSERT ON profiles
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
-- Deliberate saved profile/preferences changes; no generic updated_at trigger.
-- board_filters is excluded: pagehide beacons can persist it without a user edit.
DROP TRIGGER IF EXISTS profile_matching_activity ON profiles;
CREATE TRIGGER profile_matching_activity AFTER UPDATE OF resume_text,instructions,
 preferred_locations,company_exclusions,company_instructions,
 full_name,email,phone,links,location,screening_answers,
 resume_generation_instructions,cover_letter_generation_instructions ON profiles
 FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW) EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS correction_matching_activity ON review_corrections;
CREATE TRIGGER correction_matching_activity AFTER INSERT ON review_corrections
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS company_override_matching_activity ON company_overrides;
CREATE TRIGGER company_override_matching_activity AFTER INSERT OR UPDATE ON company_overrides
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();

-- Only manual verdict changes and applied-state transitions count; generated
-- package content and automatic AI reviews never advance the activity clock.
DROP TRIGGER IF EXISTS reject_insert_matching_activity ON job_reviews;
CREATE TRIGGER reject_insert_matching_activity AFTER INSERT ON job_reviews
 FOR EACH ROW WHEN (NEW.human_override) EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS reject_update_matching_activity ON job_reviews;
CREATE TRIGGER reject_update_matching_activity AFTER UPDATE OF human_override,verdict ON job_reviews
 FOR EACH ROW WHEN ((OLD.human_override OR NEW.human_override) AND OLD IS DISTINCT FROM NEW)
 EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_insert_matching_activity ON application_packages;
CREATE TRIGGER applied_insert_matching_activity AFTER INSERT ON application_packages
 FOR EACH ROW WHEN (NEW.status='applied') EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_update_matching_activity ON application_packages;
CREATE TRIGGER applied_update_matching_activity AFTER UPDATE OF status ON application_packages
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND (OLD.status='applied' OR NEW.status='applied'))
 EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_delete_matching_activity ON application_packages;
CREATE TRIGGER applied_delete_matching_activity AFTER DELETE ON application_packages
 FOR EACH ROW WHEN (OLD.status='applied') EXECUTE FUNCTION track_matching_activity();

-- Serialize resume calls on this user's activity row. Queue insertion and state
-- change commit together; RLS is supplemented with a checked server JWT identity.
CREATE OR REPLACE FUNCTION resume_matching() RETURNS TABLE(status text, existing boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.app_user_id(); was_paused boolean; req review_requests%ROWTYPE;
BEGIN
 IF uid IS NULL OR EXISTS(SELECT 1 FROM account_deletions WHERE user_id=uid) THEN
   RAISE EXCEPTION 'sign in' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM matching_activity WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile required' USING ERRCODE='42501'; END IF;
 -- Inspect stored pause/expiry, not the paid exemption: billing may have
 -- activated after the running worker already skipped this paused account.
 SELECT paused_at IS NOT NULL OR last_meaningful_at <= clock_timestamp()-interval '7 days'
 INTO was_paused FROM matching_activity WHERE user_id=uid;
 UPDATE matching_activity SET last_meaningful_at=clock_timestamp(),paused_at=NULL WHERE user_id=uid;
 INSERT INTO review_requests(user_id) VALUES(uid)
 ON CONFLICT (user_id) WHERE review_requests.status IN ('pending','running') DO NOTHING
 RETURNING * INTO req;
 IF FOUND THEN RETURN QUERY SELECT req.status,false; RETURN; END IF;
 -- The worker might finish between conflict detection and this row lock. Retry
 -- insertion if so; never return a synthetic pending success without durable work.
 SELECT * INTO req FROM review_requests WHERE user_id=uid AND review_requests.status IN ('pending','running') FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO review_requests(user_id) VALUES(uid) RETURNING * INTO req;
   RETURN QUERY SELECT req.status,false; RETURN;
 END IF;
 IF was_paused AND req.status='running' THEN
   UPDATE review_requests SET resume_requested=true WHERE id=req.id;
 END IF;
 RETURN QUERY SELECT req.status,true;
END
$$;
REVOKE ALL ON FUNCTION resume_matching() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resume_matching() TO authenticated;

INSERT INTO schema_migrations(filename) VALUES ('2026-10-02-matching-activity.sql') ON CONFLICT DO NOTHING;
COMMIT;
