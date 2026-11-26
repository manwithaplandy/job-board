// The variant 3 grammar and sandbox document (plan Task 2.4, spec 7.1 "Sandboxed code" and
// spec 10 "Variant 3 sandbox"). The model writes one self-contained HTML document against
// the injected kit (kit.ts); the host shows it in an iframe with sandbox="allow-scripts"
// only, loaded by srcdoc (components/agent/sandbox/SandboxFrame.tsx).
//
// checkV3Static is defense in depth only: it is bypassable by obfuscation. The sandbox and
// the CSP are the real control, and Task 2.7 tests them in real browsers.
//
// The document carries two CSP policies, both before any model-authored byte. A browser
// enforces every policy in the list, so a script runs only if both allow it:
//   1. the plan's policy: default-src 'none', script and style by nonce, img-src data:,
//      everything else 'none';
//   2. a hash policy: script-src and style-src list the SHA-256 of every inline script and
//      style element this builder emitted (kit and model), each salted with the per-build
//      nonce so no hash is known ahead of the build.
//      Policy 2 also requires Trusted Types and allows only a policy named "default",
//      which the kit creates first: it passes HTML through unless it would create a
//      script or a frame, and refuses every script text and script URL.
// Policy 2 is stricter than the plan (PR J2). With policy 1 alone, model script can read
// the nonce (document.currentScript.nonce, or the CSP meta's content) and give it to a
// script element it creates with any src, and a nonce'd script's dynamic import() inherits
// the nonce; either is a request to any URL. Policy 2 has no nonce and no URL source, so
// such a script is refused.
//
// What is left (fix round 1, I1). Browsers that apply CSP3's rule that a hash source also
// admits an external script whose `integrity` matches it would let model script that
// knows a listed hash load a script from any URL, as often as it likes, without a
// navigation. The kit narrows that: as its first statement, before any model byte runs, it
// removes both CSP meta elements (a policy stays in force once applied), so the hash list
// cannot be copied from the DOM; and in browsers with Trusted Types every script URL
// assignment throws (createElement('script') then src) and document.write is disabled.
// Still open, all for Task 2.7 to measure per browser:
//   - a browser with that CSP3 rule but no Trusted Types, where script computes the hash
//     of its own salted text at run time (crypto.subtle) and sets src with integrity;
//   - a child realm (a nested frame) made by a path the kit's guards miss: the kit refuses
//     frame elements in createElement, createElementNS and its default policy's createHTML,
//     but a browser without Trusted Types still parses frame markup from innerHTML, and any
//     child realm has its own document.write and may register its own default policy;
//   - self-navigation (spec 10's accepted one-request residual; SandboxFrame tears the
//     frame down on a second load or a missed liveness reply).
// Nonce hiding means getAttribute("nonce") reads empty, but the nonce IDL attribute and
// document.currentScript.nonce still expose it to model script, so policy 1 alone is
// never enough.
//
// Script elements with a src, href or integrity attribute, or a type other than classic
// JavaScript, get no nonce and no hash, so both policies refuse them; checkV3Static
// rejects them too.
import { z } from "zod";
import type { GatheredData } from "@/lib/agent/gathered";
import type {
  DocumentMeta, MemoDoc, MetricResult, MetricSpec, ReviewFacts, ShortlistRow, ApplicationRow, JobFacts,
} from "@/lib/workspaces/types";
import { sha256Base64 } from "@/lib/agent/surfaces/v3/sha256";

export const V3_LIMITS = { maxBytes: 60_000, handshakeMs: 3000, maxHeightPx: 1200 } as const;
export const V3_TITLE_MAX = 80;

export interface SurfacePayloadV3 {
  variant: 3;
  title: string;
  html: string;
}

export const SurfacePayloadV3Schema: z.ZodType<SurfacePayloadV3> = z
  .object({
    variant: z.literal(3),
    title: z
      .string()
      .min(1)
      .max(V3_TITLE_MAX)
      .refine((s) => s.trim().length > 0, { message: "must not be blank" }),
    // Characters here; the byte cap is checked by checkV3Static.
    html: z.string().min(1).max(V3_LIMITS.maxBytes),
  })
  .strict();

