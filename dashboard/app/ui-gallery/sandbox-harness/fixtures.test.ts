import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HTML_INJECTION_CASES } from "@/lib/agent/evals/injectionHtml";
import { normalizeAskText } from "@/lib/agent/surfaces/v3/bridge";
import {
  HARNESS_ASK_BIDI_SHOWN,
  HARNESS_ASK_SWAPPED,
  HARNESS_ASK_TEXT,
  HARNESS_JOB_A,
  HARNESS_CROSS_SLIDE_PX,
  HARNESS_SLIDE_PX,
  SANDBOX_CANARY_ORIGIN, SANDBOX_CANARY_PORT, SANDBOX_CASES, SANDBOX_CASE_NAMES, isSandboxCaseName, sandboxCase } from "./fixtures";

// The harness's hostile documents (plan Task 2.7). The browsers themselves run in CI; these
// checks keep the fixtures honest where they can be checked without one.

/** Not a fetchable URL: the XHTML namespace the child-realm case passes to createElementNS. */
const NAMESPACE_URIS = new Set(["http://www.w3.org/1999/xhtml"]);

function urlsIn(html: string): string[] {
  return html.match(/\b(?:https?|wss?|stun|turn):\/?\/?[^\s"'`<>)]+/g) ?? [];
}

describe("sandbox harness fixtures", () => {
  test("the case list is closed, unique, and every name resolves to its own case", () => {
    expect(new Set(SANDBOX_CASE_NAMES).size).toBe(SANDBOX_CASE_NAMES.length);
    expect(SANDBOX_CASES.map((c) => c.name)).toEqual([...SANDBOX_CASE_NAMES]);
    for (const name of SANDBOX_CASE_NAMES) {
      expect(isSandboxCaseName(name)).toBe(true);
      expect(sandboxCase(name).name).toBe(name);
    }
    for (const value of ["", "BENIGN", "benign ", "../benign", "__proto__", "constructor", null, 3, ["benign"]]) {
      expect(isSandboxCaseName(value), JSON.stringify(value)).toBe(false);
    }
  });

  test("every case has at most two frames, distinct tags, and each document starts with the probe prelude", () => {
    for (const c of SANDBOX_CASES) {
      expect(c.frames.length, c.name).toBeGreaterThanOrEqual(1);
      expect(c.frames.length, c.name).toBeLessThanOrEqual(2);
      expect(new Set(c.frames.map((f) => f.tag)).size, c.name).toBe(c.frames.length);
      for (const f of c.frames) {
        expect(f.html.startsWith('<pre id="probe"></pre>'), `${c.name}/${f.tag}`).toBe(true);
        expect(f.html, `${c.name}/${f.tag}`).toContain(`t: "${f.tag}"`);
        expect(f.html, `${c.name}/${f.tag}`).toContain('P("start"');
      }
    }
  });

  test("every URL in every document points at the local canary, so no case can reach anything else", () => {
    const canaryHost = new URL(SANDBOX_CANARY_ORIGIN).host;
    let checked = 0;
    for (const c of SANDBOX_CASES) {
      for (const f of c.frames) {
        for (const url of urlsIn(f.html)) {
          checked += 1;
          if (NAMESPACE_URIS.has(url)) continue;
          const rest = url.replace(/^[a-z]+:\/?\/?/, "");
          expect(rest.startsWith(canaryHost), `${c.name}/${f.tag}: ${url}`).toBe(true);
        }
      }
    }
    // Every document's prelude names the canary twice (C and WS), and the cases add more.
    expect(checked).toBeGreaterThan(SANDBOX_CASES.length * 2);
  });

  test("the injection set's three variant 3 surfaces are harness cases (plan Task 2.12)", () => {
    for (const name of HTML_INJECTION_CASES) {
      expect(isSandboxCaseName(name), name).toBe(true);
      expect(sandboxCase(name).frames.map((f) => f.tag)).toEqual([name]);
    }
    expect(sandboxCase("auto_fire").frames[0].html).toMatch(/host\.action\("application\.prepare"/);
    expect((sandboxCase("intent_loop").frames[0].html.match(/host\.action\(/g) ?? []).length).toBe(2);
    expect(sandboxCase("chip_spoof").frames[0].html).toContain('id="fake-confirm"');
  });

  test("the expand cases are static: no action, no request, a button to click (PR 3)", () => {
    for (const name of ["expand-no-reload", "escape-from-frame"] as const) {
      const html = sandboxCase(name).frames[0].html;
      expect(html, name).not.toMatch(/host\.action\(/);
      expect(html, name).not.toMatch(/\bfetch\b|new Image|location/);
      expect(html, name).toMatch(/<button id="(more|focus-me)"/);
    }
  });

  test("kit-controls uses every PR 5 element, a chart with onSelect and a table, and stays static (PR 5)", () => {
    expect(isSandboxCaseName("kit-controls")).toBe(true);
    const html = sandboxCase("kit-controls").frames[0].html;
    for (const tag of ["<jb-select", "<jb-slider", "<jb-toggle", "<jb-segmented", "<jb-tabs", "<jb-tab ", 'variant="secondary"']) {
      expect(html, tag).toContain(tag);
    }
    expect(html).toMatch(/host\.chart\([^)]*/);
    expect(html).toMatch(/onSelect:/);
    expect(html).toMatch(/host\.table\(/);
    expect(html).toMatch(/onRowSelect:/);
    // The slider and the tabs report what they show, so the browser test can read it.
    expect(html).toContain('P("slider"');
    expect(html).toContain('P("tab"');
    expect(html, "no action is sent: the jb-buttons carry none").not.toMatch(/host\.action\(|action=/);
    expect(html).not.toMatch(/\bfetch\b|new Image|location/);
  });

  test("the ask cases ask, never act or reach out, and say what the browser test checks (PR 6)", () => {
    const names = ["ask-on-load", "ask-loop", "ask-click", "ask-swap", "ask-synthetic-click", "ask-oversize", "ask-bidi"] as const;
    for (const name of names) {
      expect(isSandboxCaseName(name), name).toBe(true);
      const html = sandboxCase(name).frames[0].html;
      expect(html, name).toMatch(/host\.ask\(|ask="/);
      expect(html, name).not.toMatch(/host\.action\(|action=/);
      expect(html, name).not.toMatch(/\bfetch\b|new Image|location/);
    }
    expect(sandboxCase("ask-click").frames[0].html).toContain(`<jb-button id="ask" ask="${HARNESS_ASK_TEXT}">`);
    expect(sandboxCase("ask-swap").frames[0].html).toContain(`host.ask("${HARNESS_ASK_SWAPPED}")`);
    expect(sandboxCase("ask-swap").frames[0].html).toMatch(/}, 100\);/);
    expect(sandboxCase("ask-loop").frames[0].html).toMatch(/i < 40/);
    expect(sandboxCase("ask-oversize").frames[0].html).toMatch(/i < 281/);
    // Fix wave M1: a valid third ask in the same click, so a closed gate cannot pass the case.
    expect(sandboxCase("ask-oversize").frames[0].html).toContain(`P("valid", host.ask("${HARNESS_ASK_TEXT}"));`);
    // Fix wave I1: ask-swap hides its probe log, so the swap does not grow the frame and the
    // early press tests the swap's own arming, not the re-arm on a resize.
    expect(sandboxCase("ask-swap").frames[0].html).toContain("#probe { display: none; }");
    // The bidi document carries escapes, so the raw controls never sit in this source file.
    const bidi = sandboxCase("ask-bidi").frames[0].html;
    expect(bidi).toContain("\\u202E");
    expect(/[\u202A-\u202E\u2066-\u2069\u200B]/.test(bidi)).toBe(false);
    expect(HARNESS_ASK_BIDI_SHOWN).toBe("Show the top two roles now");
    // What the document asks for, decoded, normalises to exactly what the browser test expects shown.
    expect(normalizeAskText("Show the \u202Etop two\u202C\u200B roles\u0007\n\u2066now\u2069")).toBe(HARNESS_ASK_BIDI_SHOWN);
    expect(normalizeAskText("\u200B\u202E \u0007 \n\u2066\u2069")).toBeNull();
    expect(bidi).toContain('"Show the \\u202Etop two\\u202C\\u200B roles\\u0007\\n\\u2066now\\u2069"');
  });

  test("ask-resize-slide asks and acts only on clicks, shrinks itself by HARNESS_SLIDE_PX on the next pointer move, and never reaches out (fix wave I1)", () => {
    expect(isSandboxCaseName("ask-resize-slide")).toBe(true);
    const html = sandboxCase("ask-resize-slide").frames[0].html;
    expect(html).toContain(`.sbx-tall { height: ${HARNESS_SLIDE_PX}px; }`);
    expect(html).toContain('<div id="pad" class="sbx-tall"></div>');
    // The probe log is hidden, so a probe line never changes the document's height.
    expect(html).toContain("#probe { display: none; }");
    expect(html).toContain(`host.ask("${HARNESS_ASK_TEXT}")`);
    expect(html).toContain(`host.action("shortlist.set", { jobId: "${HARNESS_JOB_A}", state: "shortlisted" })`);
    expect(html).toMatch(/addEventListener\("pointermove"/);
    expect(html).toContain('pad.classList.remove("sbx-tall")');
    expect(html).toContain('P("slid" + slides, { at: Date.now() })');
    expect(html).not.toMatch(/\bfetch\b|new Image|location/);
  });

  test("ask-cross-view-slide: view A shrinks itself by HARNESS_CROSS_SLIDE_PX on a click, view B asks on a click, and neither reaches out (fix wave follow-up)", () => {
    expect(isSandboxCaseName("ask-cross-view-slide")).toBe(true);
    const frames = sandboxCase("ask-cross-view-slide").frames;
    expect(frames.map((f) => f.tag)).toEqual(["cross-a", "cross-b"]);
    const [a, b] = frames.map((f) => f.html);
    expect(a).toContain(`.sbx-tall { height: ${HARNESS_CROSS_SLIDE_PX}px; }`);
    expect(a).toContain('pad.classList.remove("sbx-tall")');
    expect(a).toContain('P("shrunk" + shrinks, { at: Date.now() })');
    expect(a).not.toContain("host.ask(");
    expect(b).toContain(`host.ask("${HARNESS_ASK_TEXT}")`);
    // Neither probe log shows, so a probe line never moves anything.
    for (const html of [a, b]) {
      expect(html).toContain("#probe { display: none; }");
      expect(html).not.toMatch(/\bfetch\b|new Image|location/);
    }
    expect(HARNESS_CROSS_SLIDE_PX).toBeLessThan(HARNESS_SLIDE_PX);
  });

  test("the canary server listens on the port the fixtures name", () => {
    const server = readFileSync(path.join(process.cwd(), "tests/sandbox/canary-server.mjs"), "utf8");
    expect(server).toContain(`process.env.SANDBOX_CANARY_PORT ?? ${SANDBOX_CANARY_PORT}`);
    expect(SANDBOX_CANARY_ORIGIN).toBe(`http://127.0.0.1:${SANDBOX_CANARY_PORT}`);
  });
});
