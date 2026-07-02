import { describe, expect, test } from "vitest";
import {
  formToCorrection, buildDatasetItem, GOLDEN_DATASET_NAME, GOLDEN_EXPECTED_FIELDS,
} from "@/lib/rolefit/correction";

const form = {
  verdict: "approve", experienceMatch: "match", industry: "software_internet",
  industrySubcategory: "gaming", confidence: "high", roleCategory: "Backend",
  seniority: "senior", workArrangement: "remote",
  skillsScore: 80, experienceScore: 70, compScore: 60,
  reasoning: "fits", about: null, payMin: null, payMax: null,
  payCurrency: null, payPeriod: null, headcount: null,
  redFlags: [], skillGaps: [], benefits: [], requirements: [], note: "ok",
};

describe("correction builders", () => {
  test("formToCorrection computes fit_score and maps to snake_case", () => {
    const row = formToCorrection(form);
    expect(row.verdict).toBe("approve");
    expect(row.industry_subcategory).toBe("gaming");
    expect(row.skills_score).toBe(80);
    expect(row.fit_score).toBe(79); // parity with computeFit test
  });

  test("buildDatasetItem keys id by user:job and carries only golden expected", () => {
    const row = formToCorrection(form);
    const item = buildDatasetItem({
      userId: "u1", jobId: "lever:acme:1",
      input: { title: "SRE", company_name: "Acme", location: "Remote",
               ats: "lever", description: "jd", resume_text: "r", instructions: "i" },
      row, note: "ok", correctedAt: "2026-06-30T00:00:00Z",
    });
    expect(item.id).toBe("u1:lever:acme:1");
    expect(item.datasetName).toBe(GOLDEN_DATASET_NAME);
    expect(Object.keys(item.expectedOutput).sort()).toEqual(
      [...GOLDEN_EXPECTED_FIELDS].sort(),
    );
    expect(item.expectedOutput).not.toHaveProperty("fit_score");
    expect(item.metadata.note).toBe("ok");
  });
});
