# Global company classification + per-user structured filters

**Date:** 2026-07-21
**Status:** Approved design, pre-implementation
**Replaces:** the per-user company evaluation pipeline (`company_discovery` per-profile loop, `company_reviews` classification, `reconcile_active`)

## Problem

Company evaluation is per-user in a now multi-tenant app:

- `company_reviews` (PK `user_id, company_id`) stores verdict/industry/red_flags/tech_tags computed by one LLM call per (user × company) against each user's free-text `profiles.company_instructions`. Prod holds 15,859 rows — all from one user. Every new tenant with company instructions would re-classify the whole corpus (~16k LLM calls each, growing to ~30k as the vendored datasets drain in).
- `companies.active` (which companies get polled) is a **global** flag reconciled from **per-user** verdicts in a loop — last-writer-wins. Two users with different instructions would fight over the polling corpus.
- The reviewer never reads company classification; the only company signal in job evaluation is the display-name string. Per-user company "exclude" verdicts don't gate job review or the board — they only shape the `/companies` page buckets.
- No global industry/size/country metadata exists anywhere.

## Design summary

Split company evaluation into two layers:

1. **Global facts, computed once per company** and stored on the global `companies` table: industry + subcategory (existing taxonomy), size bucket (new), HQ country (new), red-flag categories, tech tags, confidence. Produced by **admin-triggered, cost-controlled batch classification jobs** (default model: Gemini 3.5 Flash-Lite), with **per-run-configurable SERP grounding** (hybrid model: cheap ungrounded first pass, optional SERP-grounded re-pass over the unknown/low-confidence tail).
2. **Per-user judgment, deterministic and LLM-free**: structured exclusions (industries, countries, sizes, red-flag categories) + per-company manual include/exclude overrides. Enforced in the reviewer's candidate selection (excluded companies' jobs are never reviewed — saves budget) and in the authed board query; company metadata also becomes interactive board facets.

Free-text `company_instructions` survives but moves: it is injected into the **stage-2 job review prompt** alongside the company metadata block, so nuanced preferences are judged per-job at no extra cost. The per-user company LLM pass, `company_profile_version` invalidation, and `reconcile_active` are retired.

`companies.active` becomes purely operational: default TRUE, flipped FALSE only by the poller on dead boards (repeated fetch failures / 404s). User preferences never touch it.

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Polling gate | Poll the whole corpus; `active` = board-health only |
| Free-text company instructions | Fold into stage-2 job review prompt |
| Sourcing pipeline | Hybrid: ungrounded first pass + SERP re-pass on unknowns, **SERP selectable per run in the admin UI**; Flash-Lite default |
| Cost control | No autonomous LLM spend — classification only via admin-triggered jobs with model + cap + live cost estimate |
| Filter surface | Pipeline gate (reviewer + board server-side) **and** board facets, both in v1 |
| Seeding | Copy existing `company_reviews` classification into `companies` for $0 |

## Data model

### `companies` (global, existing `shared_read` RLS) — new columns

| Column | Type | Notes |
|---|---|---|
| `industry` | TEXT | existing shared taxonomy (`reviewer/schemas.py`) |
| `industry_subcategory` | TEXT | |
| `size` | TEXT | enum bucket: `1-10 \| 11-50 \| 51-200 \| 201-1000 \| 1001-5000 \| 5000+ \| unknown` |
| `hq_country` | TEXT | ISO-3166 alpha-2 or `unknown` |
| `tech_tags` | JSONB | |
| `red_flags` | JSONB | array of `{category, note}`, existing category enum |
| `classification_confidence` | REAL | |
| `classified_at` | TIMESTAMPTZ | |
| `classification_model` | TEXT | |
| `classification_source` | TEXT | `seeded_from_user_review \| job \| job_serp` |

`unknown` is a first-class value for every facet. The dormant SERP columns (`web_description`, `web_searched_at`, `about_source='serp'`) get wired: the SERP step writes fetched snippets to `web_description` + stamps `web_searched_at`; the classifier prompt already falls back `about → web_description`.

### `classification_jobs` (new, global, deny-all RLS, service/admin only)

