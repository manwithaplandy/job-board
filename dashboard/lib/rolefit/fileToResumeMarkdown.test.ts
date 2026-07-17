import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { jsPDF } from "jspdf";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { parseProfileText } from "@/lib/rolefit/parseProfile";

const here = path.dirname(fileURLToPath(import.meta.url));
const realPdf = path.resolve(here, "../../scripts/fixtures/source.pdf");

// A valid PDF with a real text layer whose layout the coordinate parser can't
// structure (no experience entries) — the shape of résumé that must reach the
// flat-text fallback instead of 422ing.
function unstructuredTextPdf(): Uint8Array {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Ada Lovelace", 20, 20);
  doc.setFontSize(11);
  doc.text("Analyst and metaphysician; wrote the first published algorithm.", 20, 40);
  return new Uint8Array(doc.output("arraybuffer"));
}

describe("fileToResumeMarkdown", () => {
  test("returns empty string for empty input", async () => {
    expect(await fileToResumeMarkdown(new Uint8Array(), "pdf")).toBe("");
  });

  test("falls back to flat text when the structured parse fails on a readable PDF", async () => {
    const md = await fileToResumeMarkdown(unstructuredTextPdf(), "pdf");
    expect(md).toContain("Ada Lovelace");
  });

  test("does not consume the caller's bytes (pdf.js transfer must not leak out)", async () => {
    const bytes = unstructuredTextPdf();
    const size = bytes.length;
    await fileToResumeMarkdown(bytes, "pdf");
    expect(bytes.length).toBe(size);
  });

  test.skipIf(!existsSync(realPdf))("converts the real PDF to parseable markdown", async () => {
    const md = await fileToResumeMarkdown(new Uint8Array(readFileSync(realPdf)), "pdf");
    expect(md.length).toBeGreaterThan(0);
    const profile = parseProfileText(md);
    expect(profile.name.length).toBeGreaterThan(0);
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
  });
});
