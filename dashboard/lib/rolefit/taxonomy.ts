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

// Human-readable labels for the enum tokens rendered in the correction editor's
// selects (finding #26 — raw tokens like "step_down"/"software_internet" read badly).
// The token stays the persisted value; the label is display-only. Any token not listed
// falls back to the raw token via `taxonomyLabel` (e.g. the already-Title-Cased
// ROLE_CATEGORIES), so an unexpected value never blanks. Same pattern as ats.ts.
export const TAXONOMY_LABELS: Record<string, string> = {
  // Verdict
  approve: "Approve",
  deny: "Deny",
  // Experience match
  step_down: "Step down",
  match: "Match",
  reach: "Reach",
  far_reach: "Far reach",
  // Confidence
  low: "Low",
  medium: "Medium",
  high: "High",
  // Seniority
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  lead: "Lead",
  manager: "Manager",
  // Work arrangement
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  // "unknown" is shared by seniority + work arrangement
  unknown: "Unknown",
  // Industries
  software_internet: "Software & Internet",
  fintech_finance: "Fintech & Finance",
  healthcare_life_sciences: "Healthcare & Life Sciences",
  commerce_consumer: "Commerce & Consumer",
  industrial_hardware: "Industrial & Hardware",
  public_education: "Public Sector & Education",
  services_other: "Services & Other",
  // Subcategories
  devtools_platforms: "Devtools & Platforms",
  cloud_infrastructure: "Cloud Infrastructure",
  cybersecurity: "Cybersecurity",
  data_ml_ai: "Data, ML & AI",
  devops_observability_sre: "DevOps, Observability & SRE",
  saas_productivity: "SaaS & Productivity",
  consumer_social_media: "Consumer & Social Media",
  ecommerce_marketplace_tech: "E-commerce & Marketplace Tech",
  gaming: "Gaming",
  fintech_payments_crypto: "Fintech, Payments & Crypto",
  banking_trading_inhouse: "Banking & Trading (in-house)",
  insurance_insurtech: "Insurance & Insurtech",
  health_tech_digital_health: "Health Tech & Digital Health",
  provider_hospital_inhouse: "Provider & Hospital (in-house)",
  biotech_pharma_software: "Biotech & Pharma Software",
  medical_devices: "Medical Devices",
  retail_ecommerce_inhouse: "Retail & E-commerce (in-house)",
  logistics_supply_chain: "Logistics & Supply Chain",
  travel_hospitality: "Travel & Hospitality",
  manufacturing_industrial_software: "Manufacturing & Industrial Software",
  iot_embedded_robotics: "IoT, Embedded & Robotics",
  automotive_aerospace_defense: "Automotive, Aerospace & Defense",
  energy_climate_cleantech: "Energy, Climate & Cleantech",
  government_govtech: "Government & GovTech",
  education_edtech: "Education & EdTech",
  nonprofit_ngo: "Nonprofit & NGO",
  consulting_agency_staffing: "Consulting, Agency & Staffing",
  telecom_networking: "Telecom & Networking",
  other_unclear: "Other / Unclear",
};

export const taxonomyLabel = (token: string): string => TAXONOMY_LABELS[token] ?? token;

/** Display label for a legitimately-optional enum token: null for null/undefined or the
 *  literal "unknown" (hide the pill — "unknown" is a real taxonomy value, not a label),
 *  else the Title-Cased label (TAXONOMY_LABELS, first-letter fallback). Shared by
 *  JobCard/JobDetail so seniority and work_arrangement can't drift again (plan phase J4). */
export function displayEnumLabel(token: string | null | undefined): string | null {
  if (!token || token === "unknown") return null;
  return TAXONOMY_LABELS[token] ?? (token.charAt(0).toUpperCase() + token.slice(1));
}
