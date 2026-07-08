# Reasoning Effort + Curated Model Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the curated OpenRouter model list (add Sonnet 5 + GPT-5.5, prune aged/superseded entries) and add per-task, tier-gated "Reasoning effort" settings to the Profile page that flow into every résumé / cover-letter OpenRouter call.

**Architecture:** Two nullable text columns on `profiles` (NULL = Off, the default), a TS-only entitlement table + resolver in `lib/entitlements.ts`, a shared per-request resolver in `lib/rolefit/generationSettings.ts` used by all three generation routes, and the `reasoning` request field attached in the shared transport `callOpenRouterStructured`. Spec: `docs/superpowers/specs/2026-07-08-reasoning-effort-and-model-curation-design.md`.

**Tech Stack:** Next.js 16 App Router, TypeScript 6, vitest 4 (jsdom for `.test.tsx`), postgres.js, Supabase (Postgres + RLS), OpenRouter chat-completions API.

## Global Constraints

- **Never rewrite commits** (no amend/rebase/reset/force-push) — fix forward with a new commit (repo CLAUDE.md).
- Work on branch `feat/reasoning-effort-model-curation` in this worktree; run all commands from the worktree root (`/Users/andrew/Scripts/job-board/.claude/worktrees/refactored-tickling-dewdrop`).
- Dashboard commands run in `dashboard/`: tests `npm test` (vitest run, offline — no network in tests), types `npm run typecheck`.
- Python parity suite runs at repo root: `python3 -m pytest tests/test_entitlements_parity.py -q` (no venv).
- `tests/test_entitlements_parity.py` regex-parses `dashboard/lib/entitlements.ts` — do NOT change the shape of `CHEAP_MODEL` / `PREMIUM_MODEL` / the `ENTITLEMENTS` literal / `GRACE_MS` / `TRIAL_GRANTS_FULL_PLAN`; add new code AFTER the `PLAN_PRICE_USD` block.
- Never `as`-cast a jsonb/DB boundary value (dashboard/CLAUDE.md); the new columns are plain `text`, read via `SELECT *` into `ProfileRow`.
- OpenRouter **hard-fails** requests that carry `reasoning` (either form, even `{enabled:false}`) to some non-reasoning models (probed 2026-07-08: `openai/gpt-5.2-chat` errors; ministral tolerates). The `reasoning` field must be OMITTED when the catalog says the model lacks support; unknown support fails OPEN (attach).
- The exact reasoning body forms: `"off"` → `reasoning: { enabled: false }`; `"low" | "medium" | "high"` → `reasoning: { effort: "<level>" }`.
- Match surrounding style: inline style objects, hand-rolled validators (no zod), comment density like neighbors.
- Before each commit: `git diff --cached --stat` must show no unexpected binary (`Bin`) files — raw control bytes in test literals must be `\xNN` escapes.

---

### Task 1: Curated model list refresh + `reasoning` capability flag

**Files:**
- Modify: `dashboard/lib/openrouter.ts` (ORModel, CURATED_MODELS, getStructuredModels)
- Test: `dashboard/lib/openrouter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ORModel.reasoning?: boolean` (true = model supports the `reasoning` request param; `undefined` = unknown, e.g. curated-fallback entries). New `CURATED_MODELS` contents. Both used by Tasks 5 and 8.

- [ ] **Step 1: Write the failing tests**

In `dashboard/lib/openrouter.test.ts`:

1. Add `"reasoning"` to the first CATALOG fixture entry's `supported_parameters` so the fixture covers both flag values (line 16):

```ts
const CATALOG = {
  data: [
    { id: "b/model", name: "B Model", supported_parameters: ["structured_outputs", "tools", "reasoning"],
      pricing: { prompt: "0.000001", completion: "0.000002" } },
    { id: "a/model", name: "A Model", supported_parameters: ["structured_outputs"],
      pricing: { prompt: "0.000003", completion: "0.000004" } },
    { id: "c/notools", name: "C NoStructured", supported_parameters: ["tools"],
      pricing: { prompt: "0", completion: "0" } },
  ],
};
```

2. Update the existing `getStructuredModels` mapping test (its `toEqual` breaks once the field exists) and assert the flag both ways:

```ts
  test("keeps only structured_outputs models, mapped and sorted by name", async () => {
    const models = await getStructuredModels(fakeFetch(CATALOG));
    expect(models.map((m) => m.id)).toEqual(["a/model", "b/model"]);
    expect(models[0]).toEqual({
      id: "a/model", name: "A Model", reasoning: false,
      pricing: { prompt: "0.000003", completion: "0.000004" },
    });
    expect(models[1].reasoning).toBe(true);
  });
```

3. Replace the single `CURATED_MODELS is a non-empty list of ids` test with:

```ts
import { CHEAP_MODEL, PREMIUM_MODEL } from "@/lib/entitlements";
import { DEFAULT_RESUME_MODEL } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL } from "@/lib/rolefit/prefillClient";

describe("CURATED_MODELS curation policy (2026-07-08 refresh)", () => {
  test("contains the requested additions", () => {
    expect(CURATED_MODELS).toContain("anthropic/claude-sonnet-5");
    expect(CURATED_MODELS).toContain("openai/gpt-5.5");
  });

  test("aged-out and superseded models are gone", () => {
    for (const gone of [
      "google/gemini-2.5-flash-lite", "google/gemini-2.5-flash", "google/gemini-2.5-pro",
      "openai/gpt-4.1-nano", "openai/gpt-4o-mini", "openai/gpt-5-mini", "openai/gpt-4.1-mini",
      "meta-llama/llama-4-scout", "meta-llama/llama-4-maverick", "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-small-3.2-24b-instruct", "deepseek/deepseek-v3.2",
      "qwen/qwen3-8b", "qwen/qwen3-32b", "qwen/qwen3-30b-a3b-thinking-2507",
      "qwen/qwen3-235b-a22b-thinking-2507", "deepseek/deepseek-r1-0528",
    ]) {
      expect(CURATED_MODELS).not.toContain(gone);
    }
  });

  test("the default / entitlement model ids stay members (spec invariant)", () => {
    for (const id of [
      DEFAULT_MODEL_ID, CHEAP_MODEL, PREMIUM_MODEL,
      DEFAULT_RESUME_MODEL, DEFAULT_COVER_MODEL, DEFAULT_PREFILL_MODEL,
    ]) {
      expect(CURATED_MODELS).toContain(id);
    }
  });
});
```

