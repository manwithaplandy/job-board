// What a full application prep writes for a posting, from its Greenhouse question schema.
// The one definition: startApplicationPrep charges and generates by it, and the agent
// page's prep checklist reads "Not needed" from it. Pure, so client code can import it.
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "@/lib/rolefit/coverLetterQuestion";
import { toPrefillQuestions, type PrefillQuestion } from "@/lib/rolefit/prefillSchema";

/**
 * The questions the prefill leg answers: the answerable (non-file) questions minus any
 * cover-letter question, which the cover leg writes instead.
 */
export function prefillQuestionsFor(questions: GreenhouseQuestions | null): PrefillQuestion[] {
  return toPrefillQuestions(stripCoverLetterQuestions(questions));
}

export interface PrepNeeds {
  /** The posting asks for a cover letter, so a full prep writes (and charges) one. */
  cover: boolean;
  /** The posting has questions the prefill leg answers. */
  answers: boolean;
}

export function prepNeeds(questions: GreenhouseQuestions | null): PrepNeeds {
  return { cover: hasCoverLetterQuestion(questions), answers: prefillQuestionsFor(questions).length > 0 };
}
