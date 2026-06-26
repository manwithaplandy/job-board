# OpenRouter Reviews + User-Selectable Models — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct Anthropic API with OpenRouter for the two-stage AI job review, and let the logged-in user pick the model per stage from a searchable dropdown over OpenRouter's live structured-capable catalog.

**Architecture:** The Python `reviewer/` package keeps its two-stage flow and Pydantic schemas; only the LLM client changes — from `AsyncAnthropic` to `AsyncOpenAI` pointed at `https://openrouter.ai/api/v1`, using `beta.chat.completions.parse()` for structured output. Two new nullable columns on `profiles` (`model_stage1`, `model_stage2`) hold each user's choice; the reviewer reads them per user and falls back to a default when unset. The Next.js dashboard fetches OpenRouter's model catalog server-side, renders two searchable pickers on `/profile`, and persists the picks. Model choice is deliberately excluded from `profile_version`, so switching models reviews only *new* jobs.

**Tech Stack:** Python 3.12 (psycopg, httpx, **openai** async SDK, pydantic); Next.js 15 App Router + React 19 (postgres.js, server components/actions); Postgres on Supabase; pytest + vitest.

## Global Constraints

These apply to **every** task. Exact values copied from the spec (`docs/superpowers/specs/2026-06-25-openrouter-model-selection-design.md`).

- **Provider:** OpenRouter via the OpenAI SDK (`AsyncOpenAI`, `base_url="https://openrouter.ai/api/v1"`). Structured output via `client.beta.chat.completions.parse(response_format=PydanticModel, ...)`, reading `resp.choices[0].message.parsed`. (spec §2, §5.1)
- **Default model id:** `anthropic/claude-haiku-4.5` for both stages, overridable via `REVIEW_MODEL_STAGE1` / `REVIEW_MODEL_STAGE2`. (spec §2)
- **Server-side key:** `OPENROUTER_API_KEY` (replaces `ANTHROPIC_API_KEY`). No per-user keys. (spec §2, §9)
- **`profile_version` invariant:** stays `sha256(resume_text || '\0' || instructions)`. Model columns are **excluded** from the hash — never pass a model into `profileVersion`/`compute_profile_version`. (spec §4)
- **Structured-capable filter:** the dashboard lists only models whose `supported_parameters` includes `"structured_outputs"`. (spec §2, §6.1)
- **Per-job isolation (unchanged):** one job's review error records `error` on its row; the batch continues. SDK `None`-parsed and `.refusal` cases raise into this path. (spec §7)
- **No test makes a live OpenRouter call.** Python tests inject a fake client; TS tests inject a fake `fetch`. (spec §8)
- **DB integration tests are gated on `TEST_DATABASE_URL`** via the `requires_db` marker + `conn` fixture; the throwaway Postgres loads `schema.sql` (tests/conftest.py). `auth.users` is absent, so `profiles` uses a plain `UUID user_id` with no FK.
- **Dashboard data access stays direct SQL** via `@/lib/db` `sql` (postgres.js, `prepare: false`). The OpenRouter catalog endpoint is public — no key needed for the dashboard fetch.

---

# Part A — Database + Python reviewer

## Task 1: Schema — `model_stage1` / `model_stage2` on `profiles`

**Files:**
- Modify: `schema.sql:41-48` (the `profiles` table)
- Create: `migrations/2026-06-25-model-selection.sql`
- Modify: `tests/test_schema.py`

**Interfaces:**
- Produces: columns `profiles.model_stage1 TEXT` (nullable), `profiles.model_stage2 TEXT` (nullable). `NULL` = "use default model".

- [ ] **Step 1: Write the failing test**

Append to `tests/test_schema.py`:

```python
@requires_db
def test_profiles_has_model_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'profiles'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert {"model_stage1", "model_stage2"} <= cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_schema.py::test_profiles_has_model_columns -v`
Expected: FAIL (`AssertionError` — columns absent), or SKIP if `TEST_DATABASE_URL` is unset. If skipped, set `TEST_DATABASE_URL` to a throwaway Postgres before proceeding so this task is actually verified.

- [ ] **Step 3: Add the columns to `schema.sql`**

Replace the `profiles` table block (`schema.sql:41-48`) with:

