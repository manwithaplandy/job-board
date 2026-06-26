-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user OpenRouter model selection. NULL = use the reviewer's default model.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage1 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage2 TEXT;
