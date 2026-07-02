// Mirror of reviewer/schemas.py (TAXONOMY, ROLE_CATEGORIES, SENIORITY,
// WORK_ARRANGEMENT). Keep in sync — the Python enums are the source of truth and
// the reviewer/evaluators only accept these exact strings.

export const SUBCATEGORIES_BY_INDUSTRY: Record<string, readonly string[]> = {
  software_internet: [
    "devtools_platforms", "cloud_infrastructure", "cybersecurity",
    "data_ml_ai", "devops_observability_sre", "saas_productivity",
    "consumer_social_media", "ecommerce_marketplace_tech", "gaming",
  ],
  fintech_finance: [
    "fintech_payments_crypto", "banking_trading_inhouse", "insurance_insurtech",
  ],
  healthcare_life_sciences: [
    "health_tech_digital_health", "provider_hospital_inhouse",
    "biotech_pharma_software", "medical_devices",
  ],
  commerce_consumer: [
    "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
  ],
  industrial_hardware: [
    "manufacturing_industrial_software", "iot_embedded_robotics",
    "automotive_aerospace_defense", "energy_climate_cleantech",
  ],
  public_education: [
    "government_govtech", "education_edtech", "nonprofit_ngo",
  ],
  services_other: [
    "consulting_agency_staffing", "telecom_networking", "other_unclear",
  ],
};

export const INDUSTRIES = Object.keys(SUBCATEGORIES_BY_INDUSTRY);
export const SUBCATEGORIES = Object.values(SUBCATEGORIES_BY_INDUSTRY).flat();

export const ROLE_CATEGORIES = [
  "Frontend", "Backend", "Full-stack", "Platform", "Infra/DevOps",
  "Data/ML", "Mobile", "Security", "Product eng", "QA/Test",
  "Eng management", "Other",
] as const;

export const SENIORITY = [
  "junior", "mid", "senior", "staff", "principal", "lead", "manager", "unknown",
] as const;

export const WORK_ARRANGEMENT = ["remote", "hybrid", "onsite", "unknown"] as const;
export const EXPERIENCE_MATCH = ["step_down", "match", "reach", "far_reach"] as const;
export const CONFIDENCE = ["low", "medium", "high"] as const;
export const VERDICTS = ["approve", "deny"] as const;
