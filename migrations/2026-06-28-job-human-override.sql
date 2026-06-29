-- Manual job rejection: mark job_reviews rows the operator denied by hand.
-- A constant DEFAULT adds no table rewrite (instant on existing rows, PG 11+).
ALTER TABLE job_reviews
  ADD COLUMN IF NOT EXISTS human_override BOOLEAN NOT NULL DEFAULT FALSE;
