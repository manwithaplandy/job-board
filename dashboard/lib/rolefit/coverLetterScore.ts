// Cover-letter golden-dataset types + builders. Mirrors lib/rolefit/resumeScore.ts
// (the resume-golden equivalent), with the review_corrections flavor: the human EDIT
// is the golden expected_output. Runtime-pure — no DB or LangFuse imports.

export const COVER_LETTER_GOLDEN_DATASET_NAME = "cover-letter-golden";

// grounding 0.5 / fidelity 0.3 / jd_relevance 0.2 — fabrication stays the dominant
// failure; fidelity (closeness to the human-edited ideal) is the new comparative
// signal. Tunable constants; the judge itself never computes the overall.
export const GROUNDING_WEIGHT = 0.5;
export const FIDELITY_WEIGHT = 0.3;
export const JD_RELEVANCE_WEIGHT = 0.2;

/** Weighted overall (1–5), rounded to one decimal. */
export function coverLetterOverall(grounding: number, fidelity: number, jdRelevance: number): number {
  return (
    Math.round(
      (GROUNDING_WEIGHT * grounding + FIDELITY_WEIGHT * fidelity + JD_RELEVANCE_WEIGHT * jdRelevance) * 10,
    ) / 10
  );
}

/** The per-job review context generateCoverLetter needs (shape of CoverLetterJob). */
export interface CoverLetterGoldenJob {
  title: string;
  company: string;
  description: string | null;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skillGaps: string[];
  redFlags: string[];
}

/** Full generation context needed to REPLAY generateCoverLetter for this item. */
export interface CoverLetterGoldenInput {
  background: string | null;      // profiles.resume_text
  candidateName: string | null;   // profiles.full_name
  instructions: string | null;    // per-job cover_letter_instructions
  job: CoverLetterGoldenJob;
  model: string | null;           // profiles.model_cover
}

export interface CoverLetterGoldenItem {
  id: string;
  datasetName: string;
  input: CoverLetterGoldenInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildCoverLetterGoldenItem(args: {
  userId: string;
  jobId: string;
  input: CoverLetterGoldenInput;
  editedText: string;
  comment: string | null;
  traceId: string | null;
  model: string | null;
  originalText: string | null;
  editedAt: string;
}): CoverLetterGoldenItem {
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: COVER_LETTER_GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput: { cover_letter: args.editedText, comment: args.comment },
    metadata: {
      cover_letter_trace_id: args.traceId,
      model: args.model,
      original_text: args.originalText,
      edited_at: args.editedAt,
      source: "dashboard",
    },
  };
}
