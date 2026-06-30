import { getDocumentProxy } from "unpdf";

/**
 * Deterministic résumé-profile parser.
 *
 * A profile is either an uploaded PDF (rich layout, parsed by COORDINATES) or
 * pasted text (lossy, parsed line-by-line). We extract the FIXED fields — name,
 * contact line, education, certifications, and each work role's
 * title/company/dates + its source bullet text — WITHOUT an LLM, so the résumé
 * generator only spends the LLM on job-specific tailoring.
 *
 * The coordinate clustering lives in `parsePdfItems`, which is intentionally
 * PURE (no imports) so it is trivially unit-testable from a captured item list.
 */

export interface PdfItem {
  str: string;
  x: number;
  y: number;
  size: number;
  font: string;
  width: number;
}

export interface ParsedRole {
  role: string;
  company: string;
  dates: string;
  sourceBullets: string[];
}

export interface ParsedProfile {
  /** verbatim name (topmost line) */
  name: string;
  /** contact line verbatim (items joined), "" if none */
  contact: string;
  /** degree entries as a LIST, in source order (ordered most-advanced-first downstream) */
  educationEntries: string[];
  /** raw cert list (may be empty) */
  certifications: string[];
  experience: ParsedRole[];
}

// ----------------------------------------------------------------------------
// Pure constants / regexes
// ----------------------------------------------------------------------------

/** Items within this many points of y are treated as one visual line. */
const Y_TOL = 3;
/** Inter-item x-gap (pt) beyond which we insert a single space when joining. */
const GAP_SPACE = 1;
/** x-gap (pt) used to split a heading row into separate column headings. */
const COLUMN_GAP = 20;

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|" +
  "Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const DATE_TOKEN = `(?:(?:${MONTHS})\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`;
const DATE_END = `(?:${DATE_TOKEN}|Present|Current|Now|Ongoing|Today)`;
const DATE_RANGE_RE = new RegExp(
  `^\\s*(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_END})\\.?\\s*$`,
  "i",
);

const TITLE_RE =
  /\b(engineer|developer|analyst|manager|consultant|lead|architect|scientist|administrator|designer|director|specialist|intern|associate|founder|owner|coordinator|technician|programmer|advisor|principal|head|officer|president)\b/i;

const SECTION_WORDS = new Set([
  "experience", "employment", "education", "skills", "certifications", "certification",
  "certs", "projects", "summary", "objective", "work", "history", "awards", "publications",
  "interests", "languages", "profile", "references", "activities", "leadership", "volunteer",
  "qualifications", "accomplishments", "achievements", "competencies", "expertise",
]);

const CONTACT_RE =
  /(@|\||https?:\/\/|linkedin|github|\b\d{3}[)\s.\-]*\d{3}[\s.\-]*\d{4}\b)/i;

// ● • ▪ ◦ ‣ · ⁃ ∙
const BULLET_RE = /^[●•▪◦‣·⁃∙]/;

const DEGREE_RE =
  /\b(b\.?a|b\.?s|bsc|m\.?s|m\.?a|mba|phd|ph\.d|bachelor|master|doctor|associate of|associate's|a\.a|a\.s|j\.d|jd|m\.?d)\b/i;
const CERT_RE =
  /\b(certified|certification|certificate|associate|professional|practitioner|specialist|expert|credential|licensed|license)\b/i;

// ----------------------------------------------------------------------------
// PDF extraction (impure — uses unpdf)
// ----------------------------------------------------------------------------

/**
 * Pull every positioned text run from a PDF, in page order, as flat items.
 * size = scale of the text transform; x/y = transform translation (y from
 * the page bottom). Empty / marked-content runs are dropped.
 */
export async function extractPdfItems(bytes: Uint8Array): Promise<PdfItem[]> {
  if (bytes.length === 0) return [];
  const pdf = await getDocumentProxy(bytes);
  const items: PdfItem[] = [];
  const numPages: number = pdf.numPages;
  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const raw of content.items as Array<Record<string, unknown>>) {
      if (typeof raw.str !== "string") continue; // marked-content, not a text run
      const t = raw.transform as number[];
      items.push({
        str: raw.str,
        x: t[4],
        y: t[5],
        size: Math.hypot(t[0], t[1]),
        font: typeof raw.fontName === "string" ? raw.fontName : "",
        width: typeof raw.width === "number" ? raw.width : 0,
      });
    }
  }
  return items;
}

// ----------------------------------------------------------------------------
// Coordinate clustering (PURE)
// ----------------------------------------------------------------------------

interface Line {
  y: number;
  text: string;
  items: PdfItem[]; // whitespace-filtered, sorted by x asc
}

function emptyProfile(): ParsedProfile {
  return { name: "", contact: "", educationEntries: [], certifications: [], experience: [] };
}