export type SurfaceValidationV3 = { ok: true; payload: SurfacePayloadV3 } | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// A small HTML start-tag scanner, shared by the static checks and the builder so they
// agree on which elements are scripts. It follows the tokenizer where that matters here:
// comments are skipped, raw-text elements (script, style, textarea, ...) are skipped to
// their end tag, and attributes are read as the tokenizer reads them (first occurrence
// wins). Where it could disagree with a browser (script escape states, foreign content),
// the builder's hash does not match and the script is refused: it fails closed.
// ---------------------------------------------------------------------------

export interface HtmlAttr {
  name: string;
  value: string | null;
}

export interface HtmlStartTag {
  /** Lower-case tag name. */
  name: string;
  /** Index of "<". */
  start: number;
  /** Index just after the tag name. */
  nameEnd: number;
  /** Index just after ">" (or the end of the input). */
  end: number;
  attrs: HtmlAttr[];
  /** For raw-text elements: the text between the start tag and its end tag. */
  content?: { start: number; end: number };
}

const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);

function isWs(c: string | undefined): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\f" || c === "\r";
}

function parseAttrs(html: string, from: number): { attrs: HtmlAttr[]; end: number } {
  const n = html.length;
  const attrs: HtmlAttr[] = [];
  let k = from;
  while (k < n) {
    const c = html[k];
    if (isWs(c) || c === "/") {
      k += 1;
      continue;
    }
    if (c === ">") return { attrs, end: k + 1 };
    const s = k;
    k += 1;
    while (k < n && !isWs(html[k]) && html[k] !== "/" && html[k] !== ">" && html[k] !== "=") k += 1;
    const name = html.slice(s, k).toLowerCase();
    while (k < n && isWs(html[k])) k += 1;
    let value: string | null = null;
    if (html[k] === "=") {
      k += 1;
      while (k < n && isWs(html[k])) k += 1;
      const q = html[k];
      if (q === '"' || q === "'") {
        const e = html.indexOf(q, k + 1);
        value = html.slice(k + 1, e === -1 ? n : e);
        k = e === -1 ? n : e + 1;
      } else {
        const s2 = k;
        while (k < n && !isWs(html[k]) && html[k] !== ">") k += 1;
        value = html.slice(s2, k);
      }
    }
    attrs.push({ name, value });
  }
  return { attrs, end: n };
}

function findEndTag(html: string, name: string, from: number): number {
  const re = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, "gi");
  re.lastIndex = from;
  const m = re.exec(html);
  return m ? m.index : -1;
}

/**
 * Where a comment that opened just before `from` ends, as the tokenizer reads it (Task 2.7,
 * CI run 2): "<!-->" and "<!--->" are empty comments, and "--!>" ends a comment as well as
 * "-->". Reading only "-->" would let "<!--><a target=_top>-->" hide a real tag from the
 * attribute checks.
 */
function commentEnd(html: string, from: number): number {
  if (html.startsWith(">", from)) return from + 1;
  if (html.startsWith("->", from)) return from + 2;
  const ends = [
    [html.indexOf("-->", from), 3],
    [html.indexOf("--!>", from), 4],
  ].filter(([at]) => at !== -1);
  if (ends.length === 0) return html.length;
  const [at, len] = ends.reduce((a, b) => (b[0] < a[0] ? b : a));
  return at + len;
}

/** Every start tag outside comments and raw text, in document order. */
export function scanStartTags(html: string): HtmlStartTag[] {
  const out: HtmlStartTag[] = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    if (html.startsWith("<!--", lt)) {
      i = commentEnd(html, lt + 4);
      continue;
    }
    const next = html[lt + 1];
    if (next === "!" || next === "?") {
      const close = html.indexOf(">", lt + 2);
      i = close === -1 ? n : close + 1;
      continue;
    }
    if (next === "/") {
      if (/[A-Za-z]/.test(html[lt + 2] ?? "")) {
        // An end tag: its attributes are read (a quoted ">" does not end it), then ignored.
        i = parseAttrs(html, lt + 2).end;
      } else {
        // A bogus comment.
        const close = html.indexOf(">", lt + 2);
        i = close === -1 ? n : close + 1;
      }
      continue;
    }
    if (!/[A-Za-z]/.test(next ?? "")) {
      i = lt + 1;
      continue;
    }
    let j = lt + 1;
    while (j < n && !isWs(html[j]) && html[j] !== "/" && html[j] !== ">") j += 1;
    const name = html.slice(lt + 1, j).toLowerCase();
    const { attrs, end } = parseAttrs(html, j);
    const tag: HtmlStartTag = { name, start: lt, nameEnd: j, end, attrs };
    out.push(tag);
    i = end;
    if (RAW_TEXT.has(name)) {
      if (name === "plaintext") {
        tag.content = { start: end, end: n };
        break;
      }
      const close = findEndTag(html, name, end);
      tag.content = { start: end, end: close === -1 ? n : close };
      i = close === -1 ? n : close;
    }
  }
  return out;
}

