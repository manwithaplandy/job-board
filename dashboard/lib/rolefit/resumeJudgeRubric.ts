// SOURCE OF TRUTH for the résumé LLM-judge rubric. The running copy is configured
// in the LangFuse UI (Evaluators). Keep this in sync when the UI rubric changes.
// Judge model: Claude Sonnet 5 (LangFuse LLM-connection slug confirmed at wiring).
// Two dimensions, 1–5. Overall (0.7*grounding + 0.3*jd_relevance) is computed in
// code (lib/rolefit/resumeScore.ts::resumeOverall), NOT by the judge.
//
// The evaluator maps these variables from the parent `resume` trace observation
// (same keys on the resume-golden dataset items, so it works on live traces AND
// dataset runs):
//   {{candidate_background}} ← trace input.background (the candidate's real source résumé — the grounding truth)
//   {{job_title}}/{{job_company}}/{{job_description}} ← trace input.title/company/description
//   {{resume}}               ← trace output (rendered résumé text)

export const RESUME_JUDGE_GROUNDING_SCORE_NAME = "grounding";
export const RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME = "jd_relevance";

export const RESUME_JUDGE_RUBRIC = `You are a strict résumé-quality judge. You are given the candidate's real background (their source résumé), a target job, and a generated tailored résumé. Score the GENERATED RÉSUMÉ on TWO dimensions, each an integer 1–5. Return ONLY JSON: {"grounding": <1-5>, "jd_relevance": <1-5>}.

CANDIDATE BACKGROUND (source of truth — the candidate's real résumé):
{{candidate_background}}

TARGET JOB:
Title: {{job_title}} at {{job_company}}
Description: {{job_description}}

GENERATED RÉSUMÉ (to be scored):
{{resume}}

DIMENSION 1 — grounding (truthfulness): Every claim in the GENERATED RÉSUMÉ must be traceable to the CANDIDATE BACKGROUND above. Penalize any employer, job title, employment date, degree, certification, metric/number, technology, skill, or industry/domain that does NOT appear in — and cannot be directly inferred from — the background. Treat a claim that is more specific, more senior, or more impressive than the background supports as fabrication. Rephrasing, summarizing, or re-emphasizing real background material is fine; introducing facts absent from the background is not. 5 = every claim is supported by the background; 1 = clear fabrication or inflation beyond the background. When uncertain whether a claim is supported, lean lower — fabrication is the worst failure.

DIMENSION 2 — jd_relevance (targeting): Content is selected and emphasized toward THIS role — the most relevant experience leads and gets the most space, genuinely-matched terminology is mirrored, and irrelevant material is de-emphasized. Penalize narration ("directly analogous to…"), keyword-stuffing, and generic one-size-fits-all résumés. 5 = sharply targeted; 1 = untargeted.

Return only the JSON object.`;
