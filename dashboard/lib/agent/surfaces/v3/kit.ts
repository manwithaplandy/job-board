// The kit injected ahead of every variant 3 document (plan Task 2.5, spec 7.1 "Sandboxed
// code"). buildSandboxDocument (document.ts) places KIT_CSS and KIT_JS in nonce'd, hashed
// elements before the model's HTML.
//
// KIT_CSS: the design tokens from app/globals.css (kitTokens.ts, checked against
// globals.css in kit.test.ts) for light and dark, and base styles that give <jb-button>
// and <jb-field> a 44px minimum target. Fonts are the system stack: the frame's CSP has
// font-src 'none'.
//
// KIT_JS: the custom elements <jb-button action='{"name":...}'> (or ask="text", PR 6) and
// <jb-field name label>, and a frozen `host` object:
//   host.data, host.theme   the snapshot and theme from the host's init (null and "light"
//                           until init arrives, which is after the document's own
//                           scripts start: read them in host.onInit)
//   host.onInit(cb)         cb(data, theme) once init has arrived
//   host.action(name, args) posts a request to the host and nothing else: the host turns
//                           it into a chip the user must press (D13, SandboxFrame)
//   host.ask(text)          PR 6: proposes a follow-up message, only within 1,000 ms of a
//                           trusted input event (and while navigator.userActivation is active,
//                           where it exists) (true when posted). It posts the text normalised as the
//                           host does (bridge.ts normalizeAskText) and refuses, false, one
//                           that is empty or over 280 code points once normalised; the host
//                           shows it as a pending message the user must send (spec 08 S10)
//   host.chart(el, spec)    inline SVG from { viz, points: [{ label, value }], title }
// and it reports resize (the document's height, 0 to 20000) and error (window error and
// unhandledrejection, at most once, 500 characters).
//
// The handshake (stricter than the plan, PR J2): the kit is the document's first script,
// and as it starts it posts { type: "ready" } to the parent with one end of a
// MessageChannel. Init comes back on that port and every later message goes out on it,
// never on the window. A port belongs to the document that made it, so if the document
// navigates itself (spec 10's open hole), the page it navigated to cannot receive init or
// talk to the host: its window messages are ignored, and only the first ready, which this
// document posts before any script of the model can run, is accepted.
//
// Fix round 1 (I2): the kit acks the first init on the port ({ type: "inited" }, before any
// onInit callback runs) and answers every { type: "ping", n } with { type: "pong", n }.
// The host ends its handshake timer only on the ack, and falls back when a ping goes
// unanswered, so a document that navigated, hung or was replaced is noticed even when no
// second load event comes.
//
// Fix round 1 (I1): before anything else, and so before any model byte runs, the kit
// removes both CSP meta elements (the policies stay enforced; the hash list can no longer
// be read), creates the one allowed Trusted Types policy ("default": script URLs throw,
// script text is refused, frame and script markup throw), makes document.write and
// writeln throw, and makes createElement and createElementNS refuse frame elements. These
// locks are non-configurable, so model code cannot put the originals back.
//
// Task 2.7, CI run 1 (real browsers): STUN and TURN traffic left the sandbox in Chromium and
// WebKit (CSP does not govern WebRTC), and WebKit opened a TCP connection for a link hint.
// The kit now also replaces the WebRTC constructors and window.open with locked functions
// that throw, and createElement and createElementNS refuse link, meta and base too.
//
// Task 2.7, CI run 2: WebKit opened a bare TCP connection in the old window-open case, and
// kept a document alive whose navigation never finished. The kit now cancels any click on
// an element with an href (capture phase, on the window, first), strips href from elements
// as they are added, forces shadow roots open so neither check misses one, and posts
// { type: "navigating" } on the port on beforeunload and on the Navigation API's navigate
// event to another document; the host tears down on it. The natives these use, and the
// port's postMessage, are taken before model code runs, so it cannot replace them.
//
// Task 2.8 (review M8): the host forwards a change of the page's theme as
// { type: "theme", theme } on the port; the kit applies it to data-theme (and host.theme)
// only after init and only for "light" or "dark", so the frame follows the page without a
// remount (a remount would start a new document and spend the mount's action budget).
//
// Model code must read data inside host.onInit and wire behaviour with classes and
// addEventListener: there are no inline style attributes or on... handlers under the CSP.
//
// KIT_JS holds no URL, no "//" and touches the parent window only through one
// parent.postMessage (kit.test.ts checks all three, and that the kit itself passes
// checkV3Static). It accepts the first init only. The host trusts nothing that arrives on
// the port either: script in the frame can reach the same port through host.action
// (bridge.ts, SandboxFrame).
import { KIT_TOKENS, KIT_TOKEN_NAMES, type KitTokenName } from "@/lib/agent/surfaces/v3/kitTokens";
import { ASK_INVISIBLE_SOURCE, ASK_TEXT_MAX } from "@/lib/agent/surfaces/v3/bridge";

// Polish wave, item A: the chart label size the kit's text estimate uses where the browser
// cannot measure text (the chart labels' own CSS size, --font-size-small).
const LABEL_FONT_PX = Number.parseFloat(KIT_TOKENS.light["--font-size-small"]);

function tokenBlock(selector: string, values: Record<KitTokenName, string>): string {
  return `${selector} {\n${KIT_TOKEN_NAMES.map((n) => `  ${n}: ${values[n]};`).join("\n")}\n}\n`;
}

const BASE_CSS = `
html { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
html, body { margin: 0; padding: 0; }
body {
  padding: var(--space-4);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: var(--font-size-body);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
* { box-sizing: border-box; }
jb-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--target-size);
  min-width: var(--target-size);
  padding: 0 var(--space-4);
  border: 1px solid var(--accent-solid);
  border-radius: var(--radius-control);
  background: var(--accent-solid);
  color: var(--text-on-accent);
  font-size: var(--font-size-control);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
jb-button:hover { background: var(--accent-solid-hover); border-color: var(--accent-solid-hover); }
jb-button[variant="secondary"] { background: var(--bg-surface); color: var(--text-primary); border-color: var(--border-strong); }
jb-button[variant="secondary"]:hover { background: var(--bg-muted); }
jb-button[aria-disabled="true"] { opacity: 0.5; cursor: default; }
jb-button:focus-visible, jb-field input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-halo);
}
jb-field { display: flex; flex-direction: column; gap: var(--space-1); margin: var(--space-2) 0; }
jb-field label { font-size: var(--font-size-caption); color: var(--text-secondary); }
jb-field input {
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-control);
}
.jb-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: var(--space-4); }
.jb-muted { color: var(--text-muted); }
.jb-secondary { color: var(--text-secondary); }
.jb-small { font-size: var(--font-size-small); }
.jb-caption { font-size: var(--font-size-caption); }
.jb-badge { display: inline-block; padding: 0 var(--space-2); border-radius: var(--radius-badge); background: var(--bg-muted); font-size: var(--font-size-small); }
.jb-success { color: var(--success); background: var(--success-bg); }
.jb-warning { color: var(--warning); background: var(--warning-bg); }
.jb-danger { color: var(--danger); background: var(--danger-bg); }
.jb-accent { color: var(--accent); background: var(--accent-bg); }
.jb-chart { display: block; width: 100%; height: auto; }
.jb-chart-bar { fill: var(--chart-stage); }
.jb-chart-bar.jb-good { fill: var(--chart-good); }
.jb-chart-bar.jb-bad { fill: var(--chart-bad); }
.jb-chart-bar.jb-amber { fill: var(--chart-amber); }
.jb-chart-bar.jb-violet { fill: var(--chart-violet); }
.jb-chart-line { fill: none; stroke: var(--chart-stage); stroke-width: 2; }
.jb-chart-axis { stroke: var(--chart-muted); stroke-width: 1; }
.jb-chart-label { fill: var(--text-secondary); font-size: var(--font-size-small); }
.jb-chart.jb-chart-probe { height: 0; overflow: hidden; visibility: hidden; }
`;

// PR 5 (spec 08 S9.5): the new chart kinds' marks, tones, legend and selectable targets.
const CHART_CSS = `
.jb-chart .jb-tone-stage { fill: var(--chart-stage); }
.jb-chart .jb-tone-good { fill: var(--chart-good); }
.jb-chart .jb-tone-bad { fill: var(--chart-bad); }
.jb-chart .jb-tone-amber { fill: var(--chart-amber); }
.jb-chart .jb-tone-violet { fill: var(--chart-violet); }
.jb-chart .jb-tone-muted { fill: var(--chart-muted); }
.jb-chart .jb-chart-line { fill: none; stroke: var(--chart-stage); stroke-width: 2; }
.jb-chart .jb-chart-line.jb-tone-good { stroke: var(--chart-good); }
.jb-chart .jb-chart-line.jb-tone-bad { stroke: var(--chart-bad); }
.jb-chart .jb-chart-line.jb-tone-amber { stroke: var(--chart-amber); }
.jb-chart .jb-chart-line.jb-tone-violet { stroke: var(--chart-violet); }
.jb-chart .jb-chart-line.jb-tone-muted { stroke: var(--chart-muted); }
.jb-chart .jb-chart-area { fill-opacity: 0.2; stroke: none; }
.jb-chart .jb-chart-ring { fill: none; stroke: var(--chart-muted); stroke-width: 28; opacity: 0.3; }
.jb-chart .jb-chart-total { fill: var(--text-primary); font-size: var(--font-size-control); font-weight: 700; }
.jb-chart .jb-chart-hit { fill: transparent; stroke: none; }
.jb-chart .jb-chart-target { cursor: pointer; }
.jb-chart-picks { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-2) 0 0; }
.jb-chart-pick { display: inline-flex; align-items: center; justify-content: center; min-height: var(--target-size); min-width: var(--target-size); padding: 0 var(--space-3); border: 1px solid var(--border-strong); border-radius: var(--radius-control); background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: var(--font-size-caption); cursor: pointer; }
.jb-chart-pick:hover { background: var(--bg-muted); }
.jb-chart-pick:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.jb-chart-legend { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); margin: var(--space-2) 0 0; padding: 0; list-style: none; font-size: var(--font-size-caption); color: var(--text-secondary); }
.jb-chart-legend li { display: inline-flex; align-items: center; gap: var(--space-2); }
.jb-chart-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: var(--chart-stage); }
.jb-chart-swatch.jb-tone-good { background: var(--chart-good); }
.jb-chart-swatch.jb-tone-bad { background: var(--chart-bad); }
.jb-chart-swatch.jb-tone-amber { background: var(--chart-amber); }
.jb-chart-swatch.jb-tone-violet { background: var(--chart-violet); }
.jb-chart-swatch.jb-tone-muted { background: var(--chart-muted); }
`;

// PR 5 (spec 08 S9.3): layout and text helpers. All classes, because the CSP refuses
// style="" attributes; script may still set a property through element.style.setProperty
// (the CSSOM is not an inline style attribute), which jb-meter__fill's width relies on.
// Every layout class collapses to one column below 520px of frame width (the one @media
// block at the end).
const LAYOUT_CSS = `
.jb-stack { display: flex; flex-direction: column; gap: var(--space-3); }
.jb-row { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.jb-gap-1 { gap: var(--space-1); }
.jb-gap-2 { gap: var(--space-2); }
.jb-gap-3 { gap: var(--space-3); }
.jb-gap-4 { gap: var(--space-4); }
.jb-gap-5 { gap: var(--space-5); }
.jb-gap-6 { gap: var(--space-6); }
.jb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
.jb-cols-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.jb-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
.jb-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
.jb-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); padding-bottom: var(--space-3); margin-bottom: var(--space-3); border-bottom: 1px solid var(--border); }
.jb-h1, .jb-h2, .jb-h3 { margin: 0 0 var(--space-2); font-weight: 700; line-height: 1.3; color: var(--text-primary); }
.jb-h1 { font-size: 20px; }
.jb-h2 { font-size: 18px; }
.jb-h3 { font-size: 16px; }
.jb-stat { display: flex; flex-direction: column; gap: var(--space-1); }
.jb-stat__value { font-size: 24px; font-weight: 700; line-height: 1.2; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.jb-stat__label { font-size: var(--font-size-caption); color: var(--text-secondary); }
.jb-divider { height: 0; margin: var(--space-3) 0; border: 0; border-top: 1px solid var(--border); }
.jb-scroll-x { max-width: 100%; overflow-x: auto; }
.jb-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-control); }
.jb-table caption { padding: 0 0 var(--space-2); text-align: start; font-weight: 600; color: var(--text-primary); }
.jb-table th, .jb-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border); text-align: start; vertical-align: middle; }
.jb-table th { font-size: var(--font-size-caption); font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.jb-table .jb-num { text-align: end; font-variant-numeric: tabular-nums; }
.jb-table__sort { display: inline-flex; align-items: center; gap: var(--space-1); min-height: var(--target-size); min-width: var(--target-size); margin: calc(var(--space-2) * -1) 0; padding: 0; border: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; }
.jb-table .jb-num .jb-table__sort { flex-direction: row-reverse; }
.jb-table__sort::after { content: "\\2195"; color: var(--text-muted); }
.jb-table th[aria-sort="ascending"] .jb-table__sort::after { content: "\\2191"; color: var(--text-primary); }
.jb-table th[aria-sort="descending"] .jb-table__sort::after { content: "\\2193"; color: var(--text-primary); }
.jb-table__row { cursor: pointer; }
.jb-table__row:hover { background: var(--bg-muted); }
.jb-table__row td { height: var(--target-size); }
.jb-table__more { display: inline-flex; align-items: center; justify-content: center; min-height: var(--target-size); min-width: var(--target-size); margin-top: var(--space-2); padding: 0 var(--space-4); border: 1px solid var(--border-strong); border-radius: var(--radius-control); background: var(--bg-surface); font: inherit; font-size: var(--font-size-control); color: var(--text-primary); cursor: pointer; }
.jb-table__more:hover { background: var(--bg-muted); }
.jb-table__sort:focus-visible, .jb-table__more:focus-visible, .jb-table__row:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.jb-timeline { list-style: none; margin: 0; padding: 0; }
.jb-timeline__item { position: relative; margin: 0; padding: 0 0 var(--space-4) var(--space-6); }
.jb-timeline__item::before { content: ""; position: absolute; left: 4px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-solid); }
.jb-timeline__item::after { content: ""; position: absolute; left: 8px; top: 20px; bottom: 0; width: 2px; background: var(--border-strong); }
.jb-timeline__item:last-child::after { display: none; }
.jb-meter { position: relative; height: 8px; overflow: hidden; border-radius: var(--radius-badge); background: var(--bg-muted); }
.jb-meter__fill { height: 100%; width: 0; border-radius: inherit; background: var(--accent-solid); }
.jb-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
.jb-hidden { display: none !important; }
@media (max-width: 520px) {
  .jb-row { flex-direction: column; align-items: stretch; }
  .jb-cols-2, .jb-cols-3, .jb-split, .jb-grid { grid-template-columns: minmax(0, 1fr); }
}
`;

