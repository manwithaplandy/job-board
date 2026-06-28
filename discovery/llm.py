import os

from discovery.schemas import CompanyReviewResult
from observability import tracing
from reviewer.schemas import TAXONOMY_TEXT

DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OutOfCreditsError(Exception):
    """OpenRouter returned HTTP 402 (insufficient credits). Halt the scan; do not retry."""


_INSTRUCTIONS = (
    "You are screening COMPANIES for one candidate against their company "
    "preferences. You are given only a company's name and its ATS slug — judge "
    "from what you actually know about the company.\n"
    "- verdict: 'include' if it fits the preferences, 'exclude' if it violates "
    "them, 'unknown' if you have NO real knowledge of this company. Do not guess: "
    "'unknown' is the correct answer when you don't recognize it.\n"
    "- confidence: low, medium, or high.\n"
    "- reasoning: one or two sentences naming the preference it matches or violates.\n"
    "- industry and industry_subcategory: one consistent pair from this taxonomy, "
    f"or null if unknown:\n{TAXONOMY_TEXT}\n"
    "- tech_tags: known stack keywords relevant to the preferences (e.g. 'java', "
    "'c++'); [] if unknown.\n"
    "- red_flags: short reasons the candidate might avoid it; [] if none."
)


def build_company_block(company_instructions: str | None) -> str:
    return (
        "CANDIDATE COMPANY PREFERENCES (which companies to include / exclude):\n"
        f"{company_instructions or '(none provided)'}"
    )


def _is_out_of_credits(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) == 402 or getattr(exc, "status", None) == 402:
        return True
    resp = getattr(exc, "response", None)
    if resp is not None and getattr(resp, "status_code", None) == 402:
        return True
    text = str(exc).lower()
    return "402" in text and "credit" in text


class CompanyReviewClient:
    def __init__(self, client=None, model: str | None = None):
        if client is None:
            from openai import AsyncOpenAI  # lazy: avoid import + key read at module load
            client = AsyncOpenAI(
                base_url=_OPENROUTER_BASE_URL,
                api_key=os.environ["OPENROUTER_API_KEY"],
                default_headers={"X-Title": "job-board"},
            )
        self._client = client
        self.model = model or os.environ.get("DISCOVERY_MODEL", DEFAULT_MODEL)

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
