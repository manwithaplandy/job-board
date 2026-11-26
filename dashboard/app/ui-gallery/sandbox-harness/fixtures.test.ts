import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HTML_INJECTION_CASES } from "@/lib/agent/evals/injectionHtml";
import { SANDBOX_CANARY_ORIGIN, SANDBOX_CANARY_PORT, SANDBOX_CASES, SANDBOX_CASE_NAMES, isSandboxCaseName, sandboxCase } from "./fixtures";

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

  test("the canary server listens on the port the fixtures name", () => {
    const server = readFileSync(path.join(process.cwd(), "tests/sandbox/canary-server.mjs"), "utf8");
    expect(server).toContain(`process.env.SANDBOX_CANARY_PORT ?? ${SANDBOX_CANARY_PORT}`);
    expect(SANDBOX_CANARY_ORIGIN).toBe(`http://127.0.0.1:${SANDBOX_CANARY_PORT}`);
  });
});
