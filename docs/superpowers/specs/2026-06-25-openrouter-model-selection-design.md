# Design — OpenRouter Reviews + User-Selectable Models

**Owner:** Andrew
**Status:** Approved for planning
**Date:** 2026-06-25
**Extends:** [`2026-06-24-login-ai-job-review-design.md`](2026-06-24-login-ai-job-review-design.md)

---

## 1. Summary

Replace the Anthropic API with **OpenRouter** for the two-stage AI job review, and
let the logged-in user **choose the model per stage** from a searchable dropdown
backed by OpenRouter's live model catalog. OpenRouter is OpenAI-compatible and can
route to Claude models too, so Claude stays available while every other provider
becomes selectable.

The review flow (Stage 1 title gate → Stage 2 full JD evaluation), the Pydantic
output schemas, per-job isolation, and candidate selection are **unchanged**. What
changes is (a) the client the reviewer uses to reach the LLM, and (b) two new
per-user model fields, set from the dashboard, that the reviewer reads.

Model choice applies to **newly reviewed jobs only** — switching models does not
re-review already-reviewed jobs.

---

## 2. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Provider | **OpenRouter** (OpenAI-compatible), replacing the direct Anthropic API. |
| Client (Python) | **OpenAI SDK** (`AsyncOpenAI`) pointed at `https://openrouter.ai/api/v1`, using `chat.completions.parse()` for structured output. |
| Model selection granularity | **Two dropdowns** — one per stage (Stage 1 gate, Stage 2 full review). |
| Model list source | **Live** from OpenRouter `/api/v1/models`, searchable letter-by-letter over the full catalog. |
| Model list filtering | **Structured-output-capable only** (`supported_parameters` includes `structured_outputs`). |
| "Top 20" | **Curated static shortlist** shown as default suggestions before typing; live search filters the full structured-capable catalog. (OpenRouter exposes no popularity ranking via API.) |
| Re-review on model change | **Only new jobs use the new model.** Model choice does **not** affect `profile_version`; existing verdicts are untouched. |
| API key | **Single server-side `OPENROUTER_API_KEY`** (no per-user BYOK). |
| Default model | `anthropic/claude-haiku-4.5` for both stages (verified present + structured-capable), overridable via `REVIEW_MODEL_STAGE1` / `REVIEW_MODEL_STAGE2`. |

---

## 3. Architecture

No new service and no change to where review runs (still inside the poller, per the
prior spec). Two edits to the existing topology:

```
Railway cron: poller
  review phase ──▶ OpenRouter (OpenAI-compatible)  [was: Anthropic API]
       reads profiles.model_stage1 / model_stage2  [new per-user model choice]

Vercel: Next.js dashboard
  /profile ──▶ fetches OpenRouter /api/v1/models (cached 1h, server-side)
           ──▶ two searchable model pickers ──▶ saves model_stage1/2 to profiles
```

The dashboard owns the **catalog fetch + selection UI**; the reviewer owns the
**inference call**. They communicate only through the two `profiles` columns — the
reviewer never fetches the catalog, and the dashboard never calls the LLM. This
keeps each side independently understandable and testable.

---

## 4. Data model