Add `DEFAULT_MODEL_ID` to the existing `@/lib/openrouter` import in the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run (in `dashboard/`): `npm test -- lib/openrouter.test.ts`
Expected: FAIL — `reasoning: false` missing from mapped model; sonnet-5/gpt-5.5 not in list; removed models still present.

- [ ] **Step 3: Implement in `dashboard/lib/openrouter.ts`**

1. Extend `ORModel`:

```ts
export interface ORModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  // True when the model accepts the `reasoning` request param (catalog
  // supported_parameters). undefined = unknown (e.g. a curated id missing from
  // the catalog) — callers FAIL OPEN and attach the param; OpenRouter hard-fails
  // reasoning sent to some non-supporting providers, so false must mean OMIT.
  reasoning?: boolean;
}
```

2. Replace the `CURATED_MODELS` comment + list:

```ts
// Curated default suggestions shown before the user types. The search box filters
// the FULL live catalog, so this list is UX only — removal never invalidates a
// saved model. Membership policy (refresh by hand; verify against the live
// catalog at refresh time):
//   1. present in the OpenRouter catalog with structured_outputs support;
//   2. released within the last 12 months (catalog `created`);
//   3. not superseded by a same-provider successor available on OpenRouter
//      (replace 1:1 with the successor when one exists).
// The DEFAULT_MODEL_ID / CHEAP_MODEL / PREMIUM_MODEL / DEFAULT_RESUME_MODEL /
// DEFAULT_COVER_MODEL / DEFAULT_PREFILL_MODEL ids must stay members (tested).
// Refreshed and catalog-verified 2026-07-08; every entry also supports the
// `reasoning` param. Meta has no eligible entry (Llama 4 aged out; its successor
// is not on OpenRouter yet — re-check at next refresh).
export const CURATED_MODELS: string[] = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-5",
  "google/gemini-3.1-flash-lite",
  "google/gemini-3.5-flash",
  "openai/gpt-5.4-nano",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.5",
  "mistralai/mistral-medium-3-5",
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
  "qwen/qwen3.5-9b",
  "qwen/qwen3.5-27b",
  "qwen/qwen3.5-35b-a3b",
  "qwen/qwen3.5-397b-a17b",
  "moonshotai/kimi-k2-thinking",
  "google/gemini-3.1-pro-preview",
];
```

3. In `getStructuredModels`, add the flag to the `.map`:

```ts
      .map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.supported_parameters?.includes("reasoning") ?? false,
        pricing: { prompt: m.pricing?.prompt ?? "", completion: m.pricing?.completion ?? "" },
      }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `dashboard/`): `npm test -- lib/openrouter.test.ts`
Expected: PASS (all files in that suite).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/openrouter.ts dashboard/lib/openrouter.test.ts
git commit -m "feat(models): 2026-07-08 curated refresh (add sonnet-5/gpt-5.5, prune aged+superseded) + reasoning capability flag"
```

---

### Task 2: Entitlements — `ReasoningEffort` type, tier table, resolver, validator

**Files:**
- Modify: `dashboard/lib/entitlements.ts` (append after the `PLAN_LABEL` line, BEFORE `GRACE_MS` — or anywhere below `PLAN_PRICE_USD`; never inside/above the `ENTITLEMENTS` literal)
- Test: `dashboard/lib/entitlements.test.ts`

**Interfaces:**
- Consumes: existing `Plan` type.
- Produces (used by Tasks 3–8):
  - `export type ReasoningEffort = "off" | "low" | "medium" | "high"`
  - `export const REASONING_EFFORTS: Record<Plan, ReasoningEffort[]>`
  - `export function resolveReasoningEffort(plan: Plan | null, requested: ReasoningEffort): ReasoningEffort`
  - `export function validateReasoningEffort(raw: string, plan: Plan | null): { ok: true; value: "low" | "medium" | "high" | null } | { ok: false; reason: string }`

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/lib/entitlements.test.ts` (extend the import at the top with `REASONING_EFFORTS, resolveReasoningEffort, validateReasoningEffort`):

```ts
describe("resolveReasoningEffort", () => {
  test("pro keeps every level", () => {
    for (const e of ["off", "low", "medium", "high"] as const) {
      expect(resolveReasoningEffort("pro", e)).toBe(e);
    }
  });

  test("standard keeps off/low and CLAMPS medium/high down to low", () => {
    expect(resolveReasoningEffort("standard", "off")).toBe("off");
    expect(resolveReasoningEffort("standard", "low")).toBe("low");
    expect(resolveReasoningEffort("standard", "medium")).toBe("low");
    expect(resolveReasoningEffort("standard", "high")).toBe("low");
  });

  test("null plan always resolves to off", () => {
    expect(resolveReasoningEffort(null, "high")).toBe("off");
    expect(resolveReasoningEffort(null, "off")).toBe("off");
  });

  test("tier table matches the spec", () => {
    expect(REASONING_EFFORTS.standard).toEqual(["off", "low"]);
    expect(REASONING_EFFORTS.pro).toEqual(["off", "low", "medium", "high"]);
  });
});

