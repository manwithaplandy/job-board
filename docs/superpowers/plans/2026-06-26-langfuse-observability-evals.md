# Langfuse Observability + Evals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Langfuse LLM tracing (token/cost/quality) and evaluation to the job-board's three LLM surfaces — the Python reviewer, the Next.js dashboard résumé route, and the company-discovery service — staying within Langfuse Cloud's free Hobby tier.

**Architecture:** One Langfuse Cloud project; two SDKs report into it (Python `langfuse` v3, JS `@langfuse/*` v5). The Python reviewer (Railway cron) is instrumented with **manual generation observations** wrapped around its existing `.beta.chat.completions.parse()` calls (the un-wrapped OpenAI method, so the drop-in wrapper does not apply). The **company-discovery service** (a second Railway cron, `python -m discovery`) is a structural twin of the reviewer — same lazy OpenRouter `AsyncOpenAI` + `.beta.chat.completions.parse()`, one LLM call per company — and is instrumented identically by **reusing the shared `observability/tracing.py`** seam (one `company-review` span with one nested generation; see Task 4b). The Next.js résumé route (Vercel serverless) uses the **OTel-based JS SDK v5** with `LangfuseSpanProcessor` and a flush via `after()`. All instrumentation is **no-op when Langfuse keys are absent** (mirrors the existing `OPENROUTER_API_KEY` gate). Evals: offline dataset experiments via the Python SDK + a sampled LLM-as-judge configured in the Langfuse UI.

**Tech Stack:** Python 3.12, `openai>=1.50` (OpenRouter), `langfuse>=3` (OTel-based Python SDK v3); Next.js 15.5 App Router + React 19, `@langfuse/otel` + `@langfuse/tracing` + `@opentelemetry/sdk-node` (JS SDK v5); pytest; vitest.

## Update — rebased onto `main` (2026-06-28)

This plan was originally written against HEAD `f5624d3`. It has since been fast-forwarded onto `main` HEAD `4e208fe`, which merged the **company auto-discovery** feature. Impact on this plan:

- **New third LLM surface — `discovery/`.** A company-screening cron (`python -m discovery`, its own Railway service via `railway.discovery.json`, weekly `0 6 * * 1`, `DISCOVERY_BATCH_CAP=500`, `DISCOVERY_CONCURRENCY=5`). `discovery/llm.py`'s `CompanyReviewClient.review()` makes one `.beta.chat.completions.parse()` call per company (700 max-tokens, `response_format=CompanyReviewResult`), batched by `discovery/run.py` `review_batch()` (semaphore + `asyncio.gather`, per-company isolation, `OutOfCreditsError` halt), with `run_id = db.start_discovery_run()` and `user_id = profile["user_id"]` already in scope in `_review_user`. It is a near-twin of the reviewer and is instrumented in the **new Task 4b** below, **reusing the shared `observability/tracing.py`** seam. *(Per the user's 2026-06-28 direction, the Python tracing seam lives in a neutral top-level `observability/` package — not under `reviewer/` — so the reviewer, discovery, and any future surface consume it without one cron importing another. Task 2 below is the canonical owner of this module.)*
- **The two original surfaces are unchanged by the merge.** `git diff f5624d3..4e208fe` shows `reviewer/llm.py`, `reviewer/run.py`, `reviewer/db.py`, `reviewer/config.py`, `dashboard/lib/rolefit/resumeClient.ts`, and `dashboard/app/api/resume/route.ts` all untouched — so Tasks 2–10 apply verbatim.
- **`pyproject.toml`** now lists `"discovery"` in `[tool.setuptools] packages` (orthogonal to adding the `langfuse>=3` dependency in `[project].dependencies` per Task 2).
- **`tests/test_reviewer_run.py`** swapped its DB seed helper (`poller_db.sync_companies` → `poller_db.sync_seed`). Task 4's *new* tests use the `StubClient`/`_cand` seam (not the DB seeders), so they are unaffected — just match the current file when appending.
- **Unit budget.** Discovery adds ≤ `500 companies/week × 3 units ≈ 6.5k units/mo` at full sampling (it shares `LANGFUSE_SAMPLE_RATE`, and the weekly + 500/run cap bound it). Combined with the reviewer (~30k/mo steady-state) and the dashboard (per-request, low volume), the project still projects under the 50k/mo Hobby cap.

## Sampling correction — use native head-based sampling (2026-06-28, post-Task-4b; supersedes the custom `should_sample()` design)

**Discovery during implementation:** the installed SDK is **langfuse 4.12.0** (the `langfuse>=3` floor resolves to v4; treat all "v3" mentions below as "v4 — compatible APIs"). langfuse reads **`LANGFUSE_SAMPLE_RATE` natively** at `get_client()` → `Langfuse()` init and applies **head-based, per-trace sampling** (whole traces — root span + all nested observations — are kept or dropped together by trace-id; dropped traces are never exported, so they cost **0 units**).

The original plan re-used that exact env-var name for a **custom** `tracing.should_sample()` that only skipped the per-job/per-company *span*. That is wrong: (a) it double-samples with the SDK's native sampling, and (b) when a job is not sampled the inner LLM-call layer (`_parse` / discovery `review()`) still creates a generation, which — with no enclosing span — becomes its own root trace and **still consumes units**. The bug only manifests at `LANGFUSE_SAMPLE_RATE < 1.0` (i.e. exactly the backfill case the var exists for), which is why mocked unit tests didn't catch it.

**Resolution (user-approved): rely on langfuse's native sampling; remove the custom gate.**
- `observability/tracing.py`: **remove `should_sample()`**. Keep `tracing_enabled()`, `get_langfuse()`, `identity()`, `flush()`, and `sample_rate()` (the latter now used only to **log the effective rate at cron start** — honors the "no silent truncation" constraint).
- `reviewer/run.py` `review_one(...)`: change the guard from `if lf is None or not tracing.should_sample():` to **`if lf is None:`** — always create the `job-review` span when tracing is on; native sampling drops the whole trace when it rolls out. Add a one-line `log.info("langfuse tracing on; sample_rate=%s", tracing.sample_rate())` at the start of `review_all()` when enabled.
- `discovery/run.py` `review_company_one(...)`: same guard change (`if lf is None:`); add the same startup log in `run()`.
- Tests: drop the `monkeypatch.setattr(tracing, "should_sample", …)` lines and **remove the `*_skips_span_when_not_sampled` tests** in `tests/test_reviewer_run.py` and `tests/test_discovery_run.py` (sampling is now SDK-internal and not unit-testable via our seam). The `*_traces_when_enabled` tests remain (with the should_sample monkeypatch line removed).

