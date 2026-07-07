// RUNTIME-PURE: imports only the TailoredCoverLetter type, so safe for client, server, and CLI.
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

/** Plain-text cover letter (used for copy, PDF fallback, and the LangFuse trace output).
 *  Mirrors composeResumeText. */
export function composeCoverLetterText(data: TailoredCoverLetter): string {
  let t = `${data.greeting}\n\n`;
  data.paragraphs.forEach((p) => { t += `${p}\n\n`; });
  t += `${data.closing}\n${data.signature}\n`;
  return t;
}