/** Join x-sorted items, inserting a space only across a real horizontal gap. */
function joinItems(items: PdfItem[]): string {
  let text = "";
  let prev: PdfItem | null = null;
  for (const it of items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.width);
      if (gap > GAP_SPACE) text += " ";
    }
    text += it.str;
    prev = it;
  }
  return text.trim();
}

/** Cluster items into visual lines (y desc), each x-sorted and gap-joined. */
function buildLines(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfItem[][] = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_TOL) last.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    const its = [...g].sort((a, b) => a.x - b.x);
    return { y: its[0].y, items: its, text: joinItems(its) };
  });
}

/** A short line whose every significant word is a section keyword. */
function isHeadingLine(text: string): boolean {
  const toks = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (toks.length === 0 || toks.length > 5) return false;
  const sig = toks.filter((t) => t.length > 1);
  return sig.length > 0 && sig.every((t) => SECTION_WORDS.has(t));
}

function detectBoldFont(lines: Line[], headingLines: Line[]): string {
  const counts = new Map<string, number>();
  for (const h of headingLines) {
    const f = h.items[0]?.font;
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [f, n] of counts) if (n > bestN) (best = f), (bestN = n);
  return best || lines[0]?.items[0]?.font || "";
}

function findContact(lines: Line[]): string {
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    if (CONTACT_RE.test(lines[i].text)) return lines[i].text.trim();
  }
  return "";
}

/** Normalize a date-range line, or null if the line is not a date range. */
function normalizeDates(text: string): string | null {
  const m = text.match(DATE_RANGE_RE);
  if (!m) return null;
  const start = m[1].replace(/\s+/g, " ").trim();
  let end = m[2].replace(/\s+/g, " ").trim();
  if (/^(present|current|now|ongoing|today)$/i.test(end)) end = "Present";
  return `${start} – ${end}`;
}

function isBulletText(text: string): boolean {
  return BULLET_RE.test(text) || /^[-*]\s+/.test(text);
}

function stripBullet(text: string): string {
  return text.replace(/^[●•▪◦‣·⁃∙\-*]+\s*/, "").trim();
}

/** Strip a trailing ", City, ST" / ", City, State 12345" / ", Remote" and dangling punctuation. */
function stripCompany(text: string): string {
  return text
    .replace(/\s*[,|]\s*[A-Za-z.\s]+,\s*[A-Z]{2}(\s+\d{5}(-\d{4})?)?\s*$/, "")
    .replace(/\s*[,|]\s*(remote|hybrid|on-?site|worldwide|anywhere)\s*$/i, "")
    .replace(/[\s,|]+$/, "")
    .trim();
}

interface RoleBlock {
  dates: string;
  lines: Line[];
}

function parseExperience(lines: Line[], headingLines: Line[], boldFont: string): ParsedRole[] {
  const expHeading = headingLines.find((h) => /experience|employment|work history/i.test(h.text));
  if (!expHeading) return [];
  const below = headingLines.filter((h) => h.y < expHeading.y).map((h) => h.y);
  const endY = below.length ? Math.max(...below) : -Infinity;
  const expLines = lines.filter((l) => l.y < expHeading.y && l.y > endY);

  const blocks: RoleBlock[] = [];
  let cur: RoleBlock | null = null;
  for (const l of expLines) {
    const dates = normalizeDates(l.text);
    if (dates) {
      cur = { dates, lines: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(l);
    }
  }

  return blocks.map((block) => {
    const headerLines: Line[] = [];
    const bullets: string[] = [];
    let seenBullet = false;
    for (const l of block.lines) {
      if (isBulletText(l.text)) {
        bullets.push(stripBullet(l.text));
        seenBullet = true;
      } else if (seenBullet) {
        if (bullets.length) bullets[bullets.length - 1] += " " + l.text;
      } else {
        headerLines.push(l);
      }
    }

    const companyLine = headerLines.find((l) => l.items.some((i) => i.font === boldFont));
    let company = "";
    if (companyLine) {
      company = stripCompany(joinItems(companyLine.items.filter((i) => i.font === boldFont)));
    }
    if (!company && headerLines.length) company = stripCompany(headerLines[0].text);

    const roleCandidates = headerLines.filter((l) => l !== companyLine);
    let role =
      roleCandidates.find((l) => TITLE_RE.test(l.text))?.text ??
      roleCandidates[roleCandidates.length - 1]?.text ??
      "";
    if (!role && headerLines.length) role = headerLines[headerLines.length - 1].text;

    return { role: role.trim(), company: company.trim(), dates: block.dates, sourceBullets: bullets };
  });
}

interface ColumnHeading {
  text: string;
  x: number;
  type: "skills" | "cert" | "edu" | "other";
}

function classifyColumn(text: string): ColumnHeading["type"] {
  if (/cert/i.test(text)) return "cert";
  if (/education|academ/i.test(text)) return "edu";
  if (/skill/i.test(text)) return "skills";
  return "other";
}

/** Split a heading row's items into separate column headings at wide x-gaps. */
function columnHeadings(items: PdfItem[]): ColumnHeading[] {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters: PdfItem[][] = [];
  for (const it of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const prev = last[last.length - 1];
      if (it.x - (prev.x + prev.width) > COLUMN_GAP) clusters.push([it]);
      else last.push(it);
    } else {
      clusters.push([it]);
    }
  }
  return clusters.map((c) => {
    const text = joinItems(c);
    return { text, x: c[0].x, type: classifyColumn(text) };
  });
}

