import type { GreenhouseQuestions, GreenhouseQuestion } from "@/lib/rolefit/greenhouseQuestions";

// A cover-letter ask, narrowly: Greenhouse's canonical `cover_letter` field name, or a
// label explicitly saying "cover letter". Deliberately does NOT match free-form essay
// prompts — those are answered by the generic prefill, which addresses the specific
// question; the cover pipeline writes a role-level letter that would ignore the prompt.
const COVER_LETTER_LABEL = /cover\s*letter/i;

export function isCoverLetterQuestion(q: GreenhouseQuestion): boolean {
  if (COVER_LETTER_LABEL.test(q.label)) return true;
  return q.fields.some((f) => f.name === "cover_letter");
}

/** True when the posting asks for a cover letter (present — required OR optional). */
export function hasCoverLetterQuestion(gh: GreenhouseQuestions | null): boolean {
  return !!gh && gh.questions.some(isCoverLetterQuestion);
}

/** The schema minus cover-letter questions, so the generic prefill never double-answers one. */
export function stripCoverLetterQuestions(gh: GreenhouseQuestions | null): GreenhouseQuestions {
  if (!gh) return { questions: [] };
  return { questions: gh.questions.filter((q) => !isCoverLetterQuestion(q)) };
}
