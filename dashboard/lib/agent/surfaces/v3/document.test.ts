// Variant 3 static checks, the sandbox document builder and the data snapshot (plan Task
// 2.4). The static checks are defense in depth; the CSP and the sandbox are the control
// (Task 2.7 tests them in real browsers).
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { GatheredData } from "@/lib/agent/gathered";
import { gatheredFixture, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";
import {
  V3_LIMITS,
  buildSandboxDocument,
  checkV3Static,
  newSandboxNonce,
  sandboxCsp,
  sandboxSnapshot,
  scanStartTags,
  validateSurfaceV3,
} from "@/lib/agent/surfaces/v3/document";

const NONCE = "AAAAAAAAAAAAAAAAAAAAAAAA";
const KIT = { kitJs: "var host = {};", kitCss: ":root { --accent: blue; }" };
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("base64");

/** A document a model could plausibly write against the kit: it must pass. */
const CLEAN = [
  "<style>.pick { color: var(--text-primary); padding: var(--space-2); } /* layout */</style>",
  "<h1>Your top picks</h1><div id=\"list\"></div>",
  "<jb-field name=\"note\" label=\"A note\"></jb-field>",
  "<jb-button action='{\"name\":\"open\",\"target\":\"shortlist\"}'>Open shortlist</jb-button>",
  "<script>",
  "  /* draw one row per job */",
  "  host.onInit(function (data) {",
  "    var list = document.getElementById('list');",
  "    Object.keys(data.jobs).forEach(function (id) {",
  "      var job = data.jobs[id];",
  "      var row = document.createElement('p');",
  "      row.textContent = job.title + ' at ' + job.company + (job.place ? ' (' + job.place + ')' : '');",
  "      list.appendChild(row);",
  "    });",
  "    if (data.metrics.length > 0) host.chart(document.getElementById('list'), { viz: 'bar', points: [] });",
  "  });",
  "</script>",
].join("\n");

describe("checkV3Static", () => {
  test.each([
    "<form>", "<iframe>", "<meta http-equiv=refresh>", "<base>", "<link rel=dns-prefetch>", '<a href="x">',
    "https://evil.test", "location.href", "fetch(", "new WebSocket",
  ])("rejects %s", (bad) => {
    expect(checkV3Static(`<p>ok</p>${bad}`).length).toBeGreaterThan(0);
  });

  test("rejects a document of 60001 bytes", () => {
    expect(checkV3Static("a".repeat(V3_LIMITS.maxBytes))).toEqual([]);
    expect(checkV3Static("a".repeat(V3_LIMITS.maxBytes + 1))).toEqual([`html: 60001 bytes is over the 60000 byte cap`]);
    // Bytes, not characters: 20,001 three-byte characters are over.
    expect(checkV3Static("€".repeat(20_001)).length).toBe(1);
  });

  test("a clean document written against the kit passes", () => {
    expect(checkV3Static(CLEAN)).toEqual([]);
    expect(validateSurfaceV3({ variant: 3, title: "Picks", html: CLEAN })).toEqual({
      ok: true, payload: { variant: 3, title: "Picks", html: CLEAN },
    });
  });

  test("stricter additions: script URLs, module and import map scripts, dynamic import, entity-hidden URLs", () => {
    for (const bad of [
      '<script src="x.js"></script>',
      "<script integrity=sha256-x>1</script>",
      '<script type="module">1</script>',
      '<script type="importmap">{}</script>',
      "<script>import('x')</script>",
      "<script>import /* c */ ('x')</script>",
      '<img src="&#47;&#47;evil.test/x">',
      '<img src="ht&#x74;ps:x">',
      "<style>@import 'x';</style>",
      "<svg><a xlink:href=\"#x\">x</a></svg>",
      "<script>new Worker('w')</script>",
      "<script>s.integrity = 'x'</script>",
      "<script><!-- <script> --></script>",
      "<portal></portal>",
    ]) {
      expect(checkV3Static(bad).length, bad).toBeGreaterThan(0);
    }
  });

  test("identifiers are matched as case-sensitive words, so prose like 'Location' and data keys like preferredLocations pass", () => {
    expect(checkV3Static("<p>Location: Remote</p><script>var l = host.data.profile.preferredLocations;</script>")).toEqual([]);
    expect(checkV3Static("<script>var x = document.location;</script>")).toEqual(["html: location is not allowed"]);
  });

  test("errors are plain strings under 200 characters, at most 20", () => {
    const everything = [
      "<form>", "<iframe>", "<frame>", "<object>", "<embed>", "<link>", "<base>", "<meta>", "<applet>", "<portal>",
      '<a href="x">', "https://x", "javascript:x", "data:text/html,x", "@import", "location", "fetch", "XMLHttpRequest",
      "WebSocket", "RTCPeerConnection", "sendBeacon", "importScripts", "document.cookie", "EventSource",
    ].join(" ");
    const errors = checkV3Static(everything);
    expect(errors.length).toBe(20);
    for (const e of errors) {
      expect(typeof e).toBe("string");
      expect(e.length).toBeLessThan(200);
      expect(e).not.toMatch(/\n/);
    }
  });

  test("the schema refuses a missing or blank title, an empty document and extra keys", () => {
    expect(validateSurfaceV3({ variant: 3, html: "<p>x</p>" }).ok).toBe(false);
    expect(validateSurfaceV3({ variant: 3, title: "  ", html: "<p>x</p>" }).ok).toBe(false);
    expect(validateSurfaceV3({ variant: 3, title: "x", html: "" }).ok).toBe(false);
    expect(validateSurfaceV3({ variant: 3, title: "x", html: "<p>x</p>", css: "x" }).ok).toBe(false);
    expect(validateSurfaceV3({ variant: 3, title: "x".repeat(81), html: "<p>x</p>" }).ok).toBe(false);
  });
});

describe("scanStartTags", () => {
  test("skips comments and raw text, and reads attributes as the tokenizer does", () => {
    const html = '<!-- <script>no</script> --><p title=">">x</p><script>var s = "<script src=x>";</script><textarea><script></textarea><style a=1>p{}</style>';
    const tags = scanStartTags(html).map((t) => [t.name, t.attrs.map((a) => a.name)]);
    expect(tags).toEqual([["p", ["title"]], ["script", []], ["textarea", []], ["style", ["a"]]]);
  });
});

describe("buildSandboxDocument", () => {
  test("the CSP meta is the first element after the doctype", () => {
    const doc = buildSandboxDocument({ html: "<script>1</script>", nonce: NONCE, ...KIT });
    expect(doc.startsWith(`<!doctype html><meta http-equiv="Content-Security-Policy" content="${sandboxCsp(NONCE)}">`)).toBe(true);
    expect(sandboxCsp(NONCE)).toBe(
      `default-src 'none'; script-src 'nonce-${NONCE}'; style-src 'nonce-${NONCE}'; img-src data:; font-src 'none'; ` +
        "connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
    );
    // Both policies and the prefetch switch come before the kit, and the kit before any model byte.
    const kitAt = doc.indexOf("<style nonce=");
    expect(doc.indexOf('<meta http-equiv="x-dns-prefetch-control" content="off">')).toBeLessThan(kitAt);
    expect(doc.lastIndexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(kitAt);
    expect(doc.indexOf("<body>")).toBeGreaterThan(doc.indexOf("var host = {};"));
    expect(doc.endsWith(`<body><script nonce="${NONCE}">/*${NONCE}*/1</script>`)).toBe(true);
  });

  test("every model script and style tag carries the nonce; the nonce differs per build", () => {
    const html = "<style>p{}</style><p>x</p><SCRIPT>a()</SCRIPT><script type=\"text/javascript\">b()</script>";
    const a = newSandboxNonce();
    const b = newSandboxNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{24}$/);
    for (const nonce of [a, b]) {
      const doc = buildSandboxDocument({ html, nonce, ...KIT });
      const model = doc.slice(doc.indexOf("<body>"));
      const opens = [...model.matchAll(/<(script|style)\b[^>]*>/gi)].map((m) => m[0]);
      expect(opens).toHaveLength(3);
      for (const open of opens) expect(open).toMatch(new RegExp(`^<(script|style) nonce="${nonce.replace(/[+/]/g, "\\$&")}"`, "i"));
    }
  });

  test("a hash policy lists the salted SHA-256 of every emitted script and style, with no nonce and no URL", () => {
    const html = "<style>p{}</style><script>a()</script><script>b()</script>";
    const doc = buildSandboxDocument({ html, nonce: NONCE, ...KIT });
    const policies = [...doc.matchAll(/http-equiv="Content-Security-Policy" content="([^"]*)"/g)].map((m) => m[1]);
    expect(policies).toHaveLength(2);
    const salt = `/*${NONCE}*/`;
    const scripts = [KIT.kitJs, "a()", "b()"].map((s) => `'sha256-${sha(salt + s)}'`).join(" ");
    const styles = [KIT.kitCss, "p{}"].map((s) => `'sha256-${sha(salt + s)}'`).join(" ");
    expect(policies[1]).toBe(`script-src ${scripts}; style-src ${styles}`);
    expect(policies[1]).not.toMatch(/nonce|https?:|\*/);
    // The hashes are of the element text exactly as the document holds it.
    for (const m of doc.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)) expect(policies[1]).toContain(sha(m[1]));
  });

  test("a script with a URL attribute or a non-classic type gets no nonce and no hash", () => {
    const html = '<script src="x.js"></script><script type="module">m()</script><script integrity="sha256-x">i()</script>';
    const doc = buildSandboxDocument({ html, nonce: NONCE, ...KIT });
    expect(doc).toContain('<body><script src="x.js"></script><script type="module">m()</script><script integrity="sha256-x">i()</script>');
    expect(doc).not.toContain(sha(`/*${NONCE}*/m()`));
  });

  test("a nonce the model wrote comes after the builder's, so the duplicate is ignored", () => {
    const doc = buildSandboxDocument({ html: '<script nonce="mine">x()</script>', nonce: NONCE, ...KIT });
    expect(doc).toContain(`<script nonce="${NONCE}" nonce="mine">`);
  });

  test("script text inside comments, strings and textareas is not treated as a script", () => {
    const html = '<!-- <script>no()</script> --><script>var s = "<script>";</script><textarea><script>t()</script></textarea>';
    const doc = buildSandboxDocument({ html, nonce: NONCE, ...KIT });
    expect(doc).toContain("<!-- <script>no()</script> -->");
    expect(doc).toContain('<textarea><script>t()</script></textarea>');
    expect(doc.match(new RegExp(`nonce="${NONCE}"`, "g"))).toHaveLength(3);
  });

  test("a malformed nonce or a kit that closes its element is refused", () => {
    expect(() => buildSandboxDocument({ html: "x", nonce: 'x" onload="y', ...KIT })).toThrow(/nonce/);
    expect(() => buildSandboxDocument({ html: "x", nonce: "short", ...KIT })).toThrow(/nonce/);
    expect(() => buildSandboxDocument({ html: "x", nonce: NONCE, kitJs: "a</script>", kitCss: "" })).toThrow(/kit/);
    expect(() => buildSandboxDocument({ html: "x", nonce: NONCE, kitJs: "", kitCss: "a</STYLE >" })).toThrow(/kit/);
  });
});

