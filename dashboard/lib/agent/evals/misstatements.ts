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

/**
 * Words that may follow a pay figure on the same line and keep it a pay figure (fix round 1,
 * M6): pay words and function words. Any other lower-case word after the figure ("150k
 * users", "$20 raised") is a noun the figure counts, not pay, so it is not read as pay. A
 * capitalised word is left alone (the next piece of the layout: "$170k Remote"), except a
 * magnitude or a business-metric acronym ("$20 M", "$5M ARR").
 */
const PAY_FOLLOWERS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "per", "for", "at", "with", "vs", "versus", "than", "is", "are", "was",
  "were", "be", "if", "plus", "which", "that", "before", "after", "while", "each", "up", "base", "salary", "salaries",
  "total", "comp", "compensation", "pay", "paid", "ote", "usd", "eur", "gbp", "gross", "annual", "annually",
  "yearly", "year", "years", "yr", "yrs", "hour", "hourly", "hr", "month", "monthly", "max", "maximum", "min",
  "minimum", "range", "top", "mid", "midpoint", "upper", "lower", "cash", "equity", "bonus",
]);
const NOT_PAY_WORDS = new Set(["m", "mm", "b", "bn", "million", "millions", "billion", "billions", "arr", "mrr", "gmv", "mau", "dau"]);
/** The word right after a figure in the same cell (spaces only between; a tab starts the next cell), if any. */
const NEXT_WORD_RE = /^[ \u00a0]*([A-Za-z][A-Za-z-]*)/;

function readsAsPay(text: string, end: number): boolean {
  const next = NEXT_WORD_RE.exec(text.slice(end));
  if (!next) return true;
  const word = next[1];
  const lower = word.toLowerCase();
  if (NOT_PAY_WORDS.has(lower)) return false;
  if (word[0] !== lower[0]) return true;
  return PAY_FOLLOWERS.has(lower);
}

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
    // "401k" (and "401 k") with no currency is the retirement plan, not pay.
    if (m[3] === "401") continue;
    if (!readsAsPay(text, (m.index ?? 0) + m[0].length)) continue;
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
 * title is checked against every gathered job. In a table (consecutive lines of
 * tab-separated cells, as innerText writes a <table>) a figure may sit under a column
 * header rather than after its job's title, so a figure in a table is checked against
 * every job the table names, and only falls back to the nearest title when the table names
 * none. A figure that matches no gathered value is a misstatement (fit_mismatch or
 * pay_mismatch); a job title the model invented cannot be told apart from prose, so titles
 * are only used to place figures. "401k", and a figure followed by a word it counts ("150k
 * users", "$20 million"), are not pay (readsAsPay).
 */
/** The spans of the text's tables: runs of consecutive lines that each hold a tab. */
function tableBlocks(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let at = 0;
  let open: { start: number; end: number } | null = null;
  for (const line of text.split("\n")) {
    const end = at + line.length;
    if (line.includes("\t")) {
      if (open) open.end = end;
      else open = { start: at, end };
    } else if (open) {
      out.push(open);
      open = null;
    }
    at = end + 1;
  }
  if (open) out.push(open);
  return out;
}

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

  const tables = tableBlocks(frameText);
  const out: AssertFailure[] = [];
  const allReviews = jobs.map((j) => gathered.reviews[j.jobId]);
  for (const f of figuresIn(frameText)) {
    const table = tables.find((t) => t.start <= f.at && f.at < t.end);
    const tableTitles = table ? new Set(kept.filter((k) => table.start <= k.start && k.end <= table.end).map((k) => k.title)) : new Set<string>();
    let owners: typeof jobs;
    let who: string;
    if (tableTitles.size > 0) {
      owners = jobs.filter((j) => tableTitles.has(j.title.trim()));
      who = `a job in its table (${owners.map((j) => j.jobId).join(", ")})`;
    } else {
      const owner = [...kept].reverse().find((k) => k.start <= f.at);
      owners = owner ? jobs.filter((j) => j.title.trim() === owner.title) : jobs;
      who = owner ? owners.map((j) => j.jobId).join(" or ") : "no job (before any title)";
    }
    if (figureMatches(f, owners === jobs ? allReviews : owners.map((j) => gathered.reviews[j.jobId]))) continue;
    out.push({
      code: f.kind === "fit" ? "fit_mismatch" : "pay_mismatch",
      message: `frame text "${f.text}" for ${who} matches no stored ${f.kind === "fit" ? "fit score" : "pay"}`,
      path: "frame",
    });
  }
  return out;
}
