// The agent's one model factory. Every agent model call goes through OpenRouter with
// usage accounting on, so each step's providerMetadata carries the billed cost that
// lib/agent/budget.ts charges (falling back to a token estimate when it is absent).
//
// The key is read per call, not at import, so a missing key fails the request that
// needs it instead of the build, and tests can vary it. AGENT_OPENROUTER_API_KEY lets
// the agent run on its own key (its own OpenRouter spend limit); otherwise it shares
// OPENROUTER_API_KEY with the rest of the dashboard.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";

export function agentModel(modelId: string = AGENT_MODEL_DEFAULT): LanguageModel {
  const apiKey = process.env.AGENT_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("agent: OpenRouter key missing");
  // strict: the OpenRouter API itself, so newer fields (stream usage) are sent.
  const openrouter = createOpenRouter({ apiKey, compatibility: "strict" });
  return openrouter.chat(modelId, { usage: { include: true } });
}
