import { describe, expect, test } from "vitest";
import {
  INDUSTRIES,
  SUBCATEGORIES,
  SUBCATEGORIES_BY_INDUSTRY,
  ROLE_CATEGORIES,
  SENIORITY,
  WORK_ARRANGEMENT,
  EXPERIENCE_MATCH,
  CONFIDENCE,
  VERDICTS,
} from "@/lib/rolefit/taxonomy";

// These literal arrays are copied verbatim from reviewer/schemas.py — the
// Python source of truth. Do NOT derive them from the module under test;
// that would make the assertions tautological.

const EXPECTED_INDUSTRIES = [
  "software_internet",
  "fintech_finance",
  "healthcare_life_sciences",
  "commerce_consumer",
  "industrial_hardware",
  "public_education",
  "services_other",
];

const EXPECTED_SUBCATEGORIES_BY_INDUSTRY = {
  software_internet: [
    "devtools_platforms",
    "cloud_infrastructure",
    "cybersecurity",
    "data_ml_ai",
    "devops_observability_sre",
    "saas_productivity",
    "consumer_social_media",
    "ecommerce_marketplace_tech",
    "gaming",
  ],
  fintech_finance: [
    "fintech_payments_crypto",
    "banking_trading_inhouse",
    "insurance_insurtech",
  ],
  healthcare_life_sciences: [
    "health_tech_digital_health",
    "provider_hospital_inhouse",
    "biotech_pharma_software",
    "medical_devices",
  ],
  commerce_consumer: [
    "retail_ecommerce_inhouse",
    "logistics_supply_chain",
    "travel_hospitality",
  ],
  industrial_hardware: [
    "manufacturing_industrial_software",
    "iot_embedded_robotics",
    "automotive_aerospace_defense",
    "energy_climate_cleantech",
  ],
  public_education: [
    "government_govtech",
    "education_edtech",
    "nonprofit_ngo",
  ],
  services_other: [
    "consulting_agency_staffing",
    "telecom_networking",
    "other_unclear",
  ],
};

const EXPECTED_SUBCATEGORIES = [
  "devtools_platforms",
  "cloud_infrastructure",
  "cybersecurity",
  "data_ml_ai",
  "devops_observability_sre",
  "saas_productivity",
  "consumer_social_media",
  "ecommerce_marketplace_tech",
  "gaming",
  "fintech_payments_crypto",
  "banking_trading_inhouse",
  "insurance_insurtech",
  "health_tech_digital_health",
  "provider_hospital_inhouse",
  "biotech_pharma_software",
  "medical_devices",
  "retail_ecommerce_inhouse",
  "logistics_supply_chain",
  "travel_hospitality",
  "manufacturing_industrial_software",
  "iot_embedded_robotics",
  "automotive_aerospace_defense",
  "energy_climate_cleantech",
  "government_govtech",
  "education_edtech",
  "nonprofit_ngo",
  "consulting_agency_staffing",
  "telecom_networking",
  "other_unclear",
];

const EXPECTED_ROLE_CATEGORIES = [
  "Frontend",
  "Backend",
  "Full-stack",
  "Platform",
  "Infra/DevOps",
  "Data/ML",
  "Mobile",
  "Security",
  "Product eng",
  "QA/Test",
  "Eng management",
  "Other",
];

const EXPECTED_SENIORITY = [
  "junior",
  "mid",
  "senior",
  "staff",
  "principal",
  "lead",
  "manager",
  "unknown",
];

const EXPECTED_WORK_ARRANGEMENT = ["remote", "hybrid", "onsite", "unknown"];

const EXPECTED_EXPERIENCE_MATCH = ["step_down", "match", "reach", "far_reach"];

const EXPECTED_CONFIDENCE = ["low", "medium", "high"];

const EXPECTED_VERDICTS = ["approve", "deny"];

describe("taxonomy mirror (reviewer/schemas.py)", () => {
  test("INDUSTRIES matches the literal schemas.py list", () => {
    expect([...INDUSTRIES]).toEqual(EXPECTED_INDUSTRIES);
  });

  test("SUBCATEGORIES_BY_INDUSTRY matches the literal schemas.py map", () => {
    expect(SUBCATEGORIES_BY_INDUSTRY).toEqual(EXPECTED_SUBCATEGORIES_BY_INDUSTRY);
  });

  test("SUBCATEGORIES matches the literal flattened schemas.py list", () => {
    expect([...SUBCATEGORIES]).toEqual(EXPECTED_SUBCATEGORIES);
    // Internal-consistency check: SUBCATEGORIES is the flattened union of
    // every industry's list in SUBCATEGORIES_BY_INDUSTRY.
    expect([...SUBCATEGORIES]).toEqual(
      Object.values(SUBCATEGORIES_BY_INDUSTRY).flat(),
    );
  });

  test("ROLE_CATEGORIES matches the literal schemas.py list", () => {
    expect([...ROLE_CATEGORIES]).toEqual(EXPECTED_ROLE_CATEGORIES);
  });

  test("SENIORITY matches the literal schemas.py list", () => {
    expect([...SENIORITY]).toEqual(EXPECTED_SENIORITY);
  });

  test("WORK_ARRANGEMENT matches the literal schemas.py list", () => {
    expect([...WORK_ARRANGEMENT]).toEqual(EXPECTED_WORK_ARRANGEMENT);
  });

  test("EXPERIENCE_MATCH matches the literal schemas.py list", () => {
    expect([...EXPERIENCE_MATCH]).toEqual(EXPECTED_EXPERIENCE_MATCH);
  });

  test("CONFIDENCE matches the literal schemas.py list", () => {
    expect([...CONFIDENCE]).toEqual(EXPECTED_CONFIDENCE);
  });

  test("VERDICTS matches the literal schemas.py list", () => {
    expect([...VERDICTS]).toEqual(EXPECTED_VERDICTS);
  });
});
