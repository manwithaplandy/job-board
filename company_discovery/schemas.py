from typing import Literal

from pydantic import BaseModel, Field

from reviewer.schemas import Industry, Subcategory

# Company red-flag taxonomy. `other` is the escape hatch: the model (and the
# backfill in reclassify.py) route anything that fits no concrete category here,
# with the specific reason in `note`. Recurring `other` notes surface on the
# analytics dashboard as candidates for promotion to a real category.
RED_FLAG_CATEGORIES: list[str] = [
    "consulting_agency", "defense_military", "non_tech",
    "unknown_unverified", "early_stage_risk", "values_mismatch", "other",
]
RedFlagCategory = Literal[tuple(RED_FLAG_CATEGORIES)]


class RedFlag(BaseModel):
    category: RedFlagCategory
    note: str | None = None


class CompanyReviewResult(BaseModel):
    # `reasoning` is declared BEFORE `verdict` on purpose: with OpenAI JSON
    # structured output the model emits fields in declaration order, so it must
    # reason first and derive the verdict from that reasoning (rather than
    # snap-deciding `verdict` and then rationalising a different conclusion).
    reasoning: str = ""
    verdict: Literal["include", "exclude", "unknown"]
    confidence: Literal["low", "medium", "high"] = "low"
    industry: Industry | None = None
    industry_subcategory: Subcategory | None = None
    tech_tags: list[str] = Field(default_factory=list)
    red_flags: list[RedFlag] = Field(default_factory=list)
