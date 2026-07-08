-- Per-task reasoning-effort settings for résumé / cover-letter generation.
-- NULL = Off (the default): generation sends reasoning {enabled:false} for
-- reasoning-capable models and omits the field otherwise. 'low'|'medium'|'high'
-- request that effort; medium/high are Pro-gated at save AND clamped at call
-- time (dashboard/lib/entitlements.ts — TS-only, not mirrored in the reviewer).
ALTER TABLE profiles
  ADD COLUMN reasoning_effort_resume TEXT
    CONSTRAINT reasoning_effort_resume_valid
    CHECK (reasoning_effort_resume IN ('low', 'medium', 'high')),
  ADD COLUMN reasoning_effort_cover TEXT
    CONSTRAINT reasoning_effort_cover_valid
    CHECK (reasoning_effort_cover IN ('low', 'medium', 'high'));
