import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { KIT_CSS, KIT_JS } from "@/lib/agent/surfaces/v3/kit";
import { KIT_TOKENS, KIT_TOKEN_NAMES } from "@/lib/agent/surfaces/v3/kitTokens";
import { parseThemeTokens } from "@/lib/agent/surfaces/v3/themeTokens";
import { buildSandboxDocument, checkV3Static } from "@/lib/agent/surfaces/v3/document";

/** The kit's own cap: it is not counted against the model's 60,000 bytes (spec 08 S9). */
const KIT_BYTES_BUDGET = 120_000;

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

  // PR 5 Task 5.1 (spec 08 S9.1): the tokens a rich view needs, checked by the parity test above.
  test("the kit carries the S9.1 tokens, light and dark, equal to app/globals.css", () => {
    const app = parseThemeTokens(GLOBALS_CSS)!;
    const added = [
      "--accent-border", "--success-border", "--warning-border", "--danger-border", "--font-size-heading",
      "--elevation-card", "--shadow-popover", "--motion-fast", "--ease-standard", "--control-height-compact",
    ];
    const names: readonly string[] = KIT_TOKEN_NAMES;
    const kit = parseThemeTokens(KIT_CSS)!;
    for (const n of added) {
      expect({ token: n, listed: names.includes(n) }).toEqual({ token: n, listed: true });
      expect({ token: n, light: kit.light[n] }).toEqual({ token: n, light: app.light[n] });
      expect({ token: n, dark: kit.dark[n] }).toEqual({ token: n, dark: app.dark[n] ?? app.light[n] });
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

// PR 5 Task 5.2 (spec 08 S9.3): layout and text helpers, all classes (the CSP refuses style="").
const S93_CLASSES = [
  "jb-stack", "jb-row", "jb-gap-1", "jb-gap-2", "jb-gap-3", "jb-gap-4", "jb-gap-5", "jb-gap-6",
  "jb-grid", "jb-cols-2", "jb-cols-3", "jb-split", "jb-toolbar", "jb-h1", "jb-h2", "jb-h3",
  "jb-stat", "jb-stat__value", "jb-stat__label", "jb-divider", "jb-scroll-x", "jb-table",
  "jb-timeline", "jb-timeline__item", "jb-meter", "jb-meter__fill", "jb-hidden",
  "jb-card", "jb-badge", "jb-muted", "jb-secondary", "jb-small", "jb-caption", "jb-success", "jb-warning", "jb-danger", "jb-accent", "jb-chart",
] as const;

/** The body of the one block that starts at `at` (the index of its opening brace), braces balanced. */
function blockAt(css: string, at: number): string {
  let depth = 0;
  for (let i = at; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}" && --depth === 0) return css.slice(at + 1, i);
  }
  throw new Error("unbalanced block");
}

/** Every rule as [selectors, body], read from flat CSS (no nested blocks). */
function rules(css: string): Array<[string[], string]> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].split(",").map((x) => x.trim()), m[2]]);
}