Wherever the sections below say "skip span creation when not sampled" or call `tracing.should_sample()`, they are superseded by this correction.

## Global Constraints

- **Free tier is the constraint.** Langfuse Hobby = **50k units/mo**, 30-day retention, 2 users. `units = traces + observations + scores`; units created by Langfuse features (LLM-as-judge) **also count**.
- **Graceful no-op:** every instrumentation path must be inert when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are unset — code behaves exactly as today, no import errors, no latency.
- **Flush before exit** in both runtimes (Railway cron, Vercel serverless) or events are lost.
- **Do not change the LLM calls themselves.** Reviewer keeps `.beta.chat.completions.parse()`; dashboard keeps its raw `fetch()` + `fetchImpl` test seam.
- **Unit-budget controls:** stage-2 already skipped on gate-reject (keep it); `LANGFUSE_SAMPLE_RATE` (default `1.0`) gates per-job/per-company tracing in **both** the reviewer and discovery crons; LLM-as-judge runs on a ~15% sample. Never silently drop without a log line.
- **Env var names (exact):** `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` (default `https://cloud.langfuse.com`), `LANGFUSE_SAMPLE_RATE` (reviewer + discovery crons).
- **Python dep floor:** `langfuse>=3`. **JS deps:** `@langfuse/otel`, `@langfuse/tracing`, `@opentelemetry/sdk-node` (pin to current v5-compatible majors at install time).
- **Decisions (locked):** Cloud Hobby (not self-host); scope = tracing + evals (NO prompt management); instrument BOTH surfaces.

## File Structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `observability/__init__.py` | New neutral top-level package shared by reviewer + discovery + future surfaces | Create |
| `observability/tracing.py` | Single Langfuse seam for Python: enabled-check, cached client, sampling, identity CM, flush | Create |
| `reviewer/llm.py` | Wrap `_parse` in a manual generation; add `stage` arg | Modify |
| `reviewer/run.py` | Per-job span + trace identity/metadata; thread `user_id`/`run_id`; flush in `review_all` | Modify |
| `reviewer/experiments.py` | Offline dataset experiments (seed from `job_reviews`, run pipeline, score) | Create |
| `requirements.txt`, `pyproject.toml` | Add `langfuse>=3` dep; add `"observability"` to `[tool.setuptools] packages` | Modify |
| `.env.example` | Document `LANGFUSE_*` + `LANGFUSE_SAMPLE_RATE` | Modify |
| `tests/test_tracing.py` | Unit tests for the seam | Create |
| `tests/test_llm.py`, `tests/test_reviewer_run.py` | Add tracing-on tests; keep existing passing | Modify |
| `discovery/llm.py` | Wrap `review()` in a manual `company-screen` generation (reuses `observability/tracing.py`) | Modify |
| `discovery/run.py` | Per-company `company-review` span + trace identity/metadata; thread `user_id`/`run_id`; flush in `run()` | Modify |
| `discovery/__main__.py` | Belt-and-suspenders `tracing.flush()` after `run()` | Modify |
| `tests/test_discovery_llm.py`, `tests/test_discovery_run.py` | Add tracing-on tests; keep existing passing | Modify |
| `dashboard/instrumentation.ts` | NodeSDK + `LangfuseSpanProcessor`, exported for flush | Create |
| `dashboard/lib/observability.ts` | `tracingEnabled()` helper | Create |
| `dashboard/lib/rolefit/resumeClient.ts` | Wrap `fetch` in a generation | Modify |
| `dashboard/app/api/resume/route.ts` | `propagateAttributes` + `after()` flush | Modify |
| `dashboard/lib/rolefit/resumeClient.test.ts` | Keep passing (tracing off in tests) | Modify if needed |
| `dashboard/.env.example` | Document `LANGFUSE_*` | Modify |

---

### Task 1: Langfuse Cloud project + keys (prerequisite, manual)

No code. Establishes the project and keys used by every live verification step below.

- [ ] **Step 1:** Sign up / sign in at `https://cloud.langfuse.com` (free Hobby plan). Create an organization and a project named `job-board`.
- [ ] **Step 2:** In Project Settings → API Keys, create a key pair. Record `LANGFUSE_PUBLIC_KEY` (`pk-lf-…`) and `LANGFUSE_SECRET_KEY` (`sk-lf-…`). Note the host (US vs EU region; default `https://cloud.langfuse.com`).
- [ ] **Step 3:** Keep these for local `.env` and for the Railway (reviewer) and Vercel (dashboard) dashboards. Do NOT commit them.

**Verification:** You can log into the project and see an empty Traces view.

---

### Task 2: Python tracing seam (`observability/tracing.py`)

**Files:**
- Create: `observability/__init__.py` (empty — marks the new shared package), `observability/tracing.py`
- Create: `tests/test_tracing.py`
- Modify: `requirements.txt`, `pyproject.toml` (add `langfuse>=3` dep **and** register the new `observability` package)

> **Module location (user decision, 2026-06-28):** the Python tracing seam lives in a **neutral top-level `observability/` package**, not under `reviewer/`, so the reviewer cron, the discovery cron, and future surfaces all import `from observability import tracing` without one service importing another. This is the canonical owner of the seam; Tasks 3, 4, 4b, and 9 import it from here.

**Interfaces:**
- Produces: `tracing.tracing_enabled() -> bool`; `tracing.get_langfuse()` → client or `None`; `tracing.sample_rate() -> float`; `tracing.should_sample() -> bool`; `tracing.identity(*, user_id=None, session_id=None, tags=None)` → context manager; `tracing.flush() -> None`.

- [ ] **Step 1: Add the dependency and register the package.**

In `requirements.txt` add a line under `openai>=1.50.0`:
```
langfuse>=3
```
In `pyproject.toml` `[project].dependencies` add `"langfuse>=3",`. In the same file, add the new package to `[tool.setuptools]` so it ships in the Railway builds (both crons import it):
```toml
[tool.setuptools]
packages = ["poller", "poller.adapters", "reviewer", "discovery", "observability"]
```
Create an empty `observability/__init__.py` (package marker). Then:
```bash
cd /Users/andrew/Scripts/job-board && pip install -e '.[dev]'
```
Expected: installs `langfuse` 3.x without error; `python -c "from observability import tracing"` imports cleanly once Step 4 lands.

- [ ] **Step 2: Write the failing tests.**

