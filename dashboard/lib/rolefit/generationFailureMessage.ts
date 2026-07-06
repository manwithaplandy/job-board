// Map a raw generation failure to the USER-SAFE message stored on the
// generation_jobs row (and shown in the failure toast). Extracted from the old
// inline error→HTTP-status branches of /api/resume and /api/cover-letter when
// those routes went asynchronous: with a 202-first contract the status code can
// no longer carry the failure, so the mapped copy is the whole user-facing
// signal. The raw message still goes to the Vercel runtime logs at the call
// site — this mapping only decides what the user sees.

/** `label` is the artifact name used in the copy ("Résumé" / "Cover letter"). */
export function generationFailureMessage(label: string, rawMessage: string): string {
  const msg = rawMessage;
  // Truncation is reasoning-overflow, NOT résumé length (see REASONING_SAFE_MAX_TOKENS),
  // so never advise "use a shorter résumé"; a truncated payload also arrives as non-JSON.
  if (msg.includes("truncated") || msg.includes("non-JSON")) return `${label} generation was cut off — please try again.`;
  if (msg.includes("timeout") || msg.includes("aborted")) return `${label} generation timed out — please try again.`;
  if (msg.includes("429") || msg.includes("rate")) return "Rate limited — try again in a moment.";
  if (msg.includes("402")) return "Insufficient credits.";
  return "Generation failed — try again.";
}
