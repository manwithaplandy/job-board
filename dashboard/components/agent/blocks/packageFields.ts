// The parsed documents of one application package (plan Task 1.19). Pure: every jsonb
// column goes through the package codec's total parsers, so a malformed row reads as
// "not there" rather than reaching React.
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import { parsePrefilledAnswers, parseTailoredCoverLetter, parseTailoredResume } from "@/lib/rolefit/packageCodec";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { PackageView } from "./types";

export interface PackageFields {
  resume: TailoredResume | null;
  cover: TailoredCoverLetter | null;
  /** The letter as the user will send it: their current edit, else the generated letter. */
  coverText: string | null;
  answers: PrefilledAnswer[];
}

export function packageFields(view: PackageView | null): PackageFields {
  if (!view) return { resume: null, cover: null, coverText: null, answers: [] };
  const resume = parseTailoredResume(view.resume);
  const cover = parseTailoredCoverLetter(view.coverLetter);
  const edited = typeof view.coverLetterEditedText === "string" && view.coverLetterEditedText.trim() !== "" ? view.coverLetterEditedText : null;
  return {
    resume,
    cover,
    coverText: edited ?? (cover ? composeCoverLetterText(cover) : null),
    answers: parsePrefilledAnswers(view.prefilledAnswers) ?? [],
  };
}
