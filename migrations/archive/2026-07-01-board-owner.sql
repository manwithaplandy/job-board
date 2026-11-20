BEGIN;
-- Replaces the implicit "profile row with max updated_at is the public board
-- owner" rule, which any new signup that saves a profile could hijack.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE profiles SET is_owner = TRUE
WHERE user_id = (SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1);
CREATE UNIQUE INDEX IF NOT EXISTS one_board_owner ON profiles ((TRUE)) WHERE is_owner;
COMMIT;
