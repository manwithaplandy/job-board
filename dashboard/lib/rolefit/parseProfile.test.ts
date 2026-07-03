import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  extractPdfItems,
  parsePdfItems,
  parsePdfItemsWithProse,
  parseProfile,
  parseProfileText,
  yearsOfExperience,
  type ParsedProfile,
  type PdfItem,
} from "@/lib/rolefit/parseProfile";
import scrubbedItemsJson from "./__fixtures__/scrubbed-resume-items.json";

const here = path.dirname(fileURLToPath(import.meta.url));

// PII-SCRUBBED snapshot of the REAL résumé extraction: every geometric field
// (transform/x/y/width/font/size) is byte-identical to the real PDF, only the
// `str` text is replaced with fiction. This keeps the coordinate clustering,
// dynamic bold detection, and ligature rejoin tested against GENUINE layout —
// with zero personal data — so the pure tests run in any checkout/worktree.
const scrubbedItems = scrubbedItemsJson as PdfItem[];
const scrubbedText = readFileSync(path.join(here, "__fixtures__/scrubbed-resume.txt"), "utf8");

// The real fixtures are gitignored personal data; only the binary smoke test
// touches them, and only when they happen to be present.
const realPdfPath = path.resolve(here, "../../scripts/fixtures/source.pdf");

const EXPECTED_EDU_ENTRIES = [
  "State University - BA, Economics",
  "Lakeside Institute of Technology - MS, Computer Science (In Progress)",
];
const EXPECTED_CERTS = ["Cloud AI Engineer Associate", "Cloud Solutions Architect Associate"];