```sql
CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY,
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  model_stage1     TEXT,                     -- OpenRouter model id; NULL = default
  model_stage2     TEXT,                     -- OpenRouter model id; NULL = default
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Create the incremental migration**

Create `migrations/2026-06-25-model-selection.sql`:

```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user OpenRouter model selection. NULL = use the reviewer's default model.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage1 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_stage2 TEXT;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_schema.py -v`
Expected: PASS (all schema tests, including `test_profiles_has_model_columns`).

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-06-25-model-selection.sql tests/test_schema.py
git commit -m "feat(schema): per-user model_stage1/model_stage2 on profiles"
```

---

## Task 2: Provider swap — `reviewer/llm.py` → OpenRouter (OpenAI SDK)

**Files:**
- Modify: `reviewer/llm.py` (rewrite `ReviewClient` internals; new `DEFAULT_MODEL`)
- Modify: `tests/test_llm.py` (fake client to the OpenAI surface)
- Modify: `pyproject.toml:6-10` and `requirements.txt` (swap `anthropic` → `openai`)

**Interfaces:**
- Consumes: `Stage1Result`, `Stage2Result`, `TAXONOMY_TEXT` from `reviewer/schemas.py` (unchanged).
- Produces: `ReviewClient(client=None, model_stage1=None, model_stage2=None)` with `model_stage1` / `model_stage2` attributes and async `stage1(*, profile_block, title, company, location) -> Stage1Result` and `stage2(*, profile_block, title, company, location, jd) -> Stage2Result`; `build_profile_block(resume_text, instructions) -> str`; `DEFAULT_MODEL = "anthropic/claude-haiku-4.5"`. The injected `client` must expose `client.beta.chat.completions.parse(...)` returning an object whose `.choices[0].message` has `.parsed` and `.refusal`.

- [ ] **Step 1: Rewrite the tests in `tests/test_llm.py`**

Replace the entire contents of `tests/test_llm.py` with:

```python
import asyncio
import types

import pytest

from reviewer.llm import ReviewClient, build_profile_block
from reviewer.schemas import Stage1Result, Stage2Result


def _make_response(parsed, refusal=None):
    msg = types.SimpleNamespace(parsed=parsed, refusal=refusal)
    return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)])


class _FakeCompletions:
    def __init__(self):
        self.calls = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs["response_format"] is Stage1Result:
            return _make_response(Stage1Result(decision="pass", reason="looks relevant"))
        return _make_response(Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="Strong fit.",
        ))


class _FakeClient:
    """Mimics AsyncOpenAI's beta.chat.completions.parse surface."""

    def __init__(self):
        self.completions = _FakeCompletions()
        self.beta = types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=self.completions)
        )

    @property
    def calls(self):
        return self.completions.calls


def test_build_profile_block_includes_resume_and_instructions():
    block = build_profile_block("RESUME-A", "INSTR-B")
    assert "RESUME-A" in block and "INSTR-B" in block


def test_stage1_passes_title_and_sends_profile_in_system():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="Staff Engineer", company="Acme", location="Remote")
    )
    assert isinstance(out, Stage1Result) and out.decision == "pass"
    call = fake.calls[0]
    assert call["model"] == "m1"
    assert call["response_format"] is Stage1Result
    msgs = call["messages"]
    assert msgs[0]["role"] == "system" and "P" in msgs[0]["content"]
    assert msgs[1]["role"] == "user" and "Staff Engineer" in msgs[1]["content"]


def test_stage2_includes_jd_and_uses_stage2_model():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage2(
            profile_block="P", title="SRE", company="Acme",
            location="Remote", jd="Operate Kubernetes clusters",
        )
    )
    assert isinstance(out, Stage2Result) and out.verdict == "approve"
    call = fake.calls[0]
    assert call["model"] == "m2"
    assert call["response_format"] is Stage2Result
    assert "Operate Kubernetes clusters" in call["messages"][1]["content"]


def test_models_default_from_env(monkeypatch):
    monkeypatch.setenv("REVIEW_MODEL_STAGE1", "env-s1")
    monkeypatch.delenv("REVIEW_MODEL_STAGE2", raising=False)
    rc = ReviewClient(client=_FakeClient())
    assert rc.model_stage1 == "env-s1"
    assert rc.model_stage2 == "anthropic/claude-haiku-4.5"


def test_stage_raises_when_parsed_output_none():
    class _NoneCompletions:
        async def parse(self, **kwargs):
            return _make_response(None)

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_NoneCompletions())
        )
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    with pytest.raises(ValueError, match="no parsed output"):
        asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))


