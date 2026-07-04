import { describe, expect, test } from "vitest";

import { getResumeSource } from "@/lib/rolefit/resumeSource";

// resume_text is now the SOLE generation source: getResumeSource is a tiny sync pure
// function (no supabase client, no PDF download, no pdfBytes). The whole surface is the
// `{ resumeText }` shape and the null→"" coalesce — no mocks, no boundaries.
describe("getResumeSource", () => {
  test("passes resume_text through and returns ONLY { resumeText }", () => {
    const out = getResumeSource({ resume_text: "hello" });
    // toEqual on the whole object: a reintroduced pdfBytes/extra field would fail here.
    expect(out).toEqual({ resumeText: "hello" });
  });

  test("null resume_text coalesces to empty string", () => {
    expect(getResumeSource({ resume_text: null })).toEqual({ resumeText: "" });
  });

  test("returns synchronously (not a Promise) so /api/resume can destructure it inline", () => {
    const out = getResumeSource({ resume_text: "x" });
    // A regression back to async would make out a Promise → resumeText undefined at the
    // callsite, silently feeding the generator garbage. Pin the sync string return.
    expect(out).not.toBeInstanceOf(Promise);
    expect(typeof out.resumeText).toBe("string");
  });
});
