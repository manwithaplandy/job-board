# Résumé Evals — LangFuse Managed-Evaluator Setup & Operator Runbook

**Date:** 2026-07-02  
**Feature:** résumé-generation evals (Tasks 1–10 shipped this branch)  
**Scope of this doc:** manual steps to go live — LangFuse UI configuration, Vercel env confirmation, deploy order, and end-to-end verification. No app code is produced here.

---

## Overview

The résumé-evals feature ships two feedback loops:

1. **Online (LangFuse managed evaluator)** — an LLM-as-judge scores every live `resume` trace automatically.
2. **Offline (human golden dataset)** — operators score résumés in the board; scores land in `resume_scores` (Postgres) and push a `resume-golden` dataset item to LangFuse.
3. **Calibration** — a TS script joins human scores to judge scores to measure agreement.

Follow sections 1–4 in order. The migration (section 3) MUST be applied before the deploy.

---

## Section 1: Configure the LangFuse Managed Evaluator

**LangFuse project:** `cmqvp2hg103h8ad0cjibfrrhw`  
**Region:** US — `us.cloud.langfuse.com` (not EU; "no data" = wrong region)

### 1.1 Add the LLM Connection (once per project)

1. Go to **Settings → LLM Connections** in the LangFuse UI.
2. Add a new connection for **Anthropic**.
3. For the model, select **Claude Sonnet 5**. Confirm the exact model slug against the current LangFuse model list at wiring time (e.g. `claude-sonnet-5-20251001` or whatever appears in the current list — do not hard-code a slug here; consult the UI).
4. Save and note the connection name for use in the evaluator below.

### 1.2 Create the LLM-as-Judge Evaluator

Navigate to **Evaluators** → **New Evaluator** and fill in:

| Field | Value |
|---|---|
| Name | `resume-judge` |
| Type | LLM-as-judge |
| LLM Connection | the Anthropic / Claude Sonnet 5 connection from step 1.1 |
| Sampling | 100% |
| Filter | Observation name = `resume` |
| Run on | Live traces AND dataset runs (check both) |

**Prompt:** copy the contents of `RESUME_JUDGE_RUBRIC` verbatim from:

```
dashboard/lib/rolefit/resumeJudgeRubric.ts
```

This file is the source of truth for the rubric; the running copy lives in the LangFuse UI. If you update the rubric, update both in sync.

The rubric uses four template variables. Map them as follows:

| Template variable | Source | LangFuse mapping |
|---|---|---|
| `{{job_title}}` | Trace INPUT | `input.title` |
| `{{job_company}}` | Trace INPUT | `input.company` |
| `{{job_description}}` | Trace INPUT | `input.description` |
| `{{resume}}` | Trace OUTPUT | `output` (the composed résumé text) |

The parent `resume` span on each trace sets `input = { title, company, description }` and `output` = the rendered résumé text. `metadata.mechanical_checks` carries the deterministic check results (for reference only — the judge does not score this).

### 1.3 Configure Evaluator Outputs

The evaluator must emit exactly **two scores**. Set the output variable names to:

| Score | Exact name | Constant in code |
|---|---|---|
| Truthfulness / groundedness | `grounding` | `RESUME_JUDGE_GROUNDING_SCORE_NAME` |
| Job-description targeting | `jd_relevance` | `RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME` |

The judge returns `{ "grounding": <1-5>, "jd_relevance": <1-5> }`. The overall score (`0.7 * grounding + 0.3 * jd_relevance`) is computed in code (`dashboard/lib/rolefit/resumeScore.ts::resumeOverall`) — the judge does NOT compute overall.

The score names must match the constants exported from `dashboard/lib/rolefit/resumeJudgeRubric.ts` exactly, or the calibration script will not join scores correctly.

### 1.4 Enable on Dataset Runs

Under evaluator settings, confirm **"Run on dataset runs"** is enabled. This unlocks the deferred regression harness (out of scope for this release — future work) so that when a golden dataset run is triggered, the judge also scores those items automatically.

---

## Section 2: Confirm Environment Variables on Vercel

The dashboard uses three LangFuse env vars. Confirm they are set for **both Production and Preview** environments on the Vercel project.

| Variable | Purpose |
|---|---|
| `LANGFUSE_PUBLIC_KEY` | authenticates tracing SDK writes |
| `LANGFUSE_SECRET_KEY` | authenticates LangFuse client (dataset push, calibration script) |
| `LANGFUSE_HOST` | must be `https://us.cloud.langfuse.com` (US region) |

Check in Vercel Dashboard → Project → Settings → Environment Variables. If `LANGFUSE_HOST` is absent or set to the EU endpoint, traces will appear missing — set it to the US URL above.

For the local calibration script (section 4 step 5), the same three vars plus `DATABASE_URL` must be present in `dashboard/.env.local`.