// PR 5 (spec 08 S9.4): the control elements. Every target is at least 44px
// (--target-size); focus shows the same ring as jb-button.
const CONTROLS_CSS = `
jb-select, jb-slider, jb-toggle, jb-segmented, jb-tabs { display: block; margin: var(--space-2) 0; }
jb-select > option, jb-segmented > option { display: none; }
.jb-control__label { display: block; margin-bottom: var(--space-1); font-size: var(--font-size-caption); color: var(--text-secondary); }
.jb-select__button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: var(--target-size);
  min-width: var(--target-size);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--font-size-control);
  cursor: pointer;
  user-select: none;
}
.jb-select__caret::before { content: "\\25BE"; color: var(--text-secondary); }
.jb-select__list {
  position: relative;
  max-height: 264px;
  overflow-y: auto;
  margin-top: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  box-shadow: var(--shadow-popover);
}
.jb-select__option {
  display: flex;
  align-items: center;
  min-height: var(--target-size);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--text-primary);
  font-size: var(--font-size-control);
  cursor: pointer;
}
.jb-select__option[aria-selected="true"] { font-weight: 600; }
.jb-select__option.jb-active, .jb-select__option:hover { background: var(--bg-muted); }
.jb-slider__row { display: flex; align-items: center; gap: var(--space-3); }
.jb-slider__input {
  flex: 1 1 auto;
  min-width: var(--target-size);
  min-height: var(--target-size);
  margin: 0;
  accent-color: var(--accent-solid);
  cursor: pointer;
}
.jb-slider__value { min-width: 5ch; text-align: end; font-size: var(--font-size-control); font-variant-numeric: tabular-nums; color: var(--text-primary); }
.jb-toggle__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--target-size);
  min-width: var(--target-size);
  padding: 0 var(--space-1);
  border-radius: var(--radius-control);
  cursor: pointer;
  user-select: none;
}
.jb-toggle__track { position: relative; flex: none; width: 40px; height: 24px; border-radius: var(--radius-badge); background: var(--border-strong); transition: background var(--motion-fast) var(--ease-standard); }
.jb-toggle__thumb { position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg-surface); transition: transform var(--motion-fast) var(--ease-standard); }
.jb-toggle__switch[aria-checked="true"] .jb-toggle__track { background: var(--accent-solid); }
.jb-toggle__switch[aria-checked="true"] .jb-toggle__thumb { transform: translateX(16px); }
.jb-toggle__label { display: inline; margin: 0; font-size: var(--font-size-control); color: var(--text-primary); }
.jb-segmented__group { display: inline-flex; flex-wrap: wrap; gap: var(--space-1); padding: var(--space-1); border: 1px solid var(--border-strong); border-radius: var(--radius-control); background: var(--bg-muted); }
.jb-segmented__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--target-size);
  min-width: var(--target-size);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  font-size: var(--font-size-control);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.jb-segmented__option[aria-checked="true"] { background: var(--bg-surface); color: var(--text-primary); box-shadow: var(--elevation-card); }
jb-tab { display: block; padding-top: var(--space-3); }
jb-tab[hidden] { display: none; }
.jb-tabs__list { display: flex; flex-wrap: wrap; gap: var(--space-1); border-bottom: 1px solid var(--border); }
.jb-tabs__tab {
  display: inline-flex;
  align-items: center;
  min-height: var(--target-size);
  min-width: var(--target-size);
  padding: 0 var(--space-3);
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-control);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.jb-tabs__tab[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent-solid); }
.jb-select__button:focus-visible, .jb-slider__input:focus-visible, .jb-toggle__switch:focus-visible, .jb-segmented__option:focus-visible,
.jb-tabs__tab:focus-visible, jb-tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-halo);
}
@media (prefers-reduced-motion: reduce) {
  .jb-toggle__track, .jb-toggle__thumb { transition: none; }
}
`;

export const KIT_CSS: string =
  tokenBlock(":root", KIT_TOKENS.light) + tokenBlock(':root[data-theme="dark"]', KIT_TOKENS.dark) + BASE_CSS + CHART_CSS + LAYOUT_CSS + CONTROLS_CSS;

