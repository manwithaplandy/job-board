import { describe, expect, test } from "vitest";
import { normalizeInstructions, INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

describe("normalizeInstructions", () => {
  test("non-string and blank inputs collapse to null", () => {
    expect(normalizeInstructions(undefined, "résumé")).toEqual({ ok: true, value: null });
    expect(normalizeInstructions(42, "résumé")).toEqual({ ok: true, value: null });
    expect(normalizeInstructions("   \n ", "résumé")).toEqual({ ok: true, value: null });
  });

  test("trims and passes real text through", () => {
    expect(normalizeInstructions("  focus on Python \n", "résumé")).toEqual({ ok: true, value: "focus on Python" });
  });

  test("rejects over-cap input instead of truncating", () => {
    const res = normalizeInstructions("x".repeat(INSTRUCTIONS_MAX_LENGTH + 1), "cover letter");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("cover letter");
  });
});
