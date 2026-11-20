BEGIN;
-- LLM-written scores are rendered as 0-100; malformed extractions must not persist.
ALTER TABLE job_reviews        ADD CONSTRAINT job_reviews_scores_range CHECK (
  (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
  (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
  (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
  (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)) NOT VALID;
ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_scores_range CHECK (
  (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
  (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
  (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
  (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)) NOT VALID;
ALTER TABLE application_packages ADD CONSTRAINT applied_iff_timestamp
  CHECK ((status = 'applied') = (applied_at IS NOT NULL)) NOT VALID;
COMMIT;
ALTER TABLE job_reviews          VALIDATE CONSTRAINT job_reviews_scores_range;
ALTER TABLE review_corrections   VALIDATE CONSTRAINT review_corrections_scores_range;
ALTER TABLE application_packages VALIDATE CONSTRAINT applied_iff_timestamp;