def test_stage_raises_on_refusal():
    class _RefusingCompletions:
        async def parse(self, **kwargs):
            return _make_response(None, refusal="I can't help with that.")

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_RefusingCompletions())
        )
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    with pytest.raises(ValueError, match="refused"):
        asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_llm.py -v`
Expected: FAIL (current `ReviewClient` calls `messages.parse`/reads `parsed_output`; the fake now exposes `beta.chat.completions.parse` and the default is the old `claude-haiku-4-5`).

- [ ] **Step 3: Rewrite `reviewer/llm.py`**

Replace the entire contents of `reviewer/llm.py` with:

```python
import os

from reviewer.schemas import TAXONOMY_TEXT, Stage1Result, Stage2Result

DEFAULT_MODEL = "anthropic/claude-haiku-4.5"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

_STAGE1_INSTRUCTIONS = (
    "You are a relevance gatekeeper. You see only a job's title, company, and "
    "location. Decide whether it could plausibly fit the candidate above. "
    "Reject ONLY obvious non-fits (e.g., a software engineer seeing 'Forklift "
    "Operator' or 'Social Media Manager'). When unsure, pass. Respond with "
    "decision='pass' or 'reject' and a one-sentence reason."
)

_STAGE2_INSTRUCTIONS = (
    "Evaluate this single job posting against the candidate's resume and "
    "instructions. Decide:\n"
    "- verdict: 'approve' if genuinely relevant and worth applying, else 'deny'.\n"
    "- experience_match: 'step_down' (below their level), 'match' (right level), "
    "'reach' (a plausible stretch), 'far_reach' (clearly beyond current experience).\n"
    "- industry and industry_subcategory: choose exactly one consistent pair from "
    "this taxonomy:\n"
    f"{TAXONOMY_TEXT}\n"
    "- confidence: low, medium, or high.\n"
    "- reasoning: 1-3 sentences.\n"
    "Honor the candidate's focus/avoid instructions."
)


def build_profile_block(resume_text: str | None, instructions: str | None) -> str:
    return (
        "You are screening jobs for one candidate.\n\n"
        "CANDIDATE RESUME:\n"
        f"{resume_text or '(none provided)'}\n\n"
        "CANDIDATE INSTRUCTIONS (focus/avoid):\n"
        f"{instructions or '(none provided)'}"
    )


def _system(profile_block: str, instructions: str) -> str:
    # OpenAI-style single system message (was Anthropic's two-block system list).
    return f"{profile_block}\n\n{instructions}"


class ReviewClient:
    def __init__(self, client=None, model_stage1: str | None = None,
                 model_stage2: str | None = None):
        if client is None:
            from openai import AsyncOpenAI  # lazy: avoid import + key read at module load
            client = AsyncOpenAI(
                base_url=OPENROUTER_BASE_URL,
                api_key=os.environ["OPENROUTER_API_KEY"],
                default_headers={"X-Title": "job-board"},
            )
        self._client = client
        self.model_stage1 = model_stage1 or os.environ.get("REVIEW_MODEL_STAGE1", DEFAULT_MODEL)
        self.model_stage2 = model_stage2 or os.environ.get("REVIEW_MODEL_STAGE2", DEFAULT_MODEL)

    async def _parse(self, *, model: str, max_tokens: int, system: str, user: str, schema):
        resp = await self._client.beta.chat.completions.parse(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=schema,
        )
        msg = resp.choices[0].message
        if getattr(msg, "refusal", None):
            raise ValueError(f"model refused: {msg.refusal}")
        if msg.parsed is None:
            raise ValueError("OpenRouter returned no parsed output")
        return msg.parsed

    async def stage1(self, *, profile_block: str, title: str, company: str,
                     location: str | None) -> Stage1Result:
        return await self._parse(
            model=self.model_stage1, max_tokens=512,
            system=_system(profile_block, _STAGE1_INSTRUCTIONS),
            user=f"Title: {title}\nCompany: {company}\nLocation: {location or 'n/a'}",
            schema=Stage1Result,
        )

    async def stage2(self, *, profile_block: str, title: str, company: str,
                     location: str | None, jd: str) -> Stage2Result:
        return await self._parse(
            model=self.model_stage2, max_tokens=1024,
            system=_system(profile_block, _STAGE2_INSTRUCTIONS),
            user=(
                f"Title: {title}\nCompany: {company}\nLocation: {location or 'n/a'}\n\n"
                f"JOB DESCRIPTION:\n{jd}"
            ),
            schema=Stage2Result,
        )
```

- [ ] **Step 4: Swap the dependency**

In `pyproject.toml`, replace the `anthropic>=0.100.0` line (`pyproject.toml:9`) with:

```toml
    "openai>=1.50.0",
