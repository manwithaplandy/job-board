// @vitest-environment jsdom
// Runs KIT_JS once in jsdom. jsdom has no sandbox and parent === window here, so this
// checks the kit's own behaviour only (what it posts, what it renders); the sandbox and
// the CSP are Task 2.7's real-browser tests.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { KIT_CSS, KIT_JS } from "@/lib/agent/surfaces/v3/kit";

interface KitHost {
  readonly data: unknown;
  readonly theme: string;
  onInit(cb: (data: unknown, theme: string) => void): void;
  action(name: string, args?: unknown): void;
  chart(el: Element, spec: unknown): void;
}

const onWindow: unknown[] = [];
const onPort: unknown[] = [];
let port: MessagePort | null = null;

// jsdom's window.postMessage drops transferred ports, so the kit runs with `parent` bound
// to this stand-in, which records what it is sent the way the host's window would.
const fakeParent = {
  postMessage(data: unknown, targetOrigin: string, transfer?: MessagePort[]) {
    onWindow.push(data);
    expect(targetOrigin).toBe("*");
    if (port === null && transfer?.length === 1) {
      port = transfer[0];
      port.onmessage = (m) => onPort.push(m.data);
    }
  },
};
// Anything that reaches the real window from the kit would be a bug.
function record(e: MessageEvent) {
  if (e.data && typeof e.data === "object" && "type" in e.data && e.data.type !== "init") onWindow.push(["window", e.data]);
}
// The kit's `window`. vitest's jsdom environment copies the window's keys onto Node's global
// and deletes them on teardown, so a non-configurable lock the kit puts on global `open`
// would break the teardown. The kit therefore runs against this stand-in: what it defines
// (host, its locks) lands on the shadow object; everything else is read from the real
// global, whose functions vitest has already bound to the jsdom window.
const shadow: Record<string | symbol, unknown> = {};
const kitWindow: Record<string | symbol, unknown> = new Proxy(shadow, {
  get(target, key) {
    return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : Reflect.get(globalThis, key);
  },
  getPrototypeOf() {
    return Object.getPrototypeOf(globalThis);
  },
});

function host(): KitHost {
  const h: unknown = Reflect.get(kitWindow, "host");
  if (!h || typeof h !== "object") throw new Error("no host");
  return h as KitHost; // test-only view of the kit's global
}
function ofType(type: string): unknown[] {
  return onPort.filter((m) => m && typeof m === "object" && "type" in m && m.type === type);
}
function init(data: unknown, theme: string) {
  port!.postMessage({ type: "init", data, theme });
}
const tick = () => new Promise((r) => setTimeout(r, 20));

// jsdom has no Trusted Types, so a stand-in records the policy the kit creates.
interface DefaultPolicyRules {
  createHTML(s: string): string;
  createScript(s: string): string | null;
  createScriptURL(s: string): string;
}
const policies: Array<[string, DefaultPolicyRules]> = [];
const cspMetasAtPolicy: number[] = [];

beforeAll(() => {
  window.addEventListener("message", record);
  // The document as buildSandboxDocument writes it: two CSP metas, then the other metas.
  document.head.innerHTML =
    '<meta http-equiv="Content-Security-Policy" content="script-src \'nonce-AAAA\'">' +
    '<meta http-equiv="Content-Security-Policy" content="script-src \'sha256-AAAA\'">' +
    '<meta http-equiv="x-dns-prefetch-control" content="off">' +
    '<meta name="referrer" content="no-referrer">';
  Reflect.set(window, "trustedTypes", {
    createPolicy(name: string, rules: DefaultPolicyRules) {
      // What the kit has done by the time it creates the policy: the metas are already gone.
      cspMetasAtPolicy.push(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length);
      policies.push([name, rules]);
      return {};
    },
  });
  // jsdom has no WebRTC: a stand-in, so the kit's lock on the real prototype can be checked.
  shadow.RTCPeerConnection = FakePeerConnection;
  new Function("parent", "window", KIT_JS)(fakeParent, kitWindow);
});