`id`, `status` (`pending|running|done|canceled|error`), `model`, `company_cap`, `selection_mode` (`unclassified` | `unknown_repass`), `use_serp BOOLEAN`, `est_cost`, `processed`, `errored`, `serp_queries`, `actual_prompt_tokens`, `actual_completion_tokens`, `actual_cost`, `error`, `created_at`, `started_at`, `finished_at`.

- `selection_mode = unclassified`: companies with `classified_at IS NULL`, ordered by open-job count descending (spend hits maximum board impact first).
- `selection_mode = unknown_repass`: companies already classified but with `size='unknown'` OR `hq_country='unknown'` OR `industry IS NULL/'unknown'` OR `classification_confidence < 0.5` (constant in code, not per-run), same ordering.
- `use_serp` is set per run from the admin UI and composes freely with either selection mode (e.g. ungrounded first pass over unclassified, SERP re-pass over unknowns — the recommended hybrid — or SERP on a first pass if desired).

### `company_overrides` (new, per-user)

`(user_id, company_id)` PK, `verdict` (`include|exclude`), `created_at`, `updated_at`. Full new-user_id-table checklist: deny-all + `owner_access` RLS + authenticated GRANTs (mirror the generation-jobs migration), `schema.sql`, RLS test trio, `userScopedTables.ts` (export + deletion), CI drift-guard. Existing `company_reviews.human_override=TRUE` rows migrate here.

### `profiles` — new column

`company_exclusions JSONB`: `{industries: string[], countries: string[], sizes: string[], redFlagCategories: string[]}`. Read through a total-parser codec (packageCodec pattern — never `as`-cast a jsonb column). **Must be added to the column-level INSERT/UPDATE grant lists** (profiles grants are an explicit allowlist; omitting breaks all saves with a misleading 42501).

### `company_reviews`

Goes read-only legacy at ship; dropped in a later cleanup migration (with `profiles.company_profile_version` and `profiles.model_company`) once the new path is verified.

## Classification pipeline

### Worker

The Railway `discovery` service converts from weekly cron to an **always-on queue worker** (same pattern as the reviewer worker): poll `classification_jobs` for pending work, claim via status transition, process at bounded concurrency (existing `DISCOVERY_CONCURRENCY`), update `processed`/`errored`/token counters per chunk, honor `canceled` mid-run, record actual usage + cost from OpenRouter responses. Dataset ingest + HTTP enrichment (both LLM-free) keep running on an internal weekly tick. **No LLM call ever happens outside an admin-triggered job.**

### SERP step (per-run optional)

When `use_serp` is set: for each selected company, query the SERP provider (company name + ATS context), write top snippets to `companies.web_description` + `web_searched_at`, and include them in the classification prompt. Provider sits behind a small adapter; default **Serper.dev** (`SERPER_API_KEY`, ~$1/1k queries, 2,500 free) with Brave's "Data for AI" plan as the licensing-clean alternative (note: Brave throttles ~1–2 req/s — rate-limit the fetch loop via the adapter regardless). Skip the query when `web_searched_at IS NOT NULL` (re-runs never re-pay for search; a force-refresh option is out of scope for v1).

### Prompt changes

Drop the per-user preferences block; add instructions + output fields for `size` and `hq_country`; keep the objective parts (taxonomy, red-flag categories, tech tags, English mandate). Output no longer includes an include/exclude verdict — the model reports facts + confidence only.

### Seeding (free, one-time migration)

Copy the existing 15,859 `company_reviews` rows' `industry`, `industry_subcategory`, `tech_tags`, `red_flags` into `companies` (where not already classified), with `size='unknown'`, `hq_country='unknown'`, `classified_at = reviewed_at`, `classification_source='seeded_from_user_review'`, model stamped from the row. Day one the current corpus is classified for $0; `unknown_repass` jobs backfill size/country at admin-chosen pace and spend.

## Admin UI (new admin page, admin-gated service-role path)

Job launcher:

