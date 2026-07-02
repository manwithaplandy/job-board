from typing import Literal

from pydantic import BaseModel, Field

# Appendix A — two-level, tech/SWE/DevOps-focused taxonomy.
TAXONOMY: dict[str, list[str]] = {
    "software_internet": [
        "devtools_platforms", "cloud_infrastructure", "cybersecurity",
        "data_ml_ai", "devops_observability_sre", "saas_productivity",
        "consumer_social_media", "ecommerce_marketplace_tech", "gaming",
    ],
    "fintech_finance": [
        "fintech_payments_crypto", "banking_trading_inhouse", "insurance_insurtech",
    ],
    "healthcare_life_sciences": [
        "health_tech_digital_health", "provider_hospital_inhouse",
        "biotech_pharma_software", "medical_devices",
    ],
    "commerce_consumer": [
        "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
    ],
    "industrial_hardware": [
        "manufacturing_industrial_software", "iot_embedded_robotics",
        "automotive_aerospace_defense", "energy_climate_cleantech",
    ],
    "public_education": [
        "government_govtech", "education_edtech", "nonprofit_ngo",
    ],
    "services_other": [
        "consulting_agency_staffing", "telecom_networking", "other_unclear",
    ],
}

INDUSTRIES: list[str] = list(TAXONOMY)
SUBCATEGORIES: list[str] = [s for subs in TAXONOMY.values() for s in subs]

TAXONOMY_TEXT: str = "\n".join(
    f"- {ind}: {', '.join(subs)}" for ind, subs in TAXONOMY.items()
)

# Shared output-language policy appended to every LLM agent's system prompt
# (see reviewer/llm.py and company_discovery/llm.py). Keep in sync with the TS
# mirror in dashboard/lib/rolefit/promptPolicy.ts.
ENGLISH_ONLY_INSTRUCTION: str = (
    "Write all of your output in English. Even when the input — a company name, "
    "job posting, resume, or saved answer — is in another language, express your "
    "generated text in English, translating the relevant facts rather than copying "
    "the non-English wording. The sole exception: values these instructions tell "
    "you to reproduce verbatim (e.g., an employer's name or a multiple-choice "
    "option) must be kept exactly as given."
)

Industry = Literal[tuple(INDUSTRIES)]
Subcategory = Literal[tuple(SUBCATEGORIES)]

ROLE_CATEGORIES: list[str] = [
    "Frontend", "Backend", "Full-stack", "Platform", "Infra/DevOps",
    "Data/ML", "Mobile", "Security", "Product eng", "QA/Test",
    "Eng management", "Other",
]
SENIORITY: list[str] = [
    "junior", "mid", "senior", "staff", "principal", "lead", "manager", "unknown",
]
WORK_ARRANGEMENT: list[str] = ["remote", "hybrid", "onsite", "unknown"]

RoleCategory = Literal[tuple(ROLE_CATEGORIES)]
Seniority = Literal[tuple(SENIORITY)]
WorkArrangement = Literal[tuple(WORK_ARRANGEMENT)]
PayPeriod = Literal["year", "hour", "month"]


class Requirement(BaseModel):
    text: str
    met: bool


class Stage1Result(BaseModel):
    decision: Literal["pass", "reject"]
    reason: str


class Stage1Decision(BaseModel):
    """Per-job decision in a batched stage-1 response."""
    job_id: str
    decision: Literal["pass", "reject"]
    reason: str


class Stage1BatchResult(BaseModel):
    """Batched stage-1 gate: one decision per job in the batch."""
    decisions: list[Stage1Decision]


class Stage2Result(BaseModel):
    verdict: Literal["approve", "deny"]
    experience_match: Literal["step_down", "match", "reach", "far_reach"]
    industry: Industry
    industry_subcategory: Subcategory
    confidence: Literal["low", "medium", "high"]
    reasoning: str
    # --- Rolefit extraction (optional; defaults tolerate model omissions) ---
    role_category: RoleCategory = "Other"
    seniority: Seniority = "unknown"
    work_arrangement: WorkArrangement = "unknown"
    about: str | None = None
    pay_min: int | None = None
    pay_max: int | None = None
    pay_currency: str | None = None
    pay_period: PayPeriod | None = None
    headcount: str | None = None
    skills_score: int | None = None
    experience_score: int | None = None
    comp_score: int | None = None
    red_flags: list[str] = Field(default_factory=list)
    skill_gaps: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)