class FakePeerConnection {
  createOffer() {
    return "offer";
  }
  createDataChannel() {
    return "channel";
  }
}
afterAll(() => {
  window.removeEventListener("message", record);
  port?.close();
});

describe("what the kit locks before the model's code runs (fix round 1, I1)", () => {
  test("both CSP meta elements are removed, and only those", () => {
    expect(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')).toHaveLength(0);
    expect(document.head.innerHTML).not.toContain("sha256-AAAA");
    expect(document.head.innerHTML).not.toContain("nonce-AAAA");
    expect(document.querySelector('meta[name="referrer"]')).not.toBeNull();
    expect(document.querySelector('meta[http-equiv="x-dns-prefetch-control"]')).not.toBeNull();
    // They were already gone when the kit's next step (the Trusted Types policy) ran.
    expect(cspMetasAtPolicy).toEqual([0]);
  });

  test("one default Trusted Types policy: script URLs throw, script text is refused, frame markup throws", () => {
    expect(policies.map(([name]) => name)).toEqual(["default"]);
    const rules = policies[0][1];
    expect(() => rules.createScriptURL("x.js")).toThrow();
    expect(() => rules.createScriptURL("")).toThrow();
    expect(rules.createScript("alert(1)")).toBeNull();
    expect(rules.createHTML("<svg></svg>")).toBe("<svg></svg>");
    expect(rules.createHTML("<p class=\"a\">x</p>")).toBe("<p class=\"a\">x</p>");
    for (const bad of ["<script>x</script>", "<SCRIPT src=x>", "<iframe srcdoc=x>", "<frame>", "<object>", "<embed>", "<portal>", "<fencedframe>", "<link rel=preconnect>", "<meta http-equiv=refresh>", "<base>"]) {
      expect(() => rules.createHTML(bad), bad).toThrow();
    }
  });

  test("document.write and writeln throw and cannot be put back", () => {
    expect(() => document.write("<p>x</p>")).toThrow();
    expect(() => document.writeln("<p>x</p>")).toThrow();
    expect(() => Object.defineProperty(Document.prototype, "write", { value: () => {} })).toThrow();
  });

  test("createElement and createElementNS refuse nested frames, in this document and any other", () => {
    for (const tag of ["iframe", "IFRAME", "frame", "object", "embed", "portal", "fencedframe"]) {
      expect(() => document.createElement(tag), tag).toThrow();
    }
    expect(() => document.createElementNS("http://www.w3.org/1999/xhtml", "iframe")).toThrow();
    expect(() => document.createElementNS("http://www.w3.org/1999/xhtml", "html:iframe")).toThrow();
    expect(() => document.implementation.createHTMLDocument("x").createElement("iframe")).toThrow();
    expect(document.createElement("div").tagName).toBe("DIV");
    expect(document.createElementNS("http://www.w3.org/2000/svg", "svg").localName).toBe("svg");
  });

  test("createElement and createElementNS refuse link, meta and base (Task 2.7, CI run 1)", () => {
    for (const tag of ["link", "LINK", "meta", "base"]) {
      expect(() => document.createElement(tag), tag).toThrow();
      expect(() => document.createElementNS("http://www.w3.org/1999/xhtml", tag), tag).toThrow();
    }
  });

  test("the WebRTC constructors and window.open throw and cannot be put back (Task 2.7, CI run 1)", () => {
    for (const name of ["RTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel", "RTCIceCandidate", "RTCSessionDescription"]) {
      const value: unknown = Reflect.get(kitWindow, name);
      expect(typeof value, name).toBe("function");
      expect(() => Reflect.construct(value as new () => unknown, []), name).toThrow();
      expect(Object.getOwnPropertyDescriptor(kitWindow, name), name).toMatchObject({ writable: false, configurable: false });
      expect(Reflect.set(kitWindow, name, FakePeerConnection), name).toBe(false);
      expect(() => Object.defineProperty(kitWindow, name, { value: FakePeerConnection }), name).toThrow();
    }
    // The methods that start ICE are locked on the original prototype too.
    expect(() => new FakePeerConnection().createOffer()).toThrow();
    expect(() => new FakePeerConnection().createDataChannel()).toThrow();
    const open: unknown = Reflect.get(kitWindow, "open");
    expect(() => (open as (u: string) => unknown)("x")).toThrow();
    expect(Object.getOwnPropertyDescriptor(kitWindow, "open")).toMatchObject({ writable: false, configurable: false });
  });
});

describe("the kit in a document", () => {
  test("it posts one ready with a port to the parent window, and talks on the port after that", async () => {
    await vi.waitFor(() => expect(onWindow).toEqual([{ type: "ready" }]));
    expect(port).not.toBeNull();
    await vi.waitFor(() => expect(ofType("resize").length).toBeGreaterThanOrEqual(1));
    expect(Object.isFrozen(host())).toBe(true);
    expect(host().data).toBeNull();
    expect(host().theme).toBe("light");
  });

  test("a theme message before init changes nothing (Task 2.8, review M8)", async () => {
    port!.postMessage({ type: "theme", theme: "dark" });
    await tick();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(host().theme).toBe("light");
  });

  test("init on the port sets data and theme once; a second init and an init on the window are ignored", async () => {
    window.dispatchEvent(new MessageEvent("message", { data: { type: "init", data: { forged: true }, theme: "dark" } }));
    await tick();
    expect(host().data).toBeNull();

    const seen: unknown[] = [];
    host().onInit((data, theme) => seen.push([data, theme]));
    init({ jobs: {} }, "dark");
    init({ other: 1 }, "light");
    await vi.waitFor(() => expect(seen).toEqual([[{ jobs: {} }, "dark"]]));
    await tick();
    expect(seen).toHaveLength(1);
    expect(host().data).toEqual({ jobs: {} });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    const late: unknown[] = [];
    host().onInit((data) => late.push(data));
    expect(late).toEqual([{ jobs: {} }]);
    // Fix round 1, I2: exactly one inited ack, for the first init only.
    expect(ofType("inited")).toEqual([{ type: "inited" }]);
  });

  test("the inited ack goes out before any onInit callback runs", () => {
    const order = onPort.map((m) => (m && typeof m === "object" && "type" in m ? m.type : null));
    const ack = order.indexOf("inited");
    expect(ack).toBeGreaterThanOrEqual(0);
    // Nothing a callback could post (an action or an error) comes before it.
    expect(order.slice(0, ack).filter((t) => t === "action" || t === "error")).toEqual([]);
  });

  test("every ping on the port gets a pong with the same number (fix round 1, I2)", async () => {
    port!.postMessage({ type: "ping", n: 4 });
    port!.postMessage({ type: "ping", n: 5 });
    port!.postMessage({ type: "ping", n: "x" });
    await vi.waitFor(() => expect(ofType("pong")).toHaveLength(3));
    expect(ofType("pong")).toEqual([{ type: "pong", n: 4 }, { type: "pong", n: 5 }, { type: "pong", n: 0 }]);
  });

  test("after init a theme message on the port sets data-theme and host.theme; anything else is ignored (Task 2.8)", async () => {
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    port!.postMessage({ type: "theme", theme: "light" });
    await vi.waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("light"));
    expect(host().theme).toBe("light");
    port!.postMessage({ type: "theme", theme: "blue" });
    port!.postMessage({ type: "theme", theme: "<x>" });
    await tick();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    port!.postMessage({ type: "theme", theme: "dark" });
    await vi.waitFor(() => expect(host().theme).toBe("dark"));
    // The data stays as init set it, and no second ack goes out.
    expect(host().data).toEqual({ jobs: {} });
    expect(ofType("inited")).toHaveLength(1);
  });

  test("a jb-button press posts its action on the port and nothing else happens", async () => {
    document.body.innerHTML = `<jb-button action='{"name":"shortlist.set","jobId":"greenhouse:acme:101","state":"shortlisted"}'>Keep</jb-button>`;
    const button = document.querySelector("jb-button")!;
    expect(button.getAttribute("role")).toBe("button");
    expect(button.getAttribute("tabindex")).toBe("0");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(ofType("action")).toHaveLength(2));
    expect(ofType("action")[0]).toEqual({
      type: "action",
      name: "shortlist.set",
      args: { jobId: "greenhouse:acme:101", state: "shortlisted" },
    });
    expect(onWindow).toEqual([{ type: "ready" }]); // the ready, and nothing since
  });

  test("a jb-button with an action that is not JSON posts nothing", async () => {
    const before = ofType("action").length;
    document.body.innerHTML = `<jb-button action="not json">x</jb-button>`;
    document.querySelector("jb-button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(ofType("action")).toHaveLength(before);
  });

  test("jb-field renders a labelled input and exposes its value", () => {
    document.body.innerHTML = `<jb-field name="why" label="Why"></jb-field>`;
    const field = document.querySelector("jb-field")!;
    const input = field.querySelector("input")!;
    const label = field.querySelector("label")!;
    expect(label.textContent).toBe("Why");
    expect(label.getAttribute("for")).toBe(input.id);
    input.value = "typed";
    expect(Reflect.get(field, "value")).toBe("typed");
  });

  test("host.chart draws inline SVG with text labels and no markup from the data", () => {
    document.body.innerHTML = `<div id="c"></div>`;
    const el = document.getElementById("c")!;
    host().chart(el, { viz: "bar", title: "Stages", points: [{ label: "<b>a</b>", value: 2 }, { label: "b", value: 4 }, { label: "c", value: -1 }] });
    const svg = el.querySelector("svg")!;
    expect(svg.namespaceURI).toContain("svg");
    expect(svg.getAttribute("aria-label")).toBe("Stages");
    expect(svg.querySelectorAll("rect")).toHaveLength(3);
    expect(svg.querySelector("b")).toBeNull();
    expect([...svg.querySelectorAll("text")].map((t) => t.textContent)).toEqual(["<b>a</b>", "b", "c"]);
    host().chart(el, { viz: "line", points: [{ label: "a", value: 1 }, { label: "b", value: 3 }] });
    expect(el.querySelectorAll("svg")).toHaveLength(1);
    expect(el.querySelector("polyline")).not.toBeNull();
  });

  test("an uncaught error is reported once, clipped to 500 characters", async () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "x".repeat(900) }));
    window.dispatchEvent(new ErrorEvent("error", { message: "second" }));
    await vi.waitFor(() => expect(ofType("error")).toHaveLength(1));
    await tick();
    expect(ofType("error")).toEqual([{ type: "error", message: "x".repeat(500) }]);
  });
});