describe("validateReasoningEffort", () => {
  test("empty and 'off' normalize to null (Off is the stored default)", () => {
    expect(validateReasoningEffort("", "pro")).toEqual({ ok: true, value: null });
    expect(validateReasoningEffort("off", "standard")).toEqual({ ok: true, value: null });
  });

  test("low is accepted on any plan (incl. null — call time clamps anyway)", () => {
    expect(validateReasoningEffort("low", "standard")).toEqual({ ok: true, value: "low" });
    expect(validateReasoningEffort("low", null)).toEqual({ ok: true, value: "low" });
  });

  test("medium/high require pro", () => {
    expect(validateReasoningEffort("medium", "pro")).toEqual({ ok: true, value: "medium" });
    expect(validateReasoningEffort("high", "pro")).toEqual({ ok: true, value: "high" });
    expect(validateReasoningEffort("medium", "standard")).toEqual({
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.",
    });
    expect(validateReasoningEffort("high", null)).toEqual({
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.",
    });
  });

  test("unknown values are rejected (hand-crafted form posts)", () => {
    expect(validateReasoningEffort("maximum", "pro")).toEqual({
      ok: false, reason: "unknown reasoning effort: maximum",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `dashboard/`): `npm test -- lib/entitlements.test.ts`
Expected: FAIL — the new exports don't exist.

- [ ] **Step 3: Implement in `dashboard/lib/entitlements.ts`**

Insert directly after the `PLAN_LABEL` export (line 42):

```ts
// ── Reasoning effort (résumé / cover-letter generation) ─────────────────────
// TS-ONLY, intentionally NOT mirrored in reviewer/entitlements.py: generation is
// dashboard-only, the reviewer never reads these (same precedent as
// PLAN_PRICE_USD). Kept OUTSIDE the ENTITLEMENTS literal so the parity test's
// regexes never see it. Compile-time constants, not part of the tierConfig DB
// overlay — effort tiers are product shape, not a tunable money cap.
export type ReasoningEffort = "off" | "low" | "medium" | "high";

const EFFORT_ORDER: ReasoningEffort[] = ["off", "low", "medium", "high"];

export const REASONING_EFFORTS: Record<Plan, ReasoningEffort[]> = {
  standard: ["off", "low"],
  pro: ["off", "low", "medium", "high"],
};

/**
 * Call-time clamp (mirrors resolveStage2Model's hard fallback): the requested
 * effort if the plan grants it, otherwise the highest granted level below it —
 * so a Pro→Standard downgrade with a saved "high" degrades to "low", not "off".
 * null plan → "off" (the routes' 402 gate fires before this ever matters).
 */
export function resolveReasoningEffort(
  plan: Plan | null,
  requested: ReasoningEffort,
): ReasoningEffort {
  if (!plan) return "off";
  const allowed = REASONING_EFFORTS[plan];
  for (let i = EFFORT_ORDER.indexOf(requested); i > 0; i--) {
    if (allowed.includes(EFFORT_ORDER[i])) return EFFORT_ORDER[i];
  }
  return "off";
}

export type ReasoningEffortValidation =
  | { ok: true; value: "low" | "medium" | "high" | null }
  | { ok: false; reason: string };

/**
 * Save-time gate for the profile form (mirrors the stage-2 model gate): ""/"off"
 * normalize to null (Off, the stored default), low passes on any plan, medium/high
 * require Pro, anything else (hand-crafted post) is rejected.
 */
export function validateReasoningEffort(
  raw: string,
  plan: Plan | null,
): ReasoningEffortValidation {
  const v = raw.trim().toLowerCase();
  if (!v || v === "off") return { ok: true, value: null };
  if (v !== "low" && v !== "medium" && v !== "high") {
    return { ok: false, reason: `unknown reasoning effort: ${raw}` };
  }
  if (v === "low") return { ok: true, value: "low" };
  if (plan !== "pro") {
    return { ok: false, reason: "Medium and High reasoning effort require the Pro plan." };
  }
  return { ok: true, value: v };
}
```

- [ ] **Step 4: Run tests + the Python parity suite**

Run (in `dashboard/`): `npm test -- lib/entitlements.test.ts` — Expected: PASS.
Run (at repo root): `python3 -m pytest tests/test_entitlements_parity.py -q` — Expected: all pass (the regexes still match; nothing inside `ENTITLEMENTS` changed).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/entitlements.ts dashboard/lib/entitlements.test.ts
git commit -m "feat(entitlements): tier-gated ReasoningEffort table, call-time clamp, save-time validator"
```

---

### Task 3: Transport — attach the `reasoning` request field

**Files:**
- Modify: `dashboard/lib/rolefit/openrouterClient.ts`
- Test: `dashboard/lib/rolefit/openrouterClient.test.ts`

**Interfaces:**
- Consumes: `ReasoningEffort` from Task 2.
- Produces: `callOpenRouterStructured` accepts `reasoningEffort?: ReasoningEffort | null`. `null`/`undefined` → NO `reasoning` key in the POST body; `"off"` → `reasoning: { enabled: false }`; level → `reasoning: { effort: level }`. Used by Tasks 4 and 6.

- [ ] **Step 1: Write the failing tests**

Append inside the `transport hardening` describe block of `dashboard/lib/rolefit/openrouterClient.test.ts` (the `fakeFetch`/`baseArgs` helpers are already in scope):

```ts
  test("omits the reasoning field entirely when reasoningEffort is not given", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) } }] });
    await callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect("reasoning" in body).toBe(false);
  });

  test("omits the reasoning field when reasoningEffort is null (model lacks support)", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) } }] });
    await callOpenRouterStructured({ ...baseArgs, reasoningEffort: null, fetchImpl: f, parse: (r) => r });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect("reasoning" in body).toBe(false);
  });

  test("off sends reasoning: { enabled: false }", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) } }] });
    await callOpenRouterStructured({ ...baseArgs, reasoningEffort: "off", fetchImpl: f, parse: (r) => r });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect(body.reasoning).toEqual({ enabled: false });
  });

  test.each(["low", "medium", "high"] as const)("%s sends reasoning: { effort }", async (level) => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) } }] });
    await callOpenRouterStructured({ ...baseArgs, reasoningEffort: level, fetchImpl: f, parse: (r) => r });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect(body.reasoning).toEqual({ effort: level });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `dashboard/`): `npm test -- lib/rolefit/openrouterClient.test.ts`
Expected: the four new tests FAIL (TS error on the unknown arg / missing body field); existing tests PASS.

- [ ] **Step 3: Implement in `dashboard/lib/rolefit/openrouterClient.ts`**

1. Add the import at the top:

```ts
import type { ReasoningEffort } from "@/lib/entitlements";
```

2. Add the arg to `callOpenRouterStructured`'s parameter object (after `maxTokens: number;`):

```ts
  // Reasoning control (OpenRouter unified param). "off" → { enabled: false } (the
  // fix for hybrid models burning max_tokens on thinking); a level → { effort }.
  // null/undefined → the field is OMITTED — required for models without reasoning
  // support, where OpenRouter hard-fails ANY reasoning field (probed 2026-07-08).
  reasoningEffort?: ReasoningEffort | null;
```

3. Extend the request body (the `const body = JSON.stringify({...})` block):

