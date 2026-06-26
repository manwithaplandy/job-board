import os

from reviewer.schemas import TAXONOMY_TEXT, Stage1Result, Stage2Result

DEFAULT_MODEL = "anthropic/claude-haiku-4.5"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

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
                base_url=_OPENROUTER_BASE_URL,
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
