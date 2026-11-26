// The demo résumé PDFs (plan Task 2.14, gate A7): each persona's markdown résumé
// (personas.ts) as a one-page PDF that Andrew uploads through the agent page. Everything
// in them is synthetic, like the personas.
//
// Why not lib/rolefit/resumePdf.ts: that renderer puts role, company and dates on one
// line, and the upload's coordinate parser (parsePdfItems, which fileToResumeMarkdown
// uses) only finds a role whose date range stands on its own line. Its PDFs therefore
// upload as flat text with no experience entries, and parseProfileText, which the
// agent's profile summary (tools/read.ts) and application prep (rolefit/resumeClient.ts)
// use, finds no roles in that text. This layout is
// the classic one the parser reads: section headings in bold, then per role a date line,
// the employer in bold, the title, and "•" bullets. A PDF made here uploads to the same
// structured markdown as the persona's own résumé (demoPersonas.test.ts checks it).
//
// Output is byte-stable: the creation date and the document id are fixed, so a rerun
// with unchanged personas writes identical files. scripts/demo-personas.ts writes them
// to docs/demo/personas/<persona id>.pdf.
import { jsPDF } from "jspdf";
import { PERSONA_IDS, PERSONAS, type Persona, type PersonaId } from "@/lib/agent/evals/personas";

/**
 * Fixed metadata so the bytes do not depend on when or where the file is rendered. The
 * date is a PDF date string, not a Date: jsPDF writes a Date in the local time zone.
 */
const DEMO_PDF_CREATED = "D:20261101000000+00'00'";
const DEMO_PDF_FILE_ID = "0".repeat(32);

const MARGIN = 56;
const TOP = 72;
/** Everything stays above this y: the upload parser reads lines by y across pages, so a second page would scramble it. */
const BOTTOM = 740;
const BODY_SIZE = 10.5;
const BODY_LEADING = 14;

type RGB = readonly [number, number, number];
const INK: RGB = [17, 24, 39];
const BODY: RGB = [51, 65, 81];
const MUTED: RGB = [100, 116, 139];
const ACCENT: RGB = [15, 94, 92];
const RULE: RGB = [205, 213, 219];

/** Draws the persona's markdown résumé onto a fresh letter page and returns the document. */
function layout(persona: Persona): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setCreationDate(DEMO_PDF_CREATED);
  doc.setFileId(DEMO_PDF_FILE_ID);
  doc.setProperties({ title: `${persona.name}, synthetic demo resume` });
  const width = doc.internal.pageSize.getWidth();
  let y = TOP;

  const font = (style: "normal" | "bold", size: number, color: RGB) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const advance = (pt: number) => {
    y += pt;
    if (y > BOTTOM) throw new Error(`demo résumé for ${persona.id} does not fit on one page`);
  };
  const wrapped = (text: string, x: number) => {
    for (const line of doc.splitTextToSize(text, width - MARGIN - x) as string[]) {
      doc.text(line, x, y);
      advance(BODY_LEADING);
    }
  };

  let section = "";
  let employer = "";
  let afterBullet = false;
  for (const raw of persona.resumeText.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("# ")) {
      font("bold", 22, INK);
      doc.text(line.slice(2), MARGIN, y);
      advance(20);
      section = "header";
    } else if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      advance(10);
      font("bold", 11.5, ACCENT);
      doc.text(line.slice(3), MARGIN, y);
      advance(5);
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.line(MARGIN, y, width - MARGIN, y);
      advance(16);
    } else if (line.startsWith("### ")) {
      employer = line.slice(4);
    } else if (line.startsWith("#### ")) {
      if (afterBullet) advance(8);
      const [role, dates = ""] = line.slice(5).split(" · ");
      font("normal", 9.5, MUTED);
      doc.text(dates, MARGIN, y);
      advance(BODY_LEADING);
      font("bold", 11, INK);
      doc.text(employer, MARGIN, y);
      advance(BODY_LEADING);
      font("normal", BODY_SIZE, BODY);
      doc.text(role, MARGIN, y);
      advance(BODY_LEADING + 2);
    } else if (section === "header") {
      font("normal", 10, MUTED);
      doc.text(line, MARGIN, y);
      advance(BODY_LEADING);
    } else if (line.startsWith("- ") && section === "experience") {
      font("normal", BODY_SIZE, BODY);
      doc.text("•", MARGIN + 2, y);
      wrapped(line.slice(2), MARGIN + 14);
    } else {
      // Summary and skills prose; education and certification entries without a bullet,
      // since the parser keeps those lines as they read.
      font("normal", BODY_SIZE, BODY);
      wrapped(line.startsWith("- ") ? line.slice(2) : line, MARGIN);
    }
    // The employer line (###) only sets the name drawn under the next role's dates.
    if (!line.startsWith("### ")) afterBullet = section === "experience" && line.startsWith("- ");
  }
  return doc;
}

/** One persona's résumé as PDF bytes, identical on every render of the same persona. */
export function renderPersonaPdf(persona: Persona): Uint8Array {
  return new Uint8Array(layout(persona).output("arraybuffer"));
}

/** The committed file name of a persona's PDF, under docs/demo/personas/. */
export function demoPdfName(id: PersonaId): string {
  return `${id}.pdf`;
}

/** Every persona's PDF, in PERSONA_IDS order. */
export function renderAllPersonaPdfs(): Array<{ id: PersonaId; name: string; bytes: Uint8Array }> {
  return PERSONA_IDS.map((id) => ({ id, name: demoPdfName(id), bytes: renderPersonaPdf(PERSONAS[id]) }));
}
