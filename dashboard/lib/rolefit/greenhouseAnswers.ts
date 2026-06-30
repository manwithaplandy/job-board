// dashboard/lib/rolefit/greenhouseAnswers.ts
//
// Merge a Greenhouse posting's real (text-answerable) questions with the LLM-prefilled
// answers so the UI can render BOTH the answered questions AND the still-unanswered
// ones — especially required questions, which must stay visible (with their Required
// badge) even when the model only answers some of the form. Answers are matched to
// questions by exact label; any prefilled answer with no matching question is appended
// so answered content is never dropped.
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";

// File-upload fields can't be answered with text (the résumé/cover letter attach
// separately), so they're excluded — mirrors prefillSchema.toPrefillQuestions.
const isFileType = (type: string): boolean => /file|attachment/i.test(type);

export interface MergedGreenhouseQuestion {
  key: string;
  label: string;
  required: boolean;
  // The suggested answer (trimmed, non-empty) or null when the question is unanswered.
  answer: string | null;
}

export function mergeGreenhouseQuestions(
  greenhouseQuestions: GreenhouseQuestions | null,
  prefilledAnswers: PrefilledAnswer[] | null,
): MergedGreenhouseQuestion[] {
  // Non-file questions this posting actually asks (the prompt list).
  const promptQuestions = (greenhouseQuestions?.questions ?? [])
    .filter((q) => q.fields.some((f) => !isFileType(f.type)));

  // First non-empty suggested answer per question label.
  const byLabel = new Map<string, string>();
  for (const a of prefilledAnswers ?? []) {
    if (!a || typeof a.question !== "string" || typeof a.answer !== "string") continue;
    const answer = a.answer.trim();
    if (answer && !byLabel.has(a.question)) byLabel.set(a.question, answer);
  }

  const rows: MergedGreenhouseQuestion[] = [];
  const renderedLabels = new Set<string>();
  promptQuestions.forEach((q, i) => {
    renderedLabels.add(q.label);
    rows.push({
      key: `${q.label}-${i}`,
      label: q.label,
      required: q.required,
      answer: byLabel.get(q.label) ?? null,
    });
  });

  // Orphan answers (no matching prompt question) — keep them so nothing answered is lost.
  (prefilledAnswers ?? []).forEach((a, i) => {
    if (!a || typeof a.question !== "string" || typeof a.answer !== "string") return;
    const answer = a.answer.trim();
    if (!answer || renderedLabels.has(a.question)) return;
    renderedLabels.add(a.question);
    rows.push({ key: `orphan-${a.question}-${i}`, label: a.question, required: false, answer });
  });

  return rows;
}
