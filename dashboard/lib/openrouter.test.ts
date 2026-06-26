import { describe, expect, test, vi } from "vitest";
import {
  getStructuredModels, filterModels, validateModelId, CURATED_MODELS, type ORModel,
} from "@/lib/openrouter";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

const CATALOG = {
  data: [
    { id: "b/model", name: "B Model", supported_parameters: ["structured_outputs", "tools"],
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
      id: "a/model", name: "A Model",
      pricing: { prompt: "0.000003", completion: "0.000004" },
    });
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

  test("curated id missing from catalog falls back to id-as-name", () => {
    const out = filterModels(models, ["zzz/unknown"], "");
    expect(out[0]).toEqual({ id: "zzz/unknown", name: "zzz/unknown", pricing: { prompt: "", completion: "" } });
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

test("CURATED_MODELS is a non-empty list of ids", () => {
  expect(CURATED_MODELS.length).toBeGreaterThan(0);
  expect(CURATED_MODELS).toContain("anthropic/claude-haiku-4.5");
});