```

In `requirements.txt`, replace the `anthropic>=0.100.0` line with:

```
openai>=1.50.0
```

Then install it into the working environment: `pip install "openai>=1.50.0"`

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_llm.py -v`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Run the full Python suite to confirm nothing else broke**

Run: `pytest -q`
Expected: PASS (or DB tests SKIP if `TEST_DATABASE_URL` unset). `tests/test_reviewer_run.py` still passes — `review_all` still constructs `ReviewClient()` (no args) and the integration tests still set `ANTHROPIC_API_KEY` (the gate changes in Task 3).

- [ ] **Step 7: Commit**

```bash
git add reviewer/llm.py tests/test_llm.py pyproject.toml requirements.txt
git commit -m "feat(reviewer): route reviews through OpenRouter via the OpenAI SDK"
```

---

## Task 3: Per-user model wiring + key gate

**Files:**
- Modify: `reviewer/db.py:25-30` (`load_profiles` SELECT)
- Modify: `reviewer/run.py:100` (`_review_user` client construction) and `reviewer/run.py:130-131` (skip log)
- Modify: `reviewer/config.py:15-16` (`has_api_key`)
- Modify: `tests/test_reviewer_db.py:24-37` (`test_load_profiles` expectation)
- Modify: `tests/test_reviewer_run.py:115-137` and `:166-186` (integration tests: key env + stub signature)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `ReviewClient(model_stage1=..., model_stage2=...)` from Task 2.
- Produces: `load_profiles(conn)` rows now include `model_stage1` / `model_stage2`; `has_api_key()` checks `OPENROUTER_API_KEY`; `_review_user` passes the profile's models into `ReviewClient`.

- [ ] **Step 1: Update `load_profiles` test expectation (failing)**

In `tests/test_reviewer_db.py`, replace the `assert profiles == [...]` block in `test_load_profiles` (`tests/test_reviewer_db.py:33-37`) with:

```python
    profiles = rdb.load_profiles(conn)
    assert profiles == [
        {"user_id": uuid.UUID(USER), "resume_text": "r", "instructions": "i",
         "profile_version": "v1", "model_stage1": None, "model_stage2": None}
    ]
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_reviewer_db.py::test_load_profiles -v`
Expected: FAIL — returned dict lacks `model_stage1`/`model_stage2` (or SKIP without `TEST_DATABASE_URL`; set it to verify).

- [ ] **Step 3: Add the columns to `load_profiles`**

In `reviewer/db.py`, replace the `load_profiles` SELECT (`reviewer/db.py:27-29`) with:

```python
        cur.execute(
            "SELECT user_id, resume_text, instructions, profile_version, "
            "model_stage1, model_stage2 FROM profiles"
        )
```

- [ ] **Step 4: Run to verify it passes**

Run: `pytest tests/test_reviewer_db.py::test_load_profiles -v`
Expected: PASS.

- [ ] **Step 5: Wire per-user models + flip the key gate**

In `reviewer/run.py`, replace `client = ReviewClient()` (`reviewer/run.py:100`) with:

```python
        client = ReviewClient(
            model_stage1=profile.get("model_stage1"),
            model_stage2=profile.get("model_stage2"),
        )
```

In `reviewer/run.py`, replace the skip-log line in `review_all` (`reviewer/run.py:131`) with:

```python
        log.info("OPENROUTER_API_KEY not set; skipping review phase")
```

In `reviewer/config.py`, replace `has_api_key` (`reviewer/config.py:15-16`) with:

```python
def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))
```

- [ ] **Step 6: Update the run integration tests (env var + stub signature)**

In `tests/test_reviewer_run.py`, in **both** `test_review_all_persists_stage1_error_without_aborting` and `test_review_all_writes_verdicts_and_run`:

Replace `monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")` with:

```python
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
```

Replace `monkeypatch.setattr(run_module, "ReviewClient", lambda: StubClient())` with:

```python
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient())
```

- [ ] **Step 7: Update `.env.example`**

Append to `.env.example`:

```
# OpenRouter (AI review). Get a key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-...
# Optional per-stage model overrides (OpenRouter ids). Default: anthropic/claude-haiku-4.5
REVIEW_MODEL_STAGE1=anthropic/claude-haiku-4.5
REVIEW_MODEL_STAGE2=anthropic/claude-haiku-4.5
```

- [ ] **Step 8: Run the full Python suite**

