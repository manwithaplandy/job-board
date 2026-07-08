import { describe, expect, test } from "vitest";
import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
import type { ORModel } from "@/lib/openrouter";

const or = (id: string, reasoning?: boolean): ORModel =>
  ({ id, name: id, reasoning, pricing: { prompt: "", completion: "" } });

const CATALOG: ORModel[] = [
  or("deepseek/deepseek-v4-flash", true),
  or("openai/gpt-5.2-chat", false),
];

describe("resolveReasoningSetting", () => {
  test("NULL saved value means off (the default) on a reasoning-capable model", () => {
    expect(resolveReasoningSetting("standard", null, "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });

  test("saved level passes through when the plan grants it", () => {
    expect(resolveReasoningSetting("pro", "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("high");
    expect(resolveReasoningSetting("standard", "low", "deepseek/deepseek-v4-flash", CATALOG)).toBe("low");
  });

  test("plan clamp: standard with a saved 'high' (pro downgrade) degrades to low", () => {
    expect(resolveReasoningSetting("standard", "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("low");
  });

  test("null plan resolves to off", () => {
    expect(resolveReasoningSetting(null, "high", "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });

  test("model without reasoning support -> null (OMIT the field), whatever is saved", () => {
    expect(resolveReasoningSetting("pro", "high", "openai/gpt-5.2-chat", CATALOG)).toBeNull();
    expect(resolveReasoningSetting("standard", null, "openai/gpt-5.2-chat", CATALOG)).toBeNull();
  });

  test("fails OPEN when support is unknown: model missing from catalog or catalog empty", () => {
    expect(resolveReasoningSetting("pro", "medium", "vanished/model", CATALOG)).toBe("medium");
    expect(resolveReasoningSetting("standard", null, "deepseek/deepseek-v4-flash", [])).toBe("off");
  });

  test("garbage saved value (defensive) is treated as off", () => {
    expect(resolveReasoningSetting("pro", "maximum", "deepseek/deepseek-v4-flash", CATALOG)).toBe("off");
  });
});