Create `tests/test_tracing.py`:
```python
import importlib

from observability import tracing


def test_disabled_when_keys_absent(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    assert tracing.tracing_enabled() is False
    assert tracing.get_langfuse() is None


def test_enabled_when_keys_present(monkeypatch):
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-lf-x")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-lf-x")
    assert tracing.tracing_enabled() is True


def test_sample_rate_defaults_and_clamps(monkeypatch):
    monkeypatch.delenv("LANGFUSE_SAMPLE_RATE", raising=False)
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "0.15")
    assert tracing.sample_rate() == 0.15
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "9")
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "junk")
    assert tracing.sample_rate() == 1.0


def test_identity_is_nullcontext_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    with tracing.identity(user_id="u", session_id="s", tags=["t"]):
        pass  # must not raise


def test_flush_is_noop_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    tracing.flush()  # must not raise
```

- [ ] **Step 3: Run tests — verify they fail.**

Run: `pytest tests/test_tracing.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'observability.tracing'`.

- [ ] **Step 4: Implement `observability/tracing.py`.**

```python
import os
import random
from contextlib import nullcontext

_CLIENT = None
_INITIALIZED = False


def tracing_enabled() -> bool:
    return bool(os.environ.get("LANGFUSE_PUBLIC_KEY")) and bool(
        os.environ.get("LANGFUSE_SECRET_KEY")
    )


def get_langfuse():
    """Cached Langfuse client, or None when tracing is disabled."""
    global _CLIENT, _INITIALIZED
    if not tracing_enabled():
        return None
    if not _INITIALIZED:
        from langfuse import get_client  # lazy: avoid import at module load

        _CLIENT = get_client()  # reads LANGFUSE_* from env
        _INITIALIZED = True
    return _CLIENT


def sample_rate() -> float:
    raw = os.environ.get("LANGFUSE_SAMPLE_RATE")
    if not raw or not raw.strip():
        return 1.0
    try:
        return max(0.0, min(1.0, float(raw)))
    except ValueError:
        return 1.0


def should_sample() -> bool:
    return random.random() < sample_rate()


def identity(*, user_id=None, session_id=None, tags=None):
    """Context manager that sets trace identity, or nullcontext when disabled."""
    if get_langfuse() is None:
        return nullcontext()
    from langfuse import propagate_attributes

    return propagate_attributes(
        user_id=user_id,
        session_id=str(session_id) if session_id is not None else None,
        tags=tags or [],
    )


def flush() -> None:
    client = get_langfuse()
    if client is not None:
        client.flush()
```

> NOTE: `get_client()` is cached via the module global; `monkeypatch` in `test_enabled_when_keys_present` only checks the boolean (it does not call `get_client`, which would need a network reachable host). If a test needs a real client, reset `_INITIALIZED` and `_CLIENT` in a fixture.

- [ ] **Step 5: Run tests — verify they pass.**

Run: `pytest tests/test_tracing.py -v`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit.**

```bash
git add observability/__init__.py observability/tracing.py tests/test_tracing.py requirements.txt pyproject.toml
git commit -m "feat(observability): shared Langfuse tracing seam (no-op when keys absent)"
```

---

### Task 3: Instrument reviewer LLM generations (`reviewer/llm.py`)

**Files:**
- Modify: `reviewer/llm.py` (refactor `_parse`, add `stage` arg to `stage1`/`stage2`)
- Modify: `tests/test_llm.py` (add a tracing-on test; existing tests stay valid)

**Interfaces:**
- Consumes: `tracing.get_langfuse()` from Task 2.
- Produces: `ReviewClient._call(...)` returns `(parsed, usage)`; `ReviewClient._parse(..., stage: int)` returns `parsed`; `stage1`/`stage2` unchanged externally.

- [ ] **Step 1: Write the failing test (tracing-on path).**

Add to `tests/test_llm.py`:
```python
def test_stage1_creates_generation_when_tracing_enabled(monkeypatch):
    import types as _t
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            events["create"] = kw
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="SRE", company="Acme", location="Remote")
    )
    assert out.decision == "pass"
    assert events["create"]["as_type"] == "generation"
    assert events["create"]["model"] == "m1"
    assert events["create"]["name"] == "stage1"
    assert "output" in events["update"]
```

- [ ] **Step 2: Run — verify it fails.**

Run: `pytest tests/test_llm.py::test_stage1_creates_generation_when_tracing_enabled -v`
Expected: FAIL — `_parse` does not consult `tracing` / no `create` event recorded.

- [ ] **Step 3: Implement the refactor in `reviewer/llm.py`.**

Add import near the top (after existing imports):
```python
from observability import tracing
```
Replace the `_parse` method (lines 72-87) with a `_call` helper + a thin traced `_parse`:
```python
    async def _call(self, *, model: str, max_tokens: int, system: str, user: str, schema):
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
        return msg.parsed, getattr(resp, "usage", None)

    async def _parse(self, *, model: str, max_tokens: int, system: str, user: str,
                     schema, stage: int):
        lf = tracing.get_langfuse()
        if lf is None:
            parsed, _ = await self._call(
                model=model, max_tokens=max_tokens, system=system, user=user, schema=schema
            )
            return parsed
        with lf.start_as_current_observation(
            as_type="generation",
            name=f"stage{stage}",
            model=model,
            input=[{"role": "system", "content": system},
                   {"role": "user", "content": user}],
        ) as gen:
            parsed, usage = await self._call(
                model=model, max_tokens=max_tokens, system=system, user=user, schema=schema
            )
            gen.update(
                output=parsed.model_dump(),
                usage_details={
                    "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                    "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
                } if usage is not None else None,
            )
            return parsed
```
Update the two callers to pass `stage`:
- In `stage1` (was line 91-96): add `stage=1` to the `_parse(...)` call.
- In `stage2` (was line 100-107): add `stage=2` to the `_parse(...)` call.

- [ ] **Step 4: Run the full llm test file — verify all pass.**

