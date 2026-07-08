// Per-job generation-instruction normalization shared by the three generate routes
// (/api/resume, /api/cover-letter, /api/application/prepare). Instructions are
// OPTIONAL free text from the per-job UI box: any non-string or blank input
// collapses to null; over-cap input is a caller error (400), never a silent truncate.
// RUNTIME-PURE — safe for client, server, and CLI.
export const INSTRUCTIONS_MAX_LENGTH = 4000;

export type NormalizedInstructions =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function normalizeInstructions(raw: unknown, label: string): NormalizedInstructions {
  if (typeof raw !== "string") return { ok: true, value: null };
  if (raw.length > INSTRUCTIONS_MAX_LENGTH) {
    return { ok: false, error: `${label} instructions too long (max ${INSTRUCTIONS_MAX_LENGTH} characters)` };
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}
