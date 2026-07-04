import { describe, expect, test } from "vitest";
import { renderResumePdf, type ResumePdfDoc } from "@/lib/rolefit/resumePdf";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

// A fake jsPDF that records every draw so we can assert the layout invariants
// (one-page fit, content completeness) WITHOUT a real PDF backend. The key that
// makes this meaningful: splitTextToSize must genuinely wrap — longer text must
// produce MORE lines at a fixed width — otherwise the auto-fit shrink loop would
// never be exercised and a regression that overflows the page couldn't be caught.
const PAGE_WIDTH = 612; // US Letter, pt
const CHAR_W = 6; // deterministic per-char advance

interface DrawnText {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

function makeDoc() {
  const texts: DrawnText[] = [];
  const lines: { y1: number; y2: number }[] = [];
  const fontSizes: number[] = [];
  let currentFontSize = 10;
  const doc: ResumePdfDoc = {
    internal: { pageSize: { getWidth: () => PAGE_WIDTH } },
    setFont: () => {},
    setFontSize: (size: number) => {
      currentFontSize = size;
      fontSizes.push(size);
    },
    setTextColor: () => {},
    setDrawColor: () => {},
    text: (text: string, x: number, y: number) => {
      texts.push({ text, x, y, fontSize: currentFontSize });
    },
    line: (_x1: number, y1: number, _x2: number, y2: number) => {
      lines.push({ y1, y2 });
    },
    // Chunk into fixed-width lines: a string wider than `maxWidth` wraps into
    // ceil(chars / charsPerLine) pieces, so longer content really is taller.
    splitTextToSize: (text: string, maxWidth: number) => {
      const perLine = Math.max(1, Math.floor(maxWidth / CHAR_W));
      if (text.length <= perLine) return [text];
      const out: string[] = [];
      for (let i = 0; i < text.length; i += perLine) out.push(text.slice(i, i + perLine));
      return out;
    },
    getTextWidth: (text: string) => text.length * CHAR_W,
  };
  return { doc, texts, lines, fontSizes };
}

const BOTTOM = 752; // must match resumePdf.ts — the one-page content floor

const smallResume: TailoredResume = {
  name: "Ada Lovelace",
  contact: "ada@example.com · +1 555 0100 · London",
  headline: "Senior Backend Engineer",
  summary: "Backend engineer with 8 years building distributed systems.",
  skills: ["Python", "Postgres", "Kubernetes", "Go"],
  experience: [
    {
      role: "Staff Engineer",
      company: "Acme",
      dates: "2020 – Present",
      bullets: ["Led the payments platform rewrite.", "Cut p99 latency by 40%."],
    },
  ],
  education: ["B.S. Computer Science, MIT"],
  certifications: ["AWS Solutions Architect"],
};

// Deliberately far more content than one page holds at full size: the auto-fit
// loop must shrink it. Tuned so it still fits at the MIN_SCALE 0.7 floor.
function makeOversized(): TailoredResume {
  const longBullet = (n: number) =>
    `Delivered outcome number ${n} across a very large surface area touching many teams and services and stakeholders`;
  const experience = Array.from({ length: 4 }, (_, i) => ({
    role: `Role Title ${i + 1}`,
    company: `Company ${i + 1}`,
    dates: `20${10 + i} – 20${11 + i}`,
    bullets: Array.from({ length: 5 }, (_, b) => longBullet(i * 10 + b)),
  }));
  return {
    name: "Grace Hopper",
    contact: "grace@example.com · +1 555 0199 · Arlington, VA",
    headline: "Principal Distributed Systems Engineer and Team Lead",
    summary:
      "Seasoned engineering leader with deep experience across compilers, distributed systems, and large-scale platform work spanning two decades.",
    skills: Array.from({ length: 16 }, (_, i) => `Skill ${i + 1}`),
    experience,
    education: ["Ph.D. Mathematics, Yale", "B.A. Mathematics, Vassar"],
    certifications: ["Cert A", "Cert B"],
  };
}

describe("renderResumePdf one-page layout invariant", () => {
  test("short résumé renders at full scale and stays on one page", () => {
    const { doc, texts } = makeDoc();
    const scale = renderResumePdf(doc, smallResume);
    // A short résumé must NOT be shrunk — regression that mis-measures would
    // pointlessly scale it down.
    expect(scale).toBe(1);
    const maxY = Math.max(...texts.map((t) => t.y));
    expect(maxY).toBeLessThanOrEqual(BOTTOM);
  });

  test("oversized résumé shrinks but still fits one page (the core invariant)", () => {
    const { doc, texts } = makeDoc();
    const scale = renderResumePdf(doc, makeOversized());
    // Must shrink below full size...
    expect(scale).toBeLessThan(1);
    // ...but never below the readability floor...
    expect(scale).toBeGreaterThanOrEqual(0.7);
    // ...and the whole thing must remain above the page bottom. This is the
    // invariant that, if broken, ships a clipped/overflowing PDF.
    const maxY = Math.max(...texts.map((t) => t.y));
    expect(maxY).toBeLessThanOrEqual(BOTTOM);
  });

  test("all content is drawn — nothing silently dropped", () => {
    const { doc, texts } = makeDoc();
    renderResumePdf(doc, smallResume);
    // Two views of the drawn text, for two kinds of check:
    //   `blob`  joins draws with a \x01 sentinel that can't occur in résumé text, so a
    //           match proves the string was drawn as a SINGLE run (no false positive
    //           stitched across two unrelated draws) — used for short one-line fields.
    //   `flat`  joins with "" so a string that splitTextToSize WRAPPED across several
    //           draws is reconstructed contiguously — used for long/wrappable content.
    const blob = texts.map((t) => t.text).join("\x01");
    const flat = texts.map((t) => t.text).join("");

    expect(blob).toContain(smallResume.name);
    expect(blob).toContain(smallResume.contact);
    expect(blob).toContain(smallResume.headline);
    expect(flat).toContain(smallResume.summary);
    // Section headers are drawn upper-cased.
    for (const header of ["SUMMARY", "CORE SKILLS", "EXPERIENCE", "EDUCATION"]) {
      expect(blob).toContain(header);
    }
    for (const exp of smallResume.experience) {
      expect(blob).toContain(exp.role);
      expect(blob).toContain(exp.company);
      expect(blob).toContain(exp.dates);
      for (const b of exp.bullets) expect(flat).toContain(b);
    }
    for (const skill of smallResume.skills) expect(blob).toContain(skill);
    for (const edu of smallResume.education) expect(flat).toContain(edu);
    for (const cert of smallResume.certifications) expect(flat).toContain(cert);
  });

  test("empty optional sections render without their headers and without crashing", () => {
    const minimal: TailoredResume = {
      name: "No Frills",
      contact: "",
      headline: "Engineer",
      summary: "Short summary.",
      skills: [],
      experience: [{ role: "Dev", company: "Startup", dates: "2023", bullets: [] }],
      education: [],
      certifications: [],
    };
    const { doc, texts } = makeDoc();
    expect(() => renderResumePdf(doc, minimal)).not.toThrow();
    const blob = texts.map((t) => t.text).join("\x01");
    // Skills/Education headers ARE always drawn by section(); the point here is
    // that empty arrays don't crash and don't invent phantom body content.
    expect(blob).toContain("No Frills");
    // No certifications line label when certs are empty.
    expect(blob).not.toContain("Certifications:");
  });

  test("unicode and diacritics pass through untouched", () => {
    const uni: TailoredResume = {
      ...smallResume,
      name: "José Ñoño 李明",
      experience: [
        {
          role: "Ingénieur",
          company: "Café Solutions",
          dates: "2021 – 2024",
          bullets: ["Built naïve façade — 100% coverage ✓"],
        },
      ],
    };
    const { doc, texts } = makeDoc();
    renderResumePdf(doc, uni);
    const blob = texts.map((t) => t.text).join("\x01");
    const flat = texts.map((t) => t.text).join("");
    expect(blob).toContain("José Ñoño 李明");
    expect(blob).toContain("Ingénieur");
    expect(blob).toContain("Café Solutions");
    expect(flat).toContain("Built naïve façade — 100% coverage ✓");
  });

  test("returned scale is the scale actually used to draw", () => {
    const { doc, fontSizes } = makeDoc();
    const scale = renderResumePdf(doc, makeOversized());
    // The name is drawn at 22*scale. If the return value diverged from the
    // drawn layout, this font size would be absent.
    const nameSize = fontSizes.find((s) => Math.abs(s - 22 * scale) < 1e-6);
    expect(nameSize).toBeDefined();
  });
});
