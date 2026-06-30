import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  extractPdfItems,
  parsePdfItems,
  parseProfile,
  parseProfileText,
  yearsOfExperience,
  type ParsedProfile,
} from "@/lib/rolefit/parseProfile";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.resolve(here, "../../scripts/fixtures", name);
const pdfBytes = () => new Uint8Array(readFileSync(fixture("source.pdf")));

const EXPECTED_EDU_ENTRIES = [
  "UC Santa Barbara - BA, Psychology",
  "Georgia Tech - MS, Computer Science (In Progress)",
];
const EXPECTED_CERTS = ["Azure AI Engineer Associate", "AWS Solutions Architect Associate"];

describe("parsePdfItems on the real source résumé", () => {
  test("extracts the fixed fields by coordinate clustering", async () => {
    const profile = parsePdfItems(await extractPdfItems(pdfBytes()));

    expect(profile.name).toBe("Andrew Malvani");

    expect(profile.contact).toContain("andrewrmalvani@gmail.com");
    expect(profile.contact).toContain("818-422-8819");
    expect(profile.contact).toContain("https://linkedin.com/in/andrewmalvani");

    expect(profile.experience).toHaveLength(3);
    expect(
      profile.experience.map((r) => ({ role: r.role, company: r.company, dates: r.dates })),
    ).toEqual([
      { role: "Lead AI/ML Engineer", company: "General Atomics", dates: "February 2023 – Present" },
      {
        role: "IT Strategic Analyst (Systems Administrator)",
        company: "Tillster Inc",
        dates: "October 2021 – February 2023",
      },
      {
        role: "Compliance & Marketing Consultant",
        company: "Reynolds & Reynolds",
        dates: "April 2018 – October 2021",
      },
    ]);

    expect(profile.educationEntries).toEqual(EXPECTED_EDU_ENTRIES);
    expect(profile.certifications).toEqual(EXPECTED_CERTS);
  });

  test("captures General Atomics source bullets faithfully", async () => {
    const profile = parsePdfItems(await extractPdfItems(pdfBytes()));
    const ga = profile.experience[0];

    // Every "●" glyph becomes a bullet; wrapped lines are merged back.
    expect(ga.sourceBullets).toHaveLength(9);

    // Faithful first bullet — spans two wrapped lines, verbatim text.
    expect(ga.sourceBullets[0]).toBe(
      "Avoided $15M/yr in spend with an in-house, DoD-compliant enterprise AI chatbot " +
        "(AWS Bedrock, Azure AI Foundry, LiteLLM, Azure Functions) — now serving 5,000+ " +
        "monthly and 1,000+ daily active users.",
    );

    // "fi"/"fl" ligature runs are re-joined ("work" + "fl" + "ow ef" + "fi" + "ciency").
    expect(ga.sourceBullets[1]).toContain("Achieved 4x workflow efficiency");

    // A lowercase-led bullet is still detected via its glyph.
    expect(ga.sourceBullets.some((b) => b.startsWith("rolling out AI development tools"))).toBe(true);
  });
});

describe("yearsOfExperience", () => {
  const withDates = (dates: string): ParsedProfile => ({
    name: "X",
    contact: "",
    educationEntries: [],
    certifications: [],
    experience: [{ role: "Engineer", company: "Co", dates, sourceBullets: [] }],
  });

  test("floors years from the most-recent role's start date", () => {
    // Most-recent role began February 2023; mid-2026 → 3.x years → floored to 3.
    const nowMs = Date.UTC(2026, 5, 15); // June 15, 2026
    expect(yearsOfExperience(withDates("February 2023 – Present"), nowMs)).toBe(3);
  });

  test("parses a bare-year start", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    expect(yearsOfExperience(withDates("2018 – 2021"), nowMs)).toBe(8);
  });

  test("returns null when there is no experience", () => {
    const empty: ParsedProfile = {
      name: "",
      contact: "",
      educationEntries: [],
      certifications: [],
      experience: [],
    };
    expect(yearsOfExperience(empty, Date.UTC(2026, 5, 15))).toBeNull();
  });

  test("returns null when the start date can't be parsed", () => {
    expect(yearsOfExperience(withDates("sometime – Present"), Date.UTC(2026, 5, 15))).toBeNull();
  });
});

