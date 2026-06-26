const MAX_LOCATIONS = 100;

// The profile form submits the picked locations as a JSON string array in a
// hidden field — JSON, not CSV, because location strings contain commas (e.g.
// "San Francisco, CA"). Parse defensively: any bad/missing input degrades to
// "no preference" ([]) rather than throwing in the server action.
export function parsePreferredLocations(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of parsed) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_LOCATIONS) break;
  }
  return out;
}
