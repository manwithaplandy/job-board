import type { ProfileLinks } from "@/lib/types";

// Total parser for the profiles.links jsonb column. postgres.js can return a
// double-encoded jsonb value as a JS *string* (see dashboard/CLAUDE.md); a prior
// bug re-stringified it on each save, nesting the escaping several deep. Unwrap
// up to a few string layers, then keep ONLY the three known URL keys as non-empty
// strings. Any malformed shape degrades to {} rather than throwing into a render.
const MAX_UNWRAP = 5;

function trimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function parseProfileLinks(raw: unknown): ProfileLinks {
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
  const out: ProfileLinks = {};
  const linkedin = trimmedString(src.linkedin);
  const github = trimmedString(src.github);
  const portfolio = trimmedString(src.portfolio);
  if (linkedin) out.linkedin = linkedin;
  if (github) out.github = github;
  if (portfolio) out.portfolio = portfolio;
  return out;
}
