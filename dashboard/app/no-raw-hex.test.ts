import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(__dirname, "..");            // dashboard/
const SCAN = ["app", "components"].map((d) => path.join(ROOT, d));
// Legit literal-color holders (see the dark-mode design):
//  - globals.css DEFINES the token hex values;
//  - components/theme/ intentionally hardcodes each theme's colors so a swatch
//    can PREVIEW the opposite theme, and needs a concrete meta theme-color hex;
//  - layout.tsx's <meta theme-color> default is a concrete hex.
const ALLOW = new Set([
  path.join(ROOT, "app/globals.css"),
  path.join(ROOT, "app/layout.tsx"),
]);
const ALLOW_DIRS = [path.join(ROOT, "components/theme")];
const HEX = /#[0-9a-fA-F]{3,8}\b/;

// Blank out comments (preserving line numbers) so a comment that MENTIONS a hex
// — a contrast-ratio note, a design rationale — does not trip the guard. We
// police color VALUES in code, not prose.
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return noBlock
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules") walk(p, out); }
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const allowed = (file: string) =>
  ALLOW.has(file) || ALLOW_DIRS.some((d) => file.startsWith(d + path.sep));

describe("no raw hex in themed source", () => {
  // Guards hex color LITERALS only (the /#hex/ regex). rgba() elevation shadows
  // (~20 intentional inline shadow values) are deliberately allowed and NOT policed.
  test("no raw hex color literal escapes a var(--token)", () => {
    const offenders: string[] = [];
    for (const base of SCAN) {
      for (const file of walk(base)) {
        if (allowed(file)) continue;
        stripComments(readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
          if (HEX.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        });
      }
    }
    expect(offenders, `raw hex must use var(--token):\n${offenders.join("\n")}`).toEqual([]);
  });
});
