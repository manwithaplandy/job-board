export interface ORModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
}

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Mirrors reviewer/llm.py DEFAULT_MODEL. Shown as the placeholder when unset.
export const DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash";

// Curated default suggestions shown before the user types. Refreshed and catalog-verified
// 2026-06-25: mix of small bang-for-buck models + cheapest frontier reasoning models, all
// confirmed present and structured-output-capable on OpenRouter at that date. The search
// box filters the FULL live catalog, so staleness here is low-impact — edit freely.
export const CURATED_MODELS: string[] = [
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-nano",
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "openai/gpt-4.1-mini",
  "meta-llama/llama-4-scout",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-3.2-24b-instruct",
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v3.2",
  "qwen/qwen3-8b",
  "qwen/qwen3-32b",
  "qwen/qwen3-30b-a3b-thinking-2507",
  "qwen/qwen3-235b-a22b-thinking-2507",
  "deepseek/deepseek-r1-0528",
  "moonshotai/kimi-k2-thinking",
  "google/gemini-2.5-pro",
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

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

// Remaining OpenRouter credits (total - usage), or null when unknown (no key,
// transient error). Used by the out-of-credits banner's Refresh to self-clear.
export async function getOpenRouterCredits(
  fetchImpl: typeof fetch = fetch,
  apiKey: string | undefined = process.env.OPENROUTER_API_KEY,
): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchImpl(OPENROUTER_CREDITS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const d = json?.data;
    if (!d || typeof d.total_credits !== "number" || typeof d.total_usage !== "number") {
      return null;
    }
    return d.total_credits - d.total_usage;
  } catch {
    return null;
  }
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
