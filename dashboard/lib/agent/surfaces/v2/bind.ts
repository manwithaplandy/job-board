// Data binding for the variant 2 tree (plan Task 2.1, spec 7.1 "data bound by path into a
// server-supplied data object"). A bind is a JSON pointer into the turn's GatheredData,
// limited to six roots and one to four segments, so a node can only show data the turn
// actually read under the user's RLS. Nothing here imports a server module: the client
// renderer resolves the same pointers against the stored gathered data.
//
// Segments may not contain "~" or "/", so there are no JSON pointer escapes. A job id with
// a "/" in it (Workday) is written percent-encoded ("%2F"); resolveBind tries the segment
// as written first, then percent-decoded, because job ids may contain a literal "%".
// Only own properties are read and arrays are indexed by plain digits, so a pointer can
// never reach a prototype key.

export const BIND_ROOTS = ["jobs", "reviews", "metrics", "applications", "shortlist", "profile"] as const;

/** An absolute bind into GatheredData. */
export const BIND_RE = /^\/(jobs|reviews|metrics|applications|shortlist|profile)(\/[\w.:%-]+){1,4}$/;

/**
 * A Table column's bind: a pointer relative to one row of the table's rowsBind array.
 * The empty pointer is the row itself (for a list of strings, such as a review's red flags).
 */
export const ROW_BIND_RE = /^(\/[\w.:%-]+){0,3}$/;

const INDEX_RE = /^(0|[1-9]\d{0,5})$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function decoded(segment: string): string | null {
  if (!segment.includes("%")) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

// EEO fields and the profile email never enter gathered data (Global Constraints, and
// getProfileSummary builds an explicit object). As defense in depth, a key that names one
// resolves to nothing anyway. The check is made on every key a step could read, the
// segment as written and its percent-decoded form, so "%65eo_gender" is refused like
// "eeo_gender" (PR J1 review I2, M6).
const DENIED_KEY_RE = /^(eeo|email$)/i;

function denied(key: string): boolean {
  return DENIED_KEY_RE.test(key);
}

/** One step of a pointer: an array index or an own key (as written, then percent-decoded). */
function step(value: unknown, segment: string): unknown {
  const alt = decoded(segment);
  if (denied(segment) || (alt !== null && denied(alt))) return undefined;
  if (Array.isArray(value)) {
    if (!INDEX_RE.test(segment)) return undefined;
    const i = Number(segment);
    return i < value.length ? value[i] : undefined;
  }
  if (!isRecord(value)) return undefined;
  if (Object.prototype.hasOwnProperty.call(value, segment)) return value[segment];
  return alt !== null && Object.prototype.hasOwnProperty.call(value, alt) ? value[alt] : undefined;
}

function walk(value: unknown, segments: readonly string[]): unknown {
  let at = value;
  for (const s of segments) {
    at = step(at, s);
    if (at === undefined) return undefined;
  }
  return at;
}

/**
 * The value a bind points at in the gathered data, or undefined when the pointer does not
 * match BIND_RE or does not resolve. Never throws.
 */
export function resolveBind(gathered: unknown, pointer: string): unknown {
  if (typeof pointer !== "string" || !BIND_RE.test(pointer)) return undefined;
  return walk(gathered, pointer.slice(1).split("/"));
}

/** A Table cell: a row-relative pointer into one row, or undefined. Never throws. */
export function resolveRowBind(row: unknown, pointer: string): unknown {
  if (typeof pointer !== "string" || !ROW_BIND_RE.test(pointer)) return undefined;
  return pointer === "" ? row : walk(row, pointer.slice(1).split("/"));
}

/** The pointer that names one metric the turn read, like /metrics/0. */
export const METRIC_BIND_RE = /^\/metrics\/(0|[1-9]\d{0,5})$/;
