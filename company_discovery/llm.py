import os

from company_discovery.schemas import CompanyReviewResult
from observability.llm import OutOfCreditsError, traced_structured_call
from reviewer.schemas import TAXONOMY_TEXT

DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

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
    "- red_flags: a list of {category, note} objects for reasons the candidate "
    "might avoid this company; [] if none. Choose category from:\n"
    "  * consulting_agency: consulting, agency, staffing, recruiting, advisory, "
    "or outsourcing/IT-services shop.\n"
    "  * defense_military: defense, military, aerospace-defense, weapons, "
    "intelligence, or surveillance work.\n"
    "  * non_tech: not a software/tech company; minimal in-house engineering.\n"
    "  * unknown_unverified: you do not recognize the company / cannot verify it "
    "against the preferences.\n"
    "  * early_stage_risk: very early-stage, limited track record, tiny "
    "engineering footprint.\n"
    "  * values_mismatch: ethical/values conflict (e.g. cannabis, fossil fuel, "
    "gambling, predatory lending, tobacco).\n"
    "  * other: none of the above — put the specific reason in note.\n"
    "  Set note to the specific reason (required for 'other'; optional otherwise).\n"
    "If you have real knowledge of the company but the preferences neither clearly "
    "match nor clearly violate it, return 'include' with confidence <= 0.4 so "
    "polling is not silently skipped."
)


def build_company_block(company_instructions: str | None) -> str:
    return (
        "CANDIDATE COMPANY PREFERENCES (which companies to include / exclude):\n"
        f"{company_instructions or '(none provided)'}"
    )



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

    async def review(self, *, company_block: str, name: str, ats: str,
                     token: str) -> CompanyReviewResult:
        system = f"{company_block}\n\n{_INSTRUCTIONS}"
        user = f"Company: {name}\nATS: {ats}\nSlug: {token}"
        parsed, _ = await traced_structured_call(
            self._client,
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            schema=CompanyReviewResult,
            name="company-screen",
            metadata={"ats": ats, "token": token},
        )
        return parsed
