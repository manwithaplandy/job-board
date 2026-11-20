BEGIN;
-- Golden-dataset inputs must be frozen at correction time: prune nulls JDs and
-- profiles drift, so joining live tables rewrites eval inputs under old labels.
ALTER TABLE review_corrections
  ADD COLUMN IF NOT EXISTS description_snapshot  TEXT,
  ADD COLUMN IF NOT EXISTS resume_text_snapshot  TEXT,
  ADD COLUMN IF NOT EXISTS instructions_snapshot TEXT;
COMMIT;
