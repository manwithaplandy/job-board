// Reads the custom properties of the two theme blocks in app/globals.css (`:root` for
// light, `:root[data-theme="dark"]` for dark). Pure text in, values out: the kit's token
// table (kitTokens.ts) is checked against it in kit.test.ts, so the frame's palette cannot
// drift from the app's. Test and tooling use only; nothing in the app imports it.

export type ThemeTokens = Record<string, string>;

function block(css: string, selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return null;
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return close === -1 ? null : css.slice(open + 1, close);
}

function declarations(body: string): ThemeTokens {
  const out: ThemeTokens = {};
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

/** The light and dark custom properties of globals.css, or null when a block is missing. */
export function parseThemeTokens(css: string): { light: ThemeTokens; dark: ThemeTokens } | null {
  const light = block(css, ":root");
  const dark = block(css, ':root[data-theme="dark"]');
  if (light === null || dark === null) return null;
  return { light: declarations(light), dark: declarations(dark) };
}
