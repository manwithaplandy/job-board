// The kit injected ahead of every variant 3 document (plan Task 2.5, spec 7.1 "Sandboxed
// code"). buildSandboxDocument (document.ts) places KIT_CSS and KIT_JS in nonce'd, hashed
// elements before the model's HTML.
//
// KIT_CSS: the design tokens from app/globals.css (kitTokens.ts, checked against
// globals.css in kit.test.ts) for light and dark, and base styles that give <jb-button>
// and <jb-field> a 44px minimum target. Fonts are the system stack: the frame's CSP has
// font-src 'none'.
//
// KIT_JS: the custom elements <jb-button action='{"name":...}'> and
// <jb-field name label>, and a frozen `host` object:
//   host.data, host.theme   the snapshot and theme from the host's init (null and "light"
//                           until init arrives, which is after the document's own
//                           scripts start: read them in host.onInit)
//   host.onInit(cb)         cb(data, theme) once init has arrived
//   host.action(name, args) posts a request to the host and nothing else: the host turns
//                           it into a chip the user must press (D13, SandboxFrame)
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
  tokenBlock(":root", KIT_TOKENS.light) + tokenBlock(':root[data-theme="dark"]', KIT_TOKENS.dark) + BASE_CSS + LAYOUT_CSS + CONTROLS_CSS;

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
  var hasOwn = uncurry(Object.prototype.hasOwnProperty);
  var ownKeys = Object.keys;
  var freeze = Object.freeze;
  var isList = Array.isArray;
  var finite = isFinite;
  var toNumber = Number;
  var M = { max: Math.max, min: Math.min, round: Math.round, floor: Math.floor, abs: Math.abs, sin: Math.sin, cos: Math.cos, PI: Math.PI };
  var ChangeEvent = CustomEvent;
  var defer = typeof queueMicrotask === "function" ? queueMicrotask : function (f) { setTimeout(f, 0); };
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
    var s = String(value == null ? "" : value);
    return s.length > max ? s.slice(0, max) : s;
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

  window.addEventListener("error", function (e) { report(e && e.message ? e.message : "script error"); });
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

  /* Inline SVG only. The SVG namespace comes from a parsed element, so no URL is written here. */
  var svgNamespace = null;
  function svgEl(tag, attrs) {
    if (svgNamespace === null) {
      var holder = document.createElement("div");
      holder.innerHTML = "<svg></svg>";
      svgNamespace = holder.firstChild.namespaceURI;
    }
    var el = document.createElementNS(svgNamespace, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, String(attrs[k]));
    return el;
  }
  function chart(el, spec) {
    if (!el || typeof el.appendChild !== "function") return;
    spec = spec && typeof spec === "object" ? spec : {};
    var raw = Array.isArray(spec.points) ? spec.points.slice(0, CHART_POINTS_MAX) : [];
    var points = [];
    var max = 0;
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i] && typeof raw[i] === "object" ? raw[i] : {};
      var v = typeof p.value === "number" && isFinite(p.value) && p.value > 0 ? p.value : 0;
      if (v > max) max = v;
      points.push({ label: clip(p.label, LABEL_MAX), value: v });
    }
    if (max <= 0) max = 1;
    var W = 320, H = 160, BASE = 136, PLOT = 124;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "class": "jb-chart", "aria-label": clip(spec.title || "Chart", 80) });
    svg.appendChild(svgEl("line", { x1: 0, y1: BASE, x2: W, y2: BASE, "class": "jb-chart-axis" }));
    var n = Math.max(points.length, 1);
    var step = W / n;
    if (spec.viz === "line" || spec.viz === "sparkline") {
      var coords = [];
      for (var j = 0; j < points.length; j++) {
        coords.push((step * j + step / 2).toFixed(1) + "," + (BASE - (points[j].value / max) * PLOT).toFixed(1));
      }
      svg.appendChild(svgEl("polyline", { points: coords.join(" "), "class": "jb-chart-line" }));
    } else {
      for (var b = 0; b < points.length; b++) {
        var h = (points[b].value / max) * PLOT;
        var bar = svgEl("rect", { x: (step * b + step * 0.15).toFixed(1), y: (BASE - h).toFixed(1), width: (step * 0.7).toFixed(1), height: h.toFixed(1), "class": "jb-chart-bar" });
        var tip = svgEl("title", {});
        tip.textContent = points[b].label + ": " + points[b].value;
        bar.appendChild(tip);
        svg.appendChild(bar);
      }
    }
    if (spec.viz !== "sparkline") {
      for (var t = 0; t < points.length; t++) {
        var text = svgEl("text", { x: (step * t + step / 2).toFixed(1), y: H - 6, "text-anchor": "middle", "class": "jb-chart-label" });
        text.textContent = points[t].label;
        svg.appendChild(text);
      }
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(svg);
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
    chart: chart
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
          var a = parseAction(this.getAttribute("action") || "");
          if (a) host.action(a.name, a.args);
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
    if (text !== undefined && text !== null) setText(e, String(text));
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
      v = String(v);
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
    var s = trimText(String(text));
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
    setAttr(input, "min", String(min));
    setAttr(input, "max", String(max));
    setAttr(input, "step", String(step));
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
      setInputValue(input, String(st.value));
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
      if (st && st.built && st.set) st.set(toNumber(v)); else setAttr(this, "value", String(v));
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
      v = String(v);
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
      } else if (finite(i)) setAttr(this, "value", String(i));
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
