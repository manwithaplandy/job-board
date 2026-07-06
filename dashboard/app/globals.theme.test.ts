import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

// Extract the var names declared inside a given selector's first { … } block.
function tokensIn(selector: string): Set<string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

describe("theme tokens", () => {
  test("every :root token has a dark override, and vice versa", () => {
    const light = tokensIn(":root {");
    const dark = tokensIn(':root[data-theme="dark"] {');
    expect([...light].sort()).toEqual([...dark].sort());
  });

  test("defines the core semantic tokens", () => {
    const light = tokensIn(":root {");
    for (const t of ["--bg-page", "--text-primary", "--accent", "--danger", "--focus-ring"]) {
      expect(light.has(t)).toBe(true);
    }
  });
});
