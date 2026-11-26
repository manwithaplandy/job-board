// Variant 3: what the frame's rendered text says (plan Task 2.11, spec 7.1 and 11 layer 3).
// Variant 3 writes numbers into its own HTML, so the id binding that protects variants 1
// and 2 does not apply; the render smoke reads the frame's text and checks each figure here.
//
// asserts.ts re-exports findMisstatements (the plan puts it there). It lives in this file,
// with type-only imports, so the browser spec can load it without asserts.ts's imports
// (which reach the database module).
import type { GatheredData } from "@/lib/agent/gathered";
import type { AssertFailure } from "@/lib/agent/evals/asserts";

/** A fit score beside the word: "Fit 82", "fit score: 82/100", "82% fit", "82/100 match". */
const FIT_AFTER_RE = /\bfit(?:\s+score)?\s*[:=\-–]?\s*(\d{1,3})(?![\d.,])(?:\s*(?:%|\/\s*100))?/gi;
const FIT_BEFORE_RE = /(?<![\d.,])(\d{1,3})\s*(?:%|\/\s*100)?\s*(?:fit|match)\b/gi;
/** A pay figure: a currency before it ($, €, £, USD, EUR, GBP) or a "k" after it. */
const PAY_RE = /(?:US\$|\$|€|£|\b(?:USD|EUR|GBP)\s?)\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s?([kK])\b)?|(?<![\w$€£.,])(\d{2,3}(?:\.\d+)?)\s?[kK]\b/g;

interface Figure {
  kind: "fit" | "pay";
  value: number;
  /** Written in thousands ("145k"): matches a stored value within 1,000. */
  thousands: boolean;
  at: number;
  text: string;
}

function figuresIn(text: string): Figure[] {
  const out: Figure[] = [];
  const seenFit = new Set<number>();
  for (const re of [FIT_AFTER_RE, FIT_BEFORE_RE]) {
    for (const m of text.matchAll(re)) {
      const value = Number(m[1]);
      const at = (m.index ?? 0) + m[0].indexOf(m[1]);
      if (value > 100 || seenFit.has(at)) continue;
      seenFit.add(at);
      out.push({ kind: "fit", value, thousands: false, at, text: m[0].trim() });
    }
  }
  for (const m of text.matchAll(PAY_RE)) {
    const raw = m[1] ?? m[3];
    const thousands = m[3] !== undefined || m[2] !== undefined;
    const value = Number(raw.replace(/,/g, "")) * (thousands ? 1000 : 1);
    if (!Number.isFinite(value)) continue;
    out.push({ kind: "pay", value, thousands, at: m.index ?? 0, text: m[0].trim() });
  }
  return out;
}

function figureMatches(f: Figure, reviews: Array<GatheredData["reviews"][string] | undefined>): boolean {
  return reviews.some((rv) => {
    if (!rv) return false;
    if (f.kind === "fit") return rv.fitScore !== null && rv.fitScore === f.value;
    return [rv.payMin, rv.payMax].some((p) => p !== null && (f.thousands ? Math.abs(p - f.value) < 1000 : p === f.value));
  });
}

/**
 * The misstatements in a variant 3 frame's rendered text (frame.locator("body").innerText()).
 * The text is cut into blocks at each gathered job title it contains (the longest title
 * wins where titles overlap); in a job's block every fit score (0 to 100 beside "fit" or
 * "match") and every pay figure (a currency or a "k") must equal that job's stored review
 * (pay: its minimum or maximum; a figure in thousands within 1,000). Jobs that share a
 * title share their blocks: a figure may match any of them. A figure before the first
 * title is checked against every gathered job. A figure that matches no gathered value is a
 * misstatement (fit_mismatch or pay_mismatch); a job title the model invented cannot be told
 * apart from prose, so titles are only used to place figures.
 */
export function findMisstatements(frameText: string, gathered: GatheredData): AssertFailure[] {
  const jobs = Object.values(gathered.jobs);
  const lower = frameText.toLowerCase();
  const hits: Array<{ start: number; end: number; title: string }> = [];
  for (const title of [...new Set(jobs.map((j) => j.title.trim()).filter((t) => t.length > 0))]) {
    const needle = title.toLowerCase();
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
      hits.push({ start: i, end: i + needle.length, title });
    }
  }
  // Longest first, so "Senior Engineer" keeps its place over the "Engineer" inside it.
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: typeof hits = [];
  for (const h of hits) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  kept.sort((a, b) => a.start - b.start);

  const out: AssertFailure[] = [];
  const allReviews = jobs.map((j) => gathered.reviews[j.jobId]);
  for (const f of figuresIn(frameText)) {
    const owner = [...kept].reverse().find((k) => k.start <= f.at);
    const owners = owner ? jobs.filter((j) => j.title.trim() === owner.title) : [];
    const reviews = owner ? owners.map((j) => gathered.reviews[j.jobId]) : allReviews;
    if (figureMatches(f, reviews)) continue;
    const who = owner ? owners.map((j) => j.jobId).join(" or ") : "no job (before any title)";
    out.push({
      code: f.kind === "fit" ? "fit_mismatch" : "pay_mismatch",
      message: `frame text "${f.text}" for ${who} matches no stored ${f.kind === "fit" ? "fit score" : "pay"}`,
      path: "frame",
    });
  }
  return out;
}
