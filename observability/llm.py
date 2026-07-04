"""Shared traced OpenRouter LLM call helper.

Both reviewer and company_discovery pipelines delegate to
traced_structured_call so the generation-span / usage / cost logic lives in
one place and every outgoing request carries {"usage": {"include": true}} for
real cost accounting via OpenRouter.
"""

import asyncio
import logging
import os
import time

import httpx

from observability import tracing

log = logging.getLogger("observability.llm")

# OpenRouter's authoritative per-generation stats endpoint. When usage.cost comes
# back 0/absent (the p50=$0 capture gap the spec flags), we confirm the real cost
# here. The stats are eventually consistent, so the fetch is bounded-retried.
_GENERATION_URL = "https://openrouter.ai/api/v1/generation"
_GENERATION_FETCH_ATTEMPTS = 3
_GENERATION_FETCH_BACKOFF = 0.5   # seconds between attempts (~2s total wall time cap)
_GENERATION_FETCH_TIMEOUT = 2.0   # per-request timeout


def _cached_input_tokens(usage) -> int:
    """Prompt tokens served from cache (Anthropic prompt caching on stage1_batch).

    OpenRouter mirrors OpenAI's shape: usage.prompt_tokens_details.cached_tokens.
    Absent/None → 0. Without this, cache-hit calls look mispriced.
    """
    details = getattr(usage, "prompt_tokens_details", None)
    if details is None:
        return 0
    if isinstance(details, dict):
        return int(details.get("cached_tokens") or 0)
    return int(getattr(details, "cached_tokens", 0) or 0)


async def _confirm_generation_cost(generation_id: str | None) -> float | None:
    """Confirm a generation's real USD cost via OpenRouter's stats endpoint.

    Bounded retry (the stats are eventually consistent). Returns the confirmed
    total_cost (which may legitimately be 0.0 — a CONFIRMED $0 is signal), or None
    when the id/key is missing or every attempt fails. Never raises: a failure here
    must never fail the review call it is only annotating.
    """
    if not generation_id:
        return None
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return None
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(_GENERATION_FETCH_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=_GENERATION_FETCH_TIMEOUT) as http:
                resp = await http.get(_GENERATION_URL, params={"id": generation_id},
                                      headers=headers)
            if resp.status_code == 200:
                data = (resp.json() or {}).get("data") or {}
                total = data.get("total_cost")
                if total is not None:
                    return float(total)
        except Exception as exc:  # network / parse — retry, never propagate
            log.debug("generation cost fetch attempt %s failed: %s", attempt + 1, exc)
        if attempt + 1 < _GENERATION_FETCH_ATTEMPTS:
            await asyncio.sleep(_GENERATION_FETCH_BACKOFF)
    log.warning("could not confirm cost for generation %s after %s attempts",
                generation_id, _GENERATION_FETCH_ATTEMPTS)
    return None


class OutOfCreditsError(Exception):
    """OpenRouter returned HTTP 402 (insufficient credits). Halt the pipeline; do not retry."""


def _is_out_of_credits(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) == 402 or getattr(exc, "status", None) == 402:
        return True
    resp = getattr(exc, "response", None)
    if resp is not None and getattr(resp, "status_code", None) == 402:
        return True
    text = str(exc).lower()
    return "402" in text and "credit" in text


async def _invoke(client, kwargs: dict) -> tuple:
    """Call the transport, convert 402→OutOfCreditsError, validate parsed output."""
    try:
        resp = await client.beta.chat.completions.parse(**kwargs)
    except Exception as exc:
        if _is_out_of_credits(exc):
            raise OutOfCreditsError(str(exc)) from exc
        raise
    msg = resp.choices[0].message
    if getattr(msg, "refusal", None):
        raise ValueError(f"model refused: {msg.refusal}")
    if msg.parsed is None:
        raise ValueError("OpenRouter returned no parsed output")
    return resp, msg


