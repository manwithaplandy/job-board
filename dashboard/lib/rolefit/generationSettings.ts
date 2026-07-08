// dashboard/lib/rolefit/generationSettings.ts
//
// Per-request reasoning-effort resolution shared by the three generation routes
// (/api/resume, /api/cover-letter, /api/application/prepare) so the plan clamp
// and the model-capability check can never drift between them.
//
// Returns the effort to send, or null to OMIT the `reasoning` field entirely.
// Omission is REQUIRED for models without reasoning support: OpenRouter
// hard-fails a request carrying `reasoning` (even {enabled:false}) to a model
// whose provider can't take it (probed live 2026-07-08, openai/gpt-5.2-chat).
// Unknown support — model missing from the catalog, or the catalog fetch failed
// ([]) — fails OPEN (attach), matching validateModelId's save-time posture.
import { resolveReasoningEffort, type Plan, type ReasoningEffort } from "@/lib/entitlements";
import type { ORModel } from "@/lib/openrouter";

export function resolveReasoningSetting(
  plan: Plan | null,
  saved: string | null,
  model: string,
  catalog: ORModel[],
): ReasoningEffort | null {
  const requested: ReasoningEffort =
    saved === "low" || saved === "medium" || saved === "high" ? saved : "off";
  const effort = resolveReasoningEffort(plan, requested);
  const entry = catalog.find((m) => m.id === model);
  if (entry?.reasoning === false) return null;
  return effort;
}
