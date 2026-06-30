// dashboard/lib/rolefit/greenhouseQuestions.ts
//
// Fetch + parse the real application question schema for a Greenhouse posting.
// Greenhouse's public Job Board API returns the per-job question set (identity
// fields, custom screening questions, EEO, file uploads) when called with
// `?questions=true`. We parse it into a small typed shape the UI and the LLM
// prefill step can consume; every failure mode degrades to `null` so the board
// falls back to the generic application package.
//
// Host mirrors job_discovery/adapters/greenhouse.py (boards-api.greenhouse.io).

/** A select-type field option, e.g. { value: "0", label: "Yes" }. */
export interface GreenhouseFieldOption {
  value: string;
  label: string;
}

/** One input within a question (most questions have exactly one field). */
export interface GreenhouseField {
  name: string;
  type: string;            // e.g. "input_text" | "textarea" | "multi_value_single_select" | "input_file"
  options: GreenhouseFieldOption[]; // populated for select types; empty otherwise
}

export interface GreenhouseQuestion {
  label: string;
  required: boolean;
  fields: GreenhouseField[];
}

export interface GreenhouseQuestions {
  questions: GreenhouseQuestion[];
}

const GREENHOUSE_BOARDS_API = "https://boards-api.greenhouse.io/v1/boards";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function parseOptions(values: unknown): GreenhouseFieldOption[] {
  if (!Array.isArray(values)) return [];
  const out: GreenhouseFieldOption[] = [];
  for (const v of values) {
    if (!v || typeof v !== "object") continue;
    const o = v as { value?: unknown; label?: unknown };
    const label = asString(o.label);
    // Greenhouse encodes option values as numbers; normalize to string.
    const value = asString(o.value);
    if (label) out.push({ value, label });
  }
  return out;
}

function parseFields(fields: unknown): GreenhouseField[] {
  if (!Array.isArray(fields)) return [];
  const out: GreenhouseField[] = [];
  for (const f of fields) {
    if (!f || typeof f !== "object") continue;
    const o = f as { name?: unknown; type?: unknown; values?: unknown };
    const name = asString(o.name);
    const type = asString(o.type);
    if (!name && !type) continue;
    out.push({ name, type, options: parseOptions(o.values) });
  }
  return out;
}

/**
 * Parse a Greenhouse single-job payload (fetched with `?questions=true`) into the
 * typed question shape. Returns null when the payload has no usable `questions`
 * array, so callers can fall back to the generic package. Pure and total.
 */
export function parseGreenhouseQuestions(data: unknown): GreenhouseQuestions | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { questions?: unknown }).questions;
  if (!Array.isArray(raw)) return null;

  const questions: GreenhouseQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const o = q as { label?: unknown; required?: unknown; fields?: unknown };
    const label = asString(o.label);
    if (!label) continue;
    questions.push({
      label,
      required: o.required === true,
      fields: parseFields(o.fields),
    });
  }
  return { questions };
}

/**
 * Fetch + parse the question schema for a Greenhouse posting. Returns null on any
 * failure (network error, non-2xx, unparseable body, or empty question set) so the
 * UI quietly falls back to the generic application package. Never throws.
 */
export async function fetchGreenhouseQuestions(args: {
  token: string;
  externalId: string;
  fetchImpl?: typeof fetch;
}): Promise<GreenhouseQuestions | null> {
  const token = args.token?.trim();
  const externalId = args.externalId?.trim();
  if (!token || !externalId) return null;

  const doFetch = args.fetchImpl ?? fetch;
  const url =
    `${GREENHOUSE_BOARDS_API}/${encodeURIComponent(token)}` +
    `/jobs/${encodeURIComponent(externalId)}?questions=true`;
  try {
    const res = await doFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = parseGreenhouseQuestions(json);
    if (!parsed || parsed.questions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