describe("links and leaving (Task 2.7, CI run 2)", () => {
  test("a click whose path holds an element with an href is cancelled before any listener the model adds", () => {
    document.body.innerHTML = "";
    const a = document.createElement("a");
    a.setAttribute("href", "#elsewhere");
    a.setAttribute("target", "_top");
    const inner = document.createElement("span");
    a.appendChild(inner);
    document.body.appendChild(a);
    // A model listener that tries to get in first: a capture listener on the window that stops propagation.
    const stopper = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener("click", stopper, true);
    const seen: boolean[] = [];
    a.addEventListener("click", (e) => seen.push(e.defaultPrevented));
    // All in the same task as the setAttribute, so the observer has not stripped the href yet:
    // only the guard acts.
    const first = new MouseEvent("click", { bubbles: true, cancelable: true });
    try {
      a.dispatchEvent(first);
    } finally {
      window.removeEventListener("click", stopper, true);
    }
    expect(first.defaultPrevented).toBe(true);
    // The stopper ran after the guard and kept the event from reaching the anchor's own listener.
    expect(seen).toEqual([]);
    const fromChild = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
    inner.dispatchEvent(fromChild);
    expect(fromChild.defaultPrevented).toBe(true);
    expect(seen).toEqual([true]);
    const aux = new MouseEvent("auxclick", { bubbles: true, cancelable: true });
    a.dispatchEvent(aux);
    expect(aux.defaultPrevented).toBe(true);

    const button = document.createElement("button");
    document.body.appendChild(button);
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });

  test("href is stripped from elements as they are added or given one, in the document and in shadow roots", async () => {
    document.body.innerHTML = "";
    const holder = document.createElement("div");
    holder.innerHTML = '<p><a id="m" href="#x">x</a></p>';
    document.body.appendChild(holder);
    const later = document.createElement("span");
    document.body.appendChild(later);
    await tick();
    expect(document.getElementById("m")!.hasAttribute("href")).toBe(false);
    later.setAttribute("href", "#y");
    const svgA = document.createElementNS("http://www.w3.org/2000/svg", "a");
    svgA.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#z");
    document.body.appendChild(svgA);
    await tick();
    expect(later.hasAttribute("href")).toBe(false);
    expect(svgA.getAttributeNames()).toEqual([]);

    const shadowHost = document.createElement("div");
    document.body.appendChild(shadowHost);
    const root = shadowHost.attachShadow({ mode: "closed" });
    expect(shadowHost.shadowRoot).toBe(root);
    const hidden = document.createElement("a");
    hidden.setAttribute("href", "#hidden");
    root.appendChild(hidden);
    await tick();
    expect(hidden.hasAttribute("href")).toBe(false);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "attachShadow")).toMatchObject({ writable: false, configurable: false });
  });

  test("the run-time parsers of declarative shadow roots throw", () => {
    const setHTMLUnsafe: unknown = Reflect.get(Element.prototype, "setHTMLUnsafe");
    expect(() => (setHTMLUnsafe as (h: string) => void).call(document.createElement("div"), "<p>x</p>")).toThrow();
    const parseHTMLUnsafe: unknown = Reflect.get(Document, "parseHTMLUnsafe");
    expect(() => (parseHTMLUnsafe as (h: string) => unknown)("<p>x</p>")).toThrow();
  });

  test("beforeunload posts navigating once, and a replaced MessagePort.prototype.postMessage cannot stop it", async () => {
    const original = MessagePort.prototype.postMessage;
    const pongsBefore = ofType("pong").length;
    try {
      MessagePort.prototype.postMessage = function () {};
      window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), true);
      window.dispatchEvent(new Event("beforeunload"));
      window.dispatchEvent(new Event("beforeunload"));
    } finally {
      MessagePort.prototype.postMessage = original;
    }
    await vi.waitFor(() => expect(ofType("navigating")).toEqual([{ type: "navigating" }]));
    await tick();
    expect(ofType("navigating")).toHaveLength(1);
    // The kit still answers pings over its own port after the prototype was replaced and restored.
    port!.postMessage({ type: "ping", n: 9 });
    await vi.waitFor(() => expect(ofType("pong")).toHaveLength(pongsBefore + 1));
  });
});

