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
  border: 1px solid var(--accent);
  border-radius: var(--radius-control);
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: var(--font-size-control);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
jb-button:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
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

export const KIT_CSS: string =
  tokenBlock(":root", KIT_TOKENS.light) + tokenBlock(':root[data-theme="dark"]', KIT_TOKENS.dark) + BASE_CSS;

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
  var FRAME_MARKUP_RE = /<(?:script|iframe|frame|object|embed|portal|fencedframe)\\b/i;
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
  var BLOCKED_ELEMENTS = { iframe: 1, frame: 1, object: 1, embed: 1, portal: 1, fencedframe: 1 };
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

  var state ={ data: null, theme: "light", inited: false, waiting: [], reported: false, height: -1 };
  var CHART_POINTS_MAX = 50;
  var LABEL_MAX = 40;
  var channel = new MessageChannel();
  var port = channel.port1;

  function post(msg) {
    try { port.postMessage(msg); } catch (err) { /* an uncloneable value: nothing is sent */ }
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