Run: `pytest -q`
Expected: PASS (DB tests run if `TEST_DATABASE_URL` is set; otherwise SKIP). Confirm `tests/test_reviewer_run.py` and `tests/test_reviewer_db.py` pass.

- [ ] **Step 9: Commit**

```bash
git add reviewer/db.py reviewer/run.py reviewer/config.py \
        tests/test_reviewer_db.py tests/test_reviewer_run.py .env.example
git commit -m "feat(reviewer): per-user model selection + OPENROUTER_API_KEY gate"
```

---

# Part B — Dashboard

## Task 4: OpenRouter catalog module + pure helpers

**Files:**
- Create: `dashboard/lib/openrouter.ts`
- Create: `dashboard/lib/openrouter.test.ts`

**Interfaces:**
- Produces:
  - `interface ORModel { id: string; name: string; pricing: { prompt: string; completion: string } }`
  - `DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5"`
  - `CURATED_MODELS: string[]` (~20 ids)
  - `getStructuredModels(fetchImpl?: typeof fetch): Promise<ORModel[]>` — server-side fetch + filter; `[]` on any failure
  - `filterModels(models: ORModel[], curated: string[], query: string): ORModel[]`
  - `validateModelId(raw: string, catalogIds: string[]): { ok: true; value: string | null } | { ok: false; reason: string }`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/lib/openrouter.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import {
  getStructuredModels, filterModels, validateModelId, CURATED_MODELS, type ORModel,
} from "@/lib/openrouter";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

const CATALOG = {
  data: [
    { id: "b/model", name: "B Model", supported_parameters: ["structured_outputs", "tools"],
      pricing: { prompt: "0.000001", completion: "0.000002" } },
    { id: "a/model", name: "A Model", supported_parameters: ["structured_outputs"],
      pricing: { prompt: "0.000003", completion: "0.000004" } },
    { id: "c/notools", name: "C NoStructured", supported_parameters: ["tools"],
      pricing: { prompt: "0", completion: "0" } },
  ],
};

describe("getStructuredModels", () => {
  test("keeps only structured_outputs models, mapped and sorted by name", async () => {
    const models = await getStructuredModels(fakeFetch(CATALOG));
    expect(models.map((m) => m.id)).toEqual(["a/model", "b/model"]);
    expect(models[0]).toEqual({
      id: "a/model", name: "A Model",
      pricing: { prompt: "0.000003", completion: "0.000004" },
    });
  });

  test("returns [] on non-ok response", async () => {
    expect(await getStructuredModels(fakeFetch(CATALOG, false))).toEqual([]);
  });

  test("returns [] when fetch throws", async () => {
    const throwing = (() => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await getStructuredModels(throwing)).toEqual([]);
  });
});

describe("filterModels", () => {
  const models: ORModel[] = [
    { id: "anthropic/claude-haiku-4.5", name: "Anthropic: Claude Haiku 4.5", pricing: { prompt: "", completion: "" } },
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini", pricing: { prompt: "", completion: "" } },
  ];

  test("empty query returns curated models in curated order", () => {
    const out = filterModels(models, ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"], "");
    expect(out.map((m) => m.id)).toEqual(["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"]);
  });

  test("curated id missing from catalog falls back to id-as-name", () => {
    const out = filterModels(models, ["zzz/unknown"], "");
    expect(out[0]).toEqual({ id: "zzz/unknown", name: "zzz/unknown", pricing: { prompt: "", completion: "" } });
  });

  test("non-empty query matches id or name, case-insensitive", () => {
    expect(filterModels(models, [], "HAIKU").map((m) => m.id)).toEqual(["anthropic/claude-haiku-4.5"]);
    expect(filterModels(models, [], "gpt-4o").map((m) => m.id)).toEqual(["openai/gpt-4o-mini"]);
  });
});

describe("validateModelId", () => {
  const ids = ["anthropic/claude-haiku-4.5", "openai/gpt-4o-mini"];

  test("empty -> null (use default)", () => {
    expect(validateModelId("", ids)).toEqual({ ok: true, value: null });
    expect(validateModelId("   ", ids)).toEqual({ ok: true, value: null });
  });

  test("member of catalog -> accepted", () => {
    expect(validateModelId("openai/gpt-4o-mini", ids)).toEqual({ ok: true, value: "openai/gpt-4o-mini" });
  });

  test("non-member -> rejected", () => {
    expect(validateModelId("fake/model", ids)).toEqual({ ok: false, reason: "unknown model: fake/model" });
  });

  test("empty catalog (fetch failed) -> accept submitted id", () => {
    expect(validateModelId("fake/model", [])).toEqual({ ok: true, value: "fake/model" });
  });
});

test("CURATED_MODELS is a non-empty list of ids", () => {
  expect(CURATED_MODELS.length).toBeGreaterThan(0);
  expect(CURATED_MODELS).toContain("anthropic/claude-haiku-4.5");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/openrouter.test.ts`
Expected: FAIL — `@/lib/openrouter` does not exist.

- [ ] **Step 3: Implement `dashboard/lib/openrouter.ts`**

Create `dashboard/lib/openrouter.ts`:

```ts
export interface ORModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
}

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Mirrors reviewer/llm.py DEFAULT_MODEL. Shown as the placeholder when unset.
export const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5";

// Curated default suggestions shown before the user types. All verified present and
// structured-output-capable on OpenRouter at design time (2026-06-25). The search box
// filters the FULL live catalog, so staleness here is low-impact — edit freely.
export const CURATED_MODELS: string[] = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "openai/o4-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-maverick",
  "mistralai/mistral-small-3.2-24b-instruct",
  "mistralai/mistral-large",
  "x-ai/grok-4.3",
  "qwen/qwen3.7-max",
  "z-ai/glm-4.6",
];

interface RawModel {
  id: string;
  name: string;
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string };
}

