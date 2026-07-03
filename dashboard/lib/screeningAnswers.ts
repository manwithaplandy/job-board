import type { ScreeningAnswers } from "@/lib/types";

// Total parser for the profiles.screening_answers jsonb column — the twin of
// parseProfileLinks. postgres.js can return a double-encoded jsonb value as a JS
// *string* (see dashboard/CLAUDE.md); the résumé-modal save re-stringifies
// existing.screening_answers each save, so a string scalar would nest the escaping.
// Unwrap up to a few string layers, then keep every entry whose value is a non-empty
// trimmed string (this column is an OPEN map, not a fixed key set). Any malformed
// shape degrades to {} rather than throwing into a render.
const MAX_UNWRAP = 5;

export function parseScreeningAnswers(raw: unknown): ScreeningAnswers {
  let cur = raw;
  for (let i = 0; i < MAX_UNWRAP && typeof cur === "string"; i++) {
    try {
      cur = JSON.parse(cur);
    } catch {
      return {};
    }
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return {};
  const src = cur as Record<string, unknown>;
  const out: ScreeningAnswers = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length) out[k] = t;
  }
  return out;
}