describe("parseProfile dispatcher", () => {
  test("uses the PDF path when bytes parse cleanly", async () => {
    const profile = await parseProfile({ pdfBytes: pdfBytes(), text: "garbage fallback" });
    expect(profile.name).toBe("Andrew Malvani");
    expect(profile.experience).toHaveLength(3);
    expect(profile.educationEntries).toEqual(EXPECTED_EDU_ENTRIES);
  });

  test("falls back to text when no PDF bytes are supplied", async () => {
    const profile = await parseProfile({
      pdfBytes: null,
      text: "Jane Doe\njane@doe.dev\nExperience\nJan 2020 - Present\nAcme Corp, Austin, TX\nSenior Engineer\n● Built things",
    });
    expect(profile.name).toBe("Jane Doe");
    expect(profile.experience[0].company).toBe("Acme Corp");
  });
});

describe("parseProfileText fallback", () => {
  test("parses a small pasted résumé", () => {
    const profile = parseProfileText(
      [
        "Jane Doe",
        "jane@doe.dev | (555) 123-4567 | github.com/janedoe",
        "Experience",
        "March 2020 - PRESENT",
        "Acme Corp, Austin, TX",
        "Senior Software Engineer",
        "● Shipped a thing that mattered",
        "and kept it running",
        "● Led a team of five",
        "June 2017 - March 2020",
        "Globex, Remote",
        "Backend Developer",
        "- Built the API",
        "Skills Certifications Education",
        "Python, Go, TypeScript, SQL",
        "AWS Certified Solutions Architect",
        "MIT - BS, Computer Science",
      ].join("\n"),
    );

    expect(profile.name).toBe("Jane Doe");
    expect(profile.contact).toBe("jane@doe.dev | (555) 123-4567 | github.com/janedoe");

    expect(profile.experience).toHaveLength(2);
    expect(profile.experience[0]).toEqual({
      role: "Senior Software Engineer",
      company: "Acme Corp",
      dates: "March 2020 – Present",
      sourceBullets: ["Shipped a thing that mattered and kept it running", "Led a team of five"],
    });
    expect(profile.experience[1]).toEqual({
      role: "Backend Developer",
      company: "Globex",
      dates: "June 2017 – March 2020",
      sourceBullets: ["Built the API"],
    });

    expect(profile.certifications).toEqual(["AWS Certified Solutions Architect"]);
    expect(profile.educationEntries).toEqual(["MIT - BS, Computer Science"]);
  });

  test("recovers the same roles from the flattened profile.txt", () => {
    const profile = parseProfileText(readFileSync(fixture("profile.txt"), "utf8"));
    expect(profile.name).toBe("Andrew Malvani");
    expect(profile.experience.map((r) => `${r.role} @ ${r.company} (${r.dates})`)).toEqual([
      "Lead AI/ML Engineer @ General Atomics (February 2023 – Present)",
      "IT Strategic Analyst (Systems Administrator) @ Tillster Inc (October 2021 – February 2023)",
      "Compliance & Marketing Consultant @ Reynolds & Reynolds (April 2018 – October 2021)",
    ]);
    expect(profile.educationEntries).toContain("UC Santa Barbara - BA, Psychology");
    expect(profile.certifications).toContain("Azure AI Engineer Associate");
  });

  test("re-joins a wrapped education entry instead of truncating it", () => {
    const profile = parseProfileText(readFileSync(fixture("profile.txt"), "utf8"));
    // The degree line wraps mid-phrase ("…MS, Computer" / "Science (In Progress)");
    // the continuation must be appended, not dropped.
    expect(profile.educationEntries).toContain("Georgia Tech - MS, Computer Science (In Progress)");
  });

  test("returns an empty profile for null/empty input", () => {
    expect(parseProfileText(null)).toEqual({
      name: "",
      contact: "",
      educationEntries: [],
      certifications: [],
      experience: [],
    });
  });
});