Run: `pytest tests/test_llm.py -v`
Expected: PASS — the new test plus all existing tests (existing tests run with tracing disabled because no `LANGFUSE_*` env is set, so they take the `_call` path; the fake's `beta.chat.completions.parse` surface is unchanged).

- [ ] **Step 5: Commit.**

```bash
git add reviewer/llm.py tests/test_llm.py
git commit -m "feat(reviewer): trace stage-1/2 as Langfuse generations with token usage"
```

---

### Task 4: Per-job trace identity, metadata, and flush (`reviewer/run.py`)

**Files:**
- Modify: `reviewer/run.py` (`review_one`, `review_batch`, `_review_user`, `review_all`)
- Modify: `tests/test_reviewer_run.py` (add tracing-on + flush tests; existing tests stay valid)

**Interfaces:**
- Consumes: `tracing.get_langfuse()`, `tracing.should_sample()`, `tracing.identity(...)`, `tracing.flush()`.
- Produces: `review_one(candidate, profile_block, client, *, user_id=None, run_id=None)`; `review_batch(candidates, profile_block, client, concurrency, *, user_id=None, run_id=None)`. Both keep current positional call sites working.

- [ ] **Step 1: Write the failing tests.**

Add to `tests/test_reviewer_run.py`:
```python
def test_review_one_traces_when_enabled_and_sampled(monkeypatch):
    from observability import tracing
    seen = {"trace": None, "spans": 0}

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass

    class _LF:
        def start_as_current_observation(self, **kw):
            seen["spans"] += 1
            return _Span()
        def update_current_trace(self, **kw):
            seen["trace"] = kw

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: True)
    monkeypatch.setattr(tracing, "identity", lambda **kw: __import__("contextlib").nullcontext())

    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client, user_id="u1", run_id=7))
    assert res.verdict == "approve"
    assert seen["spans"] == 1
    assert seen["trace"]["metadata"]["verdict"] == "approve"


def test_review_one_skips_span_when_not_sampled(monkeypatch):
    from observability import tracing
    calls = {"n": 0}

    class _LF:
        def start_as_current_observation(self, **kw):
            calls["n"] += 1
            raise AssertionError("should not create a span when not sampled")

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: False)
    res = asyncio.run(review_one(_cand("SRE"), "P", StubClient(), user_id="u1", run_id=7))
    assert res.verdict == "approve"  # review still runs
    assert calls["n"] == 0
```

- [ ] **Step 2: Run — verify failure.**

Run: `pytest tests/test_reviewer_run.py::test_review_one_traces_when_enabled_and_sampled tests/test_reviewer_run.py::test_review_one_skips_span_when_not_sampled -v`
Expected: FAIL — `review_one()` got an unexpected keyword argument `user_id`.

- [ ] **Step 3: Implement in `reviewer/run.py`.**

Add import:
```python
from observability import tracing
```
Rename the current `review_one` body to `_review_one_inner` (keep its logic verbatim), then add the traced wrapper:
```python
async def _review_one_inner(candidate: dict, profile_block: str, client) -> ReviewResult:
    # ... existing body of review_one, unchanged ...


async def review_one(candidate: dict, profile_block: str, client,
                     *, user_id: str | None = None, run_id=None) -> ReviewResult:
    lf = tracing.get_langfuse()
    if lf is None or not tracing.should_sample():
        return await _review_one_inner(candidate, profile_block, client)
    with tracing.identity(user_id=user_id, session_id=run_id, tags=["reviewer"]):
        with lf.start_as_current_observation(
            as_type="span", name="job-review",
            input={"job_id": candidate["id"], "title": candidate.get("title")},
        ) as span:
            res = await _review_one_inner(candidate, profile_block, client)
            metadata = {
                "job_id": res.job_id, "stage1_decision": res.stage1_decision,
                "verdict": res.verdict, "fit_score": res.fit_score,
                "error": res.error,
            }
            lf.update_current_trace(user_id=user_id,
                                    session_id=str(run_id) if run_id is not None else None,
                                    metadata=metadata)
            span.update(output={"verdict": res.verdict, "fit_score": res.fit_score})
            return res
```
Thread identity through the batch (was line 107-115):
```python
async def review_batch(candidates: list[dict], profile_block: str, client,
                       concurrency: int, *, user_id: str | None = None,
                       run_id=None) -> list[ReviewResult]:
    sem = asyncio.Semaphore(concurrency)

    async def _guarded(c: dict) -> ReviewResult:
        async with sem:
            return await review_one(c, profile_block, client,
                                    user_id=user_id, run_id=run_id)

    return await asyncio.gather(*[_guarded(c) for c in candidates])
```
In `_review_user` pass identity to the batch (was line 143):
```python
        results = asyncio.run(review_batch(
            candidates, profile_block, client, config.CONCURRENCY,
            user_id=user_id, run_id=run_id,
        ))
```
In `review_all`, flush after the loop (was line 179-180):
```python
    try:
        for profile in profiles:
            _review_user(conn, profile)
    finally:
        tracing.flush()
```

- [ ] **Step 4: Run the reviewer-run tests (non-DB) — verify pass.**

Run: `pytest tests/test_reviewer_run.py -v -m "not integration"`
Expected: PASS — new tracing tests pass; all existing `review_one`/`review_batch` tests pass (tracing disabled by default → inner path).

- [ ] **Step 5: Commit.**

```bash
git add reviewer/run.py tests/test_reviewer_run.py
git commit -m "feat(reviewer): per-job trace identity/metadata + sampling + flush"
```

---

### Task 4b: Instrument the company-discovery service (`discovery/llm.py` + `discovery/run.py`)

> Added during the 2026-06-28 rebase onto `main`. The discovery cron is a structural twin of the reviewer, so this single task combines the equivalents of Task 3 (LLM generation) and Task 4 (per-item span + identity + flush). **It depends only on Task 2** (the `observability/tracing.py` seam) and is independent of the dashboard track (Tasks 6–8). One LLM call per company → one `company-review` span (trace root) with one nested `company-screen` generation = **3 units/company** (≤ 500/week, sampled).

**Files:**
- Modify: `discovery/llm.py` (refactor `review()` into `_call` + a traced wrapper; reuse `observability/tracing.py`)
- Modify: `discovery/run.py` (add `review_company_one`; thread `user_id`/`run_id` through `review_batch`/`_review_user`; flush in `run()`)
- Modify: `discovery/__main__.py` (belt-and-suspenders flush)
- Modify: `tests/test_discovery_llm.py`, `tests/test_discovery_run.py` (add tracing-on tests; existing tests stay valid)

**Interfaces:**
- Consumes: `tracing.get_langfuse()`, `tracing.should_sample()`, `tracing.identity(...)`, `tracing.flush()` from Task 2.
- Produces: `CompanyReviewClient._call(...)` → `(parsed, usage)`; `review()` unchanged externally; `review_company_one(c, company_block, client, *, user_id=None, run_id=None)`; `review_batch(..., *, user_id=None, run_id=None)` (keeps existing positional call sites — tests call it positionally).

- [ ] **Step 1: Write the failing tests.**

Add to `tests/test_discovery_llm.py`:
```python
def test_review_creates_generation_when_tracing_enabled(monkeypatch):
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            events["create"] = kw
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="x")
    client = CompanyReviewClient(client=_Client(parsed), model="m")
    out = asyncio.run(
        client.review(company_block="P", name="Linear", ats="ashby", token="linear"))
    assert out.verdict == "include"
    assert events["create"]["as_type"] == "generation"
    assert events["create"]["name"] == "company-screen"
    assert events["create"]["model"] == "m"
    assert "output" in events["update"]
```
Add to `tests/test_discovery_run.py` (uses the existing `StubClient`/`_cands`):
```python
def test_review_company_one_traces_when_sampled(monkeypatch):
    from observability import tracing
    import contextlib
    from discovery.run import review_company_one

    seen = {"trace": None, "spans": 0}

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass

    class _LF:
        def start_as_current_observation(self, **kw):
            seen["spans"] += 1
            return _Span()
        def update_current_trace(self, **kw):
            seen["trace"] = kw

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: True)
    monkeypatch.setattr(tracing, "identity", lambda **kw: contextlib.nullcontext())

    c = {"id": 1, "name": "Linear", "ats": "greenhouse", "token": "linear"}
    res = asyncio.run(review_company_one(c, "P", StubClient(), user_id="u1", run_id=7))
    assert res.verdict == "include"
    assert seen["spans"] == 1
    assert seen["trace"]["metadata"]["verdict"] == "include"


def test_review_company_one_skips_span_when_not_sampled(monkeypatch):
    from observability import tracing
    from discovery.run import review_company_one

    class _LF:
        def start_as_current_observation(self, **kw):
            raise AssertionError("should not create a span when not sampled")

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: False)
    c = {"id": 1, "name": "Linear", "ats": "greenhouse", "token": "linear"}
    res = asyncio.run(review_company_one(c, "P", StubClient(), user_id="u1", run_id=7))
    assert res.verdict == "include"  # review still runs
```

- [ ] **Step 2: Run — verify failure.**

Run: `pytest tests/test_discovery_llm.py tests/test_discovery_run.py -v -m "not integration"`
Expected: FAIL — `cannot import name 'review_company_one'` and no `create`/`update` events recorded.

- [ ] **Step 3: Implement in `discovery/llm.py`.**

Add the import near the top (with the other imports):
```python
from observability import tracing
```
Replace `review()` (lines 60-80) with a `_call` helper + a traced `review`:
```python
    async def _call(self, *, system: str, user: str):
        try:
            resp = await self._client.beta.chat.completions.parse(
                model=self.model, max_tokens=700,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format=CompanyReviewResult,
            )
        except Exception as exc:
            if _is_out_of_credits(exc):
                raise OutOfCreditsError(str(exc)) from exc
            raise
        msg = resp.choices[0].message
        if getattr(msg, "refusal", None):
            raise ValueError(f"model refused: {msg.refusal}")
        if msg.parsed is None:
            raise ValueError("OpenRouter returned no parsed output")
        return msg.parsed, getattr(resp, "usage", None)

    async def review(self, *, company_block: str, name: str, ats: str,
                     token: str) -> CompanyReviewResult:
        system = f"{company_block}\n\n{_INSTRUCTIONS}"
        user = f"Company: {name}\nATS: {ats}\nSlug: {token}"
        lf = tracing.get_langfuse()
        if lf is None:
            parsed, _ = await self._call(system=system, user=user)
            return parsed
        with lf.start_as_current_observation(
            as_type="generation", name="company-screen", model=self.model,
            input=[{"role": "system", "content": system},
                   {"role": "user", "content": user}],
        ) as gen:
            parsed, usage = await self._call(system=system, user=user)
            gen.update(
                output=parsed.model_dump(),
                usage_details={
                    "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                    "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
                } if usage is not None else None,
            )
            return parsed
```
> The `OutOfCreditsError`/refusal/`None`-parsed paths move into `_call` unchanged and still propagate out through the generation context (its `__exit__` re-raises), so `review_batch`'s halt/per-company-isolation logic is preserved.

- [ ] **Step 4: Implement in `discovery/run.py`.**

Add the import (with the existing `from discovery...` imports):
```python
from observability import tracing
```
Add the traced per-company helper above `review_batch`:
```python
async def review_company_one(c: dict, company_block: str, client,
                             *, user_id: str | None = None, run_id=None):
    """One traced company review. Returns the parsed result; raises on failure
    (OutOfCreditsError included) so review_batch's per-company handling is intact."""
    lf = tracing.get_langfuse()
    if lf is None or not tracing.should_sample():
        return await client.review(company_block=company_block, name=c["name"],
                                   ats=c["ats"], token=c["token"])
    with tracing.identity(user_id=user_id, session_id=run_id, tags=["discovery"]):
        with lf.start_as_current_observation(
            as_type="span", name="company-review",
            input={"company_id": c["id"], "name": c["name"], "ats": c["ats"]},
        ) as span:
            res = await client.review(company_block=company_block, name=c["name"],
                                      ats=c["ats"], token=c["token"])
            lf.update_current_trace(
                user_id=user_id,
                session_id=str(run_id) if run_id is not None else None,
                metadata={"company_id": c["id"], "verdict": res.verdict,
                          "confidence": res.confidence, "industry": res.industry},
            )
            span.update(output={"verdict": res.verdict, "industry": res.industry})
            return res
```
In `review_batch`, add the keyword-only identity args and route `_guarded` through the helper (was lines 15-39):
```python
async def review_batch(candidates: list[dict], company_block: str, client,
                       concurrency: int, *, user_id: str | None = None, run_id=None):
    sem = asyncio.Semaphore(concurrency)
    halt = asyncio.Event()

    async def _guarded(c: dict):
        if halt.is_set():
            return None
        async with sem:
            if halt.is_set():
                return None
            try:
                res = await review_company_one(c, company_block, client,
                                               user_id=user_id, run_id=run_id)
                return (c["id"], res, None)
            except OutOfCreditsError:
                halt.set()  # stop launching new work; in-flight calls finish
                return None
            except Exception as exc:  # per-company isolation
                return (c["id"], None, f"{type(exc).__name__}: {exc}")

    out = await asyncio.gather(*[_guarded(c) for c in candidates])
    return [r for r in out if r is not None], halt.is_set()
```
In `_review_user`, pass identity to the batch (was lines 56-57):
```python
        results, halted = asyncio.run(
            review_batch(candidates, company_block, client, config.CONCURRENCY,
                         user_id=user_id, run_id=run_id))
```
In `run()`, flush in the `finally` (was lines 113-115):
```python
    finally:
        tracing.flush()
        if own:
            conn.close()
```

- [ ] **Step 5: Belt-and-suspenders flush in `discovery/__main__.py`.**

Wrap the `run()` call:
```python
def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        run()
    finally:
        from observability import tracing
        tracing.flush()
```

- [ ] **Step 6: Run the discovery tests — verify pass.**

Run: `pytest tests/test_discovery_llm.py tests/test_discovery_run.py -v -m "not integration"`
Expected: PASS — new tracing tests pass; existing tests pass (tracing disabled by default → the `lf is None` path, and `review_batch` positional call sites still work).

- [ ] **Step 7: Commit.**
```bash
git add discovery/llm.py discovery/run.py discovery/__main__.py \
        tests/test_discovery_llm.py tests/test_discovery_run.py
git commit -m "feat(discovery): trace company screening (generation + per-company span, sampled)"
```

- [ ] **Step 8: Deploy config (manual).** The discovery cron is a **separate Railway service** (`railway.discovery.json`, `python -m discovery`). Add `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` to **that** service's env too (in addition to the poller/reviewer service in Task 5 Step 5). Leave `LANGFUSE_SAMPLE_RATE` unset (=1.0); set it low before the first large discovery backlog drain, then restore.

---

### Task 5: Reviewer env docs + live verification + cost setup

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document env vars.** Append to `.env.example`:
```
# Langfuse (LLM observability). Free Hobby tier: https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
# Fraction of job reviews to trace (1.0 = all). Lower during large backfills to save free-tier units.
LANGFUSE_SAMPLE_RATE=1.0
```

- [ ] **Step 2: Commit docs.**
```bash
git add .env.example
git commit -m "docs: document LANGFUSE_* env vars for reviewer"
```

- [ ] **Step 3: Live smoke (manual).** With real keys exported locally and a populated `TEST_DATABASE_URL`/dev DB containing a profile + a few jobs, run:
```bash
LANGFUSE_PUBLIC_KEY=... LANGFUSE_SECRET_KEY=... LANGFUSE_HOST=https://cloud.langfuse.com \
  python -m reviewer
```
**Verify in Langfuse UI:** one trace per job named `job-review`; nested `stage1` (+ `stage2` when gated through) generations; `user_id` and `session_id` (= run_id) populated; token counts present; trace metadata shows `verdict`/`fit_score`. Confirm the process exited cleanly (flush worked — traces appear within seconds).

- [ ] **Step 4: Cost tracking (manual, Langfuse UI).** Settings → Models → add custom model definitions so OpenRouter slugs get prices: at minimum `deepseek/deepseek-v4-flash` and `anthropic/claude-haiku-4.5` (match pattern on the model string; set input/output per-token prices from OpenRouter). **Verify:** new traces show non-zero cost.

- [ ] **Step 5: Deploy config.** Add `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` to the **poller/reviewer** Railway service env (and, per Task 4b Step 8, the separate **discovery** Railway service). Leave `LANGFUSE_SAMPLE_RATE` unset (=1.0) for steady state; set it low (e.g. `0.1`) before any large backfill run, then restore. Redeploy; confirm the next cron run produces traces. *(The `deepseek/deepseek-v4-flash` custom model definition from Step 4 covers both the reviewer and discovery, since discovery defaults to the same model.)*

---

### Task 6: Dashboard SDK setup (`instrumentation.ts` + helper + deps)

**Files:**
- Create: `dashboard/instrumentation.ts`
- Create: `dashboard/lib/observability.ts`
- Modify: `dashboard/package.json`
- Modify: `dashboard/.env.example`

**Interfaces:**
- Produces: `langfuseSpanProcessor` (exported, possibly `undefined`); `register()`; `tracingEnabled(): boolean`.

- [ ] **Step 1: Install deps.**
```bash
cd /Users/andrew/Scripts/job-board/dashboard
npm install @langfuse/otel @langfuse/tracing @opentelemetry/sdk-node
```
Expected: added to `dependencies` (current v5-compatible majors).

- [ ] **Step 2: Create `dashboard/lib/observability.ts`.**
```ts
export function tracingEnabled(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}
```

- [ ] **Step 3: Create `dashboard/instrumentation.ts`** (Next.js auto-runs `register()`):
```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const langfuseSpanProcessor = process.env.LANGFUSE_PUBLIC_KEY
  ? new LangfuseSpanProcessor({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
    })
  : undefined;

export function register() {
  if (!langfuseSpanProcessor) return; // no-op when keys absent
  new NodeSDK({ spanProcessors: [langfuseSpanProcessor] }).start();
}
```
> Verify against the installed `@langfuse/otel` version that `LangfuseSpanProcessor` accepts `{publicKey, secretKey, baseUrl}`; if it reads only env, drop the args. Next.js 15 loads `instrumentation.ts` at the project root automatically (no experimental flag).

- [ ] **Step 4: Document env.** Append to `dashboard/.env.example`:
```
# Langfuse (LLM observability) — same project as the reviewer
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

- [ ] **Step 5: Verify build is clean (tracing off).**
```bash
npm run build
```
Expected: build succeeds with no Langfuse env set (instrumentation is inert).

- [ ] **Step 6: Commit.**
```bash
git add package.json package-lock.json instrumentation.ts lib/observability.ts .env.example
git commit -m "feat(dashboard): Langfuse v5 OTel instrumentation scaffold (no-op without keys)"
```

---

### Task 7: Instrument résumé generation (`dashboard/lib/rolefit/resumeClient.ts`)

**Files:**
- Modify: `dashboard/lib/rolefit/resumeClient.ts`
- Modify: `dashboard/lib/rolefit/resumeClient.test.ts` (keep green; add a usage-capture assertion)

**Interfaces:**
- Consumes: `startObservation` from `@langfuse/tracing`; `tracingEnabled()`.
- Produces: `generateResume` signature unchanged (keeps `fetchImpl`).

- [ ] **Step 1: Confirm existing test passes (baseline).**
```bash
cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/rolefit/resumeClient.test.ts
```
Expected: PASS (tracing off → no behavior change).

- [ ] **Step 2: Implement instrumentation.** In `resumeClient.ts`, add imports:
```ts
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";
```
Capture `usage` from the response and wrap the call. Change the response type and body of `generateResume` to:
```ts
  const doFetch = args.fetchImpl ?? fetch;
  const { system, user } = buildResumePrompt({ resumeText: args.resumeText, job: args.job });
  const gen = tracingEnabled()
    ? startObservation(
        "resume-generation",
        { model: args.model, input: [{ role: "system", content: system }, { role: "user", content: user }] },
        { asType: "generation" },
      )
    : null;
  try {
    const res = await doFetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "job-board",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 4000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: RESUME_JSON_SCHEMA,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter résumé request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let parsed: TailoredResume;
    try { parsed = JSON.parse(content) as TailoredResume; }
    catch { throw new Error("OpenRouter returned non-JSON résumé content"); }
    if (!parsed.name || !Array.isArray(parsed.experience)) {
      throw new Error("OpenRouter résumé missing required fields");
    }
    gen?.update({
      output: parsed,
      usageDetails: json.usage
        ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
        : undefined,
    });
    return parsed;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: (e as Error).message });
    throw e;
  } finally {
    gen?.end();
  }