// PR 3 Task 3.5 (spec 08 S9.2): Escape inside a frame leaves an expanded view. Only a
// trusted Escape that nothing handled is posted, so model code can neither forge one nor
// lose an Escape it used for itself.
// jsdom marks only its own events trusted: this sets the flag on the event's
// implementation and dispatches it the way jsdom dispatches a real key press.
function implOf(o: object): { isTrusted: boolean; _dispatch(e: unknown): void } {
  const key = Object.getOwnPropertySymbols(o).find((s) => s.description === "impl");
  if (!key) throw new Error("no jsdom impl");
  return Reflect.get(o, key);
}
function pressTrusted(target: EventTarget, init: KeyboardEventInit) {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  const impl = implOf(ev);
  impl.isTrusted = true;
  implOf(target)._dispatch(impl);
  expect(ev.isTrusted).toBe(true);
  return ev;
}

describe("escape", () => {
  test("a trusted Escape posts one escape with no payload", async () => {
    const before = ofType("escape").length;
    pressTrusted(document.body, { key: "Escape" });
    await vi.waitFor(() => expect(ofType("escape")).toHaveLength(before + 1));
    expect(ofType("escape").at(-1)).toEqual({ type: "escape" });
    await tick();
    expect(ofType("escape")).toHaveLength(before + 1);
  });

  test("an untrusted Escape (dispatched by model code) and other keys post nothing", async () => {
    const before = ofType("escape").length;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    pressTrusted(document.body, { key: "Enter" });
    pressTrusted(document.body, { key: "Esc" });
    await tick();
    expect(ofType("escape")).toHaveLength(before);
  });

  test("an Escape the document handled (preventDefault, in any phase) posts nothing", async () => {
    const before = ofType("escape").length;
    const handle = (e: Event) => e.preventDefault();
    document.addEventListener("keydown", handle);
    try {
      pressTrusted(document.body, { key: "Escape" });
      await tick();
    } finally {
      document.removeEventListener("keydown", handle);
    }
    expect(ofType("escape")).toHaveLength(before);
  });

  test("a model listener that stops the event cannot swallow the kit's escape", async () => {
    const before = ofType("escape").length;
    const stop = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener("keydown", stop, true);
    try {
      pressTrusted(document.body, { key: "Escape" });
      await vi.waitFor(() => expect(ofType("escape")).toHaveLength(before + 1));
    } finally {
      window.removeEventListener("keydown", stop, true);
    }
  });
});