- **Model** — curated dropdown defined in code (v1: `google/gemini-3.5-flash-lite` default, `google/gemini-3.6-flash`, `deepseek/deepseek-v4-flash`).
- **Selection mode** — "Unclassified companies" / "Re-pass unknowns/low-confidence" (shows the matching-company count for each).
- **SERP grounding** — per-run toggle, with the per-company delta shown inline.
- **Company cap** — numeric input.
- **Live ROM estimate** — `min(cap, matching) × per-company cost`; per-company = model pricing (fetched from OpenRouter's models API server-side, cached, with a hardcoded fallback map) × ~1,300 input / 300 output tokens, + ~900 input tokens + $0.001/query when SERP is on. Estimate updates as any control changes.
- **Launch** → inserts the `classification_jobs` row.

Job monitor: progress (processed/errored/total), actual spend so far, cancel button, and a job-history table (per-run model, mode, SERP, est vs actual cost). The admin discovery card's backlog semantics change from "per-user unreviewed" to "unclassified companies" + a link here.

### Cost reference (from the 2026-07-21 analysis; Serper at $1/1k)

| Model | No SERP /company | With SERP /company | Delta |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | $0.00114 | $0.00241 | +$0.00127 (~2.1×) |
| Gemini 3.6 Flash | $0.00420 | $0.00655 | +$0.00235 (~1.6×) |

Full-corpus reference (29,400): hybrid on Flash-Lite ≈ $69 total if run to completion; a 1,000-company Flash-Lite job is ~$1.14 without SERP, ~$2.41 with. These are ROM inputs, not commitments — the admin UI recomputes from live pricing.

## Enforcement

### Reviewer

- `select_candidates` joins `companies` and applies, in SQL before any LLM call: facet exclusions from `profiles.company_exclusions` (a facet exclusion matches only known values; the `unknown` bucket is excludable explicitly) and `company_overrides` (override-include beats facet exclusion; override-exclude beats everything).
- Stage-2 prompt gains a company block — industry, size, country, red flags, about — plus the user's free-text `company_instructions`. Stage 1 unchanged (the deterministic gate already removed excluded companies).

### Board

- Authed: profile exclusions + overrides applied **server-side** in `buildJobsQuery` (they shape the 500-row population).
- Facets: `industry`, `size`, `hq_country` added to the lean board SELECT and to `JobRow`; interactive client-side facets in `rolefit/filter.ts` alongside Source/Pay/Location; state persisted in `board_filters` like existing facets.
- Anon board / ISR twin: no exclusions (no profile), facets fully functional.

## UX changes

- **Profile settings:** new "Company filters" section — multi-select exclusions for industry, country, size, red-flag category. The company-instructions textarea stays, relabeled to reflect that it now guides job evaluation.
- **`/companies` page:** verdict buckets replaced by a metadata browse — facet filtering, per-company classification display, and an Include/Exclude override toggle (existing `setCompanyOverride` action retargeted at `company_overrides`).

## Rollout

1. **Migration first** (house rule: DB before code push): new columns/tables, seed, override migration, grants.
2. Ship worker + admin UI. Validation run: one small paid job (~500 companies, no SERP) then one small `unknown_repass` **with** SERP — verifies both code paths and est-vs-actual cost accounting.
3. Ship reviewer gate + board filters + settings UI + `/companies` rework.
4. Flip `active=TRUE` in stages (existing ~15.8k first; watch poll runtime + DB size — open jobs may roughly double; the existing size-ceiling guard is the backstop). Storage, not LLM, is the ongoing cost lever.
5. Cleanup migration later: drop `company_reviews`, `company_profile_version`, `model_company`, `reconcile_active`, and the per-user classification code paths.

## Testing

- **Python:** SQL tests for the exclusion gate (facets × overrides × unknown semantics, local PG via `TEST_DATABASE_URL`); worker job lifecycle (claim, progress, cancel, error, cost accounting); SERP adapter (mocked) incl. skip-when-fresh; prompt-block unit tests.
- **Dashboard:** codec round-trip for `company_exclusions`; RLS trio for `company_overrides`; `jobsQuery` server-filter tests; ROM-estimate unit test (model pricing fallback path included); UI contract tests for the admin page + settings section.
- **Parity:** size/hq_country enums mirrored TS↔Python with a parity guard, like PLAN_TIER.

## Out of scope (explicit)

- External company-data providers (Clearbit-style).
- Auto-scheduled classification spend (everything LLM is admin-triggered).
- Reviewer stage-1 prompt changes.
- Per-user free-text company evaluation in any form.