function keywordCount(text: string): number {
  let c = 0;
  if (/skill/i.test(text)) c++;
  if (/cert/i.test(text)) c++;
  if (/education|academ/i.test(text)) c++;
  return c;
}

/** Group a single education column's lines into entries (bold-led = new entry). */
function educationEntries(colLines: Line[], boldFont: string): string[] {
  const entries: string[] = [];
  for (const l of colLines) {
    const t = l.text.trim();
    if (!t) continue;
    const boldLed = !!l.items[0] && l.items[0].font === boldFont;
    if (boldLed || entries.length === 0) entries.push(t);
    else entries[entries.length - 1] += " " + t;
  }
  return entries;
}

function parseBottomColumns(
  items: PdfItem[],
  lines: Line[],
  headingLines: Line[],
  boldFont: string,
): { certifications: string[]; eduEntries: string[] } {
  const certifications: string[] = [];
  let eduEntries: string[] = [];

  const combined = headingLines.find((l) => keywordCount(l.text) >= 2);
  if (combined) {
    const cols = columnHeadings(combined.items);
    const bottom = items.filter((i) => i.str.trim() !== "" && i.y < combined.y - 1);
    const byCol = new Map<number, PdfItem[]>();
    for (const it of bottom) {
      let best = cols[0];
      let bestD = Infinity;
      for (const c of cols) {
        const d = Math.abs(it.x - c.x);
        if (d < bestD) (bestD = d), (best = c);
      }
      if (!byCol.has(best.x)) byCol.set(best.x, []);
      byCol.get(best.x)!.push(it);
    }
    const certCol = cols.find((c) => c.type === "cert");
    if (certCol) {
      for (const l of buildLines(byCol.get(certCol.x) ?? [])) {
        const t = l.text.trim();
        if (t) certifications.push(t);
      }
    }
    const eduCol = cols.find((c) => c.type === "edu");
    if (eduCol) eduEntries = educationEntries(buildLines(byCol.get(eduCol.x) ?? []), boldFont);
    return { certifications, eduEntries };
  }

  // Fallback: stacked single-column sections (each under its own heading row).
  const sectionLines = (heading: Line): Line[] => {
    const below = headingLines.filter((h) => h.y < heading.y).map((h) => h.y);
    const endY = below.length ? Math.max(...below) : -Infinity;
    return lines.filter((l) => l.y < heading.y && l.y > endY);
  };
  const certHeading = headingLines.find((h) => /cert/i.test(h.text) && !/skill|education/i.test(h.text));
  if (certHeading) {
    for (const l of sectionLines(certHeading)) {
      const t = l.text.trim();
      if (t) certifications.push(t);
    }
  }
  const eduHeading = headingLines.find((h) => /education|academ/i.test(h.text) && !/skill|cert/i.test(h.text));
  if (eduHeading) eduEntries = educationEntries(sectionLines(eduHeading), boldFont);
  return { certifications, eduEntries };
}

/** PURE: turn positioned PDF items into a ParsedProfile via coordinate clustering. */
export function parsePdfItems(items: PdfItem[]): ParsedProfile {
  const clean = items.filter((i) => i.str && i.str.trim() !== "");
  if (clean.length === 0) return emptyProfile();

  const lines = buildLines(clean);
  const headingLines = lines.filter((l) => isHeadingLine(l.text));
  const boldFont = detectBoldFont(lines, headingLines);

  const name = (lines[0]?.text ?? "").trim();
  const contact = findContact(lines);
  const experience = parseExperience(lines, headingLines, boldFont);
  const { certifications, eduEntries } = parseBottomColumns(clean, lines, headingLines, boldFont);

  return { name, contact, educationEntries: eduEntries, certifications, experience };
}

// ----------------------------------------------------------------------------
// Text fallback (PURE) — for pasted, flattened résumés
// ----------------------------------------------------------------------------