// Plain ES2017 in a string: it is never bundled, it runs inside the frame. No "//"
// anywhere in it (the static check reads "//" as a URL), so comments are /* */.
export const KIT_JS: string = `(function () {
  "use strict";
  /* First statement, before any byte of the model's code can run: take both CSP meta elements
     out, so the policy text (and its hash list) cannot be read back. A meta CSP stays
     enforced after the element is removed. */
  (function () {
    var metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    for (var i = 0; i < metas.length; i++) {
      if (metas[i].parentNode) metas[i].parentNode.removeChild(metas[i]);
    }
  })();

  /* Trusted Types (the second policy requires them for script sinks): the only allowed policy
     is this default one, created here before the model's code runs. Script URLs always throw,
     script text is refused, and HTML passes unless it would make a nested frame or a script. */
  var FRAME_MARKUP_RE = /<(?:script|iframe|frame|object|embed|portal|fencedframe|link|meta|base)\\b/i;
  if (window.trustedTypes && typeof window.trustedTypes.createPolicy === "function") {
    try {
      window.trustedTypes.createPolicy("default", {
        createHTML: function (s) {
          s = String(s);
          if (FRAME_MARKUP_RE.test(s)) throw new TypeError("markup for scripts and frames is blocked");
          return s;
        },
        createScript: function () { return null; },
        createScriptURL: function () { throw new TypeError("script URLs are blocked"); }
      });
    } catch (err) { /* a policy already exists: nothing more to add */ }
  }

  /* No document.write, and no nested browsing contexts made through createElement. */
  function deny() { throw new TypeError("not available in this view"); }
  function lock(proto, name, value) {
    try { Object.defineProperty(proto, name, { value: value, writable: false, configurable: false }); } catch (err) { /* already locked */ }
  }
  /* Frame elements, and (Task 2.7, CI run 1) link, meta and base: a resource hint, a refresh
     or a base URL made by script would act before any CSP check (WebKit opened a TCP
     connection for a link hint). */
  var BLOCKED_ELEMENTS = { iframe: 1, frame: 1, object: 1, embed: 1, portal: 1, fencedframe: 1, link: 1, meta: 1, base: 1 };
  function guardCreate(name, nameArg) {
    var original = Document.prototype[name];
    if (typeof original !== "function") return;
    lock(Document.prototype, name, function () {
      var tag = String(arguments[nameArg] == null ? "" : arguments[nameArg]).toLowerCase();
      tag = tag.slice(tag.lastIndexOf(":") + 1);
      if (Object.prototype.hasOwnProperty.call(BLOCKED_ELEMENTS, tag)) throw new TypeError(tag + " elements are blocked");
      return original.apply(this, arguments);
    });
  }
  lock(Document.prototype, "write", deny);
  lock(Document.prototype, "writeln", deny);
  guardCreate("createElement", 0);
  guardCreate("createElementNS", 1);

  /* Task 2.7, CI run 1: no new windows, and no WebRTC. CSP's connect-src does not govern
     WebRTC, and the sandbox let STUN and TURN traffic out in Chromium and WebKit. Each
     constructor becomes one that throws, non-configurable, on the window (where model code
     finds them) and on the window's prototype if a browser keeps one there; the methods that
     start ICE are locked on the real prototypes first, in case a reference survives. The
     names are built from parts so the kit itself still passes checkV3Static. */
  var rtc = "RTC";
  var RTC_METHODS = ["createOffer", "createAnswer", "setLocalDescription", "setRemoteDescription", "addIceCandidate",
    "createDataChannel", "addTrack", "addTransceiver", "restartIce", "setConfiguration"];
  var RTC_NAMES = [rtc + "PeerConnection", "webkit" + rtc + "PeerConnection", rtc + "DataChannel", rtc + "IceCandidate",
    rtc + "SessionDescription"];
  var globalProto = Object.getPrototypeOf(window);
  for (var r = 0; r < RTC_NAMES.length; r++) {
    var existing = window[RTC_NAMES[r]];
    if (typeof existing === "function" && existing.prototype) {
      for (var m = 0; m < RTC_METHODS.length; m++) {
        if (typeof existing.prototype[RTC_METHODS[m]] === "function") lock(existing.prototype, RTC_METHODS[m], deny);
      }
    }
    lock(window, RTC_NAMES[r], deny);
    if (globalProto && Object.prototype.hasOwnProperty.call(globalProto, RTC_NAMES[r])) lock(globalProto, RTC_NAMES[r], deny);
  }
  lock(window, "open", deny);
  if (globalProto && Object.prototype.hasOwnProperty.call(globalProto, "open")) lock(globalProto, "open", deny);

  /* Task 2.7, CI run 2: links. The static check refuses href attributes in the markup, but
     model script can still give an element one at run time and click it. So every click and
     auxclick is seen first, in the capture phase on the window (before any listener the
     model can add), and one whose path holds an element with an href is cancelled: no link
     is followed, in any target. And an observer strips href from every element as it is
     added or given one, so no link stays around to be hovered, pressed or preconnected.
     Shadow roots are made open and observed too, so no link hides in one; declarative
     shadow roots are refused by the static check, and the two parsers that make them at run
     time throw. Every native used later is taken now, before model code can replace it. */
  var uncurry = deny.bind.bind(deny.call);
  function getterOf(proto, name) {
    var d = proto ? Object.getOwnPropertyDescriptor(proto, name) : null;
    return d && typeof d.get === "function" ? uncurry(d.get) : null;
  }
  var cancelEvent = uncurry(Event.prototype.preventDefault);
  var eventPath = uncurry(Event.prototype.composedPath);
  var nodeTypeOf = getterOf(Node.prototype, "nodeType");
  var attributeNames = uncurry(Element.prototype.getAttributeNames);
  var dropAttribute = uncurry(Element.prototype.removeAttribute);
  var findAll = uncurry(Element.prototype.querySelectorAll);
  var listLength = getterOf(NodeList.prototype, "length");
  var lowerCase = uncurry("".toLowerCase);
  var sliceText = uncurry("".slice);
  /* PR 5 (spec 08 S9): the natives the controls and the host helpers use, taken now, before
     model code can replace them. createElement and createElementNS are the locked guards
     above. */
  function setterOf(proto, name) {
    var d = proto ? Object.getOwnPropertyDescriptor(proto, name) : null;
    return d && typeof d.set === "function" ? uncurry(d.set) : null;
  }
  var makeEl = uncurry(Document.prototype.createElement);
  var makeElNS = uncurry(Document.prototype.createElementNS);
  var makeText = uncurry(Document.prototype.createTextNode);
  var appendTo = uncurry(Node.prototype.appendChild);
  var insertInto = uncurry(Node.prototype.insertBefore);
  var removeFrom = uncurry(Node.prototype.removeChild);
  var firstChildOf = getterOf(Node.prototype, "firstChild");
  var setText = setterOf(Node.prototype, "textContent");
  var getText = getterOf(Node.prototype, "textContent");
  var setAttr = uncurry(Element.prototype.setAttribute);
  var getAttr = uncurry(Element.prototype.getAttribute);
  var hasAttr = uncurry(Element.prototype.hasAttribute);
  var childrenOf = getterOf(Element.prototype, "children");
  var collectionLength = getterOf(HTMLCollection.prototype, "length");
  var localNameOf = getterOf(Element.prototype, "localName");
  var listen = uncurry(EventTarget.prototype.addEventListener);
  var dispatch = uncurry(EventTarget.prototype.dispatchEvent);
  var stopEvent = uncurry(Event.prototype.stopPropagation);
  var focusHtml = uncurry(HTMLElement.prototype.focus);
  var focusSvg = typeof SVGElement === "function" && typeof SVGElement.prototype.focus === "function" ? uncurry(SVGElement.prototype.focus) : null;
  var readyStateOf = getterOf(Document.prototype, "readyState");
  var offsetTopOf = getterOf(HTMLElement.prototype, "offsetTop");
  var offsetHeightOf = getterOf(HTMLElement.prototype, "offsetHeight");
  var clientHeightOf = getterOf(Element.prototype, "clientHeight");
  var scrollTopOf = getterOf(Element.prototype, "scrollTop");
  var setScrollTop = setterOf(Element.prototype, "scrollTop");
  var inputValueOf = getterOf(HTMLInputElement.prototype, "value");
  var setInputValue = setterOf(HTMLInputElement.prototype, "value");
  var trimText = uncurry("".trim);
  var numberText = uncurry((0).toLocaleString);
  var fixedText = uncurry((0).toFixed);
  var sortList = uncurry([].sort);
  var sliceList = uncurry([].slice);
  var joinList = uncurry([].join);
  var textOf = String;
  var hasOwn = uncurry(Object.prototype.hasOwnProperty);
  var ownKeys = Object.keys;
  var freeze = Object.freeze;
  var isList = Array.isArray;
  var finite = isFinite;
  var toNumber = Number;
  var M = { max: Math.max, min: Math.min, round: Math.round, floor: Math.floor, abs: Math.abs, sin: Math.sin, cos: Math.cos, PI: Math.PI };
  var ChangeEvent = CustomEvent;
  var queueTask = setTimeout;
  var defer = typeof queueMicrotask === "function" ? queueMicrotask : function (f) { queueTask(f, 0); };
  function isElement(node) {
    try { return nodeTypeOf(node) === 1; } catch (err) { return false; }
  }
  /* The names of an element's link attributes: href, and any prefixed href such as xlink:href. */
  function linkAttributes(el) {
    var names;
    try { names = attributeNames(el); } catch (err) { return []; }
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var n = lowerCase(names[i]);
      if (n === "href" || sliceText(n, -5) === ":href") out[out.length] = names[i];
    }
    return out;
  }
  function stripLinks(el) {
    var names = linkAttributes(el);
    for (var i = 0; i < names.length; i++) {
      try { dropAttribute(el, names[i]); } catch (err) { /* nothing more to do */ }
    }
  }
  function stripTree(el) {
    stripLinks(el);
    var found;
    try { found = findAll(el, "[*|href]"); } catch (err) { return; }
    var n = listLength(found);
    for (var i = 0; i < n; i++) stripLinks(found[i]);
  }
  function guardLink(e) {
    var path;
    try { path = eventPath(e); } catch (err) { return; }
    for (var i = 0; i < path.length; i++) {
      if (isElement(path[i]) && linkAttributes(path[i]).length > 0) { cancelEvent(e); return; }
    }
  }
  window.addEventListener("click", guardLink, true);
  window.addEventListener("auxclick", guardLink, true);

  var WATCH = { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] };
  var watcher = null;
  var watch = null;
  if (typeof MutationObserver === "function") {
    var recordType = getterOf(MutationRecord.prototype, "type");
    var recordTarget = getterOf(MutationRecord.prototype, "target");
    var recordAdded = getterOf(MutationRecord.prototype, "addedNodes");
    watcher = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (recordType(r) === "attributes") { stripLinks(recordTarget(r)); continue; }
        var added = recordAdded(r);
        var n = listLength(added);
        for (var j = 0; j < n; j++) if (isElement(added[j])) stripTree(added[j]);
      }
    });
    watch = uncurry(MutationObserver.prototype.observe);
    watch(watcher, document, WATCH);
  }
  var attachShadowNative = Element.prototype.attachShadow;
  if (typeof attachShadowNative === "function") {
    var attachShadowCall = uncurry(attachShadowNative);
    lock(Element.prototype, "attachShadow", function (init) {
      var options = { mode: "open" };
      if (init && typeof init === "object") {
        if (init.delegatesFocus) options.delegatesFocus = true;
        if (init.slotAssignment === "manual") options.slotAssignment = "manual";
      }
      var root = attachShadowCall(this, options);
      if (watcher) watch(watcher, root, WATCH);
      return root;
    });
  }
  lock(Element.prototype, "setHTMLUnsafe", deny);
  if (typeof ShadowRoot === "function") lock(ShadowRoot.prototype, "setHTMLUnsafe", deny);
  lock(Document, "parseHTMLUnsafe", deny);

  var state ={ data: null, theme: "light", inited: false, waiting: [], reported: false, height: -1 };
  var CHART_POINTS_MAX = 50;
  var LABEL_MAX = 40;
  var channel = new MessageChannel();
  var port = channel.port1;
  /* Taken now, so model code that replaces MessagePort.prototype.postMessage cannot silence the kit. */
  var portSend = uncurry(MessagePort.prototype.postMessage);

  function post(msg) {
    try { portSend(port, msg); } catch (err) { /* an uncloneable value: nothing is sent */ }
  }
  function clip(value, max) {
    var s = textOf(value == null ? "" : value);
    return s.length > max ? sliceText(s, 0, max) : s;
  }
  function report(message) {
    if (state.reported) return;
    state.reported = true;
    post({ type: "error", message: clip(message || "error", 500) });
  }
  function errorText(value) {
    if (value && typeof value === "object" && typeof value.message === "string") return value.message;
    return String(value);
  }

  /* Polish fix 1 (spec 08 S11): the browser's ResizeObserver loop notification is not a frame
     error. Chrome, Edge and Firefox fire an error event on the window, with no error object,
     when a ResizeObserver callback changes layout that another observer must then wait a frame
     for ("ResizeObserver loop completed with undelivered notifications."; older engines
     "ResizeObserver loop limit exceeded"). Nothing failed: the late notifications are delivered
     in the next frame. Any view's own ResizeObserver can trip it, so an event whose error is
     null or undefined and whose message starts with "ResizeObserver loop" is not reported; every
     other error event is reported as before. The ErrorEvent getters are taken now, before model
     code can replace them; an event they cannot read (not an ErrorEvent) is reported. */
  var errorMessageOf = typeof ErrorEvent === "function" ? getterOf(ErrorEvent.prototype, "message") : null;
  var errorValueOf = typeof ErrorEvent === "function" ? getterOf(ErrorEvent.prototype, "error") : null;
  var RO_LOOP = "ResizeObserver loop";
  function resizeLoopNotice(e) {
    if (!errorMessageOf || !errorValueOf) return false;
    try {
      var message = errorMessageOf(e);
      return errorValueOf(e) == null && typeof message === "string" && sliceText(message, 0, RO_LOOP.length) === RO_LOOP;
    } catch (err) { return false; }
  }
  window.addEventListener("error", function (e) {
    if (resizeLoopNotice(e)) return;
    report(e && e.message ? e.message : "script error");
  });
  window.addEventListener("unhandledrejection", function (e) { report(errorText(e ? e.reason : null)); });

  /* Task 2.7, CI run 2: tell the host at once when this document starts to leave. WebKit does
     not commit a navigation whose response never finishes, so the old document stays and
     keeps answering pings; the host now tears down on this message instead. Both listeners
     are registered here, before model code, in the capture phase, so a listener the model
     adds later (capture or not, with stopImmediatePropagation or an on... handler) runs
     after them. The Navigation API's navigate event is used where it exists, for
     navigations to another document only. pagehide is not used: it fires only when the new
     document commits (when the second load already tells the host), and it also fires
     when the host page itself unloads, which must not be reported as a failure. */
  var announced = false;
  function leaving() {
    if (announced) return;
    announced = true;
    post({ type: "navigating" });
  }
  window.addEventListener("beforeunload", leaving, true);
  var navigationApi = window.navigation;
  if (navigationApi && typeof navigationApi.addEventListener === "function") {
    var destinationOf = typeof NavigateEvent === "function" ? getterOf(NavigateEvent.prototype, "destination") : null;
    var sameDocumentOf = typeof NavigationDestination === "function" ? getterOf(NavigationDestination.prototype, "sameDocument") : null;
    navigationApi.addEventListener("navigate", function (e) {
      try {
        if (destinationOf && sameDocumentOf && sameDocumentOf(destinationOf(e)) === true) return;
      } catch (err) { /* unreadable: treat it as leaving */ }
      leaving();
    }, true);
  }

  /* PR 3 (spec 08 S9.2): Escape leaves an expanded view, also when focus is in this frame,
     where the host page gets no key events. The listener is registered here, before model
     code, in the capture phase, so a model listener cannot stop it from running. Only a
     trusted key press counts (isTrusted cannot be redefined by page script), so model code
     cannot close the view by dispatching one. Whether the document handled the key
     (preventDefault, for a menu of its own) is read once the event has finished
     dispatching, with natives taken now. */
  var keyOf = getterOf(KeyboardEvent.prototype, "key");
  var preventedOf = getterOf(Event.prototype, "defaultPrevented");
  var later = setTimeout;
  /* The close function of the open <jb-select> popup, if one is open (PR 5, S9.2). */
  var openPopup = null;
  window.addEventListener("keydown", function (e) {
    var trusted = false;
    var key = "";
    try {
      trusted = e.isTrusted === true;
      key = keyOf ? keyOf(e) : "";
    } catch (err) { return; }
    if (!trusted || key !== "Escape") return;
    /* PR 5 (spec 08 S9.2): with a <jb-select> popup open, Escape closes the popup, here,
       before any model listener can stop the event, and posts nothing. */
    if (openPopup) {
      var closePopup = openPopup;
      openPopup = null;
      try { closePopup(); } catch (err) { /* nothing more to do */ }
      try { cancelEvent(e); } catch (err) { /* nothing more to do */ }
      return;
    }
    later(function () {
      try { if (!preventedOf || preventedOf(e)) return; } catch (err) { return; }
      post({ type: "escape" });
    }, 0);
  }, true);

  /* PR 6 (spec 08 S10.2, layer 1): host.ask posts only while the user has just acted. This is
     a filter that stops asks on load and in loops, not the control: the host never sends an
     ask without a press on its own Send.
     Fix round 2 (CI run 46111454100): navigator.userActivation.isActive alone is not evidence
     of input. Browser automation grants transient activation to a frame whenever it evaluates
     script there (Playwright sends userGesture: true on Chromium and emulateUserGesture: true
     on WebKit with every evaluation, and Firefox reported activation with no input too), so
     isActive was true on load in all three engines. The gate is therefore the kit's own flag,
     always: set by a trusted (isTrusted) activation-triggering input event (keydown or keyup
     of Enter or Space, mousedown, pointerdown, pointerup, touchend) seen in the capture phase
     on the window before any model listener, and cleared 1,000 ms later. Polish wave, M2: only
     the two keys that activate a control count, so typing in a <jb-field>, Tab, the arrows and
     Escape do not arm it. Script cannot make
     a trusted event, and evaluation by a debugger makes none. Where the browser has
     navigator.userActivation, isActive must be true as well; its getter is taken now, from the
     object's own prototype, before model code can replace either, and a value model code later
     puts on the object is never read. */
  var ACTIVATION_MS = 1000;
  var activation = null;
  var activeOf = null;
  try {
    var nav = window.navigator;
    var found = nav ? nav.userActivation : null;
    if (found && typeof found === "object") {
      activeOf = getterOf(Object.getPrototypeOf(found), "isActive");
      if (activeOf) activation = found;
    }
  } catch (err) { activation = null; activeOf = null; }
  var armed = false;
  var armCount = 0;
  var armOnTrusted = function (e) {
    try {
      /* isTrusted is an unforgeable own property of each event: page script cannot redefine it. */
      if (e.isTrusted !== true) return;
      if (e.type === "keydown" || e.type === "keyup") {
        var pressed = keyOf ? keyOf(e) : "";
        if (pressed !== "Enter" && pressed !== " " && pressed !== "Spacebar") return;
      }
    } catch (err) { return; }
    armed = true;
    armCount += 1;
    var mine = armCount;
    later(function () { if (armCount === mine) armed = false; }, ACTIVATION_MS);
  };
  var ARM_EVENTS = ["keydown", "keyup", "mousedown", "pointerdown", "pointerup", "touchend"];
  for (var ae = 0; ae < ARM_EVENTS.length; ae++) window.addEventListener(ARM_EVENTS[ae], armOnTrusted, true);
  function userActive() {
    if (!armed) return false;
    if (activation !== null) {
      try { return activeOf(activation) === true; } catch (err) { return false; }
    }
    return true;
  }
  /* PR 6 review, minor 6: the same normalisation the host applies (bridge.ts
     normalizeAskText, its character class shared as source text), so host.ask returns false,
     and posts nothing, for a text the host would drop: empty once normalised, or over
     ASK_TEXT_MAX code points. The text posted is the normalised one, so its length in UTF-16
     units cannot trip the host's parser either. A filter only: the host normalises again. */
  var ASK_TEXT_MAX = ${ASK_TEXT_MAX};
  var askInvisible = null;
  try { askInvisible = new RegExp(${JSON.stringify(ASK_INVISIBLE_SOURCE)}, "gu"); } catch (err) { askInvisible = null; }
  var normalizeText = uncurry("".normalize);
  var replaceText = uncurry("".replace);
  var trimText = uncurry("".trim);
  var codeUnitAt = uncurry("".charCodeAt);
  function askText(raw) {
    if (askInvisible === null) return null;
    var s = normalizeText(raw, "NFC");
    s = replaceText(s, askInvisible, "");
    s = replaceText(s, /\\s+/g, " ");
    s = replaceText(s, /[\\u0000-\\u001F\\u007F-\\u009F]/g, "");
    s = replaceText(s, / {2,}/g, " ");
    s = normalizeText(trimText(s), "NFC");
    if (s.length === 0) return null;
    var points = 0;
    for (var i = 0; i < s.length; i++) {
      var u = codeUnitAt(s, i);
      if (u >= 0xd800 && u <= 0xdbff && i + 1 < s.length) {
        var next = codeUnitAt(s, i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) i += 1;
      }
      points += 1;
      if (points > ASK_TEXT_MAX) return null;
    }
    return s;
  }
  function ask(text) {
    if (!userActive()) return false;
    var s;
    try { s = askText(textOf(text)); } catch (err) { return false; }
    if (s === null) return false;
    post({ type: "ask", text: s });
    return true;
  }

  function run(cb) {
    try { cb(state.data, state.theme); } catch (err) { report(errorText(err)); }
  }
  port.onmessage = function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    /* Liveness: the host pings over the port and expects the same number back. */
    if (m.type === "ping") {
      post({ type: "pong", n: typeof m.n === "number" && isFinite(m.n) ? m.n : 0 });
      return;
    }
    /* The page's theme changed: only after init, and only to one of the two themes. */
    if (m.type === "theme") {
      if (state.inited && (m.theme === "light" || m.theme === "dark")) {
        state.theme = m.theme;
        document.documentElement.setAttribute("data-theme", state.theme);
      }
      return;
    }
    if (state.inited || m.type !== "init") return;
    state.inited = true;
    state.data = m.data === undefined ? null : m.data;
    state.theme = m.theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", state.theme);
    /* The ack goes out before any onInit callback runs, so a slow callback cannot hold it. */
    post({ type: "inited" });
    var waiting = state.waiting;
    state.waiting = [];
    for (var i = 0; i < waiting.length; i++) run(waiting[i]);
  };
  /* ready goes out now, before any script of the document runs, with the port the rest of the talk uses. */
  try { parent.postMessage({ type: "ready" }, "*", [channel.port2]); } catch (err) { /* no host: nothing to do */ }

  /* Inline SVG only. The SVG namespace comes from a parsed element, so no URL is written here.
     PR 5: the namespace is read now, while the natives are still the browser's own. */
  var svgNamespace = (function () {
    var holder = document.createElement("div");
    holder.innerHTML = "<svg></svg>";
    return holder.firstChild.namespaceURI;
  })();

  /* Polish wave, item A (spec 08 S9.5): a chart is drawn in user units that are CSS px. The
     chart's SVG used to keep a 320-unit viewBox and scale to its element, so at 1000px its text
     was three times its CSS size. drawChart now measures the width its element gives a chart
     and draws at that width, and each chart's ResizeObserver redraws it when the width changes,
     so the SVG is not scaled and its text (labels, values, the donut's total) renders at its CSS
     font size at any frame width. Each kind keeps a fixed height, so a redraw never changes the
     document's height. Where the width cannot be measured yet (the element is hidden, or there
     is no layout) the chart is drawn at the reference width of 320, as before, and redrawn once
     it can be. Label widths come from the browser's own text measure on a hidden probe in the
     same element (so the view's own CSS for chart text counts), or from an estimate where there
     is none. Every native used here is taken now, before model code runs (S9). */
  var CHART_REF_W = 320;
  var CHART_MIN_W = 120;
  var CHART_MAX_W = 4000;
  var LABEL_FONT_PX = ${LABEL_FONT_PX};
  var LABEL_GAP = 8;
  var BAR_MAX_W = 112;
  var rectOf = uncurry(Element.prototype.getBoundingClientRect);
  var rectWidth = typeof DOMRectReadOnly === "function" ? getterOf(DOMRectReadOnly.prototype, "width") : null;
  var textLengthNative = typeof SVGTextContentElement === "function" && typeof SVGTextContentElement.prototype.getComputedTextLength === "function"
    ? uncurry(SVGTextContentElement.prototype.getComputedTextLength) : null;
  var SizeWatch = typeof ResizeObserver === "function" ? ResizeObserver : null;
  var observeSize = SizeWatch ? uncurry(SizeWatch.prototype.observe) : null;
  var disconnectSize = SizeWatch ? uncurry(SizeWatch.prototype.disconnect) : null;
  /* Polish fix 1 (C1, I1, m1): the chart's SVG height is pinned in CSS px through the CSSOM
     (which the frame's CSP allows, unlike a style attribute in markup), a width-only redraw
     swaps the SVG in place, and one chart is kept per element. */
  var styleOfSvg = typeof SVGElement === "function" ? getterOf(SVGElement.prototype, "style") : null;
  var setStyleProperty = typeof CSSStyleDeclaration === "function" ? uncurry(CSSStyleDeclaration.prototype.setProperty) : null;
  var parentOf = getterOf(Node.prototype, "parentNode");
  var nextSiblingOf = getterOf(Node.prototype, "nextSibling");
  var chartsOn = typeof WeakMap === "function" ? new WeakMap() : null;
  var chartOnGet = chartsOn ? uncurry(WeakMap.prototype.get) : null;
  var chartOnSet = chartsOn ? uncurry(WeakMap.prototype.set) : null;
  function widthOf(el) {
    var w = 0;
    try {
      var r = rectOf(el);
      try { w = rectWidth(r); } catch (err) { w = r ? r.width : 0; }
    } catch (err) { w = 0; }
    return typeof w === "number" && finite(w) && w > 0 ? w : 0;
  }
  /* The width a chart is drawn at for an element w CSS px wide (0: not measured). */
  function chartWidthFor(w) {
    return w > 0 ? M.min(CHART_MAX_W, M.max(CHART_MIN_W, M.round(w * 10) / 10)) : CHART_REF_W;
  }
  /* A hidden SVG in the element: its width is the width a chart there gets (the chart's SVG is
     width: 100%), and its text measures label widths with the chart's own classes. */
  function chartProbe(el, before) {
    var svg = svgNode("svg", { "class": "jb-chart jb-chart-probe", "aria-hidden": "true" });
    var text = svgNode("text", { x: 0, y: 0, "class": "jb-chart-label" });
    appendTo(svg, text);
    if (before) insertInto(el, svg, before); else appendTo(el, svg);
    var width = widthOf(svg);
    var cache = {};
    function measure(s) {
      var key = "k" + s;
      if (hasOwn(cache, key)) return cache[key];
      var n = 0;
      if (textLengthNative && width > 0) {
        try { setText(text, s); n = textLengthNative(text); } catch (err) { n = 0; }
      }
      if (!(typeof n === "number" && finite(n) && n > 0)) n = s.length * LABEL_FONT_PX * 0.6;
      cache[key] = n;
      return n;
    }
    return { svg: svg, width: width, measure: measure };
  }
  /* s cut to its first n UTF-16 units, never inside a surrogate pair, without trailing space. */
  function cutAt(s, n) {
    if (n > 0 && n < s.length) {
      var u = codeUnitAt(s, n - 1);
      if (u >= 0xd800 && u <= 0xdbff) n -= 1;
    }
    return trimText(sliceText(s, 0, n));
  }
  /* s, or s cut with an ellipsis to fit room CSS px; kept is how many units of s are shown. */
  function cutText(s, room, measure) {
    if (measure(s) <= room) return { text: s, kept: s.length, cut: false };
    var lo = 0;
    var hi = s.length - 1;
    while (lo < hi) {
      var mid = M.floor((lo + hi + 1) / 2);
      if (measure(cutAt(s, mid) + "\\u2026") <= room) lo = mid; else hi = mid - 1;
    }
    var shown = lo > 0 ? cutAt(s, lo) : "";
    return { text: shown === "" ? "" : shown + "\\u2026", kept: shown.length, cut: true };
  }
  /* Category labels under the plot. Text is drawn at its CSS size, so whether labels fit is
     decided in CSS px, with LABEL_GAP between neighbours and none past the chart's edges:
     one row of every label if they fit; else two staggered rows (each label then has two
     slots); else every k-th label in two rows, k the smallest that leaves each shown label at
     least four characters, each cut with an ellipsis to its room. A cut label keeps its full
     text in a <title>, and every label is in the hidden table either way. */
  function labelPlan(labels, step, W, measure) {
    var n = labels.length;
    function centre(i) { return step * i + step / 2; }
    function layout(every, rows, texts) {
      var out = [];
      var right = [-1e9, -1e9];
      for (var i = 0, j = 0; i < n; i += every, j++) {
        var w = measure(texts[i]);
        if (w > W) return null;
        var x = M.max(w / 2, M.min(W - w / 2, centre(i)));
        var row = rows === 2 ? j % 2 : 0;
        if (texts[i] !== "" && x - w / 2 < right[row] + LABEL_GAP) return null;
        if (texts[i] !== "") right[row] = x + w / 2;
        out[out.length] = { index: i, x: x, row: row, text: texts[i], full: texts[i] === labels[i] ? null : labels[i] };
      }
      return { rows: rows, every: every, items: out };
    }
    if (n === 0) return { rows: 1, every: 1, items: [] };
    var plan = layout(1, 1, labels) || layout(1, 2, labels);
    if (plan) return plan;
    for (var every = 1; every <= n; every++) {
      if (every > 1) {
        plan = layout(every, 2, labels);
        if (plan) return plan;
      }
      /* Each shown label's room: two of its slots, less the gap; less near an edge, where the
         label cannot be centred on its slot and moves in towards its neighbour. */
      var room = M.min(W, 2 * every * step - LABEL_GAP);
      var texts = [];
      var ok = true;
      for (var i = 0; i < n; i++) {
        if (i % every !== 0) { texts[i] = labels[i]; continue; }
        var edge = M.min(centre(i), W - centre(i)) + every * step - LABEL_GAP / 2;
        var c = cutText(labels[i], M.min(room, edge), measure);
        if (c.kept < M.min(4, labels[i].length)) { ok = false; break; }
        texts[i] = c.text;
      }
      if (!ok) continue;
      plan = layout(every, 2, texts);
      if (plan) return plan;
    }
    var only = cutText(labels[0], W, measure);
    return { rows: 1, every: n, items: [{ index: 0, x: W / 2, row: 0, text: only.text, full: only.cut ? labels[0] : null }] };
  }
  /* The base line's y and the labels' baselines for a plan, in a chart H units tall. */
  function labelBand(plan, H) {
    var two = plan !== null && plan.rows === 2;
    return { base: two ? H - 38 : H - 24, rowY: two ? [H - 20, H - 6] : [H - 6, H - 6] };
  }
  function drawLabels(svg, plan, band, legacy) {
    for (var i = 0; i < plan.items.length; i++) {
      var p = plan.items[i];
      if (p.text === "") continue;
      var y = band.rowY[p.row];
      var t = svgNode("text", { x: fx(p.x), y: legacy ? textOf(y) : fx(y), "text-anchor": "middle", "class": "jb-chart-label" });
      setText(t, p.text);
      if (p.full !== null) tip(t, p.full);
      appendTo(svg, t);
    }
  }
  /* A bar's width and left inset in a slot step wide: 70% of the slot, at most BAR_MAX_W. */
  function barFit(step) {
    var w = step * 0.7;
    return w > BAR_MAX_W ? { width: BAR_MAX_W, inset: (step - BAR_MAX_W) / 2 } : { width: w, inset: step * 0.15 };
  }

  /* bar, line and sparkline (and the bar drawing any other unknown viz name falls back to):
     at the reference width, with labels that fit one row, the drawing is the one from before
     PR 5, unchanged for the same input, so stored documents render as before
     (kit.behaviour.test.ts holds the snapshots). Polish wave, item A: at any other width it is
     drawn at that width, bars stop growing at BAR_MAX_W, and labels that would touch are
     staggered, thinned or cut (labelPlan). PR 5 adds, beside it, the hidden data table, and
     with onSelect a target per point. */
  function legacyChart(spec, fmt, g) {
    var raw = isList(spec.points) ? sliceList(spec.points, 0, CHART_POINTS_MAX) : [];
    var points = [];
    var max = 0;
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i] && typeof raw[i] === "object" ? raw[i] : {};
      var v = typeof p.value === "number" && finite(p.value) && p.value > 0 ? p.value : 0;
      if (v > max) max = v;
      points[points.length] = { label: clip(p.label, LABEL_MAX), value: v };
    }
    if (max <= 0) max = 1;
    var W = g.W, H = 160;
    var n = M.max(points.length, 1);
    var step = W / n;
    var labels = [];
    for (var l = 0; l < points.length; l++) labels[l] = points[l].label;
    var plan = spec.viz === "sparkline" ? null : labelPlan(labels, step, W, g.measure);
    var band = labelBand(plan, H);
    var BASE = band.base, PLOT = BASE - 12;
    var svg = chartSvg(W, H, spec.title);
    appendTo(svg, svgNode("line", { x1: 0, y1: BASE, x2: W, y2: BASE, "class": "jb-chart-axis" }));
    if (spec.viz === "line" || spec.viz === "sparkline") {
      var coords = [];
      for (var j = 0; j < points.length; j++) coords[j] = fx(step * j + step / 2) + "," + fx(BASE - (points[j].value / max) * PLOT);
      appendTo(svg, svgNode("polyline", { points: joinList(coords, " "), "class": "jb-chart-line" }));
    } else {
      var fit = barFit(step);
      for (var b = 0; b < points.length; b++) {
        var h = (points[b].value / max) * PLOT;
        var bar = svgNode("rect", { x: fx(step * b + fit.inset), y: fx(BASE - h), width: fx(fit.width), height: fx(h), "class": "jb-chart-bar" });
        tip(bar, points[b].label + ": " + points[b].value);
        appendTo(svg, bar);
      }
    }
    if (plan) drawLabels(svg, plan, band, true);
    var onSelect = typeof spec.onSelect === "function" ? spec.onSelect : null;
    var rows = [];
    for (var r = 0; r < points.length; r++) {
      rows[rows.length] = [points[r].label, fmt(points[r].value)];
      if (!onSelect) continue;
      var info = { label: points[r].label, value: points[r].value, series: null, index: r };
      if (spec.viz === "line" || spec.viz === "sparkline") {
        var mark = pointTarget(step * r + step / 2, BASE - (points[r].value / max) * PLOT, "stage");
        selectable(mark, info, onSelect, fmt);
        appendTo(svg, mark);
      } else {
        var hit = svgNode("rect", { x: fx(step * r), y: 0, width: fx(step), height: BASE, "class": "jb-chart-hit" });
        selectable(hit, info, onSelect, fmt);
        appendTo(svg, hit);
      }
    }
    return { svg: svg, legend: null, head: ["Label", "Value"], rows: rows };
  }

  /* PR 5 (spec 08 S9.5): hbar, stacked, area, scatter and donut. Inline SVG named by the
     title (role img, or group when onSelect makes the marks buttons), a visually hidden
     data table for screen readers, and a legend for more than one series. Caps: 8 series
     and 200 points in all; more is clipped. tone is one of the --chart-* colours. */
  var SERIES_MAX = 8;
  var CHART_TOTAL_MAX = 200;
  var CHART_TONES = { stage: 1, good: 1, bad: 1, amber: 1, violet: 1, muted: 1 };
  var TONE_CYCLE = ["stage", "good", "amber", "violet", "bad", "muted"];
  function toneOf(tone, i) {
    return typeof tone === "string" && hasOwn(CHART_TONES, tone) ? tone : TONE_CYCLE[i % TONE_CYCLE.length];
  }
  function fx(n) { return fixedText(n, 1); }
  function svgNode(tag, attrs) {
    var e = makeElNS(document, svgNamespace, tag);
    var keys = ownKeys(attrs);
    for (var i = 0; i < keys.length; i++) setAttr(e, keys[i], textOf(attrs[keys[i]]));
    return e;
  }
  function svgText(x, y, text, anchor, cls) {
    var t = svgNode("text", { x: fx(x), y: fx(y), "text-anchor": anchor, "class": cls || "jb-chart-label" });
    setText(t, text);
    return t;
  }
  /* A label cut to room CSS px, with its full text as a tooltip when it was cut. */
  function fittedText(x, y, text, anchor, room, measure) {
    var c = cutText(text, M.max(room, 0), measure);
    var t = svgText(x, y, c.text, anchor);
    if (c.cut) tip(t, text);
    return t;
  }
  function tip(el, text) {
    var t = svgNode("title", {});
    setText(t, text);
    appendTo(el, t);
  }
  function describePoint(info, fmt) {
    return (info.series ? info.series + ", " : "") + info.label + ": " + fmt(info.value);
  }
  /* With onSelect, each mark gets a native button in a row under the chart (S12: an SVG mark
     is not a 44px target; the button is). The button answers click, Enter and Space as any
     button does; the drawn mark still answers a pointer. Each calls onSelect with a fresh
     { label, value, series, index }. */
  var chartPicks = null;
  function selectable(mark, info, onSelect, fmt) {
    function fire() { onSelect({ label: info.label, value: info.value, series: info.series, index: info.index }); }
    setAttr(mark, "class", (getAttr(mark, "class") || "") + " jb-chart-target");
    listen(mark, "click", fire);
    if (chartPicks) chartPicks[chartPicks.length] = { text: describePoint(info, fmt), fire: fire };
  }
  function picksRow(title, picks) {
    var row = node("div", "jb-chart-picks");
    setAttr(row, "role", "group");
    setAttr(row, "aria-label", "Select in " + title);
    for (var i = 0; i < picks.length; i++) {
      var b = node("button", "jb-chart-pick", picks[i].text);
      setAttr(b, "type", "button");
      listen(b, "click", picks[i].fire);
      appendTo(row, b);
    }
    return row;
  }
  /* A point's target: a 44-unit transparent circle with a small visible dot. */
  function pointTarget(x, y, tone) {
    var g = svgNode("g", { "class": "jb-chart-point" });
    appendTo(g, svgNode("circle", { cx: fx(x), cy: fx(y), r: 22, "class": "jb-chart-hit" }));
    appendTo(g, svgNode("circle", { cx: fx(x), cy: fx(y), r: 3, "class": "jb-chart-dot jb-tone-" + tone }));
    return g;
  }
  /* The series to draw: spec.series, or spec.points as one unnamed series; 8 series and 200
     points in all at most. A value that is not a finite number counts as 0. */
  function chartSeries(spec) {
    var many = isList(spec.series) && spec.series.length > 0;
    var src = many ? spec.series : [{ points: spec.points }];
    var budget = CHART_TOTAL_MAX;
    var out = [];
    for (var i = 0; i < src.length && out.length < SERIES_MAX; i++) {
      var s = src[i] && typeof src[i] === "object" ? src[i] : {};
      var pts = isList(s.points) ? s.points : [];
      var list = [];
      for (var j = 0; j < pts.length && budget > 0; j++) {
        var p = pts[j] && typeof pts[j] === "object" ? pts[j] : {};
        list[list.length] = { label: clip(p.label, LABEL_MAX), value: isNum(p.value) ? p.value : 0, tone: p.tone };
        budget -= 1;
      }
      var name = many ? clip(s.name == null || s.name === "" ? "Series " + (i + 1) : s.name, LABEL_MAX) : null;
      out[out.length] = { name: name, tone: toneOf(s.tone, i), points: list };
    }
    return out;
  }
  /* The labels of all series in order of first appearance, and where each series has each. */
  function chartCategories(series) {
    var labels = [];
    var at = {};
    for (var i = 0; i < series.length; i++) {
      var pts = series[i].points;
      for (var j = 0; j < pts.length; j++) {
        var key = "k" + pts[j].label;
        if (!hasOwn(at, key)) { at[key] = labels.length; labels[labels.length] = pts[j].label; }
      }
    }
    var cells = [];
    for (var s = 0; s < series.length; s++) {
      var row = [];
      for (var c = 0; c < labels.length; c++) row[c] = null;
      for (var q = 0; q < series[s].points.length; q++) {
        var ci = at["k" + series[s].points[q].label];
        if (row[ci] === null) row[ci] = { value: series[s].points[q].value, index: q };
      }
      cells[s] = row;
    }
    return { labels: labels, cells: cells };
  }
  /* The hidden table's head and rows: one row per point for one series, else one row per
     label with a column per series. */
  function seriesTable(series, cats, fmt) {
    var head = ["Label"];
    var rows = [];
    if (series.length === 1 && series[0].name === null) {
      head[1] = "Value";
      for (var i = 0; i < series[0].points.length; i++) rows[rows.length] = [series[0].points[i].label, fmt(series[0].points[i].value)];
      return { head: head, rows: rows };
    }
    for (var s = 0; s < series.length; s++) head[head.length] = series[s].name;
    for (var c = 0; c < cats.labels.length; c++) {
      var row = [cats.labels[c]];
      for (var t = 0; t < series.length; t++) row[row.length] = cats.cells[t][c] ? fmt(cats.cells[t][c].value) : "";
      rows[rows.length] = row;
    }
    return { head: head, rows: rows };
  }
  function legendOf(series) {
    if (series.length < 2) return null;
    var out = [];
    for (var i = 0; i < series.length; i++) out[out.length] = { name: series[i].name, tone: series[i].tone };
    return out;
  }
  /* Polish fix 1 (C1): the SVG's height is pinned in CSS px, so a width change never changes
     the chart's height, before or after the redraw it schedules: until the redraw lands, the
     stale drawing is letterboxed (preserveAspectRatio), not stretched to a new height. */
  function chartSvg(w, h, title) {
    var svg = svgNode("svg", { viewBox: "0 0 " + textOf(w) + " " + textOf(h), role: "img", "class": "jb-chart", "aria-label": clip(title || "Chart", 80), preserveAspectRatio: "xMidYMid meet" });
    if (styleOfSvg && setStyleProperty) {
      try { setStyleProperty(styleOfSvg(svg), "height", textOf(h) + "px"); } catch (err) { /* height: auto, as before */ }
    }
    return svg;
  }

  /* hbar: the label column is as wide as the widest label (at most 40% of the chart), the
     value column as wide as the widest value; labels that do not fit are cut. Polish fix 1
     (m4): a value is never cut (a cut number reads as another number), so the value column
     always holds the widest formatted value and the bars and labels take what is left. */
  function drawHbar(spec, fmt, onSelect, g) {
    var series = sliceList(chartSeries(spec), 0, 1);
    var pts = series[0].points;
    var W = g.W, BAR_H = 16;
    var rowH = onSelect ? 48 : 28;
    var H = M.max(pts.length, 1) * rowH + 8;
    var svg = chartSvg(W, H, spec.title);
    var max = 0;
    var labelW = 0;
    var valueW = 0;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].value > max) max = pts[i].value;
      labelW = M.max(labelW, g.measure(pts[i].label));
      valueW = M.max(valueW, g.measure(fmt(pts[i].value)));
    }
    if (max <= 0) max = 1;
    var VALUE_W = valueW + 8;
    var LABEL_W = M.min(M.max(labelW + LABEL_GAP, 48), M.max(48, M.round(W * 0.4)), M.max(W - VALUE_W, 0));
    for (var r = 0; r < pts.length; r++) {
      var v = M.max(pts[r].value, 0);
      var y = 4 + r * rowH;
      var by = y + (rowH - BAR_H) / 2;
      var w = (v / max) * M.max(W - LABEL_W - VALUE_W, 0);
      var info = { label: pts[r].label, value: pts[r].value, series: null, index: r };
      appendTo(svg, fittedText(0, by + 12, pts[r].label, "start", LABEL_W - LABEL_GAP, g.measure));
      var bar = svgNode("rect", { x: LABEL_W, y: fx(by), width: fx(w), height: BAR_H, "class": "jb-chart-mark jb-tone-" + toneOf(pts[r].tone, 0) });
      tip(bar, describePoint(info, fmt));
      appendTo(svg, bar);
      appendTo(svg, svgText(LABEL_W + w + 4, by + 12, fmt(pts[r].value), "start"));
      if (onSelect) {
        var hit = svgNode("rect", { x: 0, y: fx(y), width: W, height: rowH, "class": "jb-chart-hit" });
        selectable(hit, info, onSelect, fmt);
        appendTo(svg, hit);
      }
    }
    var table = seriesTable(series, chartCategories(series), fmt);
    return { svg: svg, legend: null, head: table.head, rows: table.rows };
  }

  function drawStacked(spec, fmt, onSelect, g) {
    var series = chartSeries(spec);
    var cats = chartCategories(series);
    var n = cats.labels.length;
    var W = g.W, H = 160;
    var step = W / M.max(n, 1);
    var plan = labelPlan(cats.labels, step, W, g.measure);
    var band = labelBand(plan, H);
    var BASE = band.base, PLOT = BASE - 12;
    var svg = chartSvg(W, H, spec.title);
    appendTo(svg, svgNode("line", { x1: 0, y1: BASE, x2: W, y2: BASE, "class": "jb-chart-axis" }));
    var max = 0;
    for (var c = 0; c < n; c++) {
      var total = 0;
      for (var s = 0; s < series.length; s++) if (cats.cells[s][c] && cats.cells[s][c].value > 0) total += cats.cells[s][c].value;
      if (total > max) max = total;
    }
    if (max <= 0) max = 1;
    var fit = barFit(step);
    for (var k = 0; k < n; k++) {
      var y = BASE;
      for (var t = 0; t < series.length; t++) {
        var cell = cats.cells[t][k];
        if (!cell || !(cell.value > 0)) continue;
        var h = (cell.value / max) * PLOT;
        y -= h;
        var tone = series.length === 1 ? toneOf(series[t].points[cell.index].tone, 0) : series[t].tone;
        var seg = svgNode("rect", { x: fx(step * k + fit.inset), y: fx(y), width: fx(fit.width), height: fx(h), "class": "jb-chart-mark jb-tone-" + tone });
        var info = { label: cats.labels[k], value: cell.value, series: series[t].name, index: cell.index };
        tip(seg, describePoint(info, fmt));
        if (onSelect) selectable(seg, info, onSelect, fmt);
        appendTo(svg, seg);
      }
    }
    drawLabels(svg, plan, band, false);
    var table = seriesTable(series, cats, fmt);
    return { svg: svg, legend: legendOf(series), head: table.head, rows: table.rows };
  }

  function drawArea(spec, fmt, onSelect, g) {
    var series = chartSeries(spec);
    var cats = chartCategories(series);
    var W = g.W, H = 160;
    var longest = 0;
    var max = 0;
    for (var s = 0; s < series.length; s++) {
      if (series[s].points.length > series[longest].points.length) longest = s;
      for (var i = 0; i < series[s].points.length; i++) if (series[s].points[i].value > max) max = series[s].points[i].value;
    }
    if (max <= 0) max = 1;
    var step = W / M.max(series[longest].points.length, 1);
    var labels = [];
    for (var b = 0; b < series[longest].points.length; b++) labels[b] = series[longest].points[b].label;
    var plan = labelPlan(labels, step, W, g.measure);
    var band = labelBand(plan, H);
    var BASE = band.base, PLOT = BASE - 12;
    var svg = chartSvg(W, H, spec.title);
    appendTo(svg, svgNode("line", { x1: 0, y1: BASE, x2: W, y2: BASE, "class": "jb-chart-axis" }));
    for (var t = 0; t < series.length; t++) {
      var pts = series[t].points;
      if (pts.length === 0) continue;
      var coords = [];
      for (var j = 0; j < pts.length; j++) coords[j] = fx(step * j + step / 2) + "," + fx(BASE - (M.max(pts[j].value, 0) / max) * PLOT);
      var first = fx(step / 2) + "," + BASE;
      var last = fx(step * (pts.length - 1) + step / 2) + "," + BASE;
      var area = svgNode("polygon", { points: first + " " + joinList(coords, " ") + " " + last, "class": "jb-chart-area jb-chart-mark jb-tone-" + series[t].tone });
      tip(area, series[t].name === null ? clip(spec.title || "Chart", 80) : series[t].name);
      appendTo(svg, area);
      appendTo(svg, svgNode("polyline", { points: joinList(coords, " "), "class": "jb-chart-line jb-tone-" + series[t].tone }));
      if (!onSelect) continue;
      for (var q = 0; q < pts.length; q++) {
        var mark = pointTarget(step * q + step / 2, BASE - (M.max(pts[q].value, 0) / max) * PLOT, series[t].tone);
        selectable(mark, { label: pts[q].label, value: pts[q].value, series: series[t].name, index: q }, onSelect, fmt);
        appendTo(svg, mark);
      }
    }
    drawLabels(svg, plan, band, false);
    var table = seriesTable(series, cats, fmt);
    return { svg: svg, legend: legendOf(series), head: table.head, rows: table.rows };
  }

  function drawScatter(spec, fmt, onSelect, g) {
    var raw = isList(spec.xy) ? spec.xy : [];
    var pts = [];
    for (var i = 0; i < raw.length && i < CHART_TOTAL_MAX; i++) {
      var p = raw[i] && typeof raw[i] === "object" ? raw[i] : {};
      if (!isNum(p.x) || !isNum(p.y)) continue;
      pts[pts.length] = { x: p.x, y: p.y, label: p.label == null ? "" : clip(p.label, LABEL_MAX), tone: toneOf(p.tone, 0) };
    }
    var x0 = 0, x1 = 1, y0 = 0, y1 = 1;
    if (pts.length > 0) {
      x0 = x1 = pts[0].x;
      y0 = y1 = pts[0].y;
      for (var j = 1; j < pts.length; j++) {
        x0 = M.min(x0, pts[j].x); x1 = M.max(x1, pts[j].x);
        y0 = M.min(y0, pts[j].y); y1 = M.max(y1, pts[j].y);
      }
      if (x0 === x1) { x0 -= 1; x1 += 1; }
      if (y0 === y1) { y0 -= 1; y1 += 1; }
    }
    /* The y axis sits right of its widest tick label (and of the turned y label, if any). */
    var tickW = M.max(g.measure(fmt(y0)), g.measure(fmt(y1)));
    var W = g.W, H = 160, L = M.max(44, M.round(tickW + 8 + (spec.yLabel ? 16 : 0))), R = W - 8, T = 8, B = 124;
    var svg = chartSvg(W, H, spec.title);
    function sx(v) { return L + ((v - x0) / (x1 - x0)) * (R - L); }
    function sy(v) { return B - ((v - y0) / (y1 - y0)) * (B - T); }
    appendTo(svg, svgNode("line", { x1: L, y1: B, x2: R, y2: B, "class": "jb-chart-axis" }));
    appendTo(svg, svgNode("line", { x1: L, y1: T, x2: L, y2: B, "class": "jb-chart-axis" }));
    appendTo(svg, svgText(L, B + 14, fmtNumber(x0), "start"));
    appendTo(svg, svgText(R, B + 14, fmtNumber(x1), "end"));
    appendTo(svg, svgText(L - 4, B, fmt(y0), "end"));
    appendTo(svg, svgText(L - 4, T + 8, fmt(y1), "end"));
    var xLabel = spec.xLabel == null || spec.xLabel === "" ? "x" : clip(spec.xLabel, LABEL_MAX);
    var yLabel = spec.yLabel == null || spec.yLabel === "" ? "y" : clip(spec.yLabel, LABEL_MAX);
    if (spec.xLabel) appendTo(svg, fittedText((L + R) / 2, H - 4, xLabel, "middle", R - L, g.measure));
    if (spec.yLabel) {
      var yl = fittedText(0, 0, yLabel, "middle", B - T, g.measure);
      setAttr(yl, "transform", "translate(10 " + fx((T + B) / 2) + ") rotate(-90)");
      appendTo(svg, yl);
    }
    var rows = [];
    for (var k = 0; k < pts.length; k++) {
      var info = { label: pts[k].label === "" ? fmtNumber(pts[k].x) : pts[k].label, value: pts[k].y, series: null, index: k };
      var dot = svgNode("circle", { cx: fx(sx(pts[k].x)), cy: fx(sy(pts[k].y)), r: 4, "class": "jb-chart-dot jb-chart-mark jb-tone-" + pts[k].tone });
      tip(dot, (pts[k].label ? pts[k].label + ": " : "") + fmtNumber(pts[k].x) + ", " + fmt(pts[k].y));
      appendTo(svg, dot);
      if (onSelect) {
        var hit = svgNode("circle", { cx: fx(sx(pts[k].x)), cy: fx(sy(pts[k].y)), r: 22, "class": "jb-chart-hit" });
        selectable(hit, info, onSelect, fmt);
        appendTo(svg, hit);
      }
      rows[rows.length] = [pts[k].label, fmtNumber(pts[k].x), fmt(pts[k].y)];
    }
    return { svg: svg, legend: null, head: ["Label", xLabel, yLabel], rows: rows };
  }

  function arcPath(cx, cy, R, r, a0, a1) {
    if (a1 - a0 >= 2 * M.PI - 0.0001) return arcPath(cx, cy, R, r, a0, a0 + M.PI) + " " + arcPath(cx, cy, R, r, a0 + M.PI, a1);
    var large = a1 - a0 > M.PI ? 1 : 0;
    function at(rad, a) { return fx(cx + rad * M.cos(a)) + " " + fx(cy + rad * M.sin(a)); }
    return "M " + at(R, a0) + " A " + R + " " + R + " 0 " + large + " 1 " + at(R, a1) +
      " L " + at(r, a1) + " A " + r + " " + r + " 0 " + large + " 0 " + at(r, a0) + " Z";
  }
  /* donut: the ring at the left, the keys to its right, each cut to the room left. Polish fix
     1 (I2): where that room (W - 196) cannot hold every key with at least four characters of
     its label and its percentage, the SVG draws no keys and the chart has an HTML legend under
     the ring instead (chartLegend), which wraps; so a narrow donut never shows bare swatches
     or keys cut to a letter or two. */
  var DONUT_KEY_X = 192;
  function donutKeyText(label, share) {
    return clip(label, 16) + " " + fmtPercent(share);
  }
  function drawDonut(spec, fmt, onSelect, g) {
    var series = sliceList(chartSeries(spec), 0, 1);
    var pts = series[0].points;
    var W = g.W, H = 160, CX = 80, CY = 80, R = 72, RI = 44;
    var svg = chartSvg(W, H, spec.title);
    var total = 0;
    for (var i = 0; i < pts.length; i++) if (pts[i].value > 0) total += pts[i].value;
    var room = W - DONUT_KEY_X - 4;
    var keysFit = true;
    var legend = [];
    for (var m = 0, shown = 0; m < pts.length && shown < 8; m++) {
      if (!(pts[m].value > 0) || total <= 0) continue;
      shown += 1;
      var label = clip(pts[m].label, 16);
      var shortest = (label.length > 4 ? cutAt(label, 4) + "\\u2026" : label) + " " + fmtPercent(pts[m].value / total);
      if (g.measure(shortest) > room) keysFit = false;
    }
    var a = -M.PI / 2;
    var keys = 0;
    for (var k = 0; k < pts.length; k++) {
      var v = pts[k].value;
      if (!(v > 0) || total <= 0) continue;
      var tone = toneOf(pts[k].tone, k);
      var b = a + (v / total) * 2 * M.PI;
      var slice = svgNode("path", { d: arcPath(CX, CY, R, RI, a, b), "class": "jb-chart-mark jb-tone-" + tone });
      var info = { label: pts[k].label, value: v, series: null, index: k };
      tip(slice, describePoint(info, fmt));
      if (onSelect) selectable(slice, info, onSelect, fmt);
      appendTo(svg, slice);
      a = b;
      if (!keysFit) {
        legend[legend.length] = { name: pts[k].label + " " + fmtPercent(v / total), tone: tone };
      } else if (keys < 8) {
        var ky = 20 + keys * 18;
        appendTo(svg, svgNode("rect", { x: 176, y: ky - 9, width: 10, height: 10, rx: 2, "class": "jb-chart-key jb-tone-" + tone }));
        appendTo(svg, fittedText(DONUT_KEY_X, ky, donutKeyText(pts[k].label, v / total), "start", room, g.measure));
        keys += 1;
      }
    }
    if (total <= 0) appendTo(svg, svgNode("circle", { cx: CX, cy: CY, r: (R + RI) / 2, "class": "jb-chart-ring" }));
    appendTo(svg, svgText(CX, CY + 5, fmt(total), "middle", "jb-chart-total"));
    var table = seriesTable(series, chartCategories(series), fmt);
    return { svg: svg, legend: legend.length > 0 ? legend : null, head: table.head, rows: table.rows };
  }

  function chartTable(title, head, rows) {
    var table = node("table", "jb-sr-only");
    appendTo(table, node("caption", null, title));
    var thead = node("thead");
    var tr = node("tr");
    for (var i = 0; i < head.length; i++) {
      var th = node("th", null, head[i]);
      setAttr(th, "scope", "col");
      appendTo(tr, th);
    }
    appendTo(thead, tr);
    appendTo(table, thead);
    var tbody = node("tbody");
    for (var r = 0; r < rows.length; r++) {
      var row = node("tr");
      for (var c = 0; c < rows[r].length; c++) {
        var cell = node(c === 0 ? "th" : "td", null, rows[r][c]);
        if (c === 0) setAttr(cell, "scope", "row");
        appendTo(row, cell);
      }
      appendTo(tbody, row);
    }
    appendTo(table, tbody);
    return table;
  }
  function chartLegend(items) {
    var ul = node("ul", "jb-chart-legend");
    for (var i = 0; i < items.length; i++) {
      var li = node("li");
      var swatch = node("span", "jb-chart-swatch jb-tone-" + items[i].tone);
      setAttr(swatch, "aria-hidden", "true");
      appendTo(li, swatch);
      appendTo(li, makeText(document, items[i].name));
      appendTo(ul, li);
    }
    return ul;
  }
  function clearNode(el) {
    var c;
    while ((c = firstChildOf(el))) removeFrom(el, c);
  }
  /* Draws spec into el at the width el gives it; returns what was drawn and at what width
     (measured false: the width could not be read, so the reference width was used). */
  function drawChart(el, spec) {
    spec = spec && typeof spec === "object" ? spec : {};
    var fmt = formatterOf(spec.format);
    var onSelect = typeof spec.onSelect === "function" ? spec.onSelect : null;
    clearNode(el);
    var probe = chartProbe(el, null);
    var g = { W: chartWidthFor(probe.width), measure: probe.measure };
    var out;
    var picks = [];
    chartPicks = picks;
    try {
      out = drawOne(spec, fmt, onSelect, g);
    } finally {
      chartPicks = null;
      removeFrom(el, probe.svg);
    }
    var title = clip(spec.title || "Chart", 80);
    appendTo(el, out.svg);
    var legend = out.legend ? chartLegend(out.legend) : null;
    if (legend) appendTo(el, legend);
    if (picks.length > 0) appendTo(el, picksRow(title, picks));
    appendTo(el, chartTable(title, out.head, out.rows));
    return { svg: out.svg, legend: legend, W: g.W, measured: probe.width > 0 };
  }
  /* Polish fix 1 (I1): a redraw for a new width replaces the SVG alone. The legend, the 44px
     button row and the hidden table do not depend on the width, so they stay the same
     elements, and a button that has focus (or is being pressed) keeps it. The one exception is
     the donut's HTML legend, which is there only while the keys do not fit beside the ring: it
     is added or removed as the width calls for. Where the drawn SVG is no longer el's child
     (model code moved it), the chart is drawn afresh. */
  function redrawForWidth(el, spec, drawn) {
    if (parentOf(drawn.svg) !== el || (drawn.legend && parentOf(drawn.legend) !== el)) return drawChart(el, spec);
    spec = spec && typeof spec === "object" ? spec : {};
    var fmt = formatterOf(spec.format);
    var onSelect = typeof spec.onSelect === "function" ? spec.onSelect : null;
    var probe = chartProbe(el, drawn.svg);
    var g = { W: chartWidthFor(probe.width), measure: probe.measure };
    var out;
    chartPicks = null;
    try {
      out = drawOne(spec, fmt, onSelect, g);
    } finally {
      removeFrom(el, probe.svg);
    }
    insertInto(el, out.svg, drawn.svg);
    removeFrom(el, drawn.svg);
    var legend = drawn.legend;
    if (out.legend && !legend) {
      legend = chartLegend(out.legend);
      insertInto(el, legend, nextSiblingOf(out.svg));
    } else if (!out.legend && legend) {
      removeFrom(el, legend);
      legend = null;
    }
    return { svg: out.svg, legend: legend, W: g.W, measured: probe.width > 0 };
  }
  function drawOne(spec, fmt, onSelect, g) {
    var out;
    if (spec.viz === "hbar") out = drawHbar(spec, fmt, onSelect, g);
    else if (spec.viz === "stacked") out = drawStacked(spec, fmt, onSelect, g);
    else if (spec.viz === "area") out = drawArea(spec, fmt, onSelect, g);
    else if (spec.viz === "scatter") out = drawScatter(spec, fmt, onSelect, g);
    else if (spec.viz === "donut") out = drawDonut(spec, fmt, onSelect, g);
    else out = legacyChart(spec, fmt, g);
    return out;
  }
  /* host.chart(el, spec) -> { update(spec), destroy() }: update redraws into the same
     element; destroy empties it, and nothing draws there afterwards. Polish wave, item A: a
     ResizeObserver on el redraws the chart when the width it would get changes (or first
     becomes measurable), and destroy disconnects it.
     Polish fix 1 (C1): the redraw never runs inside the observer's callback, where changing
     layout makes the browser raise its "ResizeObserver loop" error. The callback only
     schedules one redraw per chart with the kit's captured timer; notifications that arrive
     before it runs add nothing. When it runs it checks again that the chart is live and that
     the width it would get has changed, then draws the current spec (an update() in between
     is drawn). The SVG's height is pinned (chartSvg), so neither the width change nor the
     redraw changes the chart's height.
     m1: one chart per element. host.chart on an element that already has one retires the
     earlier chart (its observer is disconnected, its handle does nothing more), as a view that
     draws again into the same element without destroy() expects. */
  var NO_CHART = freeze({ update: function () {}, destroy: function () {} });
  function chart(el, spec) {
    if (!el || typeof el.appendChild !== "function" || !isElement(el)) return NO_CHART;
    if (chartsOn) {
      var earlier;
      try { earlier = chartOnGet(chartsOn, el); } catch (err) { earlier = null; }
      if (typeof earlier === "function") earlier();
    }
    var live = true;
    var current = spec;
    var drawn = drawChart(el, current);
    var watcher = null;
    var queued = false;
    function retire() {
      live = false;
      if (watcher) { try { disconnectSize(watcher); } catch (err) { /* nothing more to do */ } }
    }
    function resized() {
      queued = false;
      if (!live) return;
      var w = widthOf(drawn.svg);
      if (w <= 0) return;
      if (drawn.measured && chartWidthFor(w) === drawn.W) return;
      try { drawn = redrawForWidth(el, current, drawn); } catch (err) { report(errorText(err)); }
    }
    if (SizeWatch) {
      try {
        watcher = new SizeWatch(function () {
          if (!live || queued) return;
          queued = true;
          try { queueTask(resized, 0); } catch (err) { queued = false; }
        });
        observeSize(watcher, el);
      } catch (err) { watcher = null; }
    }
    if (chartsOn) { try { chartOnSet(chartsOn, el, retire); } catch (err) { /* one chart per call, as before */ } }
    return freeze({
      update: function (next) {
        if (!live) return;
        current = next;
        drawn = drawChart(el, current);
      },
      destroy: function () {
        if (!live) return;
        retire();
        clearNode(el);
      }
    });
  }

  /* PR 5 (spec 08 S9.5): host.el builds an element from a closed set of attributes; text
     and string children become text nodes, so data never travels as markup. */
  var testRe = uncurry(RegExp.prototype.test);
  var execRe = uncurry(RegExp.prototype.exec);
  var EL_ATTRS = { role: 1, title: 1, colspan: 1, rowspan: 1 };
  var EL_ATTR_RE = /^(?:aria|data)-[A-Za-z0-9_.:-]+$/;
  function buildEl(tag, attrs, children) {
    var e = makeEl(document, textOf(tag));
    if (attrs && typeof attrs === "object") {
      var keys = ownKeys(attrs);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = attrs[k];
        if (v === undefined || v === null) continue;
        if (k === "class") setAttr(e, "class", textOf(v));
        else if (k === "text") setText(e, textOf(v));
        else if (k === "hidden") { if (v) setAttr(e, "hidden", ""); }
        else if (hasOwn(EL_ATTRS, k) || testRe(EL_ATTR_RE, k)) setAttr(e, k, textOf(v));
      }
    }
    if (isList(children)) {
      for (var j = 0; j < children.length; j++) {
        var c = children[j];
        if (typeof c === "string" || typeof c === "number") appendTo(e, makeText(document, textOf(c)));
        else if (isElement(c)) appendTo(e, c);
      }
    }
    return e;
  }

  /* host.format.date: the calendar date an ISO string starts with, as "Nov 28, 2026" (the
     date as written, no time zone shift); "" for anything else. */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DATE_RE = /^(\\d{4})-(\\d{2})-(\\d{2})(?:$|T)/;
  function fmtDate(iso) {
    if (typeof iso !== "string") return "";
    var m = execRe(DATE_RE, iso);
    if (!m) return "";
    var y = toNumber(m[1]);
    var mo = toNumber(m[2]);
    var d = toNumber(m[3]);
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (mo < 1 || mo > 12 || d < 1 || d > days[mo - 1]) return "";
    return MONTHS[mo - 1] + " " + d + ", " + y;
  }
  /* host.format.pay: the review's pay exactly as the app shows it (fmtPay in
     lib/rolefit/fit.ts, through payLabel; kit.behaviour.test.ts runs both over one table),
     or null when none is listed. */
  function fmtPay(r) {
    if (!r || typeof r !== "object") return null;
    var min = r.payMin;
    var max = r.payMax;
    var cur = r.payCurrency;
    if (min == null && max == null) return null;
    var c = !cur || cur === "USD" ? "$" : cur + " ";
    if (r.payPeriod === "hour") {
      if (min != null && max == null) return "From " + c + min + "/hr";
      if (max != null && min == null) return "Up to " + c + max + "/hr";
      return c + (min == null ? "?" : min) + "\\u2013" + (max == null ? "?" : max) + "/hr";
    }
    function k(n) { return M.round(n / 1000) + "k"; }
    if (min != null && max == null) return "From " + c + k(min);
    if (max != null && min == null) return "Up to " + c + k(max);
    return c + (min != null ? k(min) : "?") + "\\u2013" + (max != null ? k(max) : "?");
  }
  var format = freeze({ number: fmtNumber, percent: fmtPercent, days: fmtDays, date: fmtDate, pay: fmtPay });

  /* host.job: a read-only join over host.data for one job id, or null when the id is in
     none of jobs, reviews, shortlist and applications. A job that is only on the shortlist
     or in the applications list is that row's own job. */
  function ownValue(record, id) {
    return record && typeof record === "object" && hasOwn(record, id) ? record[id] : null;
  }
  function rowFor(list, id) {
    if (!isList(list)) return null;
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (row && typeof row === "object" && row.jobId === id) return row;
    }
    return null;
  }
  function jobOf(id) {
    if (typeof id !== "string" || id === "") return null;
    var d = state.data;
    if (!d || typeof d !== "object") return null;
    var j = ownValue(d.jobs, id);
    var r = ownValue(d.reviews, id);
    var s = rowFor(d.shortlist, id);
    var a = rowFor(d.applications, id);
    if (j === null) j = s && s.job ? s.job : a && a.job ? a.job : null;
    if (j === null && r === null && s === null && a === null) return null;
    return { job: j, review: r, shortlist: s, application: a };
  }

  /* PR 5 (spec 08 S9.5): host.table(el, spec) -> { update(rows), sort(key, dir) }. A real
     table in a jb-scroll-x wrapper; every cell is set as text. A sortable column's header is
     a button that sorts ascending, then descending; a missing value sorts last either way.
     pageSize rows show at first (25 by default), with a Show more button for the next page,
     and at most 500 rows ever render. onRowSelect(row, index) gets the caller's own row and
     its index in the rows given, on click or Enter. */
  var TABLE_ROWS_MAX = 500;
  var TABLE_COLUMNS_MAX = 20;
  var compareText = uncurry("".localeCompare);
  var NO_TABLE = freeze({ update: function () {}, sort: function () {} });
  function cellValue(row, key) {
    return row !== null && typeof row === "object" && hasOwn(row, key) ? row[key] : undefined;
  }
  function cellText(value, fmtName) {
    if (value === null || value === undefined) return "";
    if (fmtName === "date") return typeof value === "string" ? fmtDate(value) : "";
    if (fmtName === "pay") { var p = value && typeof value === "object" ? fmtPay(value) : null; return p === null ? "" : p; }
    if (typeof fmtName === "string" && hasOwn(VALUE_FORMATS, fmtName)) return VALUE_FORMATS[fmtName](value);
    if (typeof value === "number") return fmtNumber(value);
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return "";
  }
  function isMissing(v) {
    return v === null || v === undefined || v === "" || (typeof v === "number" && !finite(v));
  }
  function compareCells(a, b) {
    if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
    var r;
    try { r = compareText(textOf(a), textOf(b), "en", { numeric: true, sensitivity: "base" }); } catch (err) { r = 0; }
    return r < 0 ? -1 : r > 0 ? 1 : 0;
  }
  function tableColumns(list) {
    var out = [];
    if (!isList(list)) return out;
    for (var i = 0; i < list.length && out.length < TABLE_COLUMNS_MAX; i++) {
      var c = list[i];
      if (!c || typeof c !== "object" || typeof c.key !== "string" || c.key === "") continue;
      out[out.length] = {
        key: c.key,
        label: clip(typeof c.label === "string" && c.label !== "" ? c.label : c.key, 80),
        end: c.align === "end",
        format: typeof c.format === "string" ? c.format : "",
        sortable: c.sortable === true
      };
    }
    return out;
  }
  function tableRows(list) {
    var out = [];
    if (!isList(list)) return out;
    for (var i = 0; i < list.length; i++) out[out.length] = { row: list[i], index: i };
    return out;
  }
  function table(el, spec) {
    if (!el || typeof el.appendChild !== "function" || !isElement(el)) return NO_TABLE;
    spec = spec && typeof spec === "object" ? spec : {};
    var columns = tableColumns(spec.columns);
    var onRowSelect = typeof spec.onRowSelect === "function" ? spec.onRowSelect : null;
    var size = toNumber(spec.pageSize);
    var pageSize = finite(size) && size >= 1 ? M.min(M.floor(size), TABLE_ROWS_MAX) : 25;
    var entries = tableRows(spec.rows);
    var order = entries;
    var shown = pageSize;
    var sortKey = null;
    var sortDesc = false;
    var heads = [];

    var wrap = node("div", "jb-scroll-x");
    var tableEl = node("table", "jb-table");
    var caption = node("caption", "", clip(typeof spec.caption === "string" ? spec.caption : "", 200));
    var thead = node("thead", "");
    var headRow = node("tr", "");
    var tbody = node("tbody", "");
    var more = node("button", "jb-table__more", "Show more");
    setAttr(more, "type", "button");
    appendTo(tableEl, caption);
    appendTo(thead, headRow);
    appendTo(tableEl, thead);
    appendTo(tableEl, tbody);
    appendTo(wrap, tableEl);

    function columnIndex(key) {
      for (var i = 0; i < columns.length; i++) if (columns[i].key === key) return i;
      return -1;
    }
    function markSort() {
      for (var i = 0; i < columns.length; i++) {
        var c = columns[i];
        if (c.key === sortKey) setAttr(heads[i], "aria-sort", sortDesc ? "descending" : "ascending");
        else if (c.sortable) setAttr(heads[i], "aria-sort", "none");
        else dropAttribute(heads[i], "aria-sort");
      }
    }
    function sortEntries() {
      if (sortKey === null) { order = entries; return; }
      var key = sortKey;
      var desc = sortDesc;
      var copy = [];
      for (var i = 0; i < entries.length; i++) copy[i] = entries[i];
      sortList(copy, function (x, y) {
        var a = cellValue(x.row, key);
        var b = cellValue(y.row, key);
        var ma = isMissing(a);
        var mb = isMissing(b);
        if (ma || mb) return ma && mb ? x.index - y.index : ma ? 1 : -1;
        var r = compareCells(a, b);
        if (desc) r = -r;
        return r !== 0 ? r : x.index - y.index;
      });
      order = copy;
    }
    function selectRow(entry) {
      try { onRowSelect(entry.row, entry.index); } catch (err) { report(errorText(err)); }
    }
    function rowNode(entry) {
      var tr = node("tr", onRowSelect ? "jb-table__row" : "");
      for (var i = 0; i < columns.length; i++) {
        var c = columns[i];
        var td = node("td", c.end ? "jb-num" : "", cellText(cellValue(entry.row, c.key), c.format));
        appendTo(tr, td);
      }
      if (onRowSelect) {
        setAttr(tr, "tabindex", "0");
        listen(tr, "click", function () { selectRow(entry); });
        listen(tr, "keydown", function (e) {
          if (keyName(e) !== "Enter") return;
          cancelEvent(e);
          selectRow(entry);
        });
      }
      return tr;
    }
    function render() {
      clearNode(tbody);
      var limit = M.min(order.length, TABLE_ROWS_MAX);
      var count = M.min(shown, limit);
      for (var i = 0; i < count; i++) appendTo(tbody, rowNode(order[i]));
      setAttr(more, "class", count < limit ? "jb-table__more" : "jb-table__more jb-hidden");
    }
    function sortBy(key, desc) {
      var at = columnIndex(key);
      if (at < 0 || !columns[at].sortable) return;
      sortKey = key;
      sortDesc = desc;
      sortEntries();
      markSort();
      render();
    }

    for (var i = 0; i < columns.length; i++) {
      (function (c) {
        var th = node("th", c.end ? "jb-num" : "");
        setAttr(th, "scope", "col");
        if (c.sortable) {
          var b = node("button", "jb-table__sort", c.label);
          setAttr(b, "type", "button");
          listen(b, "click", function () { sortBy(c.key, sortKey === c.key ? !sortDesc : false); });
          appendTo(th, b);
        } else setText(th, c.label);
        heads[heads.length] = th;
        appendTo(headRow, th);
      })(columns[i]);
    }
    /* The button hides itself after the last page, so focus moves to the first new row. */
    listen(more, "click", function () {
      var before = collectionLength(childrenOf(tbody));
      shown += pageSize;
      render();
      var rows = childrenOf(tbody);
      if (before >= collectionLength(rows)) return;
      var first = rows[before];
      if (!hasAttr(first, "tabindex")) setAttr(first, "tabindex", "-1");
      focusOn(first);
    });

    clearNode(el);
    appendTo(el, wrap);
    appendTo(el, more);
    markSort();
    render();

    return freeze({
      update: function (rows) {
        entries = tableRows(rows);
        shown = pageSize;
        sortEntries();
        render();
      },
      sort: function (key, dir) {
        sortBy(textOf(key), dir === "desc" || dir === "descending");
      }
    });
  }

  var host = {
    get data() { return state.data; },
    get theme() { return state.theme; },
    onInit: function (cb) {
      if (typeof cb !== "function") return;
      if (state.inited) run(cb); else state.waiting.push(cb);
    },
    action: function (name, args) {
      post({ type: "action", name: String(name), args: args === undefined ? {} : args });
    },
    ask: ask,
    chart: chart,
    el: buildEl,
    format: format,
    job: jobOf,
    table: table
  };
  Object.defineProperty(window, "host", { value: Object.freeze(host), writable: false, configurable: false });

  function parseAction(text) {
    var a;
    try { a = JSON.parse(text); } catch (err) { return null; }
    if (!a || typeof a !== "object" || Array.isArray(a) || typeof a.name !== "string") return null;
    var args = {};
    for (var k in a) if (k !== "name" && Object.prototype.hasOwnProperty.call(a, k)) args[k] = a[k];
    return { name: a.name, args: args };
  }

  if (window.customElements && !customElements.get("jb-button")) {
    customElements.define("jb-button", class extends HTMLElement {
      connectedCallback() {
        if (!this.hasAttribute("role")) this.setAttribute("role", "button");
        if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
        if (this.jbWired) return;
        this.jbWired = true;
        this.addEventListener("click", function () {
          if (this.getAttribute("aria-disabled") === "true") return;
          /* PR 6: a button with an action runs the action only, even with an ask too. */
          if (hasAttr(this, "action")) {
            var a = parseAction(getAttr(this, "action") || "");
            if (a) host.action(a.name, a.args);
            return;
          }
          if (hasAttr(this, "ask")) ask(getAttr(this, "ask"));
        });
        this.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); }
        });
      }
    });
  }

  var fieldCount = 0;
  if (window.customElements && !customElements.get("jb-field")) {
    customElements.define("jb-field", class extends HTMLElement {
      connectedCallback() {
        if (this.jbInput) return;
        fieldCount += 1;
        var id = "jb-field-" + fieldCount;
        var label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = this.getAttribute("label") || this.getAttribute("name") || "";
        var input = document.createElement("input");
        input.id = id;
        input.type = "text";
        input.name = this.getAttribute("name") || "";
        if (this.hasAttribute("value")) input.value = this.getAttribute("value");
        if (this.hasAttribute("placeholder")) input.placeholder = this.getAttribute("placeholder");
        this.appendChild(label);
        this.appendChild(input);
        this.jbInput = input;
      }
      get value() { return this.jbInput ? this.jbInput.value : (this.getAttribute("value") || ""); }
      set value(v) { if (this.jbInput) this.jbInput.value = String(v); else this.setAttribute("value", String(v)); }
    });
  }

  /* PR 5 (spec 08 S9.4): the control elements. Each has a visible label, a 44px target
     (KIT_CSS), keyboard support, a value property, and fires a bubbling change CustomEvent
     with detail { name, value } when the user changes it (setting value from script fires
     nothing). An element that reads child <option> elements (or <jb-tab> children) builds
     once those are parsed: on DOMContentLoaded while the document is loading, else in a
     microtask, so script that makes one and appends its options in the same task works.
     Model code listens on the element itself; a native change event from an inner input
     is stopped there, so every change event a control sends carries a detail. */
  var controlCount = 0;
  function nextId(kind) { controlCount += 1; return "jb-" + kind + "-" + controlCount; }
  function node(tag, cls, text) {
    var e = makeEl(document, tag);
    if (cls) setAttr(e, "class", cls);
    if (text !== undefined && text !== null) setText(e, textOf(text));
    return e;
  }
  function nameOf(el) { var n = getAttr(el, "name"); return n === null ? "" : n; }
  function labelOf(el) { var l = getAttr(el, "label"); return l === null || l === "" ? nameOf(el) : l; }
  function keyName(e) { try { return keyOf ? keyOf(e) : ""; } catch (err) { return ""; } }
  function focusOn(el) {
    try { focusHtml(el); return; } catch (err) { /* not an HTML element */ }
    try { if (focusSvg) focusSvg(el); } catch (err) { /* not focusable */ }
  }
  function emitChange(el, value) {
    var ev;
    try { ev = new ChangeEvent("change", { bubbles: true, detail: { name: nameOf(el), value: value } }); } catch (err) { return; }
    dispatch(el, ev);
  }
  function whenParsed(cb) {
    if (readyStateOf(document) === "loading") listen(document, "DOMContentLoaded", cb);
    else defer(cb);
  }
  function defineOnce(name, cls) {
    if (window.customElements && !customElements.get(name)) customElements.define(name, cls);
  }
  function childOptions(el) {
    var kids = childrenOf(el);
    var out = [];
    for (var i = 0; i < collectionLength(kids); i++) if (localNameOf(kids[i]) === "option") out[out.length] = kids[i];
    return out;
  }
  function optionValue(opt) {
    var v = getAttr(opt, "value");
    return v === null ? trimText(getText(opt)) : v;
  }
  /* The <option> children as { value, label }, taken out of the element. */
  function takeOptions(el) {
    var found = childOptions(el);
    var out = [];
    for (var i = 0; i < found.length; i++) {
      out[out.length] = { value: optionValue(found[i]), label: trimText(getText(found[i])) };
      removeFrom(el, found[i]);
    }
    return out;
  }
  function indexOfValue(options, v) {
    for (var i = 0; i < options.length; i++) if (options[i].value === v) return i;
    return -1;
  }
  /* Before an element is built: its value attribute, else its first option's value. */
  function unbuiltValue(el) {
    var v = getAttr(el, "value");
    if (v !== null) return v;
    var found = childOptions(el);
    return found.length > 0 ? optionValue(found[0]) : "";
  }
  /* Scrolls a list so an item shows, without scrolling anything outside the list. */
  function keepVisible(list, item) {
    try {
      var at = offsetTopOf(item);
      var h = offsetHeightOf(item);
      var shown = scrollTopOf(list);
      var room = clientHeightOf(list);
      if (at < shown) setScrollTop(list, at);
      else if (at + h > shown + room) setScrollTop(list, at + h - room);
    } catch (err) { /* layout unavailable */ }
  }

  /* <jb-select name label value> with <option value> children: a select-only combobox
     (focus stays on it, aria-activedescendant names the active option). The popup is in
     the flow, below the button, so the frame grows to show it instead of clipping it. */
  function buildSelect(host, st) {
    if (st.built) return;
    st.built = true;
    st.options = takeOptions(host);
    st.index = indexOfValue(st.options, getAttr(host, "value"));
    if (st.index < 0 && st.options.length > 0) st.index = 0;
    var labelId = nextId("label");
    var listId = nextId("list");
    var label = node("span", "jb-control__label", labelOf(host));
    setAttr(label, "id", labelId);
    var combo = node("span", "jb-select__button");
    setAttr(combo, "role", "combobox");
    setAttr(combo, "tabindex", "0");
    setAttr(combo, "aria-haspopup", "listbox");
    setAttr(combo, "aria-expanded", "false");
    setAttr(combo, "aria-controls", listId);
    setAttr(combo, "aria-labelledby", labelId);
    var shown = node("span", "jb-select__value", st.index >= 0 ? st.options[st.index].label : "");
    var caret = node("span", "jb-select__caret");
    setAttr(caret, "aria-hidden", "true");
    appendTo(combo, shown);
    appendTo(combo, caret);
    var list = node("div", "jb-select__list jb-hidden");
    setAttr(list, "role", "listbox");
    setAttr(list, "id", listId);
    setAttr(list, "aria-labelledby", labelId);
    var items = [];
    function onOption(i) { return function () { choose(i); }; }
    for (var i = 0; i < st.options.length; i++) {
      var item = node("div", "jb-select__option", st.options[i].label);
      setAttr(item, "role", "option");
      setAttr(item, "id", nextId("option"));
      setAttr(item, "aria-selected", i === st.index ? "true" : "false");
      listen(item, "click", onOption(i));
      items[i] = item;
      appendTo(list, item);
    }
    /* A press in the list keeps focus on the combobox, so it does not blur and close first. */
    listen(list, "mousedown", function (e) { cancelEvent(e); });
    appendTo(host, label);
    appendTo(host, combo);
    appendTo(host, list);

    function show(i) {
      st.index = i;
      for (var j = 0; j < items.length; j++) setAttr(items[j], "aria-selected", j === i ? "true" : "false");
      setText(shown, st.options[i].label);
    }
    function setActive(i) {
      if (st.active >= 0 && items[st.active]) setAttr(items[st.active], "class", "jb-select__option");
      st.active = i;
      if (i < 0 || !items[i]) return;
      setAttr(items[i], "class", "jb-select__option jb-active");
      setAttr(combo, "aria-activedescendant", getAttr(items[i], "id"));
      keepVisible(list, items[i]);
    }
    function closeList() {
      if (!st.open) return;
      st.open = false;
      setAttr(list, "class", "jb-select__list jb-hidden");
      setAttr(combo, "aria-expanded", "false");
      dropAttribute(combo, "aria-activedescendant");
      setActive(-1);
      if (openPopup === closeList) openPopup = null;
    }
    function openList(at) {
      if (st.open || items.length === 0) return;
      if (openPopup) { var other = openPopup; openPopup = null; other(); }
      st.open = true;
      setAttr(list, "class", "jb-select__list");
      setAttr(combo, "aria-expanded", "true");
      openPopup = closeList;
      setActive(at < 0 ? 0 : at);
    }
    function choose(i) {
      if (i < 0 || i >= items.length) return;
      var changed = i !== st.index;
      show(i);
      closeList();
      focusOn(combo);
      if (changed) emitChange(host, st.options[i].value);
    }
    st.show = show;
    listen(combo, "click", function () { if (st.open) closeList(); else openList(st.index); });
    listen(combo, "blur", closeList);
    listen(combo, "keydown", function (e) {
      var k = keyName(e);
      var n = items.length;
      if (n === 0) return;
      if (!st.open) {
        if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { cancelEvent(e); openList(st.index); }
        else if (k === "Home") { cancelEvent(e); openList(0); }
        else if (k === "End") { cancelEvent(e); openList(n - 1); }
        return;
      }
      if (k === "ArrowDown") { cancelEvent(e); setActive(M.min(st.active + 1, n - 1)); }
      else if (k === "ArrowUp") { cancelEvent(e); setActive(M.max(st.active - 1, 0)); }
      else if (k === "Home") { cancelEvent(e); setActive(0); }
      else if (k === "End") { cancelEvent(e); setActive(n - 1); }
      else if (k === "Enter" || k === " ") { cancelEvent(e); choose(st.active); }
      else if (k === "Escape") { cancelEvent(e); closeList(); }
      else if (k === "Tab") closeList();
    });
  }
  defineOnce("jb-select", class extends HTMLElement {
    connectedCallback() {
      if (this.jbSelect) return;
      var self = this;
      var st = { built: false, options: [], index: -1, active: -1, open: false, show: null };
      this.jbSelect = st;
      whenParsed(function () { buildSelect(self, st); });
    }
    get value() {
      var st = this.jbSelect;
      if (st && st.built) return st.index >= 0 ? st.options[st.index].value : "";
      return unbuiltValue(this);
    }
    set value(v) {
      var st = this.jbSelect;
      v = textOf(v);
      if (st && st.built) {
        var i = indexOfValue(st.options, v);
        if (i >= 0 && st.show) st.show(i);
      } else setAttr(this, "value", v);
    }
  });

  /* Number formats, shared by the controls, host.format, host.chart and host.table. Each
     returns "" for a value that is not a finite number, so a missing figure is never shown
     as one. Numbers are en-US, as the app's own labels are. */
  function isNum(n) { return typeof n === "number" && finite(n); }
  function fmtNumber(n) { return isNum(n) ? numberText(n, "en-US") : ""; }
  function fmtPercent(ratio) { return isNum(ratio) ? numberText(M.round(ratio * 100), "en-US") + "%" : ""; }
  function fmtDays(n) {
    if (!isNum(n)) return "";
    var d = M.round(n);
    return d === 1 || d === -1 ? d + " day" : numberText(d, "en-US") + " days";
  }
  function fmtCurrency(n) {
    if (!isNum(n)) return "";
    var whole = M.round(n);
    return (whole < 0 ? "-$" : "$") + numberText(M.abs(whole), "en-US");
  }
  var VALUE_FORMATS = { number: fmtNumber, percent: fmtPercent, days: fmtDays, currency: fmtCurrency };
  function formatterOf(name) {
    return typeof name === "string" && hasOwn(VALUE_FORMATS, name) ? VALUE_FORMATS[name] : fmtNumber;
  }

  /* An attribute read as a finite number, or the fallback. */
  function numAttr(el, name, fallback) {
    var a = getAttr(el, name);
    if (a === null || trimText(a) === "") return fallback;
    var v = toNumber(a);
    return finite(v) ? v : fallback;
  }
  function decimalsOf(text) {
    if (text === null) return 0;
    var s = trimText(textOf(text));
    var dot = -1;
    for (var i = 0; i < s.length; i++) if (s[i] === ".") dot = i;
    return dot < 0 ? 0 : M.min(s.length - dot - 1, 10);
  }

  /* <jb-slider name label min max step value format>: a native range input with a visible
     label and its current value shown beside it (format: "number", "percent" of a ratio,
     "days" or "currency"; default "number"). The kit steps it on the arrow, Page, Home and
     End keys itself, so every browser steps alike; a drag arrives as the native input
     event. value is a number, snapped to the step and clamped. */
  function buildSlider(host, st) {
    if (st.built) return;
    st.built = true;
    var min = numAttr(host, "min", 0);
    var max = numAttr(host, "max", 100);
    if (max < min) max = min;
    var step = numAttr(host, "step", 1);
    if (!(step > 0)) step = 1;
    var decimals = M.max(decimalsOf(getAttr(host, "step")), decimalsOf(getAttr(host, "min")));
    var format = formatterOf(getAttr(host, "format"));
    var inputId = nextId("slider");
    var label = node("label", "jb-control__label", labelOf(host));
    setAttr(label, "for", inputId);
    var row = node("div", "jb-slider__row");
    var input = node("input", "jb-slider__input");
    setAttr(input, "type", "range");
    setAttr(input, "id", inputId);
    setAttr(input, "min", textOf(min));
    setAttr(input, "max", textOf(max));
    setAttr(input, "step", textOf(step));
    var out = node("span", "jb-slider__value");
    setAttr(out, "aria-hidden", "true");
    appendTo(row, input);
    appendTo(row, out);
    appendTo(host, label);
    appendTo(host, row);
    function snap(v) {
      if (!isNum(v)) v = min;
      v = min + M.round((v - min) / step) * step;
      if (v > max) v = max;
      if (v < min) v = min;
      return toNumber(fixedText(v, decimals));
    }
    function set(v) {
      st.value = snap(v);
      setInputValue(input, textOf(st.value));
      var text = format(st.value);
      setText(out, text);
      setAttr(input, "aria-valuetext", text);
    }
    function user(v) {
      var before = st.value;
      set(v);
      if (st.value !== before) emitChange(host, st.value);
    }
    st.set = set;
    set(numAttr(host, "value", min));
    var page = M.max(step, (max - min) / 10);
    listen(input, "keydown", function (e) {
      var k = keyName(e);
      var next = null;
      if (k === "ArrowRight" || k === "ArrowUp") next = st.value + step;
      else if (k === "ArrowLeft" || k === "ArrowDown") next = st.value - step;
      else if (k === "PageUp") next = st.value + page;
      else if (k === "PageDown") next = st.value - page;
      else if (k === "Home") next = min;
      else if (k === "End") next = max;
      if (next === null) return;
      cancelEvent(e);
      user(next);
    });
    listen(input, "input", function () { user(toNumber(inputValueOf(input))); });
    listen(input, "change", function (e) { stopEvent(e); });
  }
  defineOnce("jb-slider", class extends HTMLElement {
    connectedCallback() {
      if (this.jbSlider) return;
      var st = { built: false, value: 0, set: null };
      this.jbSlider = st;
      buildSlider(this, st);
    }
    get value() {
      var st = this.jbSlider;
      return st && st.built ? st.value : numAttr(this, "value", numAttr(this, "min", 0));
    }
    set value(v) {
      var st = this.jbSlider;
      if (st && st.built && st.set) st.set(toNumber(v)); else setAttr(this, "value", textOf(v));
    }
  });

  /* <jb-toggle name label checked>: a switch whose label is its own visible text, so the
     whole row is the target. value (and checked) is a boolean. */
  function buildToggle(host, st) {
    if (st.built) return;
    st.built = true;
    var sw = node("span", "jb-toggle__switch");
    setAttr(sw, "role", "switch");
    setAttr(sw, "tabindex", "0");
    var track = node("span", "jb-toggle__track");
    setAttr(track, "aria-hidden", "true");
    appendTo(track, node("span", "jb-toggle__thumb"));
    appendTo(sw, track);
    appendTo(sw, node("span", "jb-control__label jb-toggle__label", labelOf(host)));
    appendTo(host, sw);
    function set(v) {
      st.value = v === true;
      setAttr(sw, "aria-checked", st.value ? "true" : "false");
    }
    function flip() {
      set(!st.value);
      emitChange(host, st.value);
    }
    st.set = set;
    set(hasAttr(host, "checked") && getAttr(host, "checked") !== "false");
    listen(sw, "click", flip);
    listen(sw, "keydown", function (e) {
      var k = keyName(e);
      if (k !== " " && k !== "Enter") return;
      cancelEvent(e);
      flip();
    });
  }
  function toggleValue(el) {
    var st = el.jbToggle;
    return st && st.built ? st.value : hasAttr(el, "checked") && getAttr(el, "checked") !== "false";
  }
  function setToggle(el, v) {
    var st = el.jbToggle;
    v = v === true || v === "true";
    if (st && st.built && st.set) st.set(v);
    else if (v) setAttr(el, "checked", ""); else dropAttribute(el, "checked");
  }
  defineOnce("jb-toggle", class extends HTMLElement {
    connectedCallback() {
      if (this.jbToggle) return;
      var st = { built: false, value: false, set: null };
      this.jbToggle = st;
      buildToggle(this, st);
    }
    get value() { return toggleValue(this); }
    set value(v) { setToggle(this, v); }
    get checked() { return toggleValue(this); }
    set checked(v) { setToggle(this, v); }
  });

  /* The index an arrow, Home or End key moves to from i in a row of n items (wrapping), or
     -1 for any other key. */
  function rovingTarget(k, i, n) {
    if (k === "ArrowRight" || k === "ArrowDown") return (i + 1) % n;
    if (k === "ArrowLeft" || k === "ArrowUp") return (i - 1 + n) % n;
    if (k === "Home") return 0;
    if (k === "End") return n - 1;
    return -1;
  }

  /* <jb-segmented name label value> with <option value> children: a radiogroup of
     buttons in a row, one tab stop (roving tabindex); the arrow keys move and select. */
  function buildSegmented(host, st) {
    if (st.built) return;
    st.built = true;
    st.options = takeOptions(host);
    st.index = indexOfValue(st.options, getAttr(host, "value"));
    if (st.index < 0 && st.options.length > 0) st.index = 0;
    var labelId = nextId("label");
    var label = node("span", "jb-control__label", labelOf(host));
    setAttr(label, "id", labelId);
    var group = node("div", "jb-segmented__group");
    setAttr(group, "role", "radiogroup");
    setAttr(group, "aria-labelledby", labelId);
    var radios = [];
    function show(i) {
      st.index = i;
      for (var j = 0; j < radios.length; j++) {
        setAttr(radios[j], "aria-checked", j === i ? "true" : "false");
        setAttr(radios[j], "tabindex", j === i ? "0" : "-1");
      }
    }
    function pick(i, focus) {
      var changed = i !== st.index;
      show(i);
      if (focus) focusOn(radios[i]);
      if (changed) emitChange(host, st.options[i].value);
    }
    function wire(i) {
      listen(radios[i], "click", function () { pick(i, true); });
      listen(radios[i], "keydown", function (e) {
        var k = keyName(e);
        if (k === " " || k === "Enter") { cancelEvent(e); pick(i, false); return; }
        var to = rovingTarget(k, i, radios.length);
        if (to < 0) return;
        cancelEvent(e);
        pick(to, true);
      });
    }
    for (var i = 0; i < st.options.length; i++) {
      var radio = node("span", "jb-segmented__option", st.options[i].label);
      setAttr(radio, "role", "radio");
      radios[i] = radio;
      appendTo(group, radio);
      wire(i);
    }
    st.show = show;
    if (st.index >= 0) show(st.index);
    appendTo(host, label);
    appendTo(host, group);
  }
  defineOnce("jb-segmented", class extends HTMLElement {
    connectedCallback() {
      if (this.jbSegmented) return;
      var self = this;
      var st = { built: false, options: [], index: -1, show: null };
      this.jbSegmented = st;
      whenParsed(function () { buildSegmented(self, st); });
    }
    get value() {
      var st = this.jbSegmented;
      if (st && st.built) return st.index >= 0 ? st.options[st.index].value : "";
      return unbuiltValue(this);
    }
    set value(v) {
      var st = this.jbSegmented;
      v = textOf(v);
      if (st && st.built) {
        var i = indexOfValue(st.options, v);
        if (i >= 0 && st.show) st.show(i);
      } else setAttr(this, "value", v);
    }
  });

  /* <jb-tabs name label value> with <jb-tab label> children: a tablist the kit puts before
     the panels, one tab stop (roving tabindex), arrow, Home and End keys move and select
     (automatic activation), and only the selected panel shows. value is the index. */
  function buildTabs(host, st) {
    if (st.built) return;
    st.built = true;
    var kids = childrenOf(host);
    var panels = [];
    for (var i = 0; i < collectionLength(kids); i++) if (localNameOf(kids[i]) === "jb-tab") panels[panels.length] = kids[i];
    st.count = panels.length;
    var list = node("div", "jb-tabs__list");
    setAttr(list, "role", "tablist");
    var label = getAttr(host, "label");
    if (label !== null && label !== "") setAttr(list, "aria-label", label);
    var tabs = [];
    function show(i) {
      st.index = i;
      for (var j = 0; j < tabs.length; j++) {
        setAttr(tabs[j], "aria-selected", j === i ? "true" : "false");
        setAttr(tabs[j], "tabindex", j === i ? "0" : "-1");
        if (j === i) dropAttribute(panels[j], "hidden"); else setAttr(panels[j], "hidden", "");
      }
    }
    function pick(i, focus) {
      var changed = i !== st.index;
      show(i);
      if (focus) focusOn(tabs[i]);
      if (changed) emitChange(host, i);
    }
    function wire(i) {
      listen(tabs[i], "click", function () { pick(i, true); });
      listen(tabs[i], "keydown", function (e) {
        var k = keyName(e);
        if (k === " " || k === "Enter") { cancelEvent(e); pick(i, false); return; }
        var to = rovingTarget(k, i, tabs.length);
        if (to < 0) return;
        cancelEvent(e);
        pick(to, true);
      });
    }
    for (var t = 0; t < panels.length; t++) {
      var tabId = nextId("tab");
      var panelId = getAttr(panels[t], "id") || nextId("panel");
      var tab = node("span", "jb-tabs__tab", getAttr(panels[t], "label") || "Tab " + (t + 1));
      setAttr(tab, "role", "tab");
      setAttr(tab, "id", tabId);
      setAttr(tab, "aria-controls", panelId);
      setAttr(panels[t], "id", panelId);
      setAttr(panels[t], "role", "tabpanel");
      setAttr(panels[t], "aria-labelledby", tabId);
      setAttr(panels[t], "tabindex", "0");
      tabs[t] = tab;
      appendTo(list, tab);
      wire(t);
    }
    insertInto(host, list, firstChildOf(host));
    st.show = show;
    var start = M.floor(numAttr(host, "value", 0));
    if (panels.length > 0) show(start >= 0 && start < panels.length ? start : 0);
  }
  defineOnce("jb-tabs", class extends HTMLElement {
    connectedCallback() {
      if (this.jbTabs) return;
      var self = this;
      var st = { built: false, index: -1, count: 0, show: null };
      this.jbTabs = st;
      whenParsed(function () { buildTabs(self, st); });
    }
    get value() {
      var st = this.jbTabs;
      if (st && st.built) return st.index < 0 ? 0 : st.index;
      return M.floor(numAttr(this, "value", 0));
    }
    set value(v) {
      var st = this.jbTabs;
      var i = M.floor(toNumber(v));
      if (st && st.built) {
        if (i >= 0 && i < st.count && st.show) st.show(i);
      } else if (finite(i)) setAttr(this, "value", textOf(i));
    }
  });

  function measure() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height || 0);
    if (!(h >= 0)) h = 0;
    if (h > 20000) h = 20000;
    if (h === state.height) return;
    state.height = h;
    post({ type: "resize", height: h });
  }
  function watchSize() {
    measure();
    if (typeof ResizeObserver === "function") new ResizeObserver(measure).observe(document.documentElement);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchSize); else watchSize();
})();
`;