describe("sandboxSnapshot", () => {
  function richGathered(): GatheredData {
    const g = gatheredFixture();
    g.profile = {
      name: "Pat Example", titles: ["Engineer"], yearsOfExperience: 6, education: ["BS"], preferredLocations: ["Remote"],
      workAuthorized: true, needsSponsorship: false,
    };
    // A field a later code version might add to gathered data must not reach the frame.
    (g.profile as unknown as Record<string, unknown>).email = "pat@example.test";
    (g.jobs[JOB_A] as unknown as Record<string, unknown>).eeo_gender = "x";
    g.shortlist = [{
      jobId: JOB_A, state: "skipped", reasonCode: "pay", reasonText: "call me on 555 0100", briefWhy: "Good fit", briefRisk: null,
      setBy: "user", updatedAt: "2026-11-20T00:00:00.000Z", job: g.jobs[JOB_A], fitScore: 80,
    }];
    g.applications = [{
      id: "app-1", jobId: JOB_B, stage: "applied", closedReason: null, nextStepOn: null, updatedAt: "2026-11-20T00:00:00.000Z",
      job: g.jobs[JOB_B], documents: { resume: true, cover: false, outdated: false },
      events: [{ id: 1, kind: "note", fromStage: null, toStage: null, note: "recruiter: sam@example.test", actor: "user", createdAt: "2026-11-20T00:00:00.000Z" }],
    }];
    g.documents = [{ id: "doc-1", kind: "resume", filename: "Pat_Example_Resume.pdf", mime: "application/pdf", bytes: 1000, extraction: "ok", createdAt: "2026-11-20T00:00:00.000Z" }];
    return g;
  }

  function keysAtAnyDepth(v: unknown, out: string[] = []): string[] {
    if (Array.isArray(v)) v.forEach((x) => keysAtAnyDepth(x, out));
    else if (typeof v === "object" && v !== null) {
      for (const [k, x] of Object.entries(v)) {
        out.push(k);
        keysAtAnyDepth(x, out);
      }
    }
    return out;
  }

  test("the snapshot has no email, phone, links or eeo key at any depth", () => {
    const snap = sandboxSnapshot(richGathered());
    const keys = keysAtAnyDepth(snap);
    for (const k of keys) expect(k).not.toMatch(/email|phone|link|url|eeo|name|filename|note/i);
    const text = JSON.stringify(snap);
    for (const leak of ["pat@example.test", "Pat Example", "jobs.example", "555 0100", "sam@example.test", "Pat_Example_Resume"]) {
      expect(text).not.toContain(leak);
    }
  });

  test("it keeps what a surface draws: titles, companies, places, scores, metrics", () => {
    const g = richGathered();
    const snap = sandboxSnapshot(g);
    expect(snap.jobs[JOB_A]).toEqual({ jobId: JOB_A, title: "Engineer", company: "Acme", place: "Remote", remote: true, ageDays: 5, closed: false });
    expect(snap.reviews[JOB_A].fitScore).toBe(80);
    expect(snap.metrics).toEqual(g.metrics);
    expect(snap.shortlist[0]).toMatchObject({ jobId: JOB_A, state: "skipped", reasonCode: "pay", fitScore: 80 });
    expect(snap.applications[0].events[0]).toEqual({ kind: "note", fromStage: null, toStage: null, actor: "user", createdAt: "2026-11-20T00:00:00.000Z" });
    expect(snap.profile).toEqual({
      titles: ["Engineer"], yearsOfExperience: 6, education: ["BS"], preferredLocations: ["Remote"], workAuthorized: true, needsSponsorship: false,
    });
    // A copy: changing it leaves the gathered data alone.
    snap.metrics.length = 0;
    expect(g.metrics.length).toBe(2);
  });
});
