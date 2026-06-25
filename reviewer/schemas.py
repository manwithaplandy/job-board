from typing import Literal

from pydantic import BaseModel

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

Industry = Literal[
    "software_internet", "fintech_finance", "healthcare_life_sciences",
    "commerce_consumer", "industrial_hardware", "public_education", "services_other",
]
Subcategory = Literal[
    "devtools_platforms", "cloud_infrastructure", "cybersecurity", "data_ml_ai",
    "devops_observability_sre", "saas_productivity", "consumer_social_media",
    "ecommerce_marketplace_tech", "gaming", "fintech_payments_crypto",
    "banking_trading_inhouse", "insurance_insurtech", "health_tech_digital_health",
    "provider_hospital_inhouse", "biotech_pharma_software", "medical_devices",
    "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
    "manufacturing_industrial_software", "iot_embedded_robotics",
    "automotive_aerospace_defense", "energy_climate_cleantech", "government_govtech",
    "education_edtech", "nonprofit_ngo", "consulting_agency_staffing",
    "telecom_networking", "other_unclear",
]


class Stage1Result(BaseModel):
    decision: Literal["pass", "reject"]
    reason: str


class Stage2Result(BaseModel):
    verdict: Literal["approve", "deny"]
    experience_match: Literal["step_down", "match", "reach", "far_reach"]
    industry: Industry
    industry_subcategory: Subcategory
    confidence: Literal["low", "medium", "high"]
    reasoning: str
