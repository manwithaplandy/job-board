export interface ORModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
}

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Mirrors reviewer/llm.py DEFAULT_MODEL. Shown as the placeholder when unset.
export const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5";

// Curated default suggestions shown before the user types. All verified present and
// structured-output-capable on OpenRouter at design time (2026-06-25). The search box
// filters the FULL live catalog, so staleness here is low-impact — edit freely.
export const CURATED_MODELS: string[] = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "openai/o4-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-maverick",
  "mistralai/mistral-small-3.2-24b-instruct",
  "mistralai/mistral-large",
  "x-ai/grok-4.3",
  "qwen/qwen3.7-max",
  "z-ai/glm-4.6",
];

interface RawModel {
  id: string;
  name: string;
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string };
}

// Fetched server-side; the OpenRouter catalog endpoint is public (no key needed).
// Cached 1h via Next's fetch cache. Returns [] on any failure so the UI degrades
// gracefully to the curated list.
export async function getStructuredModels(
  fetchImpl: typeof fetch = fetch,
): Promise<ORModel[]> {
  try {
    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: RawModel[] };
    const data = json?.data ?? [];
    return data
      .filter((m) => Array.isArray(m.supported_parameters)
        && m.supported_parameters.includes("structured_outputs"))
      .map((m) => ({
        id: m.id,
        name: m.name,
        pricing: { prompt: m.pricing?.prompt ?? "", completion: m.pricing?.completion ?? "" },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Letter-by-letter client-side filter. Empty query -> the curated shortlist (in
// curated order); a curated id absent from the catalog falls back to id-as-name.
export function filterModels(
  models: ORModel[], curated: string[], query: string,
): ORModel[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const byId = new Map(models.map((m) => [m.id, m]));
    return curated.map((id) => byId.get(id)
      ?? { id, name: id, pricing: { prompt: "", completion: "" } });
  }
  return models.filter((m) =>
    m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
}

export type ModelValidation =
  | { ok: true; value: string | null }
  | { ok: false; reason: string };

// empty -> null (use default); member -> accepted; non-member -> rejected.
// Empty catalog means the live fetch failed at save time — accept rather than
// block a valid save on a transient outage (spec §6.4).
export function validateModelId(raw: string, catalogIds: string[]): ModelValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (catalogIds.length === 0) return { ok: true, value: trimmed };
  if (catalogIds.includes(trimmed)) return { ok: true, value: trimmed };
  return { ok: false, reason: `unknown model: ${trimmed}` };
}
