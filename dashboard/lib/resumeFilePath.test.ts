import { describe, expect, test } from "vitest";
import { resolveResumeFilePath } from "@/lib/resumeFilePath";

describe("resolveResumeFilePath", () => {
  test("a fresh upload always wins, even when the text also changed", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "brand new pasted text",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: "u1/new.pdf",
      }),
    ).toBe("u1/new.pdf");
  });

  test("pasted text that differs from the stored text drops the stale PDF", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "brand new pasted text",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBeNull();
  });

  test("unchanged text keeps the existing PDF (e.g. re-saving the prefilled modal)", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "same text",
        existingText: "same text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBe("u1/old.pdf");
  });

  test("empty submitted text keeps the existing PDF (empty file input must not wipe it)", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBe("u1/old.pdf");
  });

  test("first-ever paste with no prior PDF stays null", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "my first resume",
        existingText: null,
        existingPath: null,
        freshUploadPath: null,
      }),
    ).toBeNull();
  });
});
