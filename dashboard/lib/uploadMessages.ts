// The fixed messages for POST /api/agent/upload's error codes, shared by the documents
// page and the agent page's attach button (plan Task 1.20). Client-safe: no imports.

export const UPLOAD_ERRORS: Readonly<Record<string, string>> = {
  too_large: "That file is larger than 4 MB.",
  empty: "That file is empty.",
  type_not_allowed: "Upload a PDF, PNG, JPEG, WebP, plain-text or Markdown file.",
  type_mismatch: "That file's contents do not match its type.",
  budget: "Reading text from images is paused: your agent budget is used up for now.",
  subscription_required: "Uploads need an active plan.",
};

export const UPLOAD_FAILED = "That upload did not go through. Try again.";

/** What the file picker accepts (the upload route checks the bytes again). */
export const UPLOAD_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown";

/** The fixed message for an upload response's error code; an unknown code reads as a failed upload. */
export function uploadErrorMessage(code: unknown): string {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(UPLOAD_ERRORS, code) ? UPLOAD_ERRORS[code] : UPLOAD_FAILED;
}
