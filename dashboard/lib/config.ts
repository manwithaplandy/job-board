export const NEW_WINDOW_HOURS = Number(process.env.NEW_WINDOW_HOURS ?? 48);
export const STALE_HEALTH_HOURS = 12;

// FR-10: the operator's default filter, applied on first load only.
export const DEFAULT_INCLUDE_KEYWORDS: string[] = ["engineer"];

// These option lists mirror reviewer/schemas.py (Appendix A), which is the source of truth.
// There is no automated cross-language guard — keep these in sync manually when updating the taxonomy.
export const VERDICT_OPTIONS = ["approve", "deny", "gate_rejected", "pending", "all"] as const;
export const EXPERIENCE_OPTIONS = ["step_down", "match", "reach", "far_reach"] as const;
export const INDUSTRY_OPTIONS = [
  "software_internet", "fintech_finance", "healthcare_life_sciences",
  "commerce_consumer", "industrial_hardware", "public_education", "services_other",
] as const;
export const SUBCATEGORY_OPTIONS = [
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
] as const;
