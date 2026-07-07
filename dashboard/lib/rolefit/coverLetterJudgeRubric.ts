// SOURCE OF TRUTH for the cover-letter LLM-judge rubric. Unlike the résumé judge
// (resumeJudgeRubric.ts — reference-free, runs on live traces via the LangFuse
// managed evaluator), this judge is REFERENCE-BASED: it needs {{golden_letter}}
// (the human-edited ideal), so it runs ONLY from dataset runs / the offline script
// (scripts/calibrate-cover-letter-judge.ts) — never on live traces.
// Three dimensions, 1–5. Overall (0.5*grounding + 0.3*fidelity + 0.2*jd_relevance)
// is computed in code (lib/rolefit/coverLetterScore.ts::coverLetterOverall), NOT by
// the judge.

export const COVER_LETTER_JUDGE_GROUNDING_SCORE_NAME = "grounding";
export const COVER_LETTER_JUDGE_JD_RELEVANCE_SCORE_NAME = "jd_relevance";
export const COVER_LETTER_JUDGE_FIDELITY_SCORE_NAME = "fidelity";

export const COVER_LETTER_JUDGE_RUBRIC = `You are a strict cover-letter-quality judge. You are given the candidate's real background (their source résumé), a target job, a GENERATED cover letter to score, and a GOLDEN cover letter (a human-edited ideal for this exact job). Score the GENERATED LETTER on THREE dimensions, each an integer 1–5. Return ONLY JSON: {"grounding": <1-5>, "jd_relevance": <1-5>, "fidelity": <1-5>}.

CANDIDATE BACKGROUND (source of truth — the candidate's real résumé):
{{candidate_background}}

TARGET JOB:
Title: {{job_title}} at {{company}}
Description: {{job_description}}

GOLDEN LETTER (human-edited ideal — the reference):
{{golden_letter}}

GENERATED LETTER (to be scored):
{{cover_letter}}

DIMENSION 1 — grounding (truthfulness): Every factual claim in the GENERATED LETTER — an employer, title, date, degree, certification, metric, technology, project, domain, or "requirement met" — must be traceable to the CANDIDATE BACKGROUND. Enthusiasm and motivation need no evidence; facts do. Treat a claim that is more specific, senior, or impressive than the background supports as fabrication. 5 = every factual claim supported; 1 = clear fabrication. When uncertain, lean lower — fabrication is the worst failure.

DIMENSION 2 — jd_relevance (targeting): The letter connects the candidate's genuinely-relevant experience to THIS role and company — the strongest matching material leads, terminology is mirrored only where genuinely matched, and there is no generic boilerplate that could open any application. 5 = sharply targeted; 1 = interchangeable with any job.

DIMENSION 3 — fidelity (closeness to the ideal): How close the GENERATED LETTER lands to the GOLDEN LETTER's content choices, emphasis, structure, and tone. Judge substance, not wording: covering the same experiences and angles with different phrasing scores high; leading with material the human edit removed, missing what it added, or striking a clearly different tone scores low. 5 = a reader would accept either interchangeably; 1 = misses what the human edit was correcting.

Return only the JSON object.`;

/** Substitute the rubric variables for an offline (script) judge call. */
export function renderCoverLetterJudgePrompt(vars: {
  candidateBackground: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  coverLetter: string;
  goldenLetter: string;
}): string {
  // Function replacers, NOT string replacements: a string replacement makes JS interpret
  // `$$`, `$&`, `` $` ``, `$'` in the VALUE as special patterns (a résumé/letter can contain
  // "$$" or "$&"), corrupting the prompt. A replacer function inserts the value literally.
  return COVER_LETTER_JUDGE_RUBRIC
    .replaceAll("{{candidate_background}}", () => vars.candidateBackground)
    .replaceAll("{{job_title}}", () => vars.jobTitle)
    .replaceAll("{{company}}", () => vars.company)
    .replaceAll("{{job_description}}", () => vars.jobDescription)
    .replaceAll("{{golden_letter}}", () => vars.goldenLetter)
    .replaceAll("{{cover_letter}}", () => vars.coverLetter);
}