Two nullable columns on `profiles`. `NULL` means "use the default model."

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage1 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage2 TEXT;
```

Applied in both places the project tracks schema: appended to `schema.sql` (full
schema) and to a new incremental migration
(`migrations/2026-06-25-model-selection.sql`) for the live Supabase DB.

**Invalidation invariant (critical):** `profile_version` remains
`sha256(resume_text || '\0' || instructions)`. The model columns are deliberately
**excluded** from the hash, so changing a model does not mark existing verdicts
stale. The existing per-review `model_stage1` / `model_stage2` columns on
`job_reviews` continue to record which model produced each verdict, so history
stays accurate even as the profile's selection changes.

---

## 5. Reviewer changes (Python)

### 5.1 `reviewer/llm.py` — provider swap

`ReviewClient` keeps its public shape: constructor, `model_stage1` / `model_stage2`
attributes, `stage1()`, `stage2()`, the `build_profile_block()` helper, and the
two Pydantic schemas (`Stage1Result`, `Stage2Result`) are **unchanged**. Internals:

- **Client construction** (lazy, as today):
  ```python
  from openai import AsyncOpenAI
  client = AsyncOpenAI(
      base_url="https://openrouter.ai/api/v1",
      api_key=os.environ["OPENROUTER_API_KEY"],
      default_headers={"HTTP-Referer": "<repo/app url>", "X-Title": "job-board"},
  )
  ```
  The `default_headers` are OpenRouter's optional attribution headers.
- **`DEFAULT_MODEL`** → `"anthropic/claude-haiku-4.5"`.
- **Message shape:** the current Anthropic two-element `system=[profile_block,
  instructions]` list (with `cache_control`) becomes OpenAI message roles:
  - a `system` message containing the profile block + stage instructions, and
  - the `user` message carrying job details (Stage 1) / job details + JD (Stage 2),
  exactly as today.
- **Structured output:** `messages.parse(output_format=Model, ...)` →
  `chat.completions.parse(response_format=Model, ...)`. Read the result from
  `resp.choices[0].message.parsed`. Raise the existing `ValueError("...no parsed
  output")` when it is `None`; also treat a populated `.refusal` as an error so it
  flows into per-job isolation.
- **Caching:** Anthropic-specific `cache_control` is dropped (the model is now
  arbitrary). OpenRouter applies provider auto-caching where supported. Explicit
  cache breakpoints are a noted future optimization, not in this version.

### 5.2 `reviewer/run.py` — per-user model wiring

In `_review_user`, construct the client with the profile's models instead of the
no-arg form:

```python
client = ReviewClient(
    model_stage1=profile.get("model_stage1"),
    model_stage2=profile.get("model_stage2"),
)
```

`ReviewClient` already coalesces `None` → `REVIEW_MODEL_STAGE*` env → `DEFAULT_MODEL`,
so unset columns transparently use the default.

### 5.3 `reviewer/db.py` — load the columns

`load_profiles` SELECT adds `model_stage1, model_stage2`.

### 5.4 `reviewer/config.py` — key gate

`has_api_key()` checks `OPENROUTER_API_KEY` (was `ANTHROPIC_API_KEY`). The
`review_all` skip log message updates accordingly.

### 5.5 Dependencies

`pyproject.toml` + `requirements.txt`: drop `anthropic`, add `openai` with a floor
recent enough for `chat.completions.parse()` structured output (pin a known-good
minor at plan time).

---

## 6. Dashboard changes (Next.js / TS)

### 6.1 `dashboard/lib/openrouter.ts` (new)

- **`getStructuredModels()`** — server-side:
  `fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } })`,
  filter to entries whose `supported_parameters` includes `"structured_outputs"`,
  map to a slim `{ id, name, pricing }`, sort by `name`. On fetch failure return
  `[]` (the picker falls back to the curated list; reviews are unaffected).
- **`CURATED_MODELS`** — a `const` array of ~20 popular structured-capable ids
  (e.g. `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-4.5`,
  `openai/gpt-4.1-mini`, `openai/gpt-4o-mini`, `google/gemini-2.5-flash`,
  `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`, …). Default
  suggestion list shown before the user types. Manually maintained.
- **`DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5"`** — mirrors the Python
  default, used for placeholder display when a column is `NULL`.

### 6.2 `dashboard/components/ModelPicker.tsx` (new client component)

A searchable combobox, styled with Tailwind to match the existing lightweight
components (`SelectFilter`, `FilterBar`) — no new UI dependency.

- **Props:** `label`, `name` (the form field), `models` (full catalog), `curated`,
  `defaultValue` (current selection or `null`).
- **Behavior:** a text input filters the **full catalog client-side, letter by
  letter** (matching id + name); before any input it shows the curated top-20.
  Selecting an item sets a hidden `<input name={name}>` so it submits with the
  existing profile form. Clearing the field submits empty → reviewer uses the
  default.

### 6.3 `dashboard/app/profile/page.tsx`

Server component calls `getStructuredModels()` and renders two `ModelPicker`s
(Stage 1 / Stage 2) inside the existing `saveProfile` form, seeded from
`profile.model_stage1/2`. Helper text explains Stage 1 = cheap title gate,
Stage 2 = full review.

### 6.4 `saveProfile` action + `dashboard/lib/queries.ts`

- `saveProfile` reads `model_stage1` / `model_stage2` from `FormData`, **validates**
  each (empty → `null`; otherwise must be a member of the fetched structured-capable
  set), and passes them to `upsertProfile`. If the catalog is unavailable at save
  time (`getStructuredModels()` → `[]`), validation degrades to accepting the
  submitted id rather than rejecting every non-empty pick — a transient catalog
  outage must not block saving a valid model.
- `upsertProfile` adds the two columns to its INSERT/UPDATE. **`profile_version` is
  still computed from resume + instructions only** — model writes never touch the
  version (preserves "only new jobs use the new model").
- `ProfileRow` (in `lib/types.ts`) gains `model_stage1: string | null` and
  `model_stage2: string | null`; `getProfile` already `SELECT *`.

---

## 7. Error handling

- **Per-job isolation (unchanged):** `review_one` wraps each job; an error records
  `error` on that review row and the batch continues. OpenAI SDK `None`-parsed and
  `.refusal` cases raise inside the stage call and land here, surfacing in the
  dashboard's error count.
- **Missing key:** `review_all` already skips cleanly when the key is absent —
  retargeted to `OPENROUTER_API_KEY`.
- **Catalog fetch failure (dashboard):** `getStructuredModels()` → `[]`; picker
  falls back to the curated list so the form still works. Independent of the
  reviewer.
- **Stale/delisted stored model id:** OpenRouter call errors → caught per-job →
  row gets `error`, visible in the dashboard. Save-time validation prevents most
  bad ids up front.

---

## 8. Testing

Follows existing pytest + vitest patterns. No test makes a live OpenRouter call.

- **Reviewer (pytest), `tests/test_llm.py`:** rework the fake client to the OpenAI
  surface — a fake `chat.completions.parse()` returning
  `choices[0].message.parsed`. Assert: each stage sends the right `model`; the
  profile block + instructions land in the `system` message and job details (+ JD
  for Stage 2) in the `user` message; `response_format` is the correct Pydantic
  model; `None` / refusal raise. Keep the env-default and `None`→default coalescing
  tests (now defaulting to `anthropic/claude-haiku-4.5`).
- **Reviewer, `tests/test_reviewer_run.py` / db tests:** `load_profiles` selects
  the model columns; `_review_user` passes them into `ReviewClient`.
- **Dashboard (vitest):**
  - `openrouter.test.ts` — filtering keeps only `structured_outputs` models, field
    mapping, fetch-failure → `[]`.
  - `ModelPicker` filter logic — letter-by-letter matching; curated list shown
    before typing.
  - `queries` / `saveProfile` — model columns persist; `profile_version` is
    **unchanged** when only a model changes (guards the §4 invariant).

---

## 9. Deployment & config

- **No new service.** Same poller cron and dashboard.
- **Poller env:** add `OPENROUTER_API_KEY`; remove `ANTHROPIC_API_KEY`.
  `REVIEW_MODEL_STAGE1` / `REVIEW_MODEL_STAGE2` now hold OpenRouter ids and default
  to `anthropic/claude-haiku-4.5`.
- **Dashboard env:** no new required vars (catalog endpoint is public). If
  attribution headers are added on the dashboard side later, none are required now.
- **Migration:** apply `migrations/2026-06-25-model-selection.sql` to Supabase.
- **Dependencies:** poller swaps `anthropic` → `openai`.

---

## 10. Out of scope

- Per-user OpenRouter API keys (BYOK).
- Bulk "re-review all on model change" (explicitly deferred — only new jobs use a
  new model; resume/instructions edits still trigger re-review as before).
- Explicit prompt-cache breakpoints for OpenRouter.
- Scraped/live popularity ranking (no stable OpenRouter API; curated shortlist
  instead).
- Showing non-structured-capable models (filtered out).

---

## 11. Verified facts (at design time)

- OpenRouter `/api/v1/models` returns 339 models; **260** advertise
  `structured_outputs` in `supported_parameters`. No popularity/usage/rank field;
  `order=` param is ignored; frontend ranking endpoints 404.
- `anthropic/claude-haiku-4.5` is present and `structured_outputs`-capable — safe
  default. Other intended curated ids (`anthropic/claude-sonnet-4.5`,
  `openai/gpt-4.1-mini`, `openai/gpt-4o-mini`, `google/gemini-2.5-flash`,
  `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`) verified
  present + structured-capable.
