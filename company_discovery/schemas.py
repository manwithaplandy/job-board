from typing import Literal

from pydantic import BaseModel, Field, field_validator

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


# Company size buckets (headcount). MUST match dashboard/lib/companyMeta.ts COMPANY_SIZES
# (tests/test_company_meta_parity.py). 'unknown' is a first-class, filterable bucket.
COMPANY_SIZES: list[str] = [
    "1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+", "unknown",
]
CompanySize = Literal[tuple(COMPANY_SIZES)]


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


class CompanyClassificationResult(BaseModel):
    # reasoning first — same declaration-order rationale as CompanyReviewResult.
    reasoning: str = ""
    industry: Industry | None = None
    industry_subcategory: Subcategory | None = None
    size: CompanySize = "unknown"
    hq_country: str = "unknown"          # ISO-3166 alpha-2 (uppercase) or 'unknown'
    confidence: Literal["low", "medium", "high"] = "low"
    tech_tags: list[str] = Field(default_factory=list)
    red_flags: list[RedFlag] = Field(default_factory=list)

    @field_validator("hq_country", mode="before")
    @classmethod
    def _norm_country(cls, v):
        # Models emit "USA", "United States", lowercase codes, etc. Only a clean
        # 2-letter ASCII code survives; everything else collapses to 'unknown'.
        # `isascii()` matters: str.isalpha() is Unicode-wide, so "中国"/"мс" would
        # otherwise pass — and the dashboard's isCountryCode is ASCII-only (/^[A-Z]{2}$/),
        # so a non-ASCII value would render as raw junk in the country facet.
        if not isinstance(v, str):
            return "unknown"
        s = v.strip().upper()
        return s if len(s) == 2 and s.isascii() and s.isalpha() else "unknown"
