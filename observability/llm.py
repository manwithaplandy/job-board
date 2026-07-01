"""Shared traced OpenRouter LLM call helper.

Both reviewer and company_discovery pipelines delegate to
traced_structured_call so the generation-span / usage / cost logic lives in
one place and every outgoing request carries {"usage": {"include": true}} for
real cost accounting via OpenRouter.
"""

from observability import tracing


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


async def traced_structured_call(
    client,
    *,
    model: str,
    messages: list[dict],
    schema,
    name: str,
    metadata: dict,
) -> tuple:
    """Make a structured LLM call with a LangFuse generation span and cost accounting.

    Always adds {"usage": {"include": true}} to extra_body so OpenRouter returns
    the actual billed cost on usage.cost (Langfuse has no price entry for
    OpenRouter-prefixed slugs, so we must forward cost explicitly).

    Returns (parsed_result, usage) tuple. Raises OutOfCreditsError on HTTP 402.
    """
    try:
        resp = await client.beta.chat.completions.parse(
            model=model,
            messages=messages,
            response_format=schema,
            extra_body={"usage": {"include": True}},
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

    usage = getattr(resp, "usage", None)
    lf = tracing.get_langfuse()
    if lf is not None:
        with lf.start_as_current_observation(
            as_type="generation",
            name=name,
            model=model,
            input=messages,
            metadata=metadata,
        ) as gen:
            cost = getattr(usage, "cost", None)
            gen.update(
                output=msg.parsed.model_dump(),
                usage_details={
                    "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                    "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
                } if usage is not None else None,
                cost_details={"total": cost} if cost is not None else None,
            )

    return msg.parsed, usage
