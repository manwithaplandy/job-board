import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { parseProfileText } from "@/lib/rolefit/parseProfile";

const here = path.dirname(fileURLToPath(import.meta.url));
const realPdf = path.resolve(here, "../../scripts/fixtures/source.pdf");

describe("fileToResumeMarkdown", () => {
  test("returns empty string for empty input", async () => {
    expect(await fileToResumeMarkdown(new Uint8Array(), "pdf")).toBe("");
  });

  test.skipIf(!existsSync(realPdf))("converts the real PDF to parseable markdown", async () => {
    const md = await fileToResumeMarkdown(new Uint8Array(readFileSync(realPdf)), "pdf");
    expect(md.length).toBeGreaterThan(0);
    const profile = parseProfileText(md);
    expect(profile.name.length).toBeGreaterThan(0);
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
  });
});
