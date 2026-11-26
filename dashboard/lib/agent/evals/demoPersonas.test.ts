import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { renderAllPersonaPdfs, renderPersonaPdf } from "@/lib/agent/evals/demoPersonas";
import { PERSONA_IDS, PERSONAS } from "@/lib/agent/evals/personas";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { parseProfileText } from "@/lib/rolefit/parseProfile";

const here = path.dirname(fileURLToPath(import.meta.url));
const committedDir = path.resolve(here, "../../../../docs/demo/personas");

describe("demo persona résumé PDFs", () => {
  const pdfs = renderAllPersonaPdfs();

  test("there is one PDF per persona, named by its id", () => {
    expect(pdfs.map((p) => p.name)).toEqual(PERSONA_IDS.map((id) => `${id}.pdf`));
  });

  test("a second render of each persona is byte-identical", () => {
    for (const pdf of pdfs) {
      expect(Buffer.from(renderPersonaPdf(PERSONAS[pdf.id])).equals(Buffer.from(pdf.bytes))).toBe(true);
    }
  });

  test.each(PERSONA_IDS)("the committed docs/demo/personas/%s.pdf matches a fresh render (npm run demo:personas)", (id) => {
    const fresh = pdfs.find((p) => p.id === id)!;
    const committed = readFileSync(path.join(committedDir, fresh.name));
    expect(committed.equals(Buffer.from(fresh.bytes))).toBe(true);
  });

  test.each(PERSONA_IDS)("%s uploads to the persona's name, contact and résumé lines", async (id) => {
    const persona = PERSONAS[id];
    const markdown = await fileToResumeMarkdown(pdfs.find((p) => p.id === id)!.bytes, "pdf");
    expect(markdown.startsWith(`# ${persona.name}\n`)).toBe(true);
    expect(markdown).toContain(persona.email);
    const bullets = persona.resumeText.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets.length).toBeGreaterThan(3);
    for (const bullet of bullets) expect(markdown).toContain(bullet);
  });

  test.each(PERSONA_IDS)("%s reads back as the same profile as the persona's own résumé", async (id) => {
    const persona = PERSONAS[id];
    const markdown = await fileToResumeMarkdown(pdfs.find((p) => p.id === id)!.bytes, "pdf");
    const fromUpload = parseProfileText(markdown);
    expect(fromUpload.experience.length).toBeGreaterThan(1);
    expect(fromUpload).toEqual(parseProfileText(persona.resumeText));
  });

  test.each(PERSONA_IDS)("%s stays synthetic: every address in it is under example.test", async (id) => {
    const markdown = await fileToResumeMarkdown(pdfs.find((p) => p.id === id)!.bytes, "pdf");
    const addresses = markdown.match(/[^\s@]+@[^\s@]+/g) ?? [];
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) expect(address.endsWith("@example.test")).toBe(true);
  });
});
