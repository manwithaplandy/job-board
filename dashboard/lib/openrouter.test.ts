import { describe, expect, it, test, vi } from "vitest";
import {
  getStructuredModels, filterModels, validateModelId, getOpenRouterCredits,
  CURATED_MODELS, DEFAULT_MODEL_ID, type ORModel,
} from "@/lib/openrouter";
import { CHEAP_MODEL, PREMIUM_MODEL } from "@/lib/entitlements";
import { DEFAULT_RESUME_MODEL } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL } from "@/lib/rolefit/prefillClient";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

const CATALOG = {
  data: [
    { id: "b/model", name: "B Model", supported_parameters: ["structured_outputs", "tools", "reasoning"],
      pricing: { prompt: "0.000001", completion: "0.000002" } },
    { id: "a/model", name: "A Model", supported_parameters: ["structured_outputs"],
      pricing: { prompt: "0.000003", completion: "0.000004" } },
    { id: "c/notools", name: "C NoStructured", supported_parameters: ["tools"],
      pricing: { prompt: "0", completion: "0" } },
  ],
};

describe("getStructuredModels", () => {
  test("keeps only structured_outputs models, mapped and sorted by name", async () => {
    const models = await getStructuredModels(fakeFetch(CATALOG));
    expect(models.map((m) => m.id)).toEqual(["a/model", "b/model"]);
    expect(models[0]).toEqual({
      id: "a/model", name: "A Model", reasoning: false,
      pricing: { prompt: "0.000003", completion: "0.000004" },
    });
    expect(models[1].reasoning).toBe(true);
  });

  test("returns [] on non-ok response", async () => {
    expect(await getStructuredModels(fakeFetch(CATALOG, false))).toEqual([]);
  });

  test("returns [] when fetch throws", async () => {
    const throwing = (() => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await getStructuredModels(throwing)).toEqual([]);
  });
});

describe("filterModels", () => {
  const models: ORModel[] = [
    { id: "anthropic/claude-haiku-4.5", name: "Anthropic: Claude Haiku 4.5", pricing: { prompt: "", completion: "" } },
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini", pricing: { prompt: "", completion: "" } },
  ];

  test("empty query returns curated models in curated order", () => {
    const out = filterModels(models, ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"], "");
    expect(out.map((m) => m.id)).toEqual(["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"]);
  });

  test("whitespace-only query returns curated models in curated order", () => {
    const out = filterModels(models, ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"], "   ");
    expect(out.map((m) => m.id)).toEqual(["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"]);
  });

  test("curated id absent from a populated catalog is dropped (intersected out)", () => {
    // A populated live catalog is authoritative: a curated id it no longer lists would be
    // offered-but-unsavable (the save gate validates against this same catalog and rejects
    // it as "unknown model"), so the empty-query shortlist drops it instead of id-as-name.
    const out = filterModels(models, ["anthropic/claude-haiku-4.5", "zzz/unknown"], "");
    expect(out.map((m) => m.id)).toEqual(["anthropic/claude-haiku-4.5"]);
  });

  test("empty catalog (live fetch failed) keeps the full curated list as id-as-name", () => {
    // No live catalog => we can't authoritatively prune, so degrade to every curated
    // default rather than an empty picker (mirrors validateModelId's fail-open).
    const out = filterModels([], ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"], "");
    expect(out).toEqual([
      { id: "openai/gpt-4o-mini", name: "openai/gpt-4o-mini", pricing: { prompt: "", completion: "" } },
      { id: "anthropic/claude-haiku-4.5", name: "anthropic/claude-haiku-4.5", pricing: { prompt: "", completion: "" } },
    ]);
  });

  test("non-empty query matches id or name, case-insensitive", () => {
    expect(filterModels(models, [], "HAIKU").map((m) => m.id)).toEqual(["anthropic/claude-haiku-4.5"]);
    expect(filterModels(models, [], "gpt-4o").map((m) => m.id)).toEqual(["openai/gpt-4o-mini"]);
  });
});

describe("validateModelId", () => {
  const ids = ["anthropic/claude-haiku-4.5", "openai/gpt-4o-mini"];

  test("empty -> null (use default)", () => {
    expect(validateModelId("", ids)).toEqual({ ok: true, value: null });
    expect(validateModelId("   ", ids)).toEqual({ ok: true, value: null });
  });

  test("member of catalog -> accepted", () => {
    expect(validateModelId("openai/gpt-4o-mini", ids)).toEqual({ ok: true, value: "openai/gpt-4o-mini" });
  });

  test("non-member -> rejected", () => {
    expect(validateModelId("fake/model", ids)).toEqual({ ok: false, reason: "unknown model: fake/model" });
  });

  test("empty catalog (fetch failed) -> accept submitted id", () => {
    expect(validateModelId("fake/model", [])).toEqual({ ok: true, value: "fake/model" });
  });
});

describe("CURATED_MODELS curation policy (2026-07-08 refresh)", () => {
  test("contains the requested additions", () => {
    expect(CURATED_MODELS).toContain("anthropic/claude-sonnet-5");
    expect(CURATED_MODELS).toContain("openai/gpt-5.5");
  });

  test("aged-out and superseded models are gone", () => {
    for (const gone of [
      "google/gemini-2.5-flash-lite", "google/gemini-2.5-flash", "google/gemini-2.5-pro",
      "openai/gpt-4.1-nano", "openai/gpt-4o-mini", "openai/gpt-5-mini", "openai/gpt-4.1-mini",
      "meta-llama/llama-4-scout", "meta-llama/llama-4-maverick", "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-small-3.2-24b-instruct", "deepseek/deepseek-v3.2",
      "qwen/qwen3-8b", "qwen/qwen3-32b", "qwen/qwen3-30b-a3b-thinking-2507",
      "qwen/qwen3-235b-a22b-thinking-2507", "deepseek/deepseek-r1-0528",
    ]) {
      expect(CURATED_MODELS).not.toContain(gone);
    }
  });

  test("the default / entitlement model ids stay members (spec invariant)", () => {
    for (const id of [
      DEFAULT_MODEL_ID, CHEAP_MODEL, PREMIUM_MODEL,
      DEFAULT_RESUME_MODEL, DEFAULT_COVER_MODEL, DEFAULT_PREFILL_MODEL,
    ]) {
      expect(CURATED_MODELS).toContain(id);
    }
  });
});

describe("getOpenRouterCredits", () => {
  it("returns remaining = total - usage", async () => {
    const f = fakeFetch({ data: { total_credits: 10, total_usage: 3 } });
    expect(await getOpenRouterCredits(f, "key")).toBe(7);
  });
  it("returns null without an api key", async () => {
    expect(await getOpenRouterCredits(fakeFetch({}), "")).toBeNull();
  });
  it("returns null on a failed response", async () => {
    expect(await getOpenRouterCredits(fakeFetch({}, false), "key")).toBeNull();
  });
});