```ts
  const body = JSON.stringify({
    model: args.model,
    max_tokens: args.maxTokens,
    ...(args.reasoningEffort == null
      ? {}
      : {
          reasoning: args.reasoningEffort === "off"
            ? { enabled: false }
            : { effort: args.reasoningEffort },
        }),
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: args.responseFormat,
    usage: { include: true },
  });
```

4. Record it on the Langfuse generation span (rollout verification reads this). In the `startObservation` call, extend the second argument:

```ts
        { model: args.model,
          input: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
          metadata: { reasoning_effort: args.reasoningEffort ?? "omitted" } },
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `dashboard/`): `npm test -- lib/rolefit/openrouterClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/openrouterClient.ts dashboard/lib/rolefit/openrouterClient.test.ts
git commit -m "feat(transport): reasoningEffort arg -> OpenRouter reasoning field (off/effort/omit)"
```

---

### Task 4: Migration + schema + ProfileRow + upsert plumbing

No unit test carries this task — it is schema + typed plumbing; `npm run typecheck` is the gate (the compiler forces every `upsertProfile` caller to supply the new fields, which is exactly the drift-protection we want). Behavior tests land with Tasks 6–8.

**Files:**
- Create: `migrations/2026-07-08-reasoning-effort.sql`
- Modify: `schema.sql` (profiles CREATE TABLE, after `model_cover`)
- Modify: `dashboard/lib/types.ts` (ProfileRow, after `model_cover`)
- Modify: `dashboard/lib/queries.ts` (upsertProfile: data type, INSERT columns, VALUES, EXCLUDED)
- Modify: `dashboard/app/actions/profile.ts` (saveProfileResume passthrough)
- Modify: `dashboard/app/actions/onboarding.ts` (nulls at onboarding)
- Modify: `dashboard/app/profile/page.tsx` (saveProfile passthrough — placeholder values here; the real form fields land in Task 8)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 6–8): `ProfileRow.reasoning_effort_resume: string | null`, `ProfileRow.reasoning_effort_cover: string | null` (values: `'low' | 'medium' | 'high'` or NULL = Off); `upsertProfile` data fields `reasoningEffortResume: string | null`, `reasoningEffortCover: string | null`.

- [ ] **Step 1: Write the migration**

Create `migrations/2026-07-08-reasoning-effort.sql`:

```sql
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
```

(CHECK constraints pass on NULL by SQL semantics — NULL stays the Off default. Columns on the existing RLS'd table inherit its policies; `getProfile` uses `SELECT *`, and account export rides the profile row, so nothing else needs a column list change.)

- [ ] **Step 2: Mirror it in `schema.sql`**

In the `CREATE TABLE profiles` block, directly after the `model_cover` line:

```sql
  model_cover       TEXT,                     -- OpenRouter model id; NULL = default
  -- Reasoning effort for generation ('low'|'medium'|'high'); NULL = off (default).
  -- medium/high are Pro-gated (dashboard/lib/entitlements.ts, TS-only).
  reasoning_effort_resume TEXT CHECK (reasoning_effort_resume IN ('low', 'medium', 'high')),
  reasoning_effort_cover  TEXT CHECK (reasoning_effort_cover  IN ('low', 'medium', 'high')),
```

- [ ] **Step 3: Add the fields to `ProfileRow`** (`dashboard/lib/types.ts`, after `model_cover: string | null;`):

```ts
  model_cover: string | null;
  // Reasoning effort for generation ('low'|'medium'|'high'); NULL = off (default).
  reasoning_effort_resume: string | null;
  reasoning_effort_cover: string | null;
```

- [ ] **Step 4: Thread through `upsertProfile`** (`dashboard/lib/queries.ts`):

In the `data` parameter type, after `modelCover: string | null;`:

```ts
    modelCover: string | null;
    reasoningEffortResume: string | null;
    reasoningEffortCover: string | null;
```

In the INSERT column list, change the line
`screening_answers, model_cover,` to:

```sql
                          screening_answers, model_cover,
                          reasoning_effort_resume, reasoning_effort_cover,
```

In VALUES, change `${JSON.stringify(data.screeningAnswers)}::jsonb, ${data.modelCover},` to:

```ts
            ${JSON.stringify(data.screeningAnswers)}::jsonb, ${data.modelCover},
            ${data.reasoningEffortResume}, ${data.reasoningEffortCover},
```

In the `ON CONFLICT ... DO UPDATE SET` list, after the `model_cover` line:

```sql
      model_cover             = EXCLUDED.model_cover,
      reasoning_effort_resume = EXCLUDED.reasoning_effort_resume,
      reasoning_effort_cover  = EXCLUDED.reasoning_effort_cover,
```

- [ ] **Step 5: Update the three callers** (the compiler will point at all of them; these are the exact edits):

`dashboard/app/actions/profile.ts` — `saveProfileResume` must PRESERVE the settings (the modal doesn't expose them); after `modelCover: existing?.model_cover ?? null,`:

```ts
    modelCover: existing?.model_cover ?? null,
    reasoningEffortResume: existing?.reasoning_effort_resume ?? null,
    reasoningEffortCover: existing?.reasoning_effort_cover ?? null,
```

`dashboard/app/actions/onboarding.ts` — nulls at onboarding (edited later on /profile); extend the existing null-block line:

```ts
      modelStage1: null, modelStage2: null, modelResume: null, modelCompany: null,
      modelCover: null, companyInstructions: null,
      reasoningEffortResume: null, reasoningEffortCover: null,
```

`dashboard/app/profile/page.tsx` — in `saveProfile`'s `upsertProfile` call, after `modelCover: cl.value,` add (Task 8 replaces these with the validated form values; passing null until the form exists would WIPE nothing because the columns don't exist for any user yet — but preserve-from-existing is still the correct interim so a re-save after Task 8 ships never regresses):

```ts
      modelCover: cl.value,
      reasoningEffortResume: existing?.reasoning_effort_resume ?? null,
      reasoningEffortCover: existing?.reasoning_effort_cover ?? null,