const has = (tag: HtmlStartTag, name: string) => tag.attrs.some((a) => a.name === name);
const attrValue = (tag: HtmlStartTag, name: string) => tag.attrs.find((a) => a.name === name)?.value;

const SCRIPT_URL_ATTRS = ["src", "href", "xlink:href", "integrity"] as const;
const CLASSIC_SCRIPT_TYPES = new Set(["", "text/javascript", "application/javascript"]);

/** Why a script element may not run, or null for an inline classic script. */
function scriptRefusal(tag: HtmlStartTag): string | null {
  for (const a of SCRIPT_URL_ATTRS) if (has(tag, a)) return `a script with a ${a} attribute`;
  const type = attrValue(tag, "type");
  if (typeof type === "string" && !CLASSIC_SCRIPT_TYPES.has(type.trim().toLowerCase())) return `a script of type ${type.trim().slice(0, 40)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------

const ERRORS_MAX = 20;
const ERROR_CHARS_MAX = 199;

function line(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= ERROR_CHARS_MAX ? flat : `${flat.slice(0, ERROR_CHARS_MAX - 1)}…`;
}

/** Tags the document may not contain (plan 2.4; frameset to fencedframe are stricter additions). */
export const V3_FORBIDDEN_TAGS = [
  "form", "iframe", "frame", "object", "embed", "link", "base", "meta",
  "frameset", "applet", "portal", "fencedframe",
] as const;
const FORBIDDEN_TAG_RE = new RegExp(`<(${V3_FORBIDDEN_TAGS.join("|")})(?=[\\t\\n\\f\\r />]|$)`, "gi");

// URL-like strings, matched case-insensitively on the raw text and on a copy with
// character references decoded and tabs and newlines removed (as URL parsing does).
const URL_PATTERNS: Array<[RegExp, string]> = [
  [/https?:/i, "an http: or https: URL"],
  [/\/\//, '"//" (a URL, or a // comment: use /* */ comments)'],
  [/javascript:/i, "a javascript: URL"],
  [/data:\s*(?:text\/html|application\/xhtml|image\/svg)/i, "a data: URL for a document"],
  [/@import/i, "a CSS @import"],
];

// Identifiers, matched case-sensitively as words (the JavaScript names are case-sensitive).
// Plan 2.4 lists location to document.cookie; import( to integrity are stricter additions.
const IDENTIFIER_PATTERNS: Array<[RegExp, string]> = [
  [/\blocation\b/, "location"],
  [/\bwindow\s*\.\s*open\b/, "window.open"],
  [/\bfetch\b/, "fetch"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bRTCPeerConnection\b/, "RTCPeerConnection"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bimportScripts\b/, "importScripts"],
  [/\bdocument\s*\.\s*cookie\b/, "document.cookie"],
  [/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)*\(/, "import()"],
  [/\bEventSource\b/, "EventSource"],
  [/\bWebTransport\b/, "WebTransport"],
  [/\b(?:Shared)?Worker\b/, "Worker"],
  [/\bserviceWorker\b/, "serviceWorker"],
  [/\bintegrity\b/, "integrity"],
];

// SVG animation elements can set an attribute after load, so <animate attributeName="href">
// would make a link the href check never saw (fix round 1, M4).
const SVG_ANIMATION_TAGS: ReadonlySet<string> = new Set(["animate", "set", "animatetransform", "animatemotion", "animatecolor"]);

function animatesHref(tag: HtmlStartTag): boolean {
  const attr = tag.attrs.find((a) => a.name === "attributename");
  if (!attr || attr.value === null) return false;
  const target = decodeRefs(attr.value).trim().toLowerCase();
  return target === "href" || target === "xlink:href" || target.endsWith(":href");
}

const NAMED_REFS: Record<string, string> = { colon: ":", sol: "/", period: ".", tab: "", newline: "", lpar: "(", rpar: ")" };

/** Character references decoded (numeric, and the few named ones a URL could hide behind). */
function decodeRefs(html: string): string {
  return html
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});?/g, (_, dec: string) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_REFS[name.toLowerCase()] ?? m)
    .replace(/[\t\n\r]/g, "");
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * The static checks on a variant 3 document (plan Task 2.4), as short plain strings usable
 * as repair feedback (at most 20, each under 200 characters). Defense in depth only.
 */
export function checkV3Static(html: string): string[] {
  const errors: string[] = [];
  const bytes = utf8Bytes(html);
  if (bytes > V3_LIMITS.maxBytes) errors.push(`html: ${bytes} bytes is over the ${V3_LIMITS.maxBytes} byte cap`);

  const tags = new Set<string>();
  for (const m of html.matchAll(FORBIDDEN_TAG_RE)) tags.add(m[1].toLowerCase());
  for (const t of tags) errors.push(`html: <${t}> is not allowed`);

  if (/[\t\n\f\r "'/](?:xlink:)?href[\t\n\f\r ]*=/i.test(html)) {
    errors.push("html: href attributes are not allowed (no links; use <jb-button> with an open action)");
  }

  const decoded = decodeRefs(html);
  for (const [re, what] of URL_PATTERNS) {
    if (re.test(html) || re.test(decoded)) errors.push(`html: ${what} is not allowed`);
  }
  for (const [re, name] of IDENTIFIER_PATTERNS) {
    if (re.test(html)) errors.push(`html: ${name} is not allowed`);
  }

  const refusals = new Set<string>();
  for (const tag of scanStartTags(html)) {
    // Task 2.7, CI run 2: no link target (a target=_top or _blank anchor, area or base) and no
    // declarative shadow root (the kit forces shadow roots open so its link checks see in).
    if (has(tag, "target")) refusals.add("html: target attributes are not allowed (no links or new windows)");
    if (has(tag, "shadowrootmode") || has(tag, "shadowroot")) refusals.add("html: declarative shadow roots are not allowed");
    if (SVG_ANIMATION_TAGS.has(tag.name) && animatesHref(tag)) {
      refusals.add("html: SVG animation of href or xlink:href is not allowed");
      continue;
    }
    if (tag.name !== "script") continue;
    const why = scriptRefusal(tag);
    if (why) refusals.add(`html: ${why} is not allowed; write inline classic scripts only`);
    if (tag.content && html.slice(tag.content.start, tag.content.end).includes("<!--")) {
      refusals.add('html: "<!--" inside a script is not allowed');
    }
  }
  errors.push(...refusals);
  return errors.slice(0, ERRORS_MAX).map(line);
}

/** The variant 3 gate: the payload schema, then the static checks. */
export function validateSurfaceV3(payload: unknown): SurfaceValidationV3 {
  const parsed = SurfacePayloadV3Schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, ERRORS_MAX).map((i) => line(`${i.path.join(".") || "payload"}: ${i.message}`)),
    };
  }
  const errors = checkV3Static(parsed.data.html);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, payload: parsed.data };
}

// ---------------------------------------------------------------------------
// The sandbox document
// ---------------------------------------------------------------------------

const NONCE_RE = /^[A-Za-z0-9+/]{16,128}={0,2}$/;
/** The frame document's title: the host's own label for the frame (SandboxFrame). */
export const SANDBOX_DOCUMENT_TITLE = "Generated view";
const KIT_END_TAG_RE = /<\/(?:script|style)/i;

/** A fresh nonce for one build: 18 random bytes, base64 (24 characters). */
export function newSandboxNonce(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * The plan's policy (Task 2.4), word for word, plus `webrtc 'block'` (Task 2.7, CI run 1:
 * connect-src does not govern WebRTC, and STUN/TURN traffic left the sandbox in Chromium and
 * WebKit). The directive is defence in depth: browsers that do not know it ignore it, and
 * the kit replaces the WebRTC constructors before any model byte runs.
 */
export function sandboxCsp(nonce: string): string {
  return (
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src data:; ` +
    `font-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; webrtc 'block'`
  );
}

