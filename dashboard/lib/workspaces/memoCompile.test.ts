import { describe, expect, test } from "vitest";
import { COMPILED_MEMO_MAX, compileMemo, diffMemo } from "@/lib/workspaces/memoCompile";
import { emptyMemoDoc, MEMO_SECTIONS, MemoDocSchema } from "@/lib/workspaces/memoSchema";

describe("compileMemo", () => {
  test("compileMemo omits empty sections and keeps the fixed order", () => {
    const doc = { ...emptyMemoDoc(), other: "Four-day week", role: "  Staff backend  ", dealBreakers: "   ", compensation: "$200k+" };
    expect(compileMemo(doc)).toBe("Role and seniority: Staff backend\n\nCompensation: $200k+\n\nAnything else: Four-day week");
    expect(compileMemo(emptyMemoDoc())).toBe("");
    // Deterministic.
    expect(compileMemo(doc)).toBe(compileMemo({ ...doc }));
  });

  test("compileMemo output never exceeds 6000 chars", () => {
    const full = Object.fromEntries(MEMO_SECTIONS.map(({ key }) => [key, "x".repeat(2000)]));
    const doc = MemoDocSchema.parse(full);
    expect(compileMemo(doc)).toHaveLength(COMPILED_MEMO_MAX);
    // A surrogate pair at the cut is dropped whole, never split.
    const emoji = MemoDocSchema.parse({ ...full, role: "😀".repeat(1000) });
    const out = compileMemo(emoji);
    expect(out.length).toBeLessThanOrEqual(COMPILED_MEMO_MAX);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});

describe("diffMemo and the schema", () => {
  test("diffMemo lists changed sections only, in display order", () => {
    const a = { ...emptyMemoDoc(), role: "A", other: "x" };
    const b = { ...a, other: "y", role: "B", companies: "" };
    expect(diffMemo(a, b)).toEqual([
      { section: "role", before: "A", after: "B" },
      { section: "other", before: "x", after: "y" },
    ]);
    expect(diffMemo(a, a)).toEqual([]);
  });

  test("the schema is strict and caps each section at 2000", () => {
    expect(MemoDocSchema.safeParse({ ...emptyMemoDoc(), extra: "x" }).success).toBe(false);
    expect(MemoDocSchema.safeParse({ ...emptyMemoDoc(), role: "x".repeat(2001) }).success).toBe(false);
    expect(MemoDocSchema.safeParse({ ...emptyMemoDoc(), role: 1 }).success).toBe(false);
    expect(MEMO_SECTIONS.map((s) => s.label)).toEqual([
      "Role and seniority", "Locations and arrangement", "Compensation", "Must-haves", "Deal-breakers",
      "Companies and industries", "Anything else",
    ]);
  });
});