```

- [ ] **Step 3: Run the test — verify still green.**
```bash
npx vitest run lib/rolefit/resumeClient.test.ts
```
Expected: PASS. (Tracing is off in the test env, so `gen` is `null`; the `fetchImpl` stub and assertions are unaffected. If a test sets `LANGFUSE_*`, unset it in that test.)

- [ ] **Step 4: Commit.**
```bash
git add lib/rolefit/resumeClient.ts lib/rolefit/resumeClient.test.ts
git commit -m "feat(dashboard): trace résumé generation as a Langfuse generation"
```

---

### Task 8: Résumé route identity + serverless flush (`dashboard/app/api/resume/route.ts`)

**Files:**
- Modify: `dashboard/app/api/resume/route.ts`

- [ ] **Step 1: Implement.** Replace the imports/handler to add identity + flush, preserving every existing status path:
```ts
import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForResume } from "@/lib/queries";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForResume(jobId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  const run = async () => {
    const resume = await generateResume({
      resumeText: profile.resume_text,
      job: { title: job.title, company: job.company_name, description: job.description },
      model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
      apiKey,
    });
    return Response.json(resume);
  };

  try {
    if (tracingEnabled()) {
      const res = await propagateAttributes({ userId, sessionId: jobId }, run);
      if (langfuseSpanProcessor) after(async () => { await langfuseSpanProcessor.forceFlush(); });
      return res;
    }
    return await run();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck/build.**
```bash
cd /Users/andrew/Scripts/job-board/dashboard && npm run build
```
Expected: builds clean.

- [ ] **Step 3: Live verification (manual).** Set `LANGFUSE_*` + `OPENROUTER_API_KEY` locally, `npm run dev`, sign in, trigger a résumé generation for one job. **Verify in Langfuse UI:** a `resume-generation` trace with `userId` set, `sessionId` = jobId, model, token usage, and output captured; confirm it persisted (the `after()` flush fired) without keeping the dev server hanging.

- [ ] **Step 4: Commit + deploy config.**
```bash
git add app/api/resume/route.ts
git commit -m "feat(dashboard): résumé route trace identity + after() flush"
```
Add `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_HOST` to the Vercel project env (Production + Preview). Redeploy; trigger one résumé and confirm the trace appears.

---

### Task 9: Offline evals — datasets + experiments (`reviewer/experiments.py`)

**Files:**
- Create: `reviewer/experiments.py`
- Create: `tests/test_experiments.py`

**Interfaces:**
- Produces: `verdict_match(expected: str | None, actual: str | None) -> float`; `seed_dataset_from_reviews(conn, name: str, limit: int) -> int`; `run_experiment(name: str, run_name: str, client=None) -> int`.

> Purpose: compare models/prompts offline (e.g. the recent `deepseek/deepseek-v4-flash` switch) on a golden set, without touching the cron. Runs on demand; bounded item count keeps unit cost controlled. Tag runs so they are filterable and excluded from production dashboards.

- [ ] **Step 1: Write failing unit test for the pure scorer.**

Create `tests/test_experiments.py`:
```python
from reviewer.experiments import verdict_match


def test_verdict_match_exact_and_miss():
    assert verdict_match("approve", "approve") == 1.0
    assert verdict_match("approve", "deny") == 0.0
    assert verdict_match(None, "approve") == 0.0
```

- [ ] **Step 2: Run — verify fail.**

Run: `pytest tests/test_experiments.py::test_verdict_match_exact_and_miss -v`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Implement `reviewer/experiments.py`.**

```python
"""On-demand offline evals against a Langfuse dataset. Not run by the cron."""
import asyncio

from observability import tracing
from reviewer import db
from reviewer.jd import extract_description
from reviewer.llm import ReviewClient, build_profile_block
from reviewer.run import review_one

_NO_JD = "(no description available)"


def verdict_match(expected, actual) -> float:
    if not expected or not actual:
        return 0.0
    return 1.0 if expected == actual else 0.0


def seed_dataset_from_reviews(conn, name: str, limit: int) -> int:
    """Push recent stage-2 reviews as dataset items: input=job fields, expected=verdict."""
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot seed dataset")
    lf.create_dataset(name=name)
    rows = db.recent_stage2_reviews(conn, limit)  # see Step 3b
    for r in rows:
        lf.create_dataset_item(
            dataset_name=name,
            input={"title": r["title"], "company_name": r["company_name"],
                   "location": r["location"], "ats": r["ats"], "raw": r["raw"],
                   "resume_text": r["resume_text"], "instructions": r["instructions"]},
            expected_output={"verdict": r["verdict"]},
        )
    lf.flush()
    return len(rows)


def run_experiment(name: str, run_name: str, client=None) -> int:
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot run experiment")
    client = client or ReviewClient()
    dataset = lf.get_dataset(name)
    n = 0
    for item in dataset.items:
        n += 1
        with item.run(run_name=run_name) as root:
            cand = {"id": f"exp:{n}", **item.input}
            block = build_profile_block(item.input.get("resume_text"),
                                        item.input.get("instructions"))
            res = asyncio.run(review_one(cand, block, client))
            root.update(output={"verdict": res.verdict, "fit_score": res.fit_score})
            expected = (item.expected_output or {}).get("verdict")
            root.score_trace(name="verdict_match",
                             value=verdict_match(expected, res.verdict))
    lf.flush()
    return n
```

- [ ] **Step 3b: Add the DB helper.** In `reviewer/db.py`, add `recent_stage2_reviews(conn, limit)` returning rows joined across `job_reviews` + `jobs` + `profiles` (fields used above). Follow the existing query style in `reviewer/db.py`; write a matching unit/integration test mirroring `tests/test_reviewer_db.py` conventions.

- [ ] **Step 4: Add a stubbed smoke test for `run_experiment`.**

Append to `tests/test_experiments.py`:
```python
def test_run_experiment_iterates_items(monkeypatch):
    from reviewer import experiments, tracing

    class _Root:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass
        def score_trace(self, **kw): pass

    class _Item:
        input = {"title": "SRE", "company_name": "Acme", "location": "Remote",
                 "ats": "lever", "raw": {"descriptionPlain": "jd"},
                 "resume_text": "r", "instructions": "i"}
        expected_output = {"verdict": "approve"}
        def run(self, **kw): return _Root()

    class _DS:
        items = [_Item(), _Item()]

    class _LF:
        def get_dataset(self, name): return _DS()
        def flush(self): pass

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    from tests.test_reviewer_run import StubClient
    n = experiments.run_experiment("golden", "exp-1", client=StubClient())
    assert n == 2
```
> Verify `item.run(...)` / `root.score_trace(...)` / `create_dataset_item(...)` names against the installed langfuse v3 (docs: langfuse.com/docs/evaluation). Adjust the thin wrapper if the SDK differs; the pure `verdict_match` logic is unaffected.

- [ ] **Step 5: Run tests.**

Run: `pytest tests/test_experiments.py -v -m "not integration"`
Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add reviewer/experiments.py reviewer/db.py tests/test_experiments.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): offline dataset experiments with verdict-match scoring"
```

- [ ] **Step 7: Live (manual).** With keys set: `python -c "from poller.db import connect; from reviewer.experiments import seed_dataset_from_reviews as s; s(connect(), 'reviewer-golden', 30)"`, hand-curate/verify expected verdicts in the UI, then `run_experiment("reviewer-golden", "deepseek-v4-flash")`. **Verify:** a dataset run appears with `verdict_match` scores; re-run under a different `REVIEW_MODEL_STAGE2` to compare.

---

### Task 10: Production LLM-as-judge (sampled, Langfuse UI) + final verification

Mostly Langfuse UI configuration; the sampling that bounds its unit cost is already enforced by Task 4's `LANGFUSE_SAMPLE_RATE` (the judge only sees traces that exist).

- [ ] **Step 1: Configure a judge LLM connection.** Langfuse → Settings → LLM Connections → add an OpenAI-compatible provider pointing at OpenRouter (`https://openrouter.ai/api/v1`, the same `OPENROUTER_API_KEY`), selecting a cheap judge model.
- [ ] **Step 2: Create the evaluator.** Evaluation → Evaluators → new LLM-as-judge from a template (e.g. Correctness/Helpfulness) or custom ("Does the reasoning justify the verdict?"). Scope it to **reviewer Stage-2 traces** (filter: trace name `job-review` / tag `reviewer`, and an output present). Set **sampling ~15%**. Map evaluator input/output variables to the trace's input/output.
- [ ] **Step 2b (fallback, only if Hobby gates evaluators):** instead run the judge in-code on the sampled jobs (one extra OpenRouter call in `review_one`) and push `langfuse.create_score(name="reasoning_quality", value=..., trace_id=...)`. Same 1-unit-per-score cost, no dependency on the hosted-evaluator feature.
- [ ] **Step 3: Verify.** After a reviewer run, confirm ~15% of stage-2 traces carry a judge score; check the score distribution dashboard.

- [ ] **Step 4: Full suite green.**
```bash
cd /Users/andrew/Scripts/job-board && pytest -q -m "not integration"
cd dashboard && npm run build && npx vitest run
```
Expected: all pass.

- [ ] **Step 5: Unit-budget sanity (manual).** In Langfuse, check the usage meter trend after a normal (non-backfill) cron run; confirm it projects under 50k/mo. Document the backfill rule in the repo README or `.env.example` comment: set `LANGFUSE_SAMPLE_RATE` low for the first large run, then restore to `1.0`.

- [ ] **Step 6: Final commit (docs).**
```bash
git add -A && git commit -m "docs: Langfuse free-tier unit-budget + backfill guidance"
```

---

## Self-Review

**Spec coverage:** Tracing on reviewer (Tasks 2–5) ✓; tracing on discovery (Task 4b, added in the 2026-06-28 rebase) ✓; tracing on dashboard (Tasks 6–8) ✓; evals = datasets/experiments (Task 9) + LLM-as-judge (Task 10) ✓; Cloud Hobby + cost tracking (Task 1, Task 5 Step 4) ✓; no-op gating, sampling, flush, unit budget (Global Constraints + Tasks 2/4/4b/8/10) ✓; both `.env.example` files + deploy config for both Railway services + Vercel ✓. Prompt management intentionally excluded ✓.

**Placeholder scan:** Concrete code in every code step. Two external-SDK call shapes (langfuse v3 dataset-run API; `@langfuse/otel` constructor) carry explicit one-line "verify against installed version" notes rather than guesses — these are real API-surface confirmations to do at implementation time, not deferred work.

**Type consistency:** `tracing.get_langfuse()/should_sample()/identity()/flush()` defined in Task 2 and consumed identically in Tasks 3–4 and **Task 4b** (the discovery surface reuses the same Python seam); `_call` returns `(parsed, usage)` consumed by `_parse` in Task 3 and by `review()` in Task 4b; `review_one(..., user_id=, run_id=)` defined in Task 4 and called by `review_batch`/`_review_user` (and the analogous `review_company_one(..., user_id=, run_id=)` in Task 4b); `tracingEnabled()` defined in Task 6 and used in Tasks 7–8; `langfuseSpanProcessor` exported in Task 6 and imported in Task 8; `verdict_match` defined and used in Task 9.

## Open verification items (do at implementation time)
- `@langfuse/otel` `LangfuseSpanProcessor` constructor args vs env-only config; Next.js `register()` wiring with NodeSDK.
- langfuse v3 dataset/experiment API exact names (`item.run`, `score_trace`, `create_dataset_item`).
- Langfuse v3 wrapped client not needed (manual instrumentation used), but confirm `start_as_current_observation(as_type="generation"/"span")`, `update(usage_details=...)`, `update_current_trace(...)`, and `propagate_attributes(...)` signatures against the installed `langfuse` version.
- Whether Cloud Hobby caps hosted evaluators (drives Task 10 Step 2 vs 2b).
- Confirm OpenRouter returns `usage` on the dashboard `fetch` response (it does for chat/completions) so `usageDetails` populate.