function hashSources(hashes: readonly string[]): string {
  const unique = [...new Set(hashes)];
  return unique.length === 0 ? "'none'" : unique.map((h) => `'sha256-${h}'`).join(" ");
}

/**
 * The srcdoc document (plan Task 2.4). Fixed order: doctype; the html start tag with
 * lang="en" (it carries no content, so the CSP metas still precede everything they govern);
 * the plan's CSP meta; the hash CSP meta; x-dns-prefetch-control off; a no-referrer meta; a
 * fixed title, "Generated view" (the host's label for the frame; axe's html-has-lang and
 * document-title rules ask for both); the kit style and script; then
 * the model's HTML, its script and style tags given the nonce (placed first among their
 * attributes, so a nonce the model wrote is ignored as a duplicate). Every emitted script
 * and style element starts with the comment /*<nonce>*\/ and its hash is listed in the hash
 * policy. Throws on a malformed nonce or a kit that would close its own element.
 */
export function buildSandboxDocument(a: { html: string; nonce: string; kitJs: string; kitCss: string }): string {
  if (!NONCE_RE.test(a.nonce)) throw new Error("sandbox: the nonce must be base64");
  if (KIT_END_TAG_RE.test(a.kitJs) || KIT_END_TAG_RE.test(a.kitCss)) throw new Error("sandbox: the kit must not close its element");
  const salt = `/*${a.nonce}*/`;
  const nonceAttr = ` nonce="${a.nonce}"`;
  const kitCss = salt + a.kitCss;
  const kitJs = salt + a.kitJs;
  const styleHashes = [sha256Base64(kitCss)];
  const scriptHashes = [sha256Base64(kitJs)];

  let body = "";
  let cursor = 0;
  for (const tag of scanStartTags(a.html)) {
    if (tag.name !== "script" && tag.name !== "style") continue;
    if (tag.name === "script" && scriptRefusal(tag) !== null) continue;
    const content = tag.content ?? { start: tag.end, end: tag.end };
    body += a.html.slice(cursor, tag.nameEnd) + nonceAttr + a.html.slice(tag.nameEnd, content.start) + salt;
    const hash = sha256Base64(salt + a.html.slice(content.start, content.end));
    (tag.name === "script" ? scriptHashes : styleHashes).push(hash);
    cursor = content.start;
  }
  body += a.html.slice(cursor);

  const hashPolicy =
    `script-src ${hashSources(scriptHashes)}; style-src ${hashSources(styleHashes)}; ` +
    `require-trusted-types-for 'script'; trusted-types default`;
  return (
    "<!doctype html>" +
    '<html lang="en">' +
    `<meta http-equiv="Content-Security-Policy" content="${sandboxCsp(a.nonce)}">` +
    `<meta http-equiv="Content-Security-Policy" content="${hashPolicy}">` +
    '<meta http-equiv="x-dns-prefetch-control" content="off">' +
    '<meta name="referrer" content="no-referrer">' +
    `<title>${SANDBOX_DOCUMENT_TITLE}</title>` +
    `<style${nonceAttr}>${kitCss}</style>` +
    `<script${nonceAttr}>${kitJs}</script>` +
    "<body>" +
    body
  );
}