---

## Section 3: Deploy Order (Migration-Coupled)

**The migration MUST be applied before deploying the app code.** The dashboard reads and writes `resume_scores` and `application_packages.resume_trace_id`; deploying first causes 500s.

### Step 3.1 — Apply the migration to Supabase

```bash
# from repo root
supabase db push  # or apply via Supabase dashboard / MCP
```

Migration file: `migrations/2026-07-02-resume-scores.sql`

This migration creates:
- `resume_scores` table (human grounding / jd_relevance / comment / overall)
- `application_packages.resume_trace_id` column (links to LangFuse trace)
- Deny-all RLS on `resume_scores`
- Idempotent (`IF NOT EXISTS`), wrapped in `BEGIN`/`COMMIT`, recorded in `schema_migrations`

### Step 3.2 — Push to main (triggers Vercel deploy)

```bash
git push origin main
```

Push-to-main auto-deploys the dashboard on Vercel. No reviewer service or Railway changes are required for this feature.

Wait for the Vercel deploy to go green before proceeding to section 4.

---

## Section 4: End-to-End Verification

Follow these steps in order to confirm the full pipeline is working.

### Step 4.1 — Generate a résumé in the board

1. Open a job in the board that you have a complete profile for.
2. Expand the **Résumé** tab and click **Generate résumé**.
3. Confirm the résumé renders without error.

### Step 4.2 — Confirm the `resume` trace in LangFuse

1. Go to `us.cloud.langfuse.com` → project `cmqvp2hg103h8ad0cjibfrrhw` → **Traces**.
2. Find the trace from the generation you just triggered.
3. Confirm:
   - The parent observation is named `resume`.
   - `input` contains `{ title, company, description }` for the target job.
   - `output` contains the composed résumé text.
   - `metadata.mechanical_checks` is present (JSON object with check results).
4. Under **Scores** for that trace, confirm two scores appear: `grounding` and `jd_relevance` (the judge may take a few seconds to run). Both should be integers 1–5.

If no scores appear after ~30 seconds, check that the evaluator filter matches (`resume` observation name), that the LLM connection is valid, and that `LANGFUSE_HOST` is the US endpoint.

### Step 4.3 — Score the résumé in the board (human score)

1. Back in the board, on the same résumé, open the **"★ Score résumé"** panel.
2. Enter grounding and JD-relevance scores (1–5) and an optional comment.
3. Submit. Confirm no error toast.
4. In Supabase, verify a row was inserted into `resume_scores` for this application.
5. In LangFuse → **Datasets** → `resume-golden`, confirm a new dataset item appears whose `expectedOutput` holds `{ grounding, jd_relevance, comment, overall }`.

### Step 4.4 — Run the calibration report

From `dashboard/` (with `LANGFUSE_*` and `DATABASE_URL` in `.env.local` and the migration already applied):

```bash
# calibration report (requires at least one human score + one judge score on the same trace)
node --experimental-strip-types scripts/calibrate-resume-judge.ts

# backfill mode (syncs any human-scored traces that are missing LangFuse dataset items)
node --experimental-strip-types scripts/calibrate-resume-judge.ts --sync
```

Confirm the report prints agreement statistics joining human scores to judge scores. If it errors with a missing table, the migration has not been applied (section 3).

> **Note:** The script uses relative `.ts` imports and runs under Node's `--experimental-strip-types` flag. Do not rewrite the command to use a bundler (tsx, esbuild, etc.).

### Step 4.5 — Regression harness (deferred / future)

Running the LangFuse evaluator on dataset runs (enabled in section 1.4) unlocks a regression harness where you can re-run the judge over the full golden dataset to detect rubric drift. The tooling for scheduling and reporting those runs is out of scope for this release.

---

## Artifact Checklist

| Artifact | Location | Status |
|---|---|---|
| Judge rubric (source of truth) | `dashboard/lib/rolefit/resumeJudgeRubric.ts` | in-repo |
| Judge rubric (running copy) | LangFuse UI → Evaluators → `resume-judge` | manual step 1.2 |
| Score name constants | `RESUME_JUDGE_GROUNDING_SCORE_NAME` = `"grounding"`, `RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME` = `"jd_relevance"` | `resumeJudgeRubric.ts` |
| Overall formula | `resumeOverall(g, jd) = 0.7*g + 0.3*jd` | `dashboard/lib/rolefit/resumeScore.ts` |
| Migration | `migrations/2026-07-02-resume-scores.sql` | in-repo |
| Calibration script | `dashboard/scripts/calibrate-resume-judge.ts` | in-repo |
| Human score action | `dashboard/app/actions/resumeScores.ts` | in-repo |
| Golden dataset name | `resume-golden` | `dashboard/lib/rolefit/resumeScore.ts::RESUME_GOLDEN_DATASET_NAME` |