describe("variant 3 kit classes (S9.3)", () => {
  test("KIT_CSS defines every class in the S9.3 table", () => {
    const outside = KIT_CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    const selectors = rules(outside).flatMap(([sel]) => sel);
    for (const c of S93_CLASSES) {
      const found = selectors.some((sel) => new RegExp(`\\.${c}(?![\\w-])`).test(sel));
      expect({ class: c, defined: found }).toEqual({ class: c, defined: true });
    }
  });

  test("one @media (max-width: 520px) block sets one column for the layout classes", () => {
    const at = [...KIT_CSS.matchAll(/@media \(max-width: 520px\)\s*\{/g)];
    expect(at).toHaveLength(1);
    const body = blockAt(KIT_CSS, at[0].index! + at[0][0].length - 1);
    const inside = rules(body);
    const oneColumn = (cls: string) =>
      inside.some(([sel, decl]) =>
        sel.includes(`.${cls}`) && (/grid-template-columns:\s*(?:1fr|minmax\(0, 1fr\))\s*;/.test(decl) || /flex-direction:\s*column\s*;/.test(decl)),
      );
    for (const c of ["jb-row", "jb-cols-2", "jb-cols-3", "jb-split", "jb-grid"]) {
      expect({ class: c, oneColumn: oneColumn(c) }).toEqual({ class: c, oneColumn: true });
    }
  });

  test("the headings are 20, 18 and 16px at weight 700", () => {
    const all = rules(KIT_CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""));
    for (const [cls, px] of [["jb-h1", 20], ["jb-h2", 18], ["jb-h3", 16]] as const) {
      const decl = all.filter(([sel]) => sel.includes(`.${cls}`)).map(([, body]) => body).join("");
      expect(decl, cls).toMatch(new RegExp(`font-size: ${px}px;`));
      expect(decl, cls).toMatch(/font-weight: 700;/);
    }
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
    // Spec 08 S9: the kit is injected by the host and does not count toward
    // V3_LIMITS.maxBytes, so the model's byte cap is the one rule not applied to it (PR 5;
    // the kit's own budget is the next test). Every other rule is.
    const errors = checkV3Static(`<style>${KIT_CSS}</style><script>${KIT_JS}</script>`);
    expect(errors.filter((e) => !/^html: \d+ bytes is over the \d+ byte cap$/.test(e))).toEqual([]);
    expect(() => buildSandboxDocument({ html: "<p>x</p>", nonce: "AAAAAAAAAAAAAAAAAAAAAAAA", kitJs: KIT_JS, kitCss: KIT_CSS })).not.toThrow();
  });

  test("the kit stays within its own size budget (PR 5)", () => {
    const bytes = new TextEncoder().encode(KIT_CSS + KIT_JS).length;
    expect(bytes).toBeLessThan(KIT_BYTES_BUDGET);
  });

  test("the ready message is posted before any script of the document can run", () => {
    // The kit runs as the first script; the post is at its top level, not in a listener.
    const at = KIT_JS.indexOf("parent.postMessage(");
    expect(at).toBeGreaterThan(0);
    expect(KIT_JS.slice(0, at)).not.toMatch(/addEventListener\("(?:DOMContentLoaded|load)"/);
  });

  test("removing both CSP metas is the kit's first statement (fix round 1, I1)", () => {
    const strict = KIT_JS.indexOf('"use strict";');
    const removal = KIT_JS.indexOf("document.querySelectorAll('meta[http-equiv=\"Content-Security-Policy\"]')");
    expect(strict).toBeGreaterThan(0);
    expect(removal).toBeGreaterThan(strict);
    // Between them: comments and the opening of the removal's own function, nothing else.
    const between = KIT_JS.slice(strict + '"use strict";'.length, removal).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(between).toMatch(/^\s*\(function \(\) \{\s*var metas = $/);
    // And it comes before everything else the kit does.
    for (const later of ["trustedTypes", "Document.prototype", "var state", "new MessageChannel", "parent.postMessage("]) {
      expect({ later, after: KIT_JS.indexOf(later) > removal }).toEqual({ later, after: true });
    }
  });

  test("the kit is the first script of the built document, right after both CSP metas", () => {
    const doc = buildSandboxDocument({ html: "<script>a()</script>", nonce: "AAAAAAAAAAAAAAAAAAAAAAAA", kitJs: KIT_JS, kitCss: KIT_CSS });
    const firstScript = doc.indexOf("<script");
    // The script opens with its hash salt comment, then the kit.
    expect(doc.slice(firstScript)).toMatch(/^<script nonce="[^"]+">\/\*[A-Za-z0-9+/=]+\*\/\(function \(\) \{\n {2}"use strict";/);
    const metas = [...doc.matchAll(/<meta http-equiv="Content-Security-Policy"/g)].map((m) => m.index!);
    expect(metas).toHaveLength(2);
    for (const at of metas) expect(at).toBeLessThan(firstScript);
  });

  test("the second CSP requires Trusted Types and allows only the kit's default policy", () => {
    const doc = buildSandboxDocument({ html: "<p>x</p>", nonce: "AAAAAAAAAAAAAAAAAAAAAAAA", kitJs: KIT_JS, kitCss: KIT_CSS });
    const policies = [...doc.matchAll(/http-equiv="Content-Security-Policy" content="([^"]*)"/g)].map((m) => m[1]);
    expect(policies[1]).toMatch(/; require-trusted-types-for 'script'; trusted-types default$/);
    expect(KIT_JS).toContain('createPolicy("default"');
  });

  test("the kit acknowledges init and answers pings over the port (fix round 1, I2)", () => {
    expect(KIT_JS).toContain('post({ type: "inited" });');
    expect(KIT_JS).toContain('post({ type: "pong", n:');
  });

  test("the link guard, the observer and the leaving listeners are set up before ready is posted (Task 2.7, CI run 2)", () => {
    const ready = KIT_JS.indexOf("parent.postMessage(");
    for (const setup of [
      'window.addEventListener("click", guardLink, true);',
      'window.addEventListener("auxclick", guardLink, true);',
      "watch(watcher, document, WATCH);",
      'window.addEventListener("beforeunload", leaving, true);',
      'navigationApi.addEventListener("navigate",',
    ]) {
      const at = KIT_JS.indexOf(setup);
      expect({ setup, found: at > 0, beforeReady: at < ready }).toEqual({ setup, found: true, beforeReady: true });
    }
    expect(KIT_JS).toContain('post({ type: "navigating" });');
    expect(KIT_JS).not.toMatch(/addEventListener\("pagehide"/);
  });

  test("KIT_JS parses as a script", () => {
    expect(() => new Function(KIT_JS)).not.toThrow();
  });

  test("host.action only posts a message; it reports ready, resize and error", () => {
    expect(KIT_JS).toMatch(/action: function \(name, args\) \{\s*post\(\{ type: "action"/);
    // ready carries the port, and is the only message to the parent window.
    expect(KIT_JS).toContain('parent.postMessage({ type: "ready" }, "*", [channel.port2])');
    // Task 2.7, CI run 2: through MessagePort.prototype.postMessage as it was when the kit ran.
    expect(KIT_JS).toContain("var portSend = uncurry(MessagePort.prototype.postMessage);");
    expect(KIT_JS).toContain("function post(msg) {\n    try { portSend(port, msg); }");
    expect(KIT_JS).toContain('post({ type: "resize", height: h })');
    expect(KIT_JS).toContain('window.addEventListener("error"');
    expect(KIT_JS).toContain('window.addEventListener("unhandledrejection"');
  });
  test("host.ask posts only an ask, behind activation read through natives taken before model code (PR 6, S10.2)", () => {
    const code = KIT_JS.replace(/\/\*[\s\S]*?\*\//g, "");
    // navigator.userActivation is read once, when the kit starts, and its isActive getter is
    // taken from the object's own prototype then; a value put on the object is never read.
    expect([...code.matchAll(/userActivation/g)]).toHaveLength(1);
    expect(code).toContain('activeOf = getterOf(Object.getPrototypeOf(found), "isActive");');
    expect(code).not.toMatch(/\.isActive\b/);
    expect(code).toMatch(/function ask\(text\) \{\s*if \(!userActive\(\)\) return false;/);
    expect(code).toContain('post({ type: "ask", text: s });');
    // The fallback flag: trusted pointerup and keyup, in the capture phase on the window.
    expect(code).toContain('window.addEventListener("pointerup", armOnTrusted, true);');
    expect(code).toContain('window.addEventListener("keyup", armOnTrusted, true);');
    // All of it is set up before the host object exists, and so before any model code.
    const hostAt = code.indexOf("var host = {");
    for (const setup of ["var activeOf = null;", "function userActive()", "function ask(text)"]) {
      expect({ setup, before: code.indexOf(setup) > 0 && code.indexOf(setup) < hostAt }).toEqual({ setup, before: true });
    }
    expect(code).toMatch(/var host = \{[\s\S]*?ask: ask,/);
  });
});