// Fetched server-side; the OpenRouter catalog endpoint is public (no key needed).
// Cached 1h via Next's fetch cache. Returns [] on any failure so the UI degrades
// gracefully to the curated list.
export async function getStructuredModels(
  fetchImpl: typeof fetch = fetch,
): Promise<ORModel[]> {
  try {
    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: RawModel[] };
    const data = json?.data ?? [];
    return data
      .filter((m) => Array.isArray(m.supported_parameters)
        && m.supported_parameters.includes("structured_outputs"))
      .map((m) => ({
        id: m.id,
        name: m.name,
        pricing: { prompt: m.pricing?.prompt ?? "", completion: m.pricing?.completion ?? "" },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Letter-by-letter client-side filter. Empty query -> the curated shortlist (in
// curated order); a curated id absent from the catalog falls back to id-as-name.
export function filterModels(
  models: ORModel[], curated: string[], query: string,
): ORModel[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const byId = new Map(models.map((m) => [m.id, m]));
    return curated.map((id) => byId.get(id)
      ?? { id, name: id, pricing: { prompt: "", completion: "" } });
  }
  return models.filter((m) =>
    m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
}

export type ModelValidation =
  | { ok: true; value: string | null }
  | { ok: false; reason: string };

// empty -> null (use default); member -> accepted; non-member -> rejected.
// Empty catalog means the live fetch failed at save time — accept rather than
// block a valid save on a transient outage (spec §6.4).
export function validateModelId(raw: string, catalogIds: string[]): ModelValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (catalogIds.length === 0) return { ok: true, value: trimmed };
  if (catalogIds.includes(trimmed)) return { ok: true, value: trimmed };
  return { ok: false, reason: `unknown model: ${trimmed}` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/openrouter.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/openrouter.ts dashboard/lib/openrouter.test.ts
git commit -m "feat(dashboard): OpenRouter catalog fetch + model filter/validate helpers"
```

---

## Task 5: `ModelPicker` searchable combobox component

**Files:**
- Create: `dashboard/components/ModelPicker.tsx`

**Interfaces:**
- Consumes: `filterModels`, `ORModel` from `@/lib/openrouter`.
- Produces: `ModelPicker({ label, name, models, curated, defaultValue, placeholder })` — a client component rendering a hidden `<input name={name}>` carrying the selected id (empty = use default).

- [ ] **Step 1: Implement the component**

Create `dashboard/components/ModelPicker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { filterModels, type ORModel } from "@/lib/openrouter";

export function ModelPicker({
  label, name, models, curated, defaultValue, placeholder,
}: {
  label: string;
  name: string;
  models: ORModel[];
  curated: string[];
  defaultValue: string | null;
  placeholder: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = filterModels(models, curated, query).slice(0, 50);

  return (
    <div className="flex flex-col text-sm text-gray-700">
      <span>{label}</span>
      <input type="hidden" name={name} value={selected} />
      <input
        type="text"
        className="mt-1 rounded border px-2 py-1 text-sm"
        placeholder={selected || placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && (
        <span className="mt-1 text-xs text-gray-500">
          selected: {selected}{" "}
          <button type="button" className="underline"
            onClick={() => setSelected("")}>
            clear (use default)
          </button>
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-auto rounded border bg-white text-sm shadow">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button"
                className="block w-full px-2 py-1 text-left hover:bg-gray-100"
                onClick={() => { setSelected(m.id); setQuery(""); setOpen(false); }}>
                <span>{m.name}</span>{" "}
                <span className="text-gray-400">{m.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck the component**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/ModelPicker.tsx
git commit -m "feat(dashboard): searchable ModelPicker combobox"
```

---

## Task 6: Persist model columns — types + queries

**Files:**
- Modify: `dashboard/lib/types.ts:49-56` (`ProfileRow`)
- Modify: `dashboard/lib/queries.ts:52-69` (`upsertProfile`)

**Interfaces:**
- Consumes: `profileVersion` from `@/lib/profileVersion` (unchanged — resume + instructions only).
- Produces: `ProfileRow` with `model_stage1: string | null` and `model_stage2: string | null`; `upsertProfile(userId, { resumeText, instructions, resumeFilePath, modelStage1, modelStage2 })`.

- [ ] **Step 1: Extend `ProfileRow`**

In `dashboard/lib/types.ts`, replace the `ProfileRow` interface (`dashboard/lib/types.ts:49-56`) with:

```ts
export interface ProfileRow {
  user_id: string;
  resume_text: string | null;
  resume_file_path: string | null;
  instructions: string | null;
  model_stage1: string | null;
  model_stage2: string | null;
  profile_version: string;
  updated_at: string;
}
```

- [ ] **Step 2: Extend `upsertProfile`**

In `dashboard/lib/queries.ts`, replace `upsertProfile` (`dashboard/lib/queries.ts:52-69`) with:

```ts
export async function upsertProfile(
  userId: string,
  data: {
    resumeText: string | null;
    instructions: string | null;
    resumeFilePath: string | null;
    modelStage1: string | null;
    modelStage2: string | null;
  },
): Promise<void> {
  // profile_version intentionally excludes the model choice — changing a model
  // must NOT invalidate existing verdicts (spec §4).
  const version = profileVersion(data.resumeText, data.instructions);
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          model_stage1, model_stage2, profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${data.modelStage1}, ${data.modelStage2},
            ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text      = EXCLUDED.resume_text,
      instructions     = EXCLUDED.instructions,
      resume_file_path = EXCLUDED.resume_file_path,
      model_stage1     = EXCLUDED.model_stage1,
      model_stage2     = EXCLUDED.model_stage2,
      profile_version  = EXCLUDED.profile_version,
      updated_at       = now()
  `;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: FAIL — `dashboard/app/profile/page.tsx` calls `upsertProfile` without `modelStage1`/`modelStage2`. This is expected and fixed in Task 7. (The type + query changes themselves are correct.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts
git commit -m "feat(dashboard): persist model_stage1/model_stage2 on profiles"
```

---

## Task 7: Wire the pickers into the profile page + save action

**Files:**
- Modify: `dashboard/app/profile/page.tsx`

**Interfaces:**
- Consumes: `getStructuredModels`, `CURATED_MODELS`, `DEFAULT_MODEL_ID`, `validateModelId` from `@/lib/openrouter`; `ModelPicker` from `@/components/ModelPicker`; `upsertProfile` from `@/lib/queries` (Task 6 signature).

- [ ] **Step 1: Update `dashboard/app/profile/page.tsx`**

Replace the entire contents of `dashboard/app/profile/page.tsx` with:

```tsx
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
import {
  getStructuredModels, CURATED_MODELS, DEFAULT_MODEL_ID, validateModelId,
} from "@/lib/openrouter";
import { ModelPicker } from "@/components/ModelPicker";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
  let resumeText = (String(formData.get("resume_text") ?? "")).trim() || null;
  let resumeFilePath: string | null = null;

  const catalogIds = (await getStructuredModels()).map((m) => m.id);
  const s1 = validateModelId(String(formData.get("model_stage1") ?? ""), catalogIds);
  const s2 = validateModelId(String(formData.get("model_stage2") ?? ""), catalogIds);
  if (!s1.ok) throw new Error(s1.reason);
  if (!s2.ok) throw new Error(s2.reason);

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
  }

  await upsertProfile(userId, {
    resumeText, instructions, resumeFilePath,
    modelStage1: s1.value, modelStage2: s2.value,
  });
}

export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  const models = await getStructuredModels();
  return (
    <main className="mx-auto mt-12 max-w-2xl px-6">
      <h1 className="text-lg font-semibold">Profile</h1>
      <form action={saveProfile} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col text-sm text-gray-700">
          Resume PDF (optional — overrides pasted text when it extracts cleanly)
          <input name="resume_pdf" type="file" accept="application/pdf" className="mt-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Resume text
          <textarea name="resume_text" rows={12} defaultValue={profile?.resume_text ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Instructions (focus / avoid)
          <textarea name="instructions" rows={4} defaultValue={profile?.instructions ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm"
            placeholder="e.g. focus on backend/infra; avoid pure-frontend roles" />
        </label>

        <fieldset className="flex flex-col gap-3 rounded border p-3">
          <legend className="px-1 text-xs text-gray-500">
            Review models (leave blank to use the default: {DEFAULT_MODEL_ID})
          </legend>
          <ModelPicker
            label="Stage 1 — cheap title/company gate"
            name="model_stage1" models={models} curated={CURATED_MODELS}
            defaultValue={profile?.model_stage1 ?? null} placeholder={DEFAULT_MODEL_ID} />
          <ModelPicker
            label="Stage 2 — full job-description review"
            name="model_stage2" models={models} curated={CURATED_MODELS}
            defaultValue={profile?.model_stage2 ?? null} placeholder={DEFAULT_MODEL_ID} />
        </fieldset>

        <button type="submit"
          className="self-start rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
          Save
        </button>
        {profile && (
          <p className="text-xs text-gray-500">
            Last saved {new Date(profile.updated_at).toLocaleString()} · version{" "}
            {profile.profile_version.slice(0, 8)}
          </p>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd dashboard && npx tsc --noEmit && npm run build`
Expected: PASS — no type errors; build succeeds.

- [ ] **Step 3: Run the full dashboard test suite**

Run: `cd dashboard && npm test`
Expected: PASS (existing tests + `openrouter.test.ts`).

- [ ] **Step 4: Manual smoke (the picker wiring has no unit test)**

With the dev server running (`cd dashboard && npm run dev`) and logged in:
1. Open `/profile`. Both pickers show the curated shortlist on focus.
2. Type "haiku" in Stage 1 — the list filters letter by letter; select `anthropic/claude-haiku-4.5`.
3. Type "gpt" in Stage 2 — select an OpenAI model.
4. Save. Reload `/profile` — both selections persist (shown as "selected: …").
5. Confirm in the DB: `SELECT model_stage1, model_stage2, profile_version FROM profiles;` — models are set; note the `profile_version`.
6. Re-save with the **same** resume/instructions but a **different** model — confirm `profile_version` is **unchanged** (the §4 invariant; only-new-jobs behavior).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/profile/page.tsx
git commit -m "feat(dashboard): per-stage model pickers on the profile page"
```

---

## Self-Review Notes

**Spec coverage:**
- §3 provider swap → Task 2. §4 data model + version invariant → Task 1 (columns) + Task 6 (version excludes models) + Task 7 step 4.6 (verified). §5 reviewer changes → Tasks 2–3. §6 dashboard (catalog, picker, page, action, queries) → Tasks 4–7. §6.4 catalog-down validation fallback → Task 4 (`validateModelId` empty-catalog case). §7 error handling → Task 2 (refusal/None raise) + per-job isolation (unchanged). §8 testing → tests in Tasks 1–4; UI/wiring build- + manually-verified (Tasks 5,7), matching the dashboard's existing no-DB/no-RTL test convention. §9 deploy/config → Task 2 (deps) + Task 3 (`.env.example`, key gate) + Task 1 (migration).
- Out-of-scope items (BYOK, bulk re-review, explicit cache breakpoints, live popularity) are intentionally not tasked.

**Placeholder scan:** none — every code/test step contains full content; commands have expected output.

**Type consistency:** `ORModel`, `getStructuredModels`, `filterModels`, `validateModelId`/`ModelValidation`, `CURATED_MODELS`, `DEFAULT_MODEL_ID` are defined in Task 4 and consumed with matching signatures in Tasks 5 and 7. `upsertProfile`'s `{ modelStage1, modelStage2 }` shape (Task 6) matches the call site (Task 7). `ReviewClient(model_stage1=, model_stage2=)` (Task 2) matches the `_review_user` call and the `lambda **kw` stub (Task 3). `load_profiles` keys (`model_stage1`/`model_stage2`, Task 3) match `profile.get(...)` in `_review_user`.