```

- [ ] **Step 6: Typecheck + full dashboard suite**

Run (in `dashboard/`): `npm run typecheck` — Expected: clean (if it lists another `upsertProfile` caller this plan missed, apply the same preserve-from-existing pattern there).
Run (in `dashboard/`): `npm test` — Expected: PASS (no behavior change yet).

- [ ] **Step 7: Commit**

```bash
git add migrations/2026-07-08-reasoning-effort.sql schema.sql dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/app/actions/profile.ts dashboard/app/actions/onboarding.ts dashboard/app/profile/page.tsx
git commit -m "feat(db): profiles.reasoning_effort_resume/cover columns + upsert plumbing"
```

---

### Task 5: Shared per-request resolver `resolveReasoningSetting`

**Files:**
- Create: `dashboard/lib/rolefit/generationSettings.ts`
- Test: `dashboard/lib/rolefit/generationSettings.test.ts`

**Interfaces:**
- Consumes: `resolveReasoningEffort`, `Plan`, `ReasoningEffort` (Task 2); `ORModel` (Task 1).
- Produces (used by Task 7): `resolveReasoningSetting(plan: Plan | null, saved: string | null, model: string, catalog: ORModel[]): ReasoningEffort | null` — `null` means OMIT the param.

- [ ] **Step 1: Write the failing tests**

Create `dashboard/lib/rolefit/generationSettings.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
import type { ORModel } from "@/lib/openrouter";

const or = (id: string, reasoning?: boolean): ORModel =>
  ({ id, name: id, reasoning, pricing: { prompt: "", completion: "" } });

const CATALOG: ORModel[] = [
  or("deepseek/deepseek-v4-flash", true),
  or("openai/gpt-5.2-chat", false),
];

