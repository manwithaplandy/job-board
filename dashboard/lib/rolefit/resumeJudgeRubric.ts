// SOURCE OF TRUTH for the résumé LLM-judge rubric. The running copy is configured
// in the LangFuse UI (Evaluators). Keep this in sync when the UI rubric changes.
// Judge model: Claude Sonnet 5 (LangFuse LLM-connection slug confirmed at wiring).
// Two dimensions, 1–5. Overall (0.7*grounding + 0.3*jd_relevance) is computed in
// code (lib/rolefit/resumeScore.ts::resumeOverall), NOT by the judge.
//
// The evaluator maps two variables from the parent `resume` trace observation:
//   {{job_description}} ← trace input.description (+ title/company)
//   {{resume}}          ← trace output (rendered résumé text)

export const RESUME_JUDGE_GROUNDING_SCORE_NAME = "grounding";
export const RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME = "jd_relevance";

export const RESUME_JUDGE_RUBRIC = `You are a strict résumé-quality judge. You are given a target job and a generated, tailored résumé. Score the résumé on TWO dimensions, each an integer 1–5. Return ONLY JSON: {"grounding": <1-5>, "jd_relevance": <1-5>}.

TARGET JOB:
Title: {{job_title}} at {{job_company}}
Description: {{job_description}}

GENERATED RÉSUMÉ:
{{resume}}

DIMENSION 1 — grounding (truthfulness): Every claim must be traceable to a real candidate background. Penalize invented or inflated metrics, titles, employers, dates, degrees, technologies, or claimed industry/domain experience. 5 = nothing appears fabricated; 1 = clear fabrication/inflation. When uncertain whether a specific claim is invented, lean lower — fabrication is the worst failure.

DIMENSION 2 — jd_relevance (targeting): Content is selected and emphasized toward THIS role — the most relevant experience leads and gets the most space, genuinely-matched terminology is mirrored, and irrelevant material is de-emphasized. Penalize narration ("directly analogous to…"), keyword-stuffing, and generic one-size-fits-all résumés. 5 = sharply targeted; 1 = untargeted.

Return only the JSON object.`;
