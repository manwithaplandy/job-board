import { computeFit } from "@/lib/rolefit/fit";

export const GOLDEN_DATASET_NAME = "reviewer-golden";

export const GOLDEN_EXPECTED_FIELDS = [
  "verdict", "experience_match", "industry", "industry_subcategory",
  "role_category", "seniority", "work_arrangement", "confidence",
  "skills_score", "experience_score", "comp_score",
] as const;

export interface CorrectionForm {
  verdict: string | null;
  experienceMatch: string | null;
  industry: string | null;
  industrySubcategory: string | null;
  confidence: string | null;
  roleCategory: string | null;
  seniority: string | null;
  workArrangement: string | null;
  skillsScore: number | null;
  experienceScore: number | null;
  compScore: number | null;
  reasoning: string | null;
  about: string | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  headcount: string | null;
  redFlags: string[];
  skillGaps: string[];
  benefits: string[];
  requirements: { text: string; met: boolean }[];
  note: string | null;
}

export interface CorrectionRow {
  verdict: string | null;
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  role_category: string | null;
  seniority: string | null;
  work_arrangement: string | null;
  skills_score: number | null;
  experience_score: number | null;
  comp_score: number | null;
  fit_score: number;
  reasoning: string | null;
  about: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  headcount: string | null;
  red_flags: string[];
  skill_gaps: string[];
  benefits: string[];
  requirements: { text: string; met: boolean }[];
}

export function formToCorrection(f: CorrectionForm): CorrectionRow {
  const fit_score = computeFit({
    skillsScore: f.skillsScore, experienceScore: f.experienceScore,
    compScore: f.compScore, experienceMatch: f.experienceMatch,
    confidence: f.confidence, redFlags: f.redFlags, verdict: f.verdict,
  });
  return {
    verdict: f.verdict, experience_match: f.experienceMatch,
    industry: f.industry, industry_subcategory: f.industrySubcategory,
    confidence: f.confidence, role_category: f.roleCategory,
    seniority: f.seniority, work_arrangement: f.workArrangement,
    skills_score: f.skillsScore, experience_score: f.experienceScore,
    comp_score: f.compScore, fit_score,
    reasoning: f.reasoning, about: f.about, pay_min: f.payMin, pay_max: f.payMax,
    pay_currency: f.payCurrency, pay_period: f.payPeriod, headcount: f.headcount,
    red_flags: f.redFlags, skill_gaps: f.skillGaps, benefits: f.benefits,
    requirements: f.requirements,
  };
}

export interface DatasetInput {
  title: string;
  company_name: string;
  location: string | null;
  ats: string | null;
  description: string | null;
  resume_text: string | null;
  instructions: string | null;
}

export interface DatasetItem {
  id: string;
  datasetName: string;
  input: DatasetInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildDatasetItem(args: {
  userId: string;
  jobId: string;
  input: DatasetInput;
  row: CorrectionRow;
  note: string | null;
  correctedAt: string;
}): DatasetItem {
  const expectedOutput: Record<string, unknown> = {};
  for (const k of GOLDEN_EXPECTED_FIELDS) {
    expectedOutput[k] = (args.row as unknown as Record<string, unknown>)[k];
  }
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput,
    metadata: { note: args.note, corrected_at: args.correctedAt, source: "dashboard" },
  };
}