// ---------------------------------------------------------------------------
// The data snapshot the frame receives
// ---------------------------------------------------------------------------

/**
 * A job as the frame sees it: no posting URL (posting links come from the host), and
 * `place` for the location, so model code never needs the `location` identifier that
 * checkV3Static rejects.
 */
export interface SandboxJob {
  jobId: string;
  title: string;
  company: string;
  place: string | null;
  remote: boolean;
  ageDays: number;
  closed: boolean;
}

export type SandboxReview = ReviewFacts;
export type SandboxMemo = Omit<MemoDoc, "other">;

export interface SandboxSnapshot {
  profile: {
    titles: string[];
    yearsOfExperience: number | null;
    education: string[];
    preferredLocations: string[];
    workAuthorized: boolean | null;
    needsSponsorship: boolean | null;
  } | null;
  jobs: Record<string, SandboxJob>;
  reviews: Record<string, SandboxReview>;
  memo: SandboxMemo | null;
  shortlist: Array<Pick<ShortlistRow, "jobId" | "state" | "reasonCode" | "briefWhy" | "briefRisk" | "setBy" | "updatedAt" | "fitScore"> & { job: SandboxJob }>;
  applications: Array<
    Pick<ApplicationRow, "jobId" | "stage" | "closedReason" | "nextStepOn" | "updatedAt" | "documents"> & {
      job: SandboxJob;
      events: Array<Pick<ApplicationRow["events"][number], "kind" | "fromStage" | "toStage" | "actor" | "createdAt">>;
    }
  >;
  documents: Array<Pick<DocumentMeta, "kind" | "mime" | "bytes" | "extraction" | "createdAt">>;
  metrics: MetricResult[];
}

function sandboxJob(j: JobFacts): SandboxJob {
  return { jobId: j.jobId, title: j.title, company: j.company, place: j.location, remote: j.remote, ageDays: j.ageDays, closed: j.closed };
}

