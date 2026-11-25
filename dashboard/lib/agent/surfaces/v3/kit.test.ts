import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { KIT_CSS, KIT_JS } from "@/lib/agent/surfaces/v3/kit";
import { KIT_TOKENS, KIT_TOKEN_NAMES } from "@/lib/agent/surfaces/v3/kitTokens";
import { parseThemeTokens } from "@/lib/agent/surfaces/v3/themeTokens";
import { buildSandboxDocument, checkV3Static } from "@/lib/agent/surfaces/v3/document";

const GLOBALS_CSS = readFileSync(join(__dirname, "../../../../app/globals.css"), "utf8");

function varsUsed(text: string): string[] {
  return [...new Set([...text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]))];
}

describe("variant 3 kit tokens", () => {
  test("every kit token equals its value in app/globals.css, light and dark", () => {
    const app = parseThemeTokens(GLOBALS_CSS);
    expect(app).not.toBeNull();
    for (const n of KIT_TOKEN_NAMES) {
      expect({ token: n, value: KIT_TOKENS.light[n] }).toEqual({ token: n, value: app!.light[n] });
      // A token the dark block does not restate keeps its light value.
      expect({ token: n, value: KIT_TOKENS.dark[n] }).toEqual({ token: n, value: app!.dark[n] ?? app!.light[n] });
    }
  });

  test("KIT_CSS defines every token the kit uses for light and dark", () => {
    const kit = parseThemeTokens(KIT_CSS);
    expect(kit).not.toBeNull();
    const used = varsUsed(KIT_CSS + KIT_JS);
    expect(used.length).toBeGreaterThan(10);
    for (const n of [...used, ...KIT_TOKEN_NAMES]) {
      expect({ token: n, light: n in kit!.light, dark: n in kit!.dark }).toEqual({ token: n, light: true, dark: true });
    }
  });

  test("jb-button and jb-field get a 44px minimum target", () => {
    expect(KIT_TOKENS.light["--target-size"]).toBe("44px");
    expect(KIT_TOKENS.light["--control-height"]).toBe("44px");
    expect(KIT_CSS).toMatch(/jb-button \{[^}]*min-height: var\(--target-size\);[^}]*min-width: var\(--target-size\);/);
    expect(KIT_CSS).toMatch(/jb-field input \{[^}]*min-height: var\(--control-height\);/);
  });
});

describe("variant 3 kit script", () => {
  test("KIT_JS contains no URL and no reference to parent other than postMessage", () => {
    for (const text of [KIT_JS, KIT_CSS]) {
      expect(text).not.toMatch(/https?:/i);
      expect(text).not.toContain("//");
      expect(text).not.toMatch(/url\s*\(/i);
      expect(text).not.toMatch(/@import/i);
    }
    const parents = [...KIT_JS.matchAll(/\bparent\b/g)];
    expect(parents.length).toBe(1);
    for (const m of parents) expect(KIT_JS.slice(m.index!, m.index! + 30)).toMatch(/^parent\.postMessage\(/);
    for (const name of ["top", "opener", "frameElement", "location", "domain", "cookie", "localStorage", "sessionStorage", "indexedDB", "eval", "Function"]) {
      expect({ name, found: new RegExp(`\\b${name}\\b`).test(KIT_JS) }).toEqual({ name, found: false });
    }
  });

  test("the kit itself passes the variant 3 static checks and the document builder", () => {
    expect(checkV3Static(`<style>${KIT_CSS}</style><script>${KIT_JS}</script>`)).toEqual([]);
    expect(() => buildSandboxDocument({ html: "<p>x</p>", nonce: "AAAAAAAAAAAAAAAAAAAAAAAA", kitJs: KIT_JS, kitCss: KIT_CSS })).not.toThrow();
  });

  test("the ready message is posted before any script of the document can run", () => {
    // The kit runs as the first script; the post is at its top level, not in a listener.
    const at = KIT_JS.indexOf("parent.postMessage(");
    expect(at).toBeGreaterThan(0);
    expect(KIT_JS.slice(0, at)).not.toMatch(/addEventListener\("(?:DOMContentLoaded|load)"/);
  });

  test("KIT_JS parses as a script", () => {
    expect(() => new Function(KIT_JS)).not.toThrow();
  });

  test("host.action only posts a message; it reports ready, resize and error", () => {
    expect(KIT_JS).toMatch(/action: function \(name, args\) \{\s*post\(\{ type: "action"/);
    // ready carries the port, and is the only message to the parent window.
    expect(KIT_JS).toContain('parent.postMessage({ type: "ready" }, "*", [channel.port2])');
    expect(KIT_JS).toContain("function post(msg) {\n    try { port.postMessage(msg); }");
    expect(KIT_JS).toContain('post({ type: "resize", height: h })');
    expect(KIT_JS).toContain('window.addEventListener("error"');
    expect(KIT_JS).toContain('window.addEventListener("unhandledrejection"');
  });
});
