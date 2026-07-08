# Reasoning effort + curated model refresh — design

Date: 2026-07-08
Status: approved design, pending implementation plan
Scope: dashboard only (no Python reviewer changes, no Railway deploy)

## Goal

Three user-facing changes to the résumé / cover-letter generation configuration:

1. Add `anthropic/claude-sonnet-5` and `openai/gpt-5.5` to the curated model
   suggestions.
2. Prune the curated list: remove any model released more than 12 months ago or
   superseded by a same-provider successor, replacing each with its current
   equivalent where one exists.
3. Add per-task **Reasoning effort** settings (résumé, cover letter) to the
   Profile page, tier-gated by plan, passed through to the OpenRouter inference
   call.

## 1. Curated model list (`dashboard/lib/openrouter.ts`)

### Curation policy (encoded in the `CURATED_MODELS` comment)

An entry must be, at refresh time:

- present in the OpenRouter catalog with `structured_outputs` support (hard
  requirement — `validateModelId` rejects anything else at save time);
- released within the last 12 months (catalog `created` timestamp);
- not superseded by a same-provider successor available on OpenRouter.

Superseded or aged-out entries are replaced 1:1 by their same-provider successor
when one exists on OpenRouter; otherwise dropped. The `DEFAULT_MODEL_ID` /
`CHEAP_MODEL` / `PREMIUM_MODEL` / `DEFAULT_RESUME_MODEL` / `DEFAULT_COVER_MODEL`
/ `DEFAULT_PREFILL_MODEL` ids must always remain members of the list.

The list stays a static constant refreshed by hand (no runtime age filter): a
runtime filter would silently shrink the suggestions as models age with no human
judgment about successors, and "superseded" is not computable from the catalog.

### New list (every entry catalog-verified 2026-07-08; all support
`structured_outputs` AND `reasoning`)

| Entry | Disposition of old entry |
|---|---|
| `anthropic/claude-haiku-4.5` | kept (2025-10-15, no Haiku successor) |
| `anthropic/claude-sonnet-5` | **added** (requested; 2026-06-30) |
| `google/gemini-3.1-flash-lite` | replaces `gemini-2.5-flash-lite` (superseded) |
| `google/gemini-3.5-flash` | replaces `gemini-2.5-flash` (>1 yr + superseded) |
| `openai/gpt-5.4-nano` | replaces `gpt-4.1-nano` (>1 yr + superseded) |
| `openai/gpt-5.4-mini` | replaces `gpt-5-mini` (superseded); also covers removed `gpt-4.1-mini`, `gpt-4o-mini` (both >1 yr) |
| `openai/gpt-5.5` | **added** (requested; 2026-04-24) |
| `mistralai/mistral-medium-3-5` | replaces `mistral-small-3.2-24b-instruct` (>1 yr; current Mistral mainline with reasoning) |
| `deepseek/deepseek-v4-flash` | kept (default + cheap-tier model; 2026-04-24) |
| `deepseek/deepseek-v4-pro` | replaces `deepseek-v3.2` (superseded); also covers removed `deepseek-r1-0528` (>1 yr, R-line folded into v4 hybrids) |
| `qwen/qwen3.5-9b` | replaces `qwen3-8b` (>1 yr + superseded) |
| `qwen/qwen3.5-27b` | replaces `qwen3-32b` (>1 yr + superseded) |
| `qwen/qwen3.5-35b-a3b` | replaces `qwen3-30b-a3b-thinking-2507` (superseded) |
| `qwen/qwen3.5-397b-a17b` | replaces `qwen3-235b-a22b-thinking-2507` (superseded) |
| `moonshotai/kimi-k2-thinking` | kept (2025-11-06, no K3 on OpenRouter) |
| `google/gemini-3.1-pro-preview` | replaces `gemini-2.5-pro` (>1 yr + superseded; the only non-image Gemini pro tier currently on OpenRouter is the preview id) |

**Meta/Llama:** `llama-4-scout`, `llama-4-maverick`, `llama-3.3-70b-instruct`
are all >1 yr old and are removed. Their successor ("Muse Spark") is **not on
OpenRouter** as of 2026-07-08 (no `muse`/`spark`/newer `meta-llama` id in the
catalog), so Meta has no eligible replacement and drops out of the curated list.
Add the successor at the next refresh once OpenRouter carries it with
`structured_outputs`.

Removal from the curated list never invalidates a saved profile: the search box
filters the full live catalog and `validateModelId` accepts any catalog member,
so a user who had e.g. `gemini-2.5-pro` saved keeps working — it just stops
being suggested.

## 2. Reasoning effort

### Semantics

```
type ReasoningEffort = "off" | "low" | "medium" | "high"
```

- **Default is Off** (not "model default"). Off sends
  `reasoning: { enabled: false }`, which is the planned real fix for the
  deepseek-v4-flash reasoning-overflow truncations (see
  `REASONING_SAFE_MAX_TOKENS` comment in `openrouterClient.ts`). This
  deliberately changes current behavior, where a hybrid reasoning model decides
  for itself.
- Low/Medium/High send `reasoning: { effort: "<level>" }` (OpenRouter's unified
  parameter; mapped to budget tokens for Anthropic-style models).
