// Resolves which uploaded-PDF path a profile save should keep.
//
// A fresh upload always wins. Otherwise a non-empty pasted résumé that differs
// from the stored text is a deliberate replacement, so the old PDF is dropped
// (returns null) — this is what stops résumé generation from re-downloading and
// parsing a stale upload after the user pastes new text (getResumeSource only
// fetches the PDF while resume_file_path is set, and parseProfile prefers the
// PDF-derived profile over the text). An unchanged or empty submission keeps the
// existing path so an empty file input never wipes a prior upload.
export function resolveResumeFilePath(args: {
  submittedText: string;
  existingText: string | null;
  existingPath: string | null;
  freshUploadPath: string | null;
}): string | null {
  if (args.freshUploadPath) return args.freshUploadPath;
  if (args.submittedText && args.submittedText !== (args.existingText ?? "")) {
    return null;
  }
  return args.existingPath;
}
