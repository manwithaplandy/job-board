SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- Deliberately broken: proves the Migrations check fails before merge. Removed in the next commit.
ALTER TABLE no_such_table ADD COLUMN x bigint;