export function parseProfileText(text: string | null): ParsedProfile {
  if (!text) return emptyProfile();
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) return emptyProfile();

  const name = lines[0];
  let contact = "";
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    if (CONTACT_RE.test(lines[i])) {
      contact = lines[i];
      break;
    }
  }

  // Experience section.
  const experience: ParsedRole[] = [];
  const expIdx = lines.findIndex((s) => isHeadingLine(s) && /experience|employment|work history/i.test(s));
  if (expIdx >= 0) {
    let end = lines.length;
    for (let i = expIdx + 1; i < lines.length; i++) {
      if (isHeadingLine(lines[i])) {
        end = i;
        break;
      }
    }
    const seg = lines.slice(expIdx + 1, end);
    interface Blk { dates: string; header: string[]; bullets: string[]; seen: boolean; }
    const blocks: Blk[] = [];
    let cur: Blk | null = null;
    for (const l of seg) {
      const dates = normalizeDates(l);
      if (dates) {
        cur = { dates, header: [], bullets: [], seen: false };
        blocks.push(cur);
      } else if (cur) {
        if (isBulletText(l)) {
          cur.bullets.push(stripBullet(l));
          cur.seen = true;
        } else if (cur.seen) {
          if (cur.bullets.length) cur.bullets[cur.bullets.length - 1] += " " + l;
        } else {
          cur.header.push(l);
        }
      }
    }
    for (const b of blocks) {
      const role = b.header.find((h) => TITLE_RE.test(h)) ?? b.header[b.header.length - 1] ?? "";
      const companyLine = b.header.find((h) => h !== role) ?? b.header[0] ?? "";
      experience.push({
        role: role.trim(),
        company: stripCompany(companyLine).trim(),
        dates: b.dates,
        sourceBullets: b.bullets,
      });
    }
  }

  // Education / certifications — best-effort from the trailing section.
  const certifications: string[] = [];
  const eduEntries: string[] = [];
  const tailStart = lines.findIndex((s) => isHeadingLine(s) && /skill|cert|education/i.test(s));
  if (tailStart >= 0) {
    let lastWasEdu = false;
    for (const l of lines.slice(tailStart)) {
      if (isHeadingLine(l)) {
        lastWasEdu = false;
        continue;
      }
      const commas = (l.match(/,/g) ?? []).length;
      const isEdu =
        DEGREE_RE.test(l) && /[-–—]|\b(university|college|institute|school|academy|tech)\b/i.test(l);
      const isCert = commas < 2 && CERT_RE.test(l);
      const isSkillsList = commas >= 2; // a comma-separated skills line
      if (isEdu) {
        eduEntries.push(l);
        lastWasEdu = true;
      } else if (isCert) {
        certifications.push(l);
        lastWasEdu = false;
      } else if (lastWasEdu && !isSkillsList && eduEntries.length) {
        // A wrapped continuation of the previous education entry (e.g. a degree
        // line split mid-phrase). Re-join it so we don't truncate the entry.
        eduEntries[eduEntries.length - 1] += " " + l;
      } else {
        lastWasEdu = false;
      }
    }
  }

  return {
    name,
    contact,
    educationEntries: eduEntries,
    certifications,
    experience,
  };
}

// ----------------------------------------------------------------------------
// Tenure (PURE) — floored years since the most-recent role began
// ----------------------------------------------------------------------------

const FULL_MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/**
 * PURE: the candidate's real years of experience, floored to a whole number,
 * measured from the START of their most-recent role (`experience[0].dates`).
 *
 * The start is the substring before the range separator ("February 2023" in
 * "February 2023 – Present", "2018" in "2018 – 2021") and is parsed as a full
 * "MonthName YYYY" or a bare "YYYY". `nowMs` is supplied by the caller so this
 * never reads the clock. Returns null when there is no experience or the start
 * cannot be parsed.
 */
export function yearsOfExperience(profile: ParsedProfile, nowMs: number): number | null {
  const dates = profile.experience[0]?.dates;
  if (!dates) return null;
  const start = dates.split(/[-–—]|\bto\b/i)[0]?.trim() ?? "";

  let startMs: number | null = null;
  const monthYear = start.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = FULL_MONTHS[monthYear[1].toLowerCase()];
    if (month !== undefined) startMs = Date.UTC(Number(monthYear[2]), month, 1);
  } else {
    const yearOnly = start.match(/^(\d{4})$/);
    if (yearOnly) startMs = Date.UTC(Number(yearOnly[1]), 0, 1);
  }
  if (startMs === null) return null;

  return Math.floor((nowMs - startMs) / MS_PER_YEAR);
}

// ----------------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------------

export async function parseProfile(input: {
  pdfBytes?: Uint8Array | null;
  text: string | null;
}): Promise<ParsedProfile> {
  if (input.pdfBytes && input.pdfBytes.length > 0) {
    const fromPdf = parsePdfItems(await extractPdfItems(input.pdfBytes));
    if (fromPdf.name && fromPdf.experience.length > 0) return fromPdf;
  }
  return parseProfileText(input.text);
}
