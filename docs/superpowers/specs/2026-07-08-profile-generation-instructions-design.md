# Profile-level generation instructions

**Date:** 2026-07-08
**Status:** Approved — ready for implementation plan

## Problem

Generation instructions today exist only **per-job**: each application's résumé and
cover-letter boxes (`application_packages.resume_instructions` /
`cover_letter_instructions`) inject a `CANDIDATE FOCUS / AVOID` block into the
generation prompt. There is no way to set **standing** guidance that applies to
every résumé and every cover letter — e.g. "keep résumés to one page", "prefer a
warm tone in cover letters" — without retyping it into every job.

Add a **profile-level** configuration for résumé-generation and cover-letter-generation
instructions, layered underneath the existing per-job boxes.

### Non-goal / important distinction

`profiles.instructions` already exists, but it is **reviewer-only**: it feeds the
job-relevance reviewer and is part of the `profile_version` hash
(`sha256(resume_text || '\0' || instructions)`). It deliberately does **not** reach
résumé/cover generation. This feature does **not** reuse or touch that column — it
adds separate columns so the reviewer prompt and cached verdicts are unaffected.

## Design

### 1. Data model

Two new nullable columns on `profiles`:

- `resume_generation_instructions TEXT`
- `cover_letter_generation_instructions TEXT`

The `generation_` prefix keeps them unambiguous against the reviewer-only
`instructions` column and the per-job `application_packages.resume_instructions`.

Requirements:

- New migration under `/migrations/` **and** add the columns to `schema.sql`
  (`profiles` table definition).
- **Add both columns to the column-level `GRANT INSERT (...)` and
  `GRANT UPDATE (...)` lists** on `profiles` in `schema.sql`. Per the
  profiles-grant convention, new columns default to non-writable; omitting this
  breaks *all* profile saves with a misleading table-level `42501`. Do **not**
  "fix" that by granting at the table level.
- **Excluded from the `profile_version` hash** (`dashboard/lib/profileVersion.ts`,
  mirrored in `reviewer/profile.py`). These affect generation only, not the
  reviewer — the same convention already applied to model choices and locations.
  Editing them must not invalidate cached reviewer verdicts.
- No draft / applied-badge machinery. Unlike the per-job boxes (which live on the
  board and needed their own Save button + `*_draft` columns), these are ordinary
  profile fields saved by the profile page's existing sticky Save bar.

### 2. Prompt injection

Thread a new `profileInstructions?: string | null` argument through:

- `generateResume` (`dashboard/lib/rolefit/resumeClient.ts`) → `buildResumePrompt`
  (`dashboard/lib/rolefit/resumeSchema.ts`)
- `generateCoverLetter` (`dashboard/lib/rolefit/coverLetterClient.ts`) →
  `buildCoverLetterPrompt` (`dashboard/lib/rolefit/coverLetterSchema.ts`)

Source it from the profile columns in the routes (the `profile` row is already
loaded via `getProfile`).

Render it as its own labeled block **before** the existing per-job `focusBlock`,
carrying the same guardrail framing so it cannot license fabrication:

```
PROFILE-WIDE GUIDANCE (applies to every application — honor it within the ground
rules; it never licenses adding unsupported skills or experience):
{profile.resume_generation_instructions}

CANDIDATE FOCUS / AVOID (this application):
{per-job resume_instructions}
```

- Each block is omitted when its source is null (so today's behavior — per-job only,
  or neither — is unchanged).
- When both are present they **layer**: profile-wide guidance is standing context;
  the per-job block follows as this-application specifics. (Confirmed design choice:
  layer both, not replace.)
- Wired once at the builder/client layer, so all three entry points inherit it:
  `/api/resume`, `/api/cover-letter`, and the Greenhouse combined
  `/api/application/prepare` (both its résumé and cover legs; the prefill leg stays
  instruction-less as today).

The cover-letter block uses the same shorter `CANDIDATE FOCUS / AVOID` heading style
already present in `coverLetterSchema.ts`; the profile block mirrors the résumé
block's guardrail wording, adapted per builder.

### 3. Profile UI

New **"Generation instructions"** card in `dashboard/app/profile/page.tsx`, matching
the existing card/field styling (label + hint + `rf-focusable` textarea, `resize:
vertical`). One-line hint: *"Applied to every résumé / cover letter you generate.
Per-job boxes layer on top."*

Two uncontrolled textareas:

- `name="resume_generation_instructions"` — labeled "Résumé generation"
- `name="cover_letter_generation_instructions"` — labeled "Cover letter generation"

Placed near the reviewer `instructions` field but visually its own card, so the
reviewer-vs-generation distinction stays legible (the reviewer field keeps its
existing "not used to write your résumé or cover letters" hint).

### 4. Save wiring

- **`saveProfile`** action (`profile/page.tsx`): read both fields from `FormData`,
  normalize + cap with the shared `normalizeInstructions` (4000-char cap, blank →
  null) from `dashboard/lib/rolefit/generationInstructions.ts`, surfacing the
  existing inline error on over-cap.
- **`upsertProfile`** (`dashboard/lib/queries.ts`): add both columns to the param
  type, the INSERT column list, the `VALUES` list, and the `ON CONFLICT DO UPDATE
  SET` block (all four spots). Confirm `getProfile`'s `SELECT *` returns them.
- **`saveProfileResume`** (`dashboard/app/actions/profile.ts`, the board's
  résumé-only ProfileModal): thread both columns into its preserve-through list, so
  a résumé save from the board modal does not null the new fields.
- **`ProfileRow`** type (`dashboard/lib/types.ts`): add both fields.

### 5. Testing

- **Prompt-builder unit tests (highest value):** `buildResumePrompt` and
  `buildCoverLetterPrompt`
  - render the profile-wide block when `profileInstructions` is present,
  - omit it when null,
  - and when both profile-level and per-job instructions are present, emit both,
    with the profile-wide block **above** the per-job `focusBlock`.
  - assert the anti-fabrication guardrail phrasing is attached to the profile block.
- **Normalization/cap:** blank → null; over-cap → error, for the two new fields.

### 6. Deploy note

Migration-coupled (per deploy-topology): apply the migration to Supabase **before**
deploying the code. `upsertProfile`'s INSERT references the new columns, so they
must exist first.

## Touch-point checklist

1. `migrations/2026-07-08-profile-generation-instructions.sql` — add columns.
2. `schema.sql` — `profiles` column defs + `GRANT INSERT` + `GRANT UPDATE` lists.
3. `dashboard/lib/types.ts` — `ProfileRow` fields.
4. `dashboard/lib/queries.ts` — `upsertProfile` param type + INSERT + VALUES + SET.
5. `dashboard/app/profile/page.tsx` — new card + `saveProfile` reads + normalize/cap.
6. `dashboard/app/actions/profile.ts` — `saveProfileResume` preserve-through list.
7. `dashboard/lib/rolefit/resumeClient.ts` + `resumeSchema.ts` — thread + render.
8. `dashboard/lib/rolefit/coverLetterClient.ts` + `coverLetterSchema.ts` — thread + render.
9. `dashboard/app/api/resume/route.ts`, `.../cover-letter/route.ts`,
   `.../application/prepare/route.ts` — pass profile columns into the generate calls.
10. Unit tests for the two prompt builders (+ normalization).

Explicitly **not** touched: `dashboard/lib/profileVersion.ts` / `reviewer/*`
(profile_version and reviewer prompt stay as-is).
