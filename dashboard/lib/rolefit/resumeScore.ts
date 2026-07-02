// Résumé golden-dataset scoring types + builders. Mirrors lib/rolefit/correction.ts
// (the reviewer-golden equivalent). Runtime-pure — no DB or LangFuse imports.

export const RESUME_GOLDEN_DATASET_NAME = "resume-golden";

// grounding 0.7 / jd_relevance 0.3 — fabrication is the dominant failure.
export const GROUNDING_WEIGHT = 0.7;
export const JD_RELEVANCE_WEIGHT = 0.3;

/** Weighted overall (1–5), rounded to one decimal. */
export function resumeOverall(grounding: number, jdRelevance: number): number {
  return Math.round((GROUNDING_WEIGHT * grounding + JD_RELEVANCE_WEIGHT * jdRelevance) * 10) / 10;
}

/** Client → server-action payload. */
export interface ResumeScoreForm {
  grounding: number;    // 1–5
  jdRelevance: number;  // 1–5
  comment: string | null;
}

/** Row shape for the resume_scores upsert. */
export interface ResumeScoreRow {
  grounding: number;
  jd_relevance: number;
  comment: string | null;
}

export function formToScoreRow(f: ResumeScoreForm): ResumeScoreRow {
  return { grounding: f.grounding, jd_relevance: f.jdRelevance, comment: f.comment };
}

/** The generation inputs stored on the golden item (enough to re-generate later). */
export interface ResumeGoldenInput {
  title: string;
  company: string;
  description: string | null;
  background: string | null;
  model: string | null;
}

export interface ResumeGoldenItem {
  id: string;
  datasetName: string;
  input: ResumeGoldenInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildResumeGoldenItem(args: {
  userId: string;
  jobId: string;
  input: ResumeGoldenInput;
  form: ResumeScoreForm;
  traceId: string | null;
  model: string | null;
  scoredAt: string;
}): ResumeGoldenItem {
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: RESUME_GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput: {
      grounding: args.form.grounding,
      jd_relevance: args.form.jdRelevance,
      comment: args.form.comment,
      overall: resumeOverall(args.form.grounding, args.form.jdRelevance),
    },
    metadata: {
      resume_trace_id: args.traceId,
      model: args.model,
      scored_at: args.scoredAt,
      source: "dashboard",
    },
  };
}
