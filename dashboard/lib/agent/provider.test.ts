import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { agentModel } from "@/lib/agent/provider";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";

// No network: global fetch is stubbed and records the outgoing request, then fails it.
// The assertions are on what the provider would actually send to OpenRouter.
type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

function captureFetch(): Captured[] {
  const seen: Captured[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw: unknown = JSON.parse(String(init?.body ?? "{}"));
    seen.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: typeof raw === "object" && raw !== null ? Object.fromEntries(Object.entries(raw)) : {},
    });
    throw new Error("network disabled in tests");
  });
  return seen;
}

async function sendOne(model: ReturnType<typeof agentModel>): Promise<void> {
  if (typeof model === "string") throw new Error("expected a model object");
  try {
    await model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] });
  } catch {
    // Expected: the stubbed fetch fails every request after recording it.
  }
}

describe("agentModel", () => {
  beforeEach(() => {
    vi.stubEnv("AGENT_OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("throws when no key is configured", () => {
    expect(() => agentModel()).toThrow("agent: OpenRouter key missing");
  });

  test("a whitespace-only key counts as missing", () => {
    vi.stubEnv("AGENT_OPENROUTER_API_KEY", "   ");
    vi.stubEnv("OPENROUTER_API_KEY", "\n\t");
    expect(() => agentModel()).toThrow("agent: OpenRouter key missing");
  });

  test("a whitespace-only agent key falls through, and keys are trimmed", async () => {
    vi.stubEnv("AGENT_OPENROUTER_API_KEY", "  ");
    vi.stubEnv("OPENROUTER_API_KEY", "shared-key\n");
    const seen = captureFetch();
    await sendOne(agentModel());
    expect(seen[0].headers.get("authorization")).toBe("Bearer shared-key");
  });

  test("prefers AGENT_OPENROUTER_API_KEY", async () => {
    vi.stubEnv("AGENT_OPENROUTER_API_KEY", "agent-key");
    vi.stubEnv("OPENROUTER_API_KEY", "shared-key");
    const seen = captureFetch();
    await sendOne(agentModel());
    expect(seen).toHaveLength(1);
    expect(seen[0].headers.get("authorization")).toBe("Bearer agent-key");
  });

  test("falls back to OPENROUTER_API_KEY", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "shared-key");
    const seen = captureFetch();
    await sendOne(agentModel());
    expect(seen[0].headers.get("authorization")).toBe("Bearer shared-key");
  });

  test("uses the default model, asks for usage accounting and honours a model override", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "shared-key");
    const seen = captureFetch();
    await sendOne(agentModel());
    await sendOne(agentModel("anthropic/claude-haiku-5.5"));
    expect(seen[0].url).toContain("openrouter.ai");
    expect(seen[0].body.model).toBe(AGENT_MODEL_DEFAULT);
    expect(seen[0].body.usage).toEqual({ include: true });
    expect(seen[1].body.model).toBe("anthropic/claude-haiku-5.5");
    expect(seen[1].body.usage).toEqual({ include: true });
  });
});