describe("resolveReasoningSetting", () => {
  test("NULL saved value means off (the default) on a reasoning-capable model", () => {
    expect(resolveReasoningSetting("standard", null, "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });

  test("saved level passes through when the plan grants it", () => {
    expect(resolveReasoningSetting("pro", "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("high");
    expect(resolveReasoningSetting("standard", "low", "deepseek/deepseek-v4-flash", CATALOG)).toBe("low");
  });

  test("plan clamp: standard with a saved 'high' (pro downgrade) degrades to low", () => {
    expect(resolveReasoningSetting("standard", "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("low");
  });

  test("null plan resolves to off", () => {
    expect(resolveReasoningSetting(null, "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });

  test("model without reasoning support -> null (OMIT the field), whatever is saved", () => {
    expect(resolveReasoningSetting("pro", "high", "openai/gpt-5.2-chat", CATALOG)).toBeNull();
    expect(resolveReasoningSetting("standard", null, "openai/gpt-5.2-chat", CATALOG)).toBeNull();
  });

  test("fails OPEN when support is unknown: model missing from catalog or catalog empty", () => {
    expect(resolveReasoningSetting("pro", "medium", "vanished/model", CATALOG)).toBe("medium");
    expect(resolveReasoningSetting("standard", null, "deepseek/deepseek-v4-flash", [])).toBe("off");
  });

  test("garbage saved value (defensive) is treated as off", () => {
    expect(resolveReasoningSetting("pro", "maximum", "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `dashboard/`): `npm test -- lib/rolefit/generationSettings.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `dashboard/lib/rolefit/generationSettings.ts`:

```ts
// dashboard/lib/rolefit/generationSettings.ts
//
// Per-request reasoning-effort resolution shared by the three generation routes
// (/api/resume, /api/cover-letter, /api/application/prepare) so the plan clamp
// and the model-capability check can never drift between them.
//
// Returns the effort to send, or null to OMIT the `reasoning` field entirely.
// Omission is REQUIRED for models without reasoning support: OpenRouter
// hard-fails a request carrying `reasoning` (even {enabled:false}) to a model
// whose provider can't take it (probed live 2026-07-08, openai/gpt-5.2-chat).
// Unknown support — model missing from the catalog, or the catalog fetch failed
// ([]) — fails OPEN (attach), matching validateModelId's save-time posture.
import { resolveReasoningEffort, type Plan, type ReasoningEffort } from "@/lib/entitlements";
import type { ORModel } from "@/lib/openrouter";

export function resolveReasoningSetting(
  plan: Plan | null,
  saved: string | null,
  model: string,
  catalog: ORModel[],
): ReasoningEffort | null {
  const requested: ReasoningEffort =
    saved === "low" || saved === "medium" || saved === "high" ? saved : "off";
  const effort = resolveReasoningEffort(plan, requested);
  const entry = catalog.find((m) => m.id === model);
  if (entry?.reasoning === false) return null;
  return effort;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `dashboard/`): `npm test -- lib/rolefit/generationSettings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/generationSettings.ts dashboard/lib/rolefit/generationSettings.test.ts
git commit -m "feat(generation): shared resolveReasoningSetting (plan clamp + capability omit, fail-open)"
```

---

### Task 6: Client passthrough (résumé, cover letter) + prefill hardcoded Off

**Files:**
- Modify: `dashboard/lib/rolefit/resumeClient.ts`, `dashboard/lib/rolefit/coverLetterClient.ts`, `dashboard/lib/rolefit/prefillClient.ts`
- Test: `dashboard/lib/rolefit/resumeClient.test.ts`, `dashboard/lib/rolefit/coverLetterClient.test.ts`, `dashboard/lib/rolefit/prefillClient.test.ts`

**Interfaces:**
- Consumes: transport `reasoningEffort` (Task 3), `ReasoningEffort` type (Task 2).
- Produces (used by Task 7): `generateResume` / `generateCoverLetter` accept optional `reasoningEffort?: ReasoningEffort | null` and forward it verbatim. `generatePrefilledAnswers` takes NO new arg — it always sends `"off"` (bounded 45s extraction leg; reasoning only risks the timeout; `DEFAULT_PREFILL_MODEL` is reasoning-capable so `{enabled:false}` is safe).

- [ ] **Step 1: Write the failing tests**

Append to the main describe block of `dashboard/lib/rolefit/resumeClient.test.ts` (reuses its `args`/`fakeFetch`/`TAILORED`):

```ts
  test("forwards reasoningEffort to the transport body", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(TAILORED) } }] });
    await generateResume({ ...args, fetchImpl: f, reasoningEffort: "high" });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect(body.reasoning).toEqual({ effort: "high" });
  });

  test("omits reasoning when reasoningEffort is not given (unchanged default)", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(TAILORED) } }] });
    await generateResume({ ...args, fetchImpl: f });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect("reasoning" in body).toBe(false);
  });
```

Append the equivalent pair to `dashboard/lib/rolefit/coverLetterClient.test.ts`, using that file's existing success-payload helper and `generateCoverLetter` args (assert `body.reasoning` equals `{ effort: "high" }` when `reasoningEffort: "high"` is passed, and `"reasoning" in body` is false when absent).

Append to `dashboard/lib/rolefit/prefillClient.test.ts`, using that file's existing helpers for a successful LLM call (a question set that does NOT fully resolve from EEO answers, so the transport is hit):

```ts
  test("always disables reasoning (bounded extraction leg)", async () => {
    // Reuse the file's existing successful-call fixture pattern for fetch + questions.
    const f = /* the file's fake fetch returning a valid answers payload */;
    await generatePrefilledAnswers({ /* the file's existing base args */, fetchImpl: f });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect(body.reasoning).toEqual({ enabled: false });
  });
```

(Concrete fixture names live in that test file — mirror its first happy-path test verbatim, only adding the body assertion. If the file has no happy-path LLM test, build args exactly like its EEO-passthrough test but with one free-text question so `remainingQuestions.length > 0`.)

- [ ] **Step 2: Run tests to verify they fail**

Run (in `dashboard/`): `npm test -- lib/rolefit/resumeClient.test.ts lib/rolefit/coverLetterClient.test.ts lib/rolefit/prefillClient.test.ts`
Expected: new tests FAIL (unknown arg / missing body field); existing tests PASS.

- [ ] **Step 3: Implement**

`resumeClient.ts` — add to the import from `@/lib/rolefit/openrouterClient` nothing; add a type import and the arg + passthrough:

```ts
import type { ReasoningEffort } from "@/lib/entitlements";
```

In `generateResume`'s args type, after `apiKey: string;`:

```ts
  reasoningEffort?: ReasoningEffort | null;
```

In its `callOpenRouterStructured({...})` call, after `maxTokens: REASONING_SAFE_MAX_TOKENS,`:

```ts
    reasoningEffort: args.reasoningEffort,
```

`coverLetterClient.ts` — identical three edits (`generateCoverLetter`).

`prefillClient.ts` — no signature change; in its `callOpenRouterStructured({...})` call, after `maxTokens: REASONING_SAFE_MAX_TOKENS,`:

```ts
    // Always off: this leg is bounded to 45s by the prepare route and reasoning
    // only risks the deadline; DEFAULT_PREFILL_MODEL supports the param, so
    // {enabled:false} is safe (never omit — the model is fixed, not user-picked).
    reasoningEffort: "off",
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `dashboard/`): `npm test -- lib/rolefit/resumeClient.test.ts lib/rolefit/coverLetterClient.test.ts lib/rolefit/prefillClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/resumeClient.ts dashboard/lib/rolefit/coverLetterClient.ts dashboard/lib/rolefit/prefillClient.ts dashboard/lib/rolefit/resumeClient.test.ts dashboard/lib/rolefit/coverLetterClient.test.ts dashboard/lib/rolefit/prefillClient.test.ts
git commit -m "feat(generation): thread reasoningEffort through resume/cover clients; prefill always off"
```

---

### Task 7: Wire the three generation routes

**Files:**
- Modify: `dashboard/app/api/resume/route.ts`, `dashboard/app/api/cover-letter/route.ts`, `dashboard/app/api/application/prepare/route.ts`
- Test: `dashboard/app/api/resume/route.test.ts`, `dashboard/app/api/cover-letter/route.test.ts`, `dashboard/app/api/application/prepare/route.test.ts`

**Interfaces:**
- Consumes: `resolveReasoningSetting` (Task 5), `getViewerPlan` (`@/lib/subscriptions`, existing), `getStructuredModels` (existing), ProfileRow fields (Task 4).
- Produces: user-visible behavior — generation calls carry the resolved effort.

- [ ] **Step 1: Update the route tests' module mocks (they will otherwise fail on the new imports)**

In EACH of the three route test files, add alongside the existing `vi.mock` block:

```ts
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: async () => "pro" }));
vi.mock("@/lib/openrouter", () => ({ getStructuredModels: async () => [] }));
```

(Empty catalog = fail-open attach; plan "pro" = no clamp — existing assertions on `generateResume`/`generateCoverLetter` call args stay valid except they now ALSO receive `reasoningEffort`.)

Then add one behavior test to `dashboard/app/api/resume/route.test.ts` (mirror the file's existing happy-path 202 test setup — same mock returns, same `flushBackground()` drain — with the profile fixture extended):

```ts
  test("passes the resolved reasoning effort to generateResume", async () => {
    // Arrange exactly like the happy-path 202 test, but with an effort saved:
    mocks.getProfile.mockResolvedValue({
      ...PROFILE_FIXTURE, // the file's existing minimal ProfileRow fixture
      reasoning_effort_resume: "high",
      reasoning_effort_cover: null,
    });
    // ...same claims/job/gate/tracking mocks as the happy-path test...
    const res = await POST(makeRequest({ jobId: "j1" }));
    expect(res.status).toBe(202);
    await flushBackground();
    expect(mocks.generateResume).toHaveBeenCalledWith(
      expect.objectContaining({ reasoningEffort: "high" }),
    );
  });
```

(The file's real fixture/helper names differ — reuse whatever its happy-path test uses; the only NEW lines are the `reasoning_effort_*` fields on the profile mock and the `expect.objectContaining({ reasoningEffort: "high" })` assertion.) Add the symmetric test to the cover-letter route test (`reasoning_effort_cover: "medium"` → `generateCoverLetter` receives `reasoningEffort: "medium"`). For the prepare route test, extend its profile fixture with both fields (`"low"` / `"low"`) and assert both `generateResume` and `generateCoverLetter` received `reasoningEffort: "low"`.

NOTE: any existing route test whose profile fixture is a plain object literal typed as `ProfileRow` will now fail typecheck — add `reasoning_effort_resume: null, reasoning_effort_cover: null` to those fixtures.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run (in `dashboard/`): `npm test -- app/api/resume/route.test.ts app/api/cover-letter/route.test.ts app/api/application/prepare/route.test.ts`
Expected: new behavior tests FAIL (`generateResume` called WITHOUT `reasoningEffort`); pre-existing tests PASS (mocks added).

- [ ] **Step 3: Wire `/api/resume`** (`dashboard/app/api/resume/route.ts`)

Add imports:

```ts
import { getViewerPlan } from "@/lib/subscriptions";
import { getStructuredModels } from "@/lib/openrouter";
import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
```

After the `apiKey` check / `getResumeSource` line and BEFORE the gate, resolve once (sync section — `claims` is in scope):

```ts
  const model = profile.model_resume ?? DEFAULT_RESUME_MODEL;
  // Plan + catalog resolve the reasoning setting: clamp to the tier, and OMIT the
  // param (null) for models that can't take it. getStructuredModels is 1h-cached;
  // [] (fetch failure) fails open. getViewerPlan is one extra query per generate.
  const [plan, catalog] = await Promise.all([
    getViewerPlan(userId, claims.email),
    getStructuredModels(),
  ]);
  const reasoningEffort = resolveReasoningSetting(
    plan, profile.reasoning_effort_resume, model, catalog,
  );
```

In the `run` callback replace `model: profile.model_resume ?? DEFAULT_RESUME_MODEL,` with:

```ts
        model,
        reasoningEffort,
```

and in the catch's `console.error` replace `model: profile.model_resume ?? DEFAULT_RESUME_MODEL,` with `model,`.

- [ ] **Step 4: Wire `/api/cover-letter`** — same three imports; same resolve block with `profile.model_cover ?? DEFAULT_COVER_MODEL` and `profile.reasoning_effort_cover`; pass `model, reasoningEffort` into `generateCoverLetter` and use `model` in the failure log.

- [ ] **Step 5: Wire `/api/application/prepare`** — same three imports; after `const apiKey` check add:

```ts
  const resumeModel = profile.model_resume ?? DEFAULT_RESUME_MODEL;
  const coverModel = profile.model_cover ?? DEFAULT_COVER_MODEL;
  const [plan, catalog] = await Promise.all([
    getViewerPlan(userId, claims.email),
    getStructuredModels(),
  ]);
  const resumeReasoning = resolveReasoningSetting(
    plan, profile.reasoning_effort_resume, resumeModel, catalog,
  );
  const coverReasoning = resolveReasoningSetting(
    plan, profile.reasoning_effort_cover, coverModel, catalog,
  );
```

In the résumé leg pass `model: resumeModel, reasoningEffort: resumeReasoning,` (replacing the inline `??` expression); in the cover leg pass `model: coverModel, reasoningEffort: coverReasoning,`. (The prefill leg is untouched — Task 6 hardcoded it.)

- [ ] **Step 6: Run tests to verify they pass**

Run (in `dashboard/`): `npm test -- app/api/resume/route.test.ts app/api/cover-letter/route.test.ts app/api/application/prepare/route.test.ts` — Expected: PASS.
Run (in `dashboard/`): `npm run typecheck` — Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/api/resume/route.ts dashboard/app/api/cover-letter/route.ts dashboard/app/api/application/prepare/route.ts dashboard/app/api/resume/route.test.ts dashboard/app/api/cover-letter/route.test.ts dashboard/app/api/application/prepare/route.test.ts
git commit -m "feat(routes): resolve per-task reasoning effort (plan clamp + capability omit) in all three generation routes"
```

---

### Task 8: Profile page — ReasoningEffortSelect + save-time gate

**Files:**
- Create: `dashboard/components/ReasoningEffortSelect.tsx`
- Test: `dashboard/components/ReasoningEffortSelect.test.tsx` (jsdom — `.test.tsx` files run under jsdom via environmentMatchGlobs)
- Modify: `dashboard/app/profile/page.tsx` (save action + form)

**Interfaces:**
- Consumes: `validateReasoningEffort` (Task 2); `isPro` + `plan` already computed in the page; upsert fields (Task 4).
- Produces: form fields `reasoning_effort_resume`, `reasoning_effort_cover` (values `"" | "low" | "medium" | "high"`; `""` = Off).

- [ ] **Step 1: Write the failing component test**

Create `dashboard/components/ReasoningEffortSelect.test.tsx`:

```tsx
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReasoningEffortSelect } from "@/components/ReasoningEffortSelect";

describe("ReasoningEffortSelect", () => {
  test("renders all four levels with Off selected by default", () => {
    render(<ReasoningEffortSelect label="Résumé reasoning effort"
      name="reasoning_effort_resume" defaultValue={null} isPro={true} />);
    const select = screen.getByLabelText("Résumé reasoning effort") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "low", "medium", "high"]);
    // Pro sees no disabled options and no "(Pro)" suffixes.
    expect(Array.from(select.options).every((o) => !o.disabled)).toBe(true);
    expect(screen.queryByText(/\(Pro\)/)).toBeNull();
  });

  test("non-Pro: medium/high are disabled and labelled (Pro)", () => {
    render(<ReasoningEffortSelect label="Cover letter reasoning effort"
      name="reasoning_effort_cover" defaultValue={null} isPro={false} />);
    const select = screen.getByLabelText("Cover letter reasoning effort") as HTMLSelectElement;
    const byValue = Object.fromEntries(Array.from(select.options).map((o) => [o.value, o]));
    expect(byValue[""].disabled).toBe(false);
    expect(byValue["low"].disabled).toBe(false);
    expect(byValue["medium"].disabled).toBe(true);
    expect(byValue["high"].disabled).toBe(true);
    expect(byValue["medium"].textContent).toContain("(Pro)");
  });

  test("a saved level is preselected", () => {
    render(<ReasoningEffortSelect label="Résumé reasoning effort"
      name="reasoning_effort_resume" defaultValue="high" isPro={true} />);
    expect((screen.getByLabelText("Résumé reasoning effort") as HTMLSelectElement).value).toBe("high");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `dashboard/`): `npm test -- components/ReasoningEffortSelect.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

Create `dashboard/components/ReasoningEffortSelect.tsx` (server-renderable — no client hooks; styling mirrors ModelPicker's label/input tokens; themed `background` per the naked-input gotcha):

```tsx
// Native tier-aware <select> for the per-task reasoning-effort setting (Profile).
// "" = Off (the default; stored as NULL). Medium/High render disabled with a
// "(Pro)" suffix on non-Pro plans — the save action re-validates server-side
// (validateReasoningEffort), so the disabled attributes are UX, not the gate.
const LEVELS: { value: "" | "low" | "medium" | "high"; label: string; pro: boolean }[] = [
  { value: "", label: "Off (default)", pro: false },
  { value: "low", label: "Low", pro: false },
  { value: "medium", label: "Medium", pro: true },
  { value: "high", label: "High", pro: true },
];

export function ReasoningEffortSelect({
  label, name, defaultValue, isPro,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  isPro: boolean;
}) {
  const selectId = `reasoning-effort-${name}`;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor={selectId} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      <span style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", marginTop: "3px" }}>
        {isPro
          ? "How hard the model thinks before writing. Off is cheapest and fastest."
          : "Off or Low on Standard — Medium and High need Pro."}
      </span>
      <select
        id={selectId}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rf-focusable"
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          padding: "11px 12px",
          fontSize: "13px",
          color: "var(--text-primary)",
          background: "var(--bg-surface)",
          fontFamily: "inherit",
        }}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value} disabled={l.pro && !isPro}>
            {l.label + (l.pro && !isPro ? " (Pro)" : "")}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run (in `dashboard/`): `npm test -- components/ReasoningEffortSelect.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the Profile page** (`dashboard/app/profile/page.tsx`)

1. Imports: add `validateReasoningEffort` to the `@/lib/entitlements` import; add

```ts
import { ReasoningEffortSelect } from "@/components/ReasoningEffortSelect";
```

2. In `saveProfile`, the plan is fetched at the stage-2 gate (`const plan = await getViewerPlan(userId, claims.email);`). Directly AFTER that gate's `if (s2.value && ...)` block, add:

```ts
    // Reasoning-effort gate (mirrors the stage-2 model gate): medium/high are
    // Pro-only; ""/"off" normalize to null = Off. Call time clamps again, so a
    // later downgrade degrades gracefully rather than erroring generations.
    const er = validateReasoningEffort(String(formData.get("reasoning_effort_resume") ?? ""), plan);
    if (!er.ok) return { error: er.reason };
    const ec = validateReasoningEffort(String(formData.get("reasoning_effort_cover") ?? ""), plan);
    if (!ec.ok) return { error: ec.reason };
```

3. In the `upsertProfile` call, replace the Task-4 interim lines with the validated values:

```ts
      reasoningEffortResume: er.value,
      reasoningEffortCover: ec.value,
```

4. In the form, directly under the résumé ModelPicker (after its `/>`):

```tsx
            <ReasoningEffortSelect
              label="Résumé reasoning effort"
              name="reasoning_effort_resume"
              defaultValue={profile?.reasoning_effort_resume ?? null}
              isPro={isPro} />
```

and under the cover-letter ModelPicker:

```tsx
            <ReasoningEffortSelect
              label="Cover letter reasoning effort"
              name="reasoning_effort_cover"
              defaultValue={profile?.reasoning_effort_cover ?? null}
              isPro={isPro} />
```

(`isPro` already exists in the page — it feeds the stage-2 picker copy.)

- [ ] **Step 6: Typecheck + full suite**

Run (in `dashboard/`): `npm run typecheck` — Expected: clean.
Run (in `dashboard/`): `npm test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/ReasoningEffortSelect.tsx dashboard/components/ReasoningEffortSelect.test.tsx dashboard/app/profile/page.tsx
git commit -m "feat(profile): per-task reasoning-effort selects with Pro gating (save-time validated)"
```

---

### Task 9: Billing copy + full verification

**Files:**
- Modify: `dashboard/app/billing/page.tsx` (TierCard `<ul>`)

**Interfaces:** none new — copy + verification only.

- [ ] **Step 1: Add the tier copy**

In `TierCard`'s `<ul>`, after the `<li>{ent.monthlyCover} cover letters / mo</li>` line:

```tsx
        <li>
          {plan === "pro"
            ? "Reasoning effort up to High on résumé / cover-letter generation"
            : "Reasoning effort Off / Low on generation"}
        </li>
```

- [ ] **Step 2: Full verification battery**

Run and confirm ALL of:

1. (in `dashboard/`) `npm test` — every suite PASS.
2. (in `dashboard/`) `npm run typecheck` — clean.
3. (in `dashboard/`) `npm run build` — compiles (catches server/client component misuse).
4. (repo root) `python3 -m pytest tests/test_entitlements_parity.py -q` — PASS.
5. `git diff origin/main --stat -- '*.test.*'` — inspect for unexpected `Bin` entries (raw control bytes in generated tests); convert any to `\xNN` escapes before proceeding.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/billing/page.tsx
git commit -m "feat(billing): reasoning-effort line in tier cards"
```

- [ ] **Step 4: Report**

Summarize: list of commits, test counts, and the two rollout gates that remain OUTSIDE this plan's scope (do NOT do them as part of a task): apply `migrations/2026-07-08-reasoning-effort.sql` to Supabase BEFORE any merge to main (push-to-main auto-deploys Vercel), then post-deploy prod smoke per the spec's Rollout section (Profile dropdowns render; a Pro-effort generation shows `reasoning_effort` in the Langfuse generation span metadata on us.cloud.langfuse.com; a default-Off generation succeeds on deepseek-v4-flash).

---

## Plan Self-Review (done at write time)

- **Spec coverage:** curated add/prune/policy → Task 1; effort semantics + storage → Tasks 3/4; tier gating (table, save gate, call-time clamp) → Tasks 2/5/8; capability omission (REQUIRED per probe) → Tasks 3/5/7; UI → Task 8; plumbing incl. prepare route + prefill-off → Tasks 6/7; billing copy → Task 9; testing list → embedded per task; rollout ordering → Task 9 report (execution deliberately excluded).
- **Type consistency:** `ReasoningEffort` defined once (Task 2), consumed by Tasks 3/5/6; `reasoningEffort?: ReasoningEffort | null` uniform across transport/clients; DB value type `"low" | "medium" | "high" | null` uniform across validator/columns/ProfileRow.
- **Known soft spots called out inline:** route-test and prefill-test fixture/helper names must be mirrored from the actual files (their concrete names live in those files; the NEW lines are specified exactly); another `upsertProfile` caller, if the compiler finds one, gets the preserve-from-existing pattern.