- For a model whose catalog entry does **not** list `reasoning` in
  `supported_parameters`, the parameter is omitted entirely, whatever the
  setting. Lookup uses the already-1h-cached `getStructuredModels()`; if the
  catalog fetch fails, fail open and attach the parameter (matches
  `validateModelId`'s fail-open posture). Every curated model supports
  `reasoning` today, so omission only applies to user-searched catalog models.
- SETTLED (live probe, 2026-07-08): OpenRouter **hard-fails** ("Provider
  returned error") a request that carries `reasoning` — either form, even
  `enabled: false` — to a model whose provider can't take it (probed
  `openai/gpt-5.2-chat`; `mistralai/ministral-8b-2512` tolerates it, so
  behavior is provider-dependent). The catalog-gated omission is therefore
  REQUIRED, not an optional defense; do not simplify it away.

### Storage

Migration `migrations/2026-07-08-reasoning-effort.sql` adds to `profiles`:

- `reasoning_effort_resume text CHECK (reasoning_effort_resume IN ('low','medium','high'))`
- `reasoning_effort_cover  text CHECK (reasoning_effort_cover  IN ('low','medium','high'))`

`NULL` means Off (the default); the save action normalizes an explicit "off"
selection to `NULL`. Update `schema.sql` to match. New columns on the existing
RLS'd `profiles` table inherit its policies; account export includes them via
the profile row. No new table → the new-user_id-table checklist does not apply.

### Tier gating (`dashboard/lib/entitlements.ts`)

```
Standard: off, low        Pro: off, low, medium, high
```

- New TS-only export `REASONING_EFFORTS: Record<Plan, ReasoningEffort[]>` plus
  `resolveReasoningEffort(plan, requested): ReasoningEffort`. Commented as
  intentionally NOT mirrored in `reviewer/entitlements.py` (generation is
  dashboard-only), same precedent as `PLAN_PRICE_USD`. Placed outside the
  `ENTITLEMENTS` literal so `tests/test_entitlements_parity.py`'s regexes are
  untouched; the parity suite must stay green.
- Enforced twice, mirroring the stage-2 model gate:
  - **Save time:** profile action rejects Medium/High for a non-Pro plan with
    a "requires the Pro plan" error (defense against hand-crafted form posts).
  - **Call time:** `resolveReasoningEffort` clamps a saved-but-no-longer-
    entitled value to the highest level the plan allows (Standard: `high` →
    `low`), covering Pro→Standard downgrades. `null` plan → `off`.
- Compile-time constants only — not part of the DB-overlaid `tierConfig`
  overlay (T1); effort levels are a product-shape knob, not a tunable money
  cap. Revisit only if per-tier effort needs live tuning.

### UI (Profile page)

- Two native `<select>`s (styled like existing inputs, `rf-focusable`), each
  directly under its model picker: "Résumé reasoning effort" under the résumé
  model, "Cover letter reasoning effort" under the cover-letter model.
- Options: Off / Low / Medium / High. For non-Pro users, Medium and High render
  `disabled` with a "(Pro)" suffix, plus the existing hint-text pattern used by
  the stage-2 picker.
- Billing page: add one line to the Pro feature copy mentioning higher
  reasoning-effort levels.

### Plumbing

- `callOpenRouterStructured` gains optional
  `reasoningEffort?: ReasoningEffort | null` — `null`/`undefined` omits the
  parameter (non-reasoning model), `"off"` → `{ enabled: false }`, otherwise
  `{ effort }`.
- `generateResume` / `generateCoverLetter` gain an optional `reasoningEffort`
  arg (optional keeps `scripts/gen-resume.ts` and existing tests compiling).
- All three generation routes resolve `(model, effort)` from profile + plan:
  `/api/resume`, `/api/cover-letter`, `/api/application/prepare`. A small
  shared helper computes the resolved settings once (plan clamp + the catalog
  `reasoning`-support lookup that maps to `null`/omit) so the three routes
  cannot drift.
- Greenhouse prefill (`prefillClient`, fixed `DEFAULT_PREFILL_MODEL`) is not
  user-configurable and always sends Off: it is a bounded 45-second extraction
  call where reasoning only risks the timeout.

## Out of scope

- Stage-2 / company review models (Python reviewer) get no effort knob.
- The full-catalog search stays unrestricted — age/supersession curation
  applies to the curated suggestions only. Users may still deliberately pick
  any structured-output model OpenRouter carries.
- No automatic (runtime) curation.

## Testing

- `lib/entitlements.test.ts`: `resolveReasoningEffort` clamping table
  (per-plan allowed sets, downgrade clamp, null plan).
- `lib/rolefit/openrouterClient.test.ts`: request-body assertions for all four
  levels + the omit case; existing behavior unchanged when arg absent.
- `lib/rolefit/resumeClient.test.ts` / `coverLetterClient.test.ts`: effort
  passthrough to the transport.
- Profile save action: gate rejection for Standard + Medium/High; "off"
  normalized to NULL; catalog-validation behavior unchanged.
- Python: `python3 -m pytest tests/test_entitlements_parity.py` stays green.
- Curated-list sanity: keep the list static; the catalog verification above is
  recorded here rather than as a network test (dashboard vitest stays offline).

## Rollout

1. Apply `2026-07-08-reasoning-effort.sql` to Supabase (session-mode pooler
   DSN) **before** pushing code — push-to-main auto-deploys Vercel.
2. Merge to main; verify on prod: Profile shows the new dropdowns and curated
   suggestions; a generation with effort High (Pro account) shows
   `reasoning` in the Langfuse generation span input/metadata; default (Off)
   generation succeeds on deepseek-v4-flash.

## Open items

- "Muse Spark" (Meta's Llama successor) absent from OpenRouter as of
  2026-07-08 — re-check at next curated refresh.