describe("parsePdfItems on the scrubbed résumé snapshot", () => {
  const profile = parsePdfItems(scrubbedItems);

  test("name + contact come from the top-of-page lines", () => {
    expect(profile.name).toBe("Jordan Casey");
    expect(profile.contact).toContain("jordan.casey@example.com");
    expect(profile.contact).toContain("555-013-4827");
    expect(profile.contact).toContain("https://linkedin.com/in/jordancasey");
  });

  test("assembles every role, most-recent-first, with title/company/dates", () => {
    expect(
      profile.experience.map((r) => ({ role: r.role, company: r.company, dates: r.dates })),
    ).toEqual([
      { role: "Lead AI/ML Engineer", company: "Northwind Systems", dates: "February 2023 – Present" },
      {
        role: "IT Strategic Analyst (Systems Administrator)",
        company: "Brightpath Retail",
        dates: "October 2021 – February 2023",
      },
      {
        role: "Compliance & Marketing Consultant",
        company: "Cedar & Lane Co",
        dates: "April 2018 – October 2021",
      },
    ]);
    // Each role keeps exactly its own bullets (block boundaries = date lines).
    expect(profile.experience.map((r) => r.sourceBullets.length)).toEqual([9, 2, 1]);
  });

  test("captures the bold company name only — the f2 location is stripped off", () => {
    // The company line is "Northwind Systems," (bold) + " " + "Austin, TX" (regular).
    // Dynamic bold-face detection must pick the bold run and drop the location.
    expect(profile.experience[0].company).toBe("Northwind Systems");
    expect(profile.experience[0].company).not.toContain("Austin");
  });

  test("rejoins ligature-split runs by x-gap, not by inserting spaces", () => {
    // Bullet 1's first word is extracted as "Boosted 3x work" + "fl" + "ow ef" +
    // "fi" + "ciency …" — abutting runs (gap ≤ 1pt) must concatenate WITHOUT a
    // space, reconstructing real words. A regression in joinItems' gap test would
    // yield "work fl ow ef fi ciency".
    const bullet = profile.experience[0].sourceBullets[1];
    expect(bullet).toContain("workflow efficiency");
    expect(bullet).not.toMatch(/work\s+fl|ef\s+fi/);
  });

  test("merges wrapped bullet lines and detects lowercase-led bullets by glyph", () => {
    const ga = profile.experience[0];
    // Bullet 0 spans two wrapped visual lines, merged back into one bullet.
    expect(ga.sourceBullets[0]).toBe(
      "Saved $9M/yr in spend with an in-house, policy-compliant enterprise AI assistant " +
        "(managed inference, a vector store, a gateway proxy, and serverless jobs) — now " +
        "serving 4,000+ monthly and 800+ daily users.",
    );
    // A lowercase-led bullet is still a bullet — detected via its "●" glyph.
    expect(ga.sourceBullets.some((b) => b.startsWith("expanding AI tooling adoption"))).toBe(true);
  });

  test("demultiplexes the 3-column footer without bleeding columns into each other", () => {
    // Skills | Certifications | Education share one heading row; items are
    // assigned to the nearest column by x. The certs column must hold ONLY certs
    // and the education column ONLY schools — no skill tokens, no cross-bleed.
    expect(profile.certifications).toEqual(EXPECTED_CERTS);
    expect(profile.educationEntries).toEqual(EXPECTED_EDU_ENTRIES);

    // Skills tokens ("Python", "TypeScript", …) live in the left column and must
    // not leak into certs/education; school/cert text must not cross over either.
    const footer = [...profile.certifications, ...profile.educationEntries].join(" | ");
    expect(footer).not.toMatch(/python|typescript|javascript|node\b/i);
    expect(profile.certifications.join(" ")).not.toMatch(/university|institute|economics/i);
    expect(profile.educationEntries.join(" ")).not.toMatch(/associate/i);
  });

  test("re-joins the wrapped education entry instead of starting a new one", () => {
    // The 2nd school wraps: "Lakeside Institute of Technology - MS, Computer" /
    // "Science (In Progress)". The continuation line is NOT bold-led, so it must
    // be appended to the prior entry rather than become its own.
    expect(profile.educationEntries).toHaveLength(2);
    expect(profile.educationEntries[1]).toBe(
      "Lakeside Institute of Technology - MS, Computer Science (In Progress)",
    );
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

  test("parses an abbreviated-month start (markdown résumés use 'Jun 2024')", () => {
    // Jun 2024 → July 3 2026 is ~2.1 years → floored to 2.
    expect(yearsOfExperience(withDates("Jun 2024 – Present"), Date.UTC(2026, 6, 3))).toBe(2);
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

  test("recovers the same roles from the flattened scrubbed résumé text", () => {
    const profile = parseProfileText(scrubbedText);
    expect(profile.name).toBe("Jordan Casey");
    expect(profile.experience.map((r) => `${r.role} @ ${r.company} (${r.dates})`)).toEqual([
      "Lead AI/ML Engineer @ Northwind Systems (February 2023 – Present)",
      "IT Strategic Analyst (Systems Administrator) @ Brightpath Retail (October 2021 – February 2023)",
      "Compliance & Marketing Consultant @ Cedar & Lane Co (April 2018 – October 2021)",
    ]);
    expect(profile.certifications).toContain("Cloud AI Engineer Associate");
    expect(profile.educationEntries).toContain("State University - BA, Economics");
  });

  test("re-joins a wrapped education entry instead of truncating it", () => {
    const profile = parseProfileText(scrubbedText);
    // The degree line wraps mid-phrase ("…MS, Computer" / "Science (In Progress)");
    // the continuation must be appended, not dropped.
    expect(profile.educationEntries).toContain(
      "Lakeside Institute of Technology - MS, Computer Science (In Progress)",
    );
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

describe("parseProfileText — markdown résumé", () => {
  // A markdown résumé: name is an `#` H1, sections are `##`, companies are `###`
  // with a "— City, ST" suffix, roles are `####` with the date range INLINE
  // (`· Jun 2024 – Present ·`), and body copy uses `**bold**` / `*italic*`.
  // Structurally identical to a real pasted résumé; content is fiction (no PII).
  const MD = [
    "# Jordan Casey",
    "",
    "jordan.casey@example.com | 555-013-4827 | Phoenix, AZ | linkedin.com/in/jordancasey",
    "",
    "## Professional Summary",
    "",
    "Lead AI/ML Engineer specializing in production generative-AI systems.",
    "",
    "## Technical Skills",
    "",
    "- **Languages:** Python, TypeScript, SQL",
    "",
    "## Experience",
    "",
    "### Northwind Systems — San Diego, CA",
    "",
    "#### Lead AI/ML Engineer · Jun 2024 – Present · Hybrid",
    "",
    "*Drive AI innovation across the enterprise.*",
    "",
    "**Flagship Products & Business Impact**",
    "",
    "- Avoided an estimated **$15M/yr** in licensing by shipping an in-house AI assistant.",
    "- Achieved **4x workflow efficiency** for 10,000+ users with a RAG platform.",
    "",
    "#### System Administrator · Feb 2023 – Jun 2024 · On-site",
    "",
    "- Migrated the enterprise MDM stack to the cloud.",
    "",
    "### Brightpath Retail — San Diego, CA",
    "",
    "#### IT Strategic Analyst (Systems Administrator) · Oct 2021 – Feb 2023",
    "",
    "- Reduced onboarding time by **90%** via automated provisioning.",
    "",
    "## Certifications",
    "",
    "- **Microsoft Certified:** Azure AI Engineer Associate",
    "- AWS Certified: Solutions Architect – Associate",
    "",
    "## Education",
    "",
    "- **M.S., Computer Science** — Georgia Institute of Technology · Expected 2029",
    "- **B.A., Psychology** — University of California, Santa Barbara",
  ].join("\n");

  const p = parseProfileText(MD);

  test("strips the leading markdown heading from the name", () => {
    expect(p.name).toBe("Jordan Casey");
  });

  test("extracts the contact line verbatim, including the correct city", () => {
    expect(p.contact).toBe(
      "jordan.casey@example.com | 555-013-4827 | Phoenix, AZ | linkedin.com/in/jordancasey",
    );
  });

  test("parses every role from inline dates + ### company headings, in order", () => {
    expect(
      p.experience.map((r) => ({ role: r.role, company: r.company, dates: r.dates })),
    ).toEqual([
      { role: "Lead AI/ML Engineer", company: "Northwind Systems", dates: "Jun 2024 – Present" },
      { role: "System Administrator", company: "Northwind Systems", dates: "Feb 2023 – Jun 2024" },
      {
        role: "IT Strategic Analyst (Systems Administrator)",
        company: "Brightpath Retail",
        dates: "Oct 2021 – Feb 2023",
      },
    ]);
  });

  test("attaches each role's bullets, stripped of markdown emphasis", () => {
    expect(p.experience[0].sourceBullets).toEqual([
      "Avoided an estimated $15M/yr in licensing by shipping an in-house AI assistant.",
      "Achieved 4x workflow efficiency for 10,000+ users with a RAG platform.",
    ]);
    expect(p.experience[1].sourceBullets).toEqual([
      "Migrated the enterprise MDM stack to the cloud.",
    ]);
  });

  test("does not mistake bold subsection headers or italic summaries for bullets", () => {
    const allBullets = p.experience.flatMap((r) => r.sourceBullets);
    expect(allBullets.some((b) => /Flagship Products/i.test(b))).toBe(false);
    expect(allBullets.some((b) => /Drive AI innovation/i.test(b))).toBe(false);
  });

  test("cleans markdown bullets and emphasis from education and certifications", () => {
    expect(p.educationEntries).toEqual([
      "M.S., Computer Science — Georgia Institute of Technology · Expected 2029",
      "B.A., Psychology — University of California, Santa Barbara",
    ]);
    expect(p.certifications).toEqual([
      "Microsoft Certified: Azure AI Engineer Associate",
      "AWS Certified: Solutions Architect – Associate",
    ]);
  });
});

// Binary/integration smoke test: exercises the real unpdf/pdf.js extraction and
// the dispatcher's PDF path on the REAL résumé. Gated on the gitignored fixture
// being present, and asserts only NON-PII facts so no personal data is hardcoded.
describe("extractPdfItems + parseProfile on the real PDF", () => {
  // Fresh bytes per call: extractPdfItems detaches the backing ArrayBuffer.
  const freshBytes = () => new Uint8Array(readFileSync(realPdfPath));

  test.skipIf(!existsSync(realPdfPath))("parses the binary via the PDF path", async () => {
    // Direct extraction → clustering yields a usable profile.
    const direct = parsePdfItems(await extractPdfItems(freshBytes()));
    expect(direct.name.length).toBeGreaterThan(0);
    expect(direct.experience.length).toBeGreaterThanOrEqual(1);
    expect(direct.educationEntries.length).toBeGreaterThanOrEqual(1);

    // The dispatcher must choose the PDF path, not the text fallback.
    const profile = await parseProfile({ pdfBytes: freshBytes(), text: "garbage fallback" });
    expect(profile.name).not.toBe("garbage fallback");
    expect(profile.name.length).toBeGreaterThan(0);
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
    expect(profile.experience[0].sourceBullets.length).toBeGreaterThanOrEqual(1);
  });
});

describe("parsePdfItemsWithProse — prose capture", () => {
  // Minimal single-column PdfItem set: name, a SUMMARY heading + body, and an
  // EXPERIENCE heading (structured, must NOT appear in prose). y descends down
  // the page; x constant; one font.
  const line = (str: string, y: number): PdfItem => ({ str, x: 72, y, size: 11, font: "F0", width: str.length * 5 });
  const items: PdfItem[] = [
    line("Jordan Casey", 720),
    line("jordan@example.com", 705),
    line("Summary", 680),
    line("Seasoned engineer with a decade in AI infrastructure.", 665),
    line("Experience", 640),
    line("January 2020 - Present", 625),
    line("Acme Corp", 610),
    line("Staff Engineer", 595),
    line("● Shipped the platform", 580),
  ];

  test("captures the Summary section as prose, excludes Experience", () => {
    const { prose } = parsePdfItemsWithProse(items);
    const summary = prose.find((p) => /summary/i.test(p.heading));
    expect(summary?.lines.join(" ")).toContain("Seasoned engineer");
    expect(prose.some((p) => /experience/i.test(p.heading))).toBe(false);
  });

  test("still returns the structured profile unchanged", () => {
    const { profile } = parsePdfItemsWithProse(items);
    expect(profile.name).toBe("Jordan Casey");
    expect(profile.experience[0].company).toBe("Acme Corp");
  });
});