/**
 * The memo's six named preference fields, copied one by one. They are free text, but each
 * is the user's own answer to a fixed question (role, places, pay, must-haves, deal
 * breakers, companies), which is what a "what you're looking for" view draws, so they are
 * kept. `other` is left out: it is the memo's catch-all free text, the field most likely
 * to hold contact or personal details, and no view needs it (fix round 1, M2).
 */
function sandboxMemo(m: MemoDoc): SandboxMemo {
  return {
    role: m.role, locations: m.locations, compensation: m.compensation,
    mustHaves: m.mustHaves, dealBreakers: m.dealBreakers, companies: m.companies,
  };
}

function sandboxMetric(m: MetricResult): MetricResult {
  const spec: MetricSpec = { metric: m.spec.metric, window: m.spec.window };
  if (m.spec.groupBy !== undefined) spec.groupBy = m.spec.groupBy;
  if (m.spec.filter !== undefined) spec.filter = m.spec.filter.stage === undefined ? {} : { stage: [...m.spec.filter.stage] };
  switch (m.kind) {
    case "value":
      return { spec, n: m.n, kind: "value", value: m.value, ...(m.delta === undefined ? {} : { delta: m.delta }) };
    case "series":
      return { spec, n: m.n, kind: "series", points: m.points.map((p) => ({ x: p.x, y: p.y })) };
    case "rows":
      return { spec, n: m.n, kind: "rows", columns: [...m.columns], rows: m.rows.map((r) => [...r]) };
  }
}

/**
 * The data the frame gets (plan Task 2.4, spec 10 mitigation (d)): built field by field
 * from the gathered data, so a field added to GatheredData later is left out until it is
 * added here. Left out: the profile's name; posting URLs; skip reason text and
 * application notes (the user's free text, which can hold contact details); the memo's
 * `other` field; application and document ids; document filenames. EEO fields are never
 * in gathered data.
 */
export function sandboxSnapshot(g: GatheredData): SandboxSnapshot {
  const jobs: Record<string, SandboxJob> = {};
  for (const [id, j] of Object.entries(g.jobs)) jobs[id] = sandboxJob(j);
  const reviews: Record<string, SandboxReview> = {};
  for (const [id, r] of Object.entries(g.reviews)) {
    reviews[id] = {
      jobId: r.jobId, verdict: r.verdict, fitScore: r.fitScore, skillsScore: r.skillsScore, experienceScore: r.experienceScore,
      compScore: r.compScore, payMin: r.payMin, payMax: r.payMax, payCurrency: r.payCurrency, payPeriod: r.payPeriod,
      workArrangement: r.workArrangement, seniority: r.seniority, redFlags: [...r.redFlags], skillGaps: [...r.skillGaps],
      requirements: r.requirements.map((q) => ({ text: q.text, met: q.met })), reasoning: r.reasoning, stale: r.stale,
    };
  }
  const p = g.profile;
  return {
    profile: p === null ? null : {
      titles: [...p.titles], yearsOfExperience: p.yearsOfExperience, education: [...p.education],
      preferredLocations: [...p.preferredLocations], workAuthorized: p.workAuthorized, needsSponsorship: p.needsSponsorship,
    },
    jobs,
    reviews,
    memo: g.memo === null ? null : sandboxMemo(g.memo),
    shortlist: g.shortlist.map((s) => ({
      jobId: s.jobId, state: s.state, reasonCode: s.reasonCode, briefWhy: s.briefWhy, briefRisk: s.briefRisk,
      setBy: s.setBy, updatedAt: s.updatedAt, fitScore: s.fitScore, job: sandboxJob(s.job),
    })),
    applications: g.applications.map((a) => ({
      jobId: a.jobId, stage: a.stage, closedReason: a.closedReason, nextStepOn: a.nextStepOn, updatedAt: a.updatedAt,
      documents: { resume: a.documents.resume, cover: a.documents.cover, outdated: a.documents.outdated }, job: sandboxJob(a.job),
      events: a.events.map((e) => ({ kind: e.kind, fromStage: e.fromStage, toStage: e.toStage, actor: e.actor, createdAt: e.createdAt })),
    })),
    documents: g.documents.map((d) => ({ kind: d.kind, mime: d.mime, bytes: d.bytes, extraction: d.extraction, createdAt: d.createdAt })),
    metrics: g.metrics.map(sandboxMetric),
  };
}
