from typing import Literal

from pydantic import BaseModel, Field

from reviewer.schemas import Industry, Subcategory


class CompanyReviewResult(BaseModel):
    verdict: Literal["include", "exclude", "unknown"]
    confidence: Literal["low", "medium", "high"] = "low"
    reasoning: str = ""
    industry: Industry | None = None
    industry_subcategory: Subcategory | None = None
    tech_tags: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
