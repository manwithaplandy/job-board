import { describe, expect, test } from "vitest";
import { COMPILED_MEMO_MAX, compiledMemoOverflow, compileMemo, diffMemo } from "@/lib/workspaces/memoCompile";
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

  test("compiledMemoOverflow says how far over the cap the uncut text runs, else 0", () => {
    const full = MemoDocSchema.parse(Object.fromEntries(MEMO_SECTIONS.map(({ key }) => [key, "x".repeat(2000)])));
    const uncut = MEMO_SECTIONS.reduce((n, { label }) => n + label.length + 2 + 2000, 0) + 2 * (MEMO_SECTIONS.length - 1);
    expect(compiledMemoOverflow(full)).toBe(uncut - COMPILED_MEMO_MAX);
    expect(compiledMemoOverflow(emptyMemoDoc())).toBe(0);
    const small = { ...emptyMemoDoc(), role: "Staff" };
    expect(compiledMemoOverflow(small)).toBe(0);
    // Exactly at the cap fits; one more character is one over.
    const exact = { ...emptyMemoDoc(), role: "a".repeat(2000), mustHaves: "m".repeat(2000), other: "o" };
    const room = COMPILED_MEMO_MAX - compileMemo(exact).length;
    const filled = { ...exact, other: "o".repeat(1 + room) };
    expect(compileMemo(filled)).toHaveLength(COMPILED_MEMO_MAX);
    expect(compiledMemoOverflow(filled)).toBe(0);
    expect(compiledMemoOverflow({ ...filled, other: `${filled.other}o` })).toBe(1);
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