async def traced_structured_call(
    client,
    *,
    model: str,
    messages: list[dict],
    schema,
    name: str,
    metadata: dict,
    max_tokens: int | None = None,
    extra_body: dict | None = None,
) -> tuple:
    """Make a structured LLM call with a LangFuse generation span and cost accounting.

    Always adds {"usage": {"include": true}} to extra_body so OpenRouter returns
    the actual billed cost on usage.cost (Langfuse has no price entry for
    OpenRouter-prefixed slugs, so we must forward cost explicitly). A caller
    extra_body (e.g. Anthropic cache_control) is merged in, and max_tokens is
    forwarded when set.

    The generation span wraps the awaited API call so recorded latency reflects
    the call; a failure is recorded on the span before propagating.

    Returns (parsed_result, usage) tuple. Raises OutOfCreditsError on HTTP 402.
    """
    body = {"usage": {"include": True}}
    if extra_body:
        body.update(extra_body)
    kwargs = {"model": model, "messages": messages, "response_format": schema,
              "extra_body": body}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    lf = tracing.get_langfuse()
    if lf is None:
        resp, msg = await _invoke(client, kwargs)
        return msg.parsed, getattr(resp, "usage", None)

    # end_on_exit=False keeps the generation span OPEN after the `with` body so we can
    # attach the cost below and then end() it with an EXPLICIT end_time pinned to the
    # moment the API call returned (api_end_ns). The cost-confirmation retry loop is a
    # SECOND OpenRouter round-trip (only on the capture-gap path) — running it after the
    # span's timed window means it never inflates the recorded generation latency (minor 9).
    with lf.start_as_current_observation(
        as_type="generation",
        name=name,
        model=model,
        input=messages,
        metadata=metadata,
        end_on_exit=False,
    ) as gen:
        try:
            resp, msg = await _invoke(client, kwargs)
        except Exception as exc:
            gen.update(level="ERROR", status_message=str(exc))
            gen.end()
            raise
        # Generation latency stops HERE — the actual model call. Everything below (cost
        # confirmation especially) is annotation and must not count toward it.
        api_end_ns = time.time_ns()

    # try/finally guarantees the (end_on_exit=False) span is ended even if annotation
    # raises — so moving the tail out of the `with` can never leak an unclosed span.
    try:
        usage = getattr(resp, "usage", None)
        reported_cost = getattr(usage, "cost", None) if usage is not None else None

        # Trust usage.cost only when it's a real positive number. A 0/None is the capture
        # gap the spec flags — confirm it against OpenRouter's authoritative generation
        # stats. A CONFIRMED 0 is signal (recorded); an ASSUMED 0 is the bug (never
        # recorded). Unconfirmable → record NO cost, source='unknown'. This confirm runs
        # OUTSIDE the span's timed window (the span's end_time is pinned to api_end_ns).
        if reported_cost is not None and reported_cost > 0:
            cost, cost_source = reported_cost, "usage"
        else:
            confirmed = await _confirm_generation_cost(getattr(resp, "id", None))
            if confirmed is not None:
                cost, cost_source = confirmed, "generation_api"
            else:
                cost, cost_source = None, "unknown"

        usage_details = None
        if usage is not None:
            usage_details = {
                "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
            }
            cached = _cached_input_tokens(usage)
            if cached:
                usage_details["input_cached"] = cached

        gen.update(
            output=msg.parsed.model_dump(),
            usage_details=usage_details,
            cost_details={"total": cost} if cost is not None else None,
            # cost_source lets downstream analysis trust (or discount) each number; served
            # model is what OpenRouter actually routed to (may differ from the requested
            # slug), which matters for per-model cost attribution.
            metadata={**metadata, "cost_source": cost_source,
                      "served_model": getattr(resp, "model", None)},
        )
    finally:
        # Pin the end to the API-call completion so the confirm round-trip above is excluded.
        gen.end(end_time=api_end_ns)
    return msg.parsed, usage
