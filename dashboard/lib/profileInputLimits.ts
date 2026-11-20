// Server-side caps on the free-text and file inputs that feed LLM prompts. Every
// review and generation sends the résumé and the standing instructions, so their
// length multiplies spend; the 1 MB server-action body limit alone allows a
// ~250k-token résumé. Over-cap input is a validation error, never a silent truncate.
// RUNTIME-PURE — safe for client, server, and tests.

// A long multi-page CV is ~20k characters; 50k leaves room without letting the
// résumé become a prompt-sized payload.
export const RESUME_TEXT_MAX_LENGTH = 50_000;
// Standing job/company preference instructions (profile-level, sent with every review).
export const PROFILE_INSTRUCTIONS_MAX_LENGTH = 8_000;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function resumeTextError(value: string | null | undefined): string | null {
  if (value && value.length > RESUME_TEXT_MAX_LENGTH) {
    return `Résumé text is too long (max ${RESUME_TEXT_MAX_LENGTH.toLocaleString("en-US")} characters).`;
  }
  return null;
}

export function instructionsError(value: string | null | undefined): string | null {
  if (value && value.length > PROFILE_INSTRUCTIONS_MAX_LENGTH) {
    return `Instructions are too long (max ${PROFILE_INSTRUCTIONS_MAX_LENGTH.toLocaleString("en-US")} characters).`;
  }
  return null;
}

// The same PDF and size rule for every résumé upload path. The storage bucket is
// written with the user's own JWT, so this is the app-side half of the check.
export function resumePdfError(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Upload a PDF file.";
  if (file.size > MAX_RESUME_BYTES) return "PDF must be 5 MiB or smaller.";
  return null;
}