// PR 5 Task 5.2 (spec 08 S9.3): the layout classes as jsdom computes them from KIT_CSS.
describe("kit classes in a document", () => {
  beforeAll(() => {
    const style = document.createElement("style");
    style.textContent = KIT_CSS;
    document.head.appendChild(style);
  });

  test("jb-grid uses repeat(auto-fit, minmax(220px, 1fr)); jb-row wraps; jb-hidden hides", () => {
    document.body.innerHTML = '<div class="jb-grid"></div><div class="jb-row"></div><div class="jb-row jb-hidden"></div><div class="jb-cols-3"></div>';
    const [grid, row, hidden, cols] = [...document.body.children];
    expect(getComputedStyle(grid).display).toBe("grid");
    expect(getComputedStyle(grid).gridTemplateColumns).toBe("repeat(auto-fit, minmax(220px, 1fr))");
    expect(getComputedStyle(row).display).toBe("flex");
    expect(getComputedStyle(row).flexWrap).toBe("wrap");
    expect(getComputedStyle(hidden).display).toBe("none");
    expect(getComputedStyle(cols).gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });
});

// PR 5 Task 5.3 (spec 08 S9.4): the control elements. Each has a visible label, a value
// property, a bubbling change CustomEvent with detail { name, value }, keyboard support
// and a 44px target in KIT_CSS. The kit builds an element once its children are parsed
// (on DOMContentLoaded, or in a microtask when the document has loaded), so each test
// waits a tick after writing the markup.
function press(target: Element, key: string) {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}
/** The change events that bubble to the body while fn runs. */
function changes(fn: () => void): Array<{ detail: unknown; bubbles: boolean; custom: boolean }> {
  const seen: Array<{ detail: unknown; bubbles: boolean; custom: boolean }> = [];
  const on = (e: Event) => seen.push({ detail: e instanceof CustomEvent ? e.detail : undefined, bubbles: e.bubbles, custom: e instanceof CustomEvent });
  document.body.addEventListener("change", on);
  try {
    fn();
  } finally {
    document.body.removeEventListener("change", on);
  }
  return seen;
}
/** The text of the element an ARIA reference names, or the label element for an input. */
function labelText(el: Element): string {
  const ids = el.getAttribute("aria-labelledby");
  if (ids) return ids.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  const id = el.getAttribute("id");
  return id ? (document.querySelector(`label[for="${id}"]`)?.textContent ?? "") : "";
}
/** The declarations KIT_CSS gives a selector, all rules joined. */
function cssFor(selector: string): string {
  return [...KIT_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").map((x) => x.trim()).includes(selector))
    .map((m) => m[2])
    .join("");
}
function value(el: Element): unknown {
  return Reflect.get(el, "value");
}

describe("jb-select", () => {
  test("a labelled select-only combobox: value, change with a string, keyboard, 44px", async () => {
    document.body.innerHTML = `<jb-select name="stage" label="Stage" value="applied"><option value="ready">Ready</option><option value="applied">Applied</option><option value="offer">Offer</option></jb-select>`;
    const sel = document.querySelector("jb-select")!;
    expect(value(sel)).toBe("applied");
    await tick();
    const combo = sel.querySelector('[role="combobox"]')!;
    expect(combo).not.toBeNull();
    expect(labelText(combo)).toBe("Stage");
    expect(sel.querySelector(".jb-control__label")?.textContent).toBe("Stage");
    expect(combo.textContent).toContain("Applied");
    expect(combo.getAttribute("tabindex")).toBe("0");
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    const list = sel.querySelector('[role="listbox"]')!;
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(3);
    // The original option elements are gone from the light DOM's flow.
    expect(sel.querySelectorAll("option")).toHaveLength(0);

    // Keyboard: ArrowDown opens on the selected option, ArrowDown moves, Enter chooses.
    const seen = changes(() => {
      press(combo, "ArrowDown");
      expect(combo.getAttribute("aria-expanded")).toBe("true");
      expect(combo.getAttribute("aria-activedescendant")).toBe(list.querySelectorAll('[role="option"]')[1].id);
      press(combo, "ArrowDown");
      press(combo, "Enter");
    });
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    expect(seen).toEqual([{ detail: { name: "stage", value: "offer" }, bubbles: true, custom: true }]);
    expect(value(sel)).toBe("offer");
    expect(combo.textContent).toContain("Offer");
    expect(list.querySelectorAll('[role="option"]')[2].getAttribute("aria-selected")).toBe("true");

    // Click: open, pick an option.
    const clicked = changes(() => {
      (combo as HTMLElement).click();
      (list.querySelectorAll('[role="option"]')[0] as HTMLElement).click();
    });
    expect(clicked.map((c) => c.detail)).toEqual([{ name: "stage", value: "ready" }]);

    // The value property sets without an event; an unknown value changes nothing.
    expect(changes(() => Reflect.set(sel, "value", "applied"))).toEqual([]);
    expect(value(sel)).toBe("applied");
    Reflect.set(sel, "value", "nope");
    expect(value(sel)).toBe("applied");

    expect(cssFor(".jb-select__button")).toMatch(/min-height: var\(--target-size\);/);
    expect(cssFor(".jb-select__option")).toMatch(/min-height: var\(--target-size\);/);
  });
});

// PR 5 (spec 08 S9.2): Escape with an open <jb-select> popup closes the popup and does not
// leave the expanded view; with no popup open it posts escape as before.
describe("escape and an open jb-select popup", () => {
  async function openSelect() {
    document.body.innerHTML = `<jb-select name="s" label="S"><option value="a">A</option><option value="b">B</option></jb-select>`;
    await tick();
    const combo = document.querySelector('jb-select [role="combobox"]') as HTMLElement;
    combo.focus();
    combo.click();
    expect(combo.getAttribute("aria-expanded")).toBe("true");
    return combo;
  }

  test("a trusted Escape closes the open popup and posts no escape, even when a model listener stops the event first", async () => {
    const combo = await openSelect();
    const before = ofType("escape").length;
    const stop = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener("keydown", stop, true);
    try {
      pressTrusted(combo, { key: "Escape" });
    } finally {
      window.removeEventListener("keydown", stop, true);
    }
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('jb-select [role="listbox"]')!.classList.contains("jb-hidden")).toBe(true);
    await tick();
    expect(ofType("escape")).toHaveLength(before);
  });

  test("with the popup closed, a trusted Escape on the select posts escape", async () => {
    const combo = await openSelect();
    pressTrusted(combo, { key: "Escape" });
    await tick();
    const before = ofType("escape").length;
    expect(combo.getAttribute("aria-expanded")).toBe("false");
    pressTrusted(combo, { key: "Escape" });
    await vi.waitFor(() => expect(ofType("escape")).toHaveLength(before + 1));
  });
});

describe("jb-slider", () => {
  test("a labelled range that shows its value: value, change with a number, keyboard, 44px", async () => {
    document.body.innerHTML = `<jb-slider name="min" label="Minimum fit" min="0" max="100" step="5" value="40"></jb-slider>`;
    const slider = document.querySelector("jb-slider")!;
    await tick();
    const input = slider.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(labelText(input)).toBe("Minimum fit");
    expect(slider.querySelector(".jb-control__label")?.textContent).toBe("Minimum fit");
    const shown = slider.querySelector(".jb-slider__value")!;
    expect(shown.textContent).toBe("40");
    expect(value(slider)).toBe(40);

    const keys = changes(() => {
      press(input, "ArrowRight");
      press(input, "ArrowUp");
      press(input, "ArrowLeft");
    });
    expect(keys.map((c) => c.detail)).toEqual([{ name: "min", value: 45 }, { name: "min", value: 50 }, { name: "min", value: 45 }]);
    expect(keys.every((c) => c.bubbles && c.custom)).toBe(true);
    expect(shown.textContent).toBe("45");
    expect(input.getAttribute("aria-valuetext")).toBe("45");
    expect(changes(() => press(input, "End")).map((c) => c.detail)).toEqual([{ name: "min", value: 100 }]);
    // At the end already: no change, no event.
    expect(changes(() => press(input, "ArrowRight"))).toEqual([]);
    expect(changes(() => press(input, "Home")).map((c) => c.detail)).toEqual([{ name: "min", value: 0 }]);

    // A drag (the native input event) changes it too; the native change event stays inside.
    const dragged = changes(() => {
      input.value = "60";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(dragged).toEqual([{ detail: { name: "min", value: 60 }, bubbles: true, custom: true }]);

    // The value property sets (snapped to the step, clamped) without an event.
    expect(changes(() => Reflect.set(slider, "value", 72))).toEqual([]);
    expect(value(slider)).toBe(70);
    Reflect.set(slider, "value", 400);
    expect(value(slider)).toBe(100);
    expect(shown.textContent).toBe("100");

    expect(cssFor(".jb-slider__input")).toMatch(/min-height: var\(--target-size\);/);
  });

  test("format shows the value as host.format would: percent of a ratio, without float noise", async () => {
    document.body.innerHTML = `<jb-slider name="rate" label="Rate" min="0" max="1" step="0.05" value="0.35" format="percent"></jb-slider>`;
    const slider = document.querySelector("jb-slider")!;
    await tick();
    const input = slider.querySelector("input")!;
    expect(slider.querySelector(".jb-slider__value")?.textContent).toBe("35%");
    expect(changes(() => press(input, "ArrowUp")).map((c) => c.detail)).toEqual([{ name: "rate", value: 0.4 }]);
    expect(slider.querySelector(".jb-slider__value")?.textContent).toBe("40%");
    document.body.innerHTML = `<jb-slider name="d" label="Days" min="0" max="30" value="1" format="days"></jb-slider>`;
    await tick();
    expect(document.querySelector(".jb-slider__value")?.textContent).toBe("1 day");
  });
});
