-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Widen the companies.ats CHECK to admit three more discovery providers:
-- Workable, SmartRecruiters and Workday. These are discovery-only (listing/reading
-- postings); apply stays deep-link. The original inline column constraint is
-- auto-named `companies_ats_check` — drop and re-add it with the expanded set.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_check
  CHECK (ats IN ('greenhouse','lever','ashby','workable','smartrecruiters','workday'));
