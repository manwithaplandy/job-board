import { describe, expect, it } from "vitest";
import {
  MAX_RESUME_BYTES,
  PROFILE_INSTRUCTIONS_MAX_LENGTH,
  RESUME_TEXT_MAX_LENGTH,
  instructionsError,
  resumePdfError,
  resumeTextError,
} from "@/lib/profileInputLimits";

describe("profile input limits", () => {
  it("accepts résumé text up to the cap and rejects longer", () => {
    expect(resumeTextError(null)).toBeNull();
    expect(resumeTextError("x".repeat(RESUME_TEXT_MAX_LENGTH))).toBeNull();
    expect(resumeTextError("x".repeat(RESUME_TEXT_MAX_LENGTH + 1))).toMatch(/too long/);
  });

  it("accepts instructions up to the cap and rejects longer", () => {
    expect(instructionsError(undefined)).toBeNull();
    expect(instructionsError("x".repeat(PROFILE_INSTRUCTIONS_MAX_LENGTH))).toBeNull();
    expect(instructionsError("x".repeat(PROFILE_INSTRUCTIONS_MAX_LENGTH + 1))).toMatch(/too long/);
  });

  it("accepts a PDF within the size limit", () => {
    expect(resumePdfError(new File(["%PDF"], "cv.pdf", { type: "application/pdf" }))).toBeNull();
    expect(resumePdfError(new File(["%PDF"], "CV.PDF", { type: "" }))).toBeNull();
  });

  it("rejects non-PDF and oversized uploads", () => {
    expect(resumePdfError(new File(["<html>"], "x.html", { type: "text/html" }))).toBe("Upload a PDF file.");
    const big = new File([new Uint8Array(MAX_RESUME_BYTES + 1)], "cv.pdf", { type: "application/pdf" });
    expect(resumePdfError(big)).toMatch(/5 MiB/);
  });
});
