import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

/**
 * Minimal structural subset of the jsPDF API used by the résumé renderer.
 * Declared locally so this module needn't import jspdf: the dashboard lazy-loads
 * jspdf in the browser (keeping it out of the main bundle), and the CLI résumé
 * harness imports it directly. Both pass a real jsPDF instance here.
 */
export interface ResumePdfDoc {
  internal: { pageSize: { getWidth: () => number } };
  setFont: (family: string, style: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  text: (text: string, x: number, y: number, opts?: { align?: string }) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  getTextWidth: (text: string) => number;
}

const M = 56; // left/right margin (pt)
const TOP = 66; // first baseline (pt)
const BOTTOM = 752; // content must stay above this y to remain on one page
const MIN_SCALE = 0.7; // readability floor when content must shrink
const MAX_EXTRA = 28; // max extra leading (pt) added per break when filling slack

// Palette (RGB). A restrained teal accent gives the page a designed hierarchy
// without reading as flashy; everything else is a calm slate ramp.
type RGB = readonly [number, number, number];
const NAME: RGB = [17, 24, 39]; // near-black for the name + role titles
const HEADLINE: RGB = [100, 116, 139]; // muted slate for the headline
const ACCENT: RGB = [15, 94, 92]; // deep teal for section titles + header rule
const RULE: RGB = [205, 213, 219]; // hairline under section titles
const BODY: RGB = [51, 65, 81]; // body copy
const DATES: RGB = [140, 150, 165]; // right-aligned employment dates

/**
 * Render `data` onto `doc` as a single US-Letter page. Lays out at the largest
 * scale in [MIN_SCALE, 1] that keeps the content above the page bottom, using
 * cheap measurement passes, then draws once at that scale. When the content is
 * short enough to leave slack at the chosen scale, the leftover vertical space
 * is distributed across the section breaks (bounded per break) so the page
 * reads as a full, intentionally spaced sheet rather than top-loaded text.
 * Does not save — the caller owns the doc lifecycle. Returns the scale used.
 */
export function renderResumePdf(doc: ResumePdfDoc, data: TailoredResume): number {
  const W = doc.internal.pageSize.getWidth();
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  // Lay the résumé out at scale `s`, adding `extra` pt of leading at each major
  // break (used to absorb leftover vertical slack). When `draw` is false it
  // only advances `y` (a measurement pass); when true it actually paints. Font
  // + size are set in both passes so line-wrapping during measurement matches
  // the drawn output. Returns the y of the content bottom.
  const layout = (s: number, draw: boolean, extra: number): number => {
    let y = TOP;
    const body = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(10.5 * s); };
    const wrapLines = (txt: string, w: number, lh: number) => {
      body();
      doc.splitTextToSize(txt, w).forEach((l) => {
        if (draw) doc.text(l, M, y);
        y += lh * s;
      });
    };
    // Wrap a list of items joined by a middle-dot separator, assembling each
    // line item-by-item so the separator only ever sits BETWEEN two items that
    // share a line — never dangling at a line start or end. Greedy fit: an item
    // moves to the next line only when appending it (with its separator) would
    // overflow the current line's width.
    const wrapSkills = (items: string[], w: number, lh: number) => {
      body();
      const SEP = "   ·   ";
      let line = "";
      const flush = () => {
        if (!line) return;
        if (draw) doc.text(line, M, y);
        y += lh * s;
        line = "";
      };
      for (const item of items) {
        const trial = line ? line + SEP + item : item;
        if (line && doc.splitTextToSize(trial, w).length > 1) {
          flush();
          line = item;
        } else {
          line = trial;
        }
      }
      flush();
    };
    const section = (title: string) => {
      if (draw) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11 * s);
        setText(ACCENT);
        doc.text(title.toUpperCase(), M, y);
      }
      y += 6 * s;
      if (draw) { setDraw(RULE); doc.line(M, y, W - M, y); }
      y += 16 * s;
      if (draw) setText(BODY);
      body();
    };

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22 * s);
    if (draw) { setText(NAME); doc.text(data.name, M, y); }
    y += 18 * s;

    // Headline (wraps if long)
    body();
    if (draw) setText(HEADLINE);
    doc.splitTextToSize(data.headline, W - 2 * M).forEach((l) => {
      if (draw) doc.text(l, M, y);
      y += 13 * s;
    });
    // Contact line (muted, ~9pt, wraps if long). Measured + drawn so auto-fit
    // accounts for it.
    if (data.contact) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9 * s);
      if (draw) setText(HEADLINE);
      doc.splitTextToSize(data.contact, W - 2 * M).forEach((l) => {
        if (draw) doc.text(l, M, y);
        y += 11 * s;
      });
    }
    // Accent rule closes the header block.
    y += 7 * s;
    if (draw) { setDraw(ACCENT); doc.line(M, y, W - M, y); }
    y += 15 * s + extra;

    section("Summary");
    wrapLines(data.summary, W - 2 * M, 15);
    y += 8 * s + extra;

    section("Core skills");
    wrapSkills(data.skills, W - 2 * M, 15);
    y += 8 * s + extra;

    section("Experience");
    data.experience.forEach((exp, idx) => {
      if (draw) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.8 * s);
        setText(NAME);
        doc.text(`${exp.role}, ${exp.company}`, M, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5 * s);
        setText(DATES);
        doc.text(exp.dates, W - M, y, { align: "right" });
      }
      y += 15 * s;
      if (draw) setText(BODY);
      const indent = 12 * s;
      exp.bullets.forEach((b) => {
        body();
        const lines = doc.splitTextToSize(b, W - 2 * M - indent);
        if (draw) doc.text("•", M + 1, y);
        lines.forEach((l) => {
          if (draw) doc.text(l, M + indent, y);
          y += 14 * s;
        });
      });
      // Space between roles is fixed and tight so each role reads as one
      // cohesive block — slack is NOT poured between entries (that looked loose).
      y += 9 * s;
    });

    // Experience→Education is a major section break, so it absorbs slack.
    y += extra;
    section("Education");
    // Each degree entry on its own line (stacked, most-advanced first), long
    // entries wrapped. Measured + drawn identically so auto-fit stays exact.
    data.education.forEach((entry) => wrapLines(entry, W - 2 * M, 15));
    // One trailing certifications line: a bold "Certifications:" label, then the
    // certs joined by " · " on the body font, hanging-indented under the label
    // and wrapped if long.
    if (data.certifications.length) {
      const label = "Certifications:  ";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5 * s);
      const labelW = doc.getTextWidth(label);
      body();
      const certLines = doc.splitTextToSize(data.certifications.join(" · "), W - 2 * M - labelW);
      certLines.forEach((l, i) => {
        if (draw) {
          if (i === 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5 * s);
            doc.text(label, M, y);
          }
          body();
          doc.text(l, M + labelW, y);
        }
        y += 15 * s;
      });
    }

    return y;
  };

  // Pick the largest scale that fits with no extra leading.
  let scale = MIN_SCALE;
  for (let s = 1; s >= MIN_SCALE - 1e-9; s -= 0.02) {
    if (layout(s, false, 0) <= BOTTOM) { scale = s; break; }
  }

  // Distribute any leftover vertical space across the four major section breaks
  // so a short résumé fills the page instead of stranding whitespace at the
  // bottom. Breaks that take `extra`: header→Summary, Summary→Skills,
  // Skills→Experience, and Experience→Education. Inter-role gaps deliberately
  // stay fixed so job entries read as tight, cohesive blocks rather than loose.
  const bottom = layout(scale, false, 0);
  const breaks = 4;
  const extra = Math.min(Math.max(0, BOTTOM - bottom) / breaks, MAX_EXTRA);

  layout(scale, true, extra);
  return scale;
}
