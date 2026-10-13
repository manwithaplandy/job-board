/** Client-safe lifecycle state: no DB, service credentials or mutation imports. */
export interface JobLifecycle {
  feedEnabled: boolean;
  sourceEnabled: boolean;
  sourceAvailability: "open" | "unknown" | "closed";
  discoveryAnchorAt: string;
  discoveryExpiresAt: string;
  payloadAvailability: "available" | "missing" | "retired";
}
/** Bounded JSON unwrapping tolerates old string-scalar writes; every result is validated. */
export function unwrapLifecycleJson(raw: unknown): unknown {
  let value = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i++) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value;
}
export function parseJobLifecycle(raw: unknown): JobLifecycle | null {
  const value = unwrapLifecycleJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = Object.fromEntries(Object.entries(value));
  const availability = row.sourceAvailability;
  const payload = row.payloadAvailability;
  if (typeof row.feedEnabled !== "boolean" || typeof row.sourceEnabled !== "boolean" ||
      (availability !== "open" && availability !== "unknown" && availability !== "closed") ||
      (payload !== "available" && payload !== "missing" && payload !== "retired") ||
      typeof row.discoveryAnchorAt !== "string" || typeof row.discoveryExpiresAt !== "string") return null;
  const zonedIso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!zonedIso.test(row.discoveryAnchorAt) || !zonedIso.test(row.discoveryExpiresAt)) return null;
  const anchor = Date.parse(row.discoveryAnchorAt), expires = Date.parse(row.discoveryExpiresAt);
  if (!Number.isFinite(anchor) || !Number.isFinite(expires) || expires - anchor !== 720 * 3600000) return null;
  return {feedEnabled:row.feedEnabled,sourceEnabled:row.sourceEnabled,sourceAvailability:availability,
    discoveryAnchorAt:row.discoveryAnchorAt,discoveryExpiresAt:row.discoveryExpiresAt,payloadAvailability:payload};
}
export interface SqlFragment { text: string; values: unknown[] }
/** SQL owns aggregation over multiple source listings and the persisted flag decision. */
export function discoveryPredicate(includeOlderLive: boolean): SqlFragment {
  return {text:`public.lifecycle_discovery_visible(j.id, j.closed_at, ${includeOlderLive ? "true" : "false"})`,values:[]};
}
export function discoveryVisible(state: JobLifecycle | null | undefined, includeOlderLive: boolean, nowIso: string): boolean {
  if (!state) return true; // Unmapped legacy rows retain their existing caller's closed_at gate.
  if (state.sourceAvailability === "closed") return false;
  if (!state.feedEnabled) return true;
  return Date.parse(nowIso) < Date.parse(state.discoveryExpiresAt) || (includeOlderLive && state.sourceAvailability === "open");
}
export function lifecycleLabels(state: JobLifecycle | null | undefined, nowIso: string): string[] {
  if (!state || !(state.feedEnabled || state.sourceEnabled)) return [];
  const labels = [`Source ${state.sourceAvailability}`];
  if (state.feedEnabled && Date.parse(nowIso) >= Date.parse(state.discoveryExpiresAt)) labels.push("Discovery expired");
  if (state.payloadAvailability !== "available") labels.push(state.payloadAvailability === "retired" ? "Posting payload retired" : "Posting payload unavailable");
  return labels;
}

export function parseStringList(raw: unknown): string[] | null {
  const value=unwrapLifecycleJson(raw);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}
export function parseRequirements(raw: unknown): {text:string;met:boolean}[] | null {
  const value=unwrapLifecycleJson(raw);
  if (!Array.isArray(value)) return null;
  const out: {text:string;met:boolean}[]=[];
  for (const rawItem of value) {
    if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) continue;
    const item=Object.fromEntries(Object.entries(rawItem));
    if (typeof item.text === "string" && typeof item.met === "boolean") out.push({text:item.text,met:item.met});
  }
  return out;
}

export function sourceClosedPredicate(): SqlFragment {
  return {text:"public.lifecycle_source_closed(j.id, j.closed_at)",values:[]};
}
