// @vitest-environment jsdom
// Runs KIT_JS once in jsdom. jsdom has no sandbox and parent === window here, so this
// checks the kit's own behaviour only (what it posts, what it renders); the sandbox and
// the CSP are Task 2.7's real-browser tests.
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { KIT_CSS, KIT_JS } from "@/lib/agent/surfaces/v3/kit";
import { payLabel } from "@/components/agent/blocks/shared";
import type { ReviewFacts } from "@/lib/workspaces/types";
import { sha256Base64 } from "@/lib/agent/surfaces/v3/sha256";

interface KitHost {
  readonly data: unknown;
  readonly theme: string;
  onInit(cb: (data: unknown, theme: string) => void): void;
  action(name: string, args?: unknown): void;
  ask(text: unknown): boolean;
  chart(el: Element, spec: unknown): unknown;
  el(tag: string, attrs?: Record<string, unknown>, children?: unknown[]): Element;
  format: {
    number(n: unknown): string;
    percent(n: unknown): string;
    days(n: unknown): string;
    date(iso: unknown): string;
    pay(review: unknown): string | null;
  };
  job(id: unknown): { job: unknown; review: unknown; shortlist: unknown; application: unknown } | null;
  table(el: Element, spec: unknown): { update(rows: unknown[]): void; sort(key: string, dir?: string): void };
}

// The snapshot the first init carries (the shape of sandboxSnapshot, trimmed): host.job
// joins over it. JOB_C is only in the applications list, with its job inside.
const JOB_A = "greenhouse:acme:101";
const JOB_B = "lever:globex:202";
const JOB_C = "ashby:initech:303";
const INIT_DATA = {
  jobs: {
    [JOB_A]: { jobId: JOB_A, title: "Platform Engineer", company: "Acme" },
    [JOB_B]: { jobId: JOB_B, title: "Backend Engineer", company: "Globex" },
  },
  reviews: {
    [JOB_A]: { jobId: JOB_A, fitScore: 82, payMin: 150000, payMax: 180000, payCurrency: "USD", payPeriod: "year" },
  },
  shortlist: [{ jobId: JOB_A, state: "shortlisted", job: { jobId: JOB_A, title: "Platform Engineer", company: "Acme" } }],
  applications: [
    { jobId: JOB_B, stage: "applied", job: { jobId: JOB_B, title: "Backend Engineer", company: "Globex" } },
    { jobId: JOB_C, stage: "interviewing", job: { jobId: JOB_C, title: "Data Engineer", company: "Initech" } },
  ],
};

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
  // PR 6: navigator.userActivation, as browsers have it (an object whose isActive is a getter
  // on its prototype), with the activation state set by the test.
  shadow.navigator = { userActivation: fakeActivation };
  new Function("parent", "window", KIT_JS)(fakeParent, kitWindow);
});

// PR 6: a stand-in for the browser's UserActivation; isActive reads `activation.active`.
const activation = { active: false };
class FakeUserActivation {
  get isActive() {
    return activation.active;
  }
  get hasBeenActive() {
    return activation.active;
  }
}
const fakeActivation = new FakeUserActivation();

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
    init(INIT_DATA, "dark");
    init({ other: 1 }, "light");
    await vi.waitFor(() => expect(seen).toEqual([[INIT_DATA, "dark"]]));
    await tick();
    expect(seen).toHaveLength(1);
    expect(host().data).toEqual(INIT_DATA);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    const late: unknown[] = [];
    host().onInit((data) => late.push(data));
    expect(late).toEqual([INIT_DATA]);
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
    expect(host().data).toEqual(INIT_DATA);
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

describe("jb-toggle", () => {
  test("a labelled switch: value and checked, change with a boolean, Space and Enter, 44px", async () => {
    document.body.innerHTML = `<jb-toggle name="remote" label="Remote only" checked></jb-toggle><jb-toggle name="off" label="Off"></jb-toggle>`;
    const [on, off] = [...document.querySelectorAll("jb-toggle")];
    await tick();
    const sw = on.querySelector('[role="switch"]') as HTMLElement;
    expect(sw).not.toBeNull();
    expect(sw.getAttribute("tabindex")).toBe("0");
    expect(sw.textContent).toContain("Remote only");
    expect(on.querySelector(".jb-control__label")?.textContent).toBe("Remote only");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(value(on)).toBe(true);
    expect(Reflect.get(on, "checked")).toBe(true);
    expect(value(off)).toBe(false);

    const seen = changes(() => {
      press(sw, " ");
      press(sw, "Enter");
      sw.click();
    });
    expect(seen.map((c) => c.detail)).toEqual([
      { name: "remote", value: false },
      { name: "remote", value: true },
      { name: "remote", value: false },
    ]);
    expect(seen.every((c) => c.bubbles && c.custom)).toBe(true);
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(press(sw, " ").defaultPrevented).toBe(true);

    expect(changes(() => Reflect.set(off, "value", true))).toEqual([]);
    expect(off.querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("true");
    Reflect.set(off, "checked", false);
    expect(value(off)).toBe(false);

    expect(cssFor(".jb-toggle__switch")).toMatch(/min-height: var\(--target-size\);/);
  });
});

describe("jb-segmented", () => {
  test("a labelled radiogroup: value, change with a string, arrow keys move and select, roving tabindex, 44px", async () => {
    document.body.innerHTML = `<jb-segmented name="range" label="Range" value="month"><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option></jb-segmented>`;
    const seg = document.querySelector("jb-segmented")!;
    expect(value(seg)).toBe("month");
    await tick();
    const group = seg.querySelector('[role="radiogroup"]')!;
    expect(group).not.toBeNull();
    expect(labelText(group)).toBe("Range");
    expect(seg.querySelector(".jb-control__label")?.textContent).toBe("Range");
    const radios = [...group.querySelectorAll('[role="radio"]')] as HTMLElement[];
    expect(radios.map((r) => r.textContent)).toEqual(["Week", "Month", "Year"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(seg.querySelectorAll("option")).toHaveLength(0);

    radios[1].focus();
    const seen = changes(() => {
      press(radios[1], "ArrowRight");
      press(radios[2], "ArrowRight"); // wraps to the first
      press(radios[0], "ArrowLeft"); // wraps to the last
    });
    expect(seen.map((c) => c.detail)).toEqual([
      { name: "range", value: "year" },
      { name: "range", value: "week" },
      { name: "range", value: "year" },
    ]);
    expect(seen.every((c) => c.bubbles && c.custom)).toBe(true);
    expect(document.activeElement).toBe(radios[2]);
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "0"]);
    expect(value(seg)).toBe("year");

    expect(changes(() => radios[0].click()).map((c) => c.detail)).toEqual([{ name: "range", value: "week" }]);
    // Pressing the one already selected changes nothing.
    expect(changes(() => press(radios[0], " "))).toEqual([]);

    expect(changes(() => Reflect.set(seg, "value", "month"))).toEqual([]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);

    expect(cssFor(".jb-segmented__option")).toMatch(/min-height: var\(--target-size\);/);
  });
});

describe("jb-tabs and jb-tab", () => {
  test("a tablist over its panels: value is the index, change with a number, roving tabindex and arrow keys, 44px", async () => {
    document.body.innerHTML = `<jb-tabs name="view" label="Views" value="1"><jb-tab label="Summary"><p>one</p></jb-tab><jb-tab label="Pay"><p>two</p></jb-tab><jb-tab label="Risks"><p>three</p></jb-tab></jb-tabs>`;
    const tabs = document.querySelector("jb-tabs")!;
    expect(value(tabs)).toBe(1);
    await tick();
    const list = tabs.querySelector('[role="tablist"]')!;
    expect(list).not.toBeNull();
    expect(list.getAttribute("aria-label")).toBe("Views");
    const tab = [...list.querySelectorAll('[role="tab"]')] as HTMLElement[];
    const panels = [...tabs.querySelectorAll("jb-tab")];
    // Each tab's visible label is its own text, and it names its panel.
    expect(tab.map((t) => t.textContent)).toEqual(["Summary", "Pay", "Risks"]);
    expect(panels.map((p) => p.getAttribute("role"))).toEqual(["tabpanel", "tabpanel", "tabpanel"]);
    expect(panels.map((p) => labelText(p))).toEqual(["Summary", "Pay", "Risks"]);
    expect(tab.map((t) => t.getAttribute("aria-controls"))).toEqual(panels.map((p) => p.id));
    expect(tab.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(tab.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(panels.map((p) => p.hasAttribute("hidden"))).toEqual([true, false, true]);

    tab[1].focus();
    const seen = changes(() => {
      press(tab[1], "ArrowRight");
      press(tab[2], "ArrowRight"); // wraps
      press(tab[0], "End");
      press(tab[2], "Home");
    });
    expect(seen.map((c) => c.detail)).toEqual([
      { name: "view", value: 2 },
      { name: "view", value: 0 },
      { name: "view", value: 2 },
      { name: "view", value: 0 },
    ]);
    expect(seen.every((c) => c.bubbles && c.custom)).toBe(true);
    expect(document.activeElement).toBe(tab[0]);
    expect(panels.map((p) => p.hasAttribute("hidden"))).toEqual([false, true, true]);
    expect(value(tabs)).toBe(0);

    expect(changes(() => tab[2].click()).map((c) => c.detail)).toEqual([{ name: "view", value: 2 }]);
    expect(changes(() => Reflect.set(tabs, "value", 1))).toEqual([]);
    expect(panels.map((p) => p.hasAttribute("hidden"))).toEqual([true, false, true]);
    expect(tab.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);

    expect(cssFor(".jb-tabs__tab")).toMatch(/min-height: var\(--target-size\);/);
  });
});

describe('jb-button variant="secondary"', () => {
  test("a quieter button with the same 44px target and the same press: it posts its action on click and keys", async () => {
    document.body.innerHTML = `<jb-button action='{"name":"open","target":"applications"}'>Primary</jb-button><jb-button variant="secondary" action='{"name":"open","target":"tracker"}'>Open the tracker</jb-button>`;
    const secondary = document.querySelectorAll("jb-button")[1] as HTMLElement;
    expect(secondary.textContent).toBe("Open the tracker");
    expect(secondary.getAttribute("role")).toBe("button");
    expect(secondary.getAttribute("tabindex")).toBe("0");
    // jsdom does not resolve var(), so the rule itself is read: a surface fill, not the accent.
    expect(cssFor('jb-button[variant="secondary"]')).toMatch(/background: var\(--bg-surface\);/);
    expect(cssFor('jb-button[variant="secondary"]')).toMatch(/color: var\(--text-primary\);/);
    expect(cssFor('jb-button[variant="secondary"]')).toMatch(/border-color: var\(--border-strong\);/);
    expect(cssFor("jb-button")).toMatch(/min-height: var\(--target-size\);[^}]*min-width: var\(--target-size\);/);
    const before = ofType("action").length;
    secondary.click();
    press(secondary, "Enter");
    press(secondary, " ");
    await vi.waitFor(() => expect(ofType("action")).toHaveLength(before + 3));
    expect(ofType("action").at(-1)).toEqual({ type: "action", name: "open", args: { target: "tracker" } });
  });
});

// PR 5 Task 5.4 (spec 08 S9.5): host.el, host.format and host.job.
describe("host.el", () => {
  test("builds an element from the allowed attributes only; text and string children are text", () => {
    const p = host().el("p", { class: "x", text: "<b>", onclick: "y", "aria-label": "a", "data-k": "v" }, ["t"]);
    expect(p.tagName).toBe("P");
    expect(p.getAttribute("class")).toBe("x");
    expect(p.textContent).toBe("<b>t");
    expect(p.querySelector("b")).toBeNull();
    expect(p.hasAttribute("onclick")).toBe(false);
    expect(p.getAttribute("aria-label")).toBe("a");
    expect(p.getAttribute("data-k")).toBe("v");
    expect(p.getAttributeNames().sort()).toEqual(["aria-label", "class", "data-k"]);
  });

  test("role, title, colspan, rowspan and hidden pass; anything else is ignored; element children are appended", () => {
    const cell = host().el("td", { role: "cell", title: "T", colspan: 2, rowspan: "3", hidden: true, id: "i", style: "color: red", src: "x", href: "y" });
    expect(cell.getAttributeNames().sort()).toEqual(["colspan", "hidden", "role", "rowspan", "title"]);
    expect(cell.getAttribute("colspan")).toBe("2");
    expect(host().el("td", { hidden: false }).hasAttribute("hidden")).toBe(false);
    const li = host().el("li", undefined, ["a ", host().el("strong", { text: "b" }), null, 3]);
    expect(li.innerHTML).toBe("a <strong>b</strong>3");
    expect(() => host().el("iframe")).toThrow();
  });
});

describe("host.format", () => {
  test("number, percent, days and date on a small table; anything that is not a value formats as empty", () => {
    const f = host().format;
    const rows: Array<[keyof typeof f, unknown, string]> = [
      ["number", 1234, "1,234"],
      ["number", 1234.5, "1,234.5"],
      ["number", 0, "0"],
      ["number", -5, "-5"],
      ["number", Number.NaN, ""],
      ["number", null, ""],
      ["number", "12", ""],
      ["percent", 0.456, "46%"],
      ["percent", 1, "100%"],
      ["percent", 0, "0%"],
      ["percent", undefined, ""],
      ["days", 0, "0 days"],
      ["days", 1, "1 day"],
      ["days", 2.6, "3 days"],
      ["days", 1200, "1,200 days"],
      ["days", null, ""],
      ["date", "2026-11-28", "Nov 28, 2026"],
      ["date", "2026-01-05T23:30:00Z", "Jan 5, 2026"],
      ["date", "2026-13-01", ""],
      ["date", "soon", ""],
      ["date", null, ""],
    ];
    for (const [fn, input, want] of rows) expect({ fn, input, got: f[fn](input) }).toEqual({ fn, input, got: want });
    expect(Object.isFrozen(f)).toBe(true);
  });

  test("pay parity: host.format.pay equals the app's payLabel on every row", () => {
    const base: ReviewFacts = {
      jobId: "j", verdict: null, fitScore: null, skillsScore: null, experienceScore: null, compScore: null,
      payMin: null, payMax: null, payCurrency: null, payPeriod: null, workArrangement: null, seniority: null,
      redFlags: [], skillGaps: [], requirements: [], reasoning: null, stale: false,
    };
    const pay = (payMin: number | null, payMax: number | null, payCurrency: string | null, payPeriod: string | null): ReviewFacts => ({
      ...base, payMin, payMax, payCurrency, payPeriod,
    });
    const table: Array<ReviewFacts | null> = [
      pay(150000, 180000, "USD", "year"), // both
      pay(150000, null, "USD", "year"), // min only
      pay(null, 180000, "USD", "year"), // max only
      pay(120000, 120000, "USD", "year"), // equal
      pay(150000, 180000, null, "year"), // missing currency
      pay(150000, 180000, "EUR", "year"),
      pay(45, 60, "USD", "hour"),
      pay(45, null, "USD", "hour"),
      pay(null, 60, null, "hour"),
      pay(8000, 9500, "USD", "month"),
      pay(150000, 180000, "USD", null), // no period
      pay(0, 0, "USD", "year"), // zero
      pay(0, null, "USD", "hour"),
      pay(149500, 180499, "GBP", "month"), // rounding to the nearest thousand
      pay(null, null, "USD", "year"), // nothing listed
      pay(null, null, null, null),
      null,
    ];
    expect(table.length).toBeGreaterThanOrEqual(12);
    for (const review of table) {
      expect({ review, kit: host().format.pay(review) }).toEqual({ review, kit: payLabel(review) });
    }
    // The snapshot's JSON may leave a field out entirely: treated as not listed.
    expect(host().format.pay({ payMin: 90000 })).toBe(payLabel(pay(90000, null, null, null)));
  });
});

describe("host.job", () => {
  test("joins job, review, shortlist row and application for one id from host.data; null for an unknown id", () => {
    expect(host().job(JOB_A)).toEqual({
      job: INIT_DATA.jobs[JOB_A], review: INIT_DATA.reviews[JOB_A], shortlist: INIT_DATA.shortlist[0], application: null,
    });
    expect(host().job(JOB_B)).toEqual({ job: INIT_DATA.jobs[JOB_B], review: null, shortlist: null, application: INIT_DATA.applications[0] });
    // A job only in the applications list: its job is the application's own.
    expect(host().job(JOB_C)).toEqual({ job: INIT_DATA.applications[1].job, review: null, shortlist: null, application: INIT_DATA.applications[1] });
    for (const unknown of ["nope", "__proto__", "constructor", "", 3, null, undefined]) expect(host().job(unknown), String(unknown)).toBeNull();
  });

  test("host is still frozen and its helpers cannot be replaced", () => {
    const h = host();
    expect(Object.isFrozen(h)).toBe(true);
    for (const name of ["el", "format", "job", "table", "chart", "action", "ask", "onInit"]) {
      expect({ name, set: Reflect.set(h, name, () => "x") }).toEqual({ name, set: false });
    }
    expect(Reflect.set(h.format, "pay", () => "x")).toBe(false);
  });
});

// PR 5 Task 5.5, written before host.chart changed: today's SVG for bar, line and sparkline
// (and the bar drawing any other viz name fell back to). Stored documents must render as
// before, so these stay as they are. The 60-point case is held as a hash of its SVG.
describe("host.chart: bar, line and sparkline as before PR 5", () => {
  function svgOf(spec: unknown): string {
    document.body.innerHTML = `<div id="snap"></div>`;
    const el = document.getElementById("snap")!;
    host().chart(el, spec);
    const svg = el.querySelector("svg");
    // Today the SVG is the element's first child and the drawing.
    expect(el.firstElementChild).toBe(svg);
    return svg ? svg.outerHTML : "";
  }
  const POINTS = [
    { label: "<b>a</b>", value: 2 },
    { label: "b", value: 4 },
    { label: "c", value: -1 },
    { label: "a label that runs well past the forty character limit", value: 3.5, tone: "good" },
  ];

  test("bar", () => {
    expect(svgOf({ viz: "bar", title: "Stages", points: POINTS })).toMatchInlineSnapshot(`"<svg viewBox="0 0 320 160" role="img" class="jb-chart" aria-label="Stages"><line x1="0" y1="136" x2="320" y2="136" class="jb-chart-axis"></line><rect x="12.0" y="74.0" width="56.0" height="62.0" class="jb-chart-bar"><title>&lt;b&gt;a&lt;/b&gt;: 2</title></rect><rect x="92.0" y="12.0" width="56.0" height="124.0" class="jb-chart-bar"><title>b: 4</title></rect><rect x="172.0" y="136.0" width="56.0" height="0.0" class="jb-chart-bar"><title>c: 0</title></rect><rect x="252.0" y="27.5" width="56.0" height="108.5" class="jb-chart-bar"><title>a label that runs well past the forty ch: 3.5</title></rect><text x="40.0" y="154" text-anchor="middle" class="jb-chart-label">&lt;b&gt;a&lt;/b&gt;</text><text x="120.0" y="154" text-anchor="middle" class="jb-chart-label">b</text><text x="200.0" y="154" text-anchor="middle" class="jb-chart-label">c</text><text x="280.0" y="154" text-anchor="middle" class="jb-chart-label">a label that runs well past the forty ch</text></svg>"`);
  });
  test("line", () => {
    expect(svgOf({ viz: "line", title: "Weekly", points: [...POINTS, { label: "e", value: Number.NaN }] })).toMatchInlineSnapshot(`"<svg viewBox="0 0 320 160" role="img" class="jb-chart" aria-label="Weekly"><line x1="0" y1="136" x2="320" y2="136" class="jb-chart-axis"></line><polyline points="32.0,74.0 96.0,12.0 160.0,136.0 224.0,27.5 288.0,136.0" class="jb-chart-line"></polyline><text x="32.0" y="154" text-anchor="middle" class="jb-chart-label">&lt;b&gt;a&lt;/b&gt;</text><text x="96.0" y="154" text-anchor="middle" class="jb-chart-label">b</text><text x="160.0" y="154" text-anchor="middle" class="jb-chart-label">c</text><text x="224.0" y="154" text-anchor="middle" class="jb-chart-label">a label that runs well past the forty ch</text><text x="288.0" y="154" text-anchor="middle" class="jb-chart-label">e</text></svg>"`);
  });
  test("sparkline", () => {
    expect(svgOf({ viz: "sparkline", title: "Trend", points: POINTS })).toMatchInlineSnapshot(`"<svg viewBox="0 0 320 160" role="img" class="jb-chart" aria-label="Trend"><line x1="0" y1="136" x2="320" y2="136" class="jb-chart-axis"></line><polyline points="40.0,74.0 120.0,12.0 200.0,136.0 280.0,27.5" class="jb-chart-line"></polyline></svg>"`);
  });
  test("no title, no points, and an unknown viz name", () => {
    expect(svgOf({ viz: "bar" })).toMatchInlineSnapshot(`"<svg viewBox="0 0 320 160" role="img" class="jb-chart" aria-label="Chart"><line x1="0" y1="136" x2="320" y2="136" class="jb-chart-axis"></line></svg>"`);
    expect(svgOf({ viz: "pie", title: "Fallback", points: POINTS.slice(0, 2) })).toMatchInlineSnapshot(`"<svg viewBox="0 0 320 160" role="img" class="jb-chart" aria-label="Fallback"><line x1="0" y1="136" x2="320" y2="136" class="jb-chart-axis"></line><rect x="24.0" y="74.0" width="112.0" height="62.0" class="jb-chart-bar"><title>&lt;b&gt;a&lt;/b&gt;: 2</title></rect><rect x="184.0" y="12.0" width="112.0" height="124.0" class="jb-chart-bar"><title>b: 4</title></rect><text x="80.0" y="154" text-anchor="middle" class="jb-chart-label">&lt;b&gt;a&lt;/b&gt;</text><text x="240.0" y="154" text-anchor="middle" class="jb-chart-label">b</text></svg>"`);
  });
  test("60 points draw the first 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ label: `w${i}`, value: (i * 7) % 13 }));
    expect(sha256Base64(svgOf({ viz: "bar", title: "Many", points: many }))).toMatchInlineSnapshot(`"3EYJS0e3apsVF4r/Uj532QwG/Y4tQAB5pmO9jmO/v7Q="`);
    expect(sha256Base64(svgOf({ viz: "line", title: "Many", points: many }))).toMatchInlineSnapshot(`"hKgNm3VJI88Qa9dlK+7VlzSDK/5lIzFlL4PX313OCyY="`);
  });
});

// PR 5 Task 5.5 (spec 08 S9.5): the new chart kinds, the caps, onSelect, update and destroy.
interface ChartHandle {
  update(spec: unknown): void;
  destroy(): void;
}
function drawChart(spec: unknown): { el: HTMLElement; handle: ChartHandle } {
  document.body.innerHTML = `<div id="chart"></div>`;
  const el = document.getElementById("chart")!;
  const handle = host().chart(el, spec) as ChartHandle;
  return { el, handle };
}
/** The visually hidden data table's rows, as text. */
function tableRows(el: Element): string[][] {
  const table = el.querySelector("table.jb-sr-only");
  if (!table) return [];
  return [...table.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent ?? ""));
}

describe("host.chart: new kinds", () => {
  const STAGES = [
    { label: "Ready", value: 4 },
    { label: "Applied", value: 6, tone: "good" },
    { label: "Interviewing", value: 2, tone: "amber" },
  ];
  const SERIES = [
    { name: "Remote", tone: "good", points: [{ label: "Oct", value: 3 }, { label: "Nov", value: 5 }] },
    { name: "On site", points: [{ label: "Oct", value: 1 }, { label: "Nov", value: 2 }] },
  ];

  test.each([
    ["hbar", { points: STAGES }, [["Label", "Value"], ["Ready", "4"], ["Applied", "6"], ["Interviewing", "2"]]],
    ["stacked", { series: SERIES }, [["Label", "Remote", "On site"], ["Oct", "3", "1"], ["Nov", "5", "2"]]],
    ["area", { series: SERIES }, [["Label", "Remote", "On site"], ["Oct", "3", "1"], ["Nov", "5", "2"]]],
    ["area", { points: STAGES }, [["Label", "Value"], ["Ready", "4"], ["Applied", "6"], ["Interviewing", "2"]]],
    ["scatter", { xy: [{ x: 1, y: 82, label: "Acme" }, { x: 9, y: 64 }], xLabel: "Days open", yLabel: "Fit" }, [["Label", "Days open", "Fit"], ["Acme", "1", "82"], ["", "9", "64"]]],
    ["donut", { points: STAGES }, [["Label", "Value"], ["Ready", "4"], ["Applied", "6"], ["Interviewing", "2"]]],
    // Fix round 1: hbar and donut draw the first of several series, named in the table's head.
    ["hbar", { series: SERIES }, [["Label", "Remote"], ["Oct", "3"], ["Nov", "5"]]],
    ["donut", { series: SERIES }, [["Label", "Remote"], ["Oct", "3"], ["Nov", "5"]]],
  ])("%s renders inline SVG named by its title, with a visually hidden data table", (viz, rest, rows) => {
    const { el } = drawChart({ viz, title: `A ${viz} chart`, ...rest });
    const svg = el.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.namespaceURI).toContain("svg");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe(`A ${viz} chart`);
    expect(svg.querySelectorAll(".jb-chart-mark").length).toBeGreaterThan(0);
    const table = el.querySelector("table.jb-sr-only")!;
    expect(table).not.toBeNull();
    expect(table.querySelector("caption")?.textContent).toBe(`A ${viz} chart`);
    expect([...table.querySelectorAll("thead th")].every((th) => th.getAttribute("scope") === "col")).toBe(true);
    expect(tableRows(el)).toEqual(rows);
    // Data never becomes markup.
    expect(el.querySelector("b")).toBeNull();
  });

  test("bar, line and sparkline add the hidden table too, beside their unchanged SVG", () => {
    for (const viz of ["bar", "line", "sparkline"]) {
      const { el } = drawChart({ viz, title: "T", points: STAGES });
      expect(el.firstElementChild?.tagName.toLowerCase(), viz).toBe("svg");
      expect(tableRows(el), viz).toEqual([["Label", "Value"], ["Ready", "4"], ["Applied", "6"], ["Interviewing", "2"]]);
    }
  });

  test("format applies to the values the chart shows", () => {
    const { el } = drawChart({ viz: "hbar", title: "Rates", format: "percent", points: [{ label: "<i>Reply</i>", value: 0.456 }] });
    expect(tableRows(el)).toEqual([["Label", "Value"], ["<i>Reply</i>", "46%"]]);
    expect(el.querySelector("svg")!.textContent).toContain("46%");
  });

  test("caps: 9 series draw 8, 250 points draw 200", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: `S${i}`, points: [{ label: "a", value: i + 1 }] }));
    const stacked = drawChart({ viz: "stacked", title: "Nine", series: nine }).el;
    expect(tableRows(stacked)[0]).toHaveLength(1 + 8);
    expect(stacked.querySelectorAll("svg .jb-chart-mark")).toHaveLength(8);
    const many = Array.from({ length: 250 }, (_, i) => ({ label: `p${i}`, value: i }));
    const area = drawChart({ viz: "area", title: "Many", points: many }).el;
    expect(tableRows(area)).toHaveLength(1 + 200);
    const scatter = drawChart({ viz: "scatter", title: "Many", xy: many.map((p) => ({ x: p.value, y: p.value })) }).el;
    expect(scatter.querySelectorAll("svg .jb-chart-mark")).toHaveLength(200);
    // 200 points in all, across series.
    const wide = Array.from({ length: 3 }, (_, s) => ({ name: `S${s}`, points: many.slice(0, 90) }));
    expect(tableRows(drawChart({ viz: "stacked", title: "Wide", series: wide }).el).slice(1).flatMap((r) => r.slice(1)).filter((c) => c !== "")).toHaveLength(200);
  });

  test("onSelect adds a row of native buttons, one per mark, called with { label, value, series, index }; a mark still answers a click", () => {
    const picked: unknown[] = [];
    const onSelect = (p: unknown) => picked.push(p);
    const { el } = drawChart({ viz: "hbar", title: "Stages", points: STAGES, onSelect });
    const svg = el.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Stages");
    const row = el.querySelector(".jb-chart-picks")!;
    expect(row.getAttribute("role")).toBe("group");
    expect(row.getAttribute("aria-label")).toBe("Select in Stages");
    const picks = [...row.querySelectorAll("button")];
    expect(picks.map((b) => [b.getAttribute("type"), b.textContent])).toEqual([
      ["button", "Ready: 4"],
      ["button", "Applied: 6"],
      ["button", "Interviewing: 2"],
    ]);
    picks[1].click();
    // A pointer on the drawn mark selects it too.
    svg.querySelectorAll(".jb-chart-target")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual([
      { label: "Applied", value: 6, series: null, index: 1 },
      { label: "Interviewing", value: 2, series: null, index: 2 },
    ]);

    const fromSeries: unknown[] = [];
    const stacked = drawChart({ viz: "stacked", title: "S", series: SERIES, onSelect: (p: unknown) => fromSeries.push(p) }).el;
    const segs = [...stacked.querySelectorAll<HTMLButtonElement>(".jb-chart-picks button")];
    expect(segs.map((b) => b.textContent)).toEqual(["Remote, Oct: 3", "On site, Oct: 1", "Remote, Nov: 5", "On site, Nov: 2"]);
    for (const b of segs) b.click();
    expect(fromSeries).toContainEqual({ label: "Nov", value: 2, series: "On site", index: 1 });

    // bar keeps its drawing and gains a button per bar.
    const barPicks: unknown[] = [];
    const bar = drawChart({ viz: "bar", title: "B", points: STAGES, onSelect: (p: unknown) => barPicks.push(p) }).el;
    const barButtons = [...bar.querySelectorAll<HTMLButtonElement>(".jb-chart-picks button")];
    expect(barButtons).toHaveLength(3);
    barButtons[0].click();
    expect(barPicks).toEqual([{ label: "Ready", value: 4, series: null, index: 0 }]);
  });

  test("with onSelect every focusable target is a native button of at least 44 CSS px, never a scaled SVG mark", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ label: `p${i}`, value: i + 1 }));
    const specs: Array<[string, Record<string, unknown>, number]> = [
      ["bar", { points: many }, 50],
      ["line", { points: many }, 50],
      ["sparkline", { points: many }, 50],
      ["hbar", { points: STAGES }, 3],
      ["stacked", { series: SERIES }, 4],
      ["area", { series: SERIES }, 4],
      ["scatter", { xy: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }, 2],
      ["donut", { points: [{ label: "big", value: 999 }, { label: "tiny", value: 1 }] }, 2],
    ];
    for (const [viz, rest, count] of specs) {
      const { el } = drawChart({ viz, title: viz, onSelect: () => {}, ...rest });
      expect(el.querySelectorAll('svg [role="button"], svg [tabindex]'), viz).toHaveLength(0);
      expect(el.querySelectorAll(".jb-chart-picks button.jb-chart-pick"), viz).toHaveLength(count);
    }
    expect(cssFor(".jb-chart-pick")).toMatch(/min-height: var\(--target-size\);/);
    expect(cssFor(".jb-chart-pick")).toMatch(/min-width: var\(--target-size\);/);
    // No onSelect, no buttons.
    expect(drawChart({ viz: "donut", title: "d", points: STAGES }).el.querySelector(".jb-chart-picks")).toBeNull();
  });

  // Fix round 1 (spec 08 S9): what the kit draws with was captured before model code ran.
  test("a chart and a table still draw after model code replaces Array.prototype.join and slice and String", () => {
    const realJoin = Array.prototype.join;
    const realSlice = Array.prototype.slice;
    const RealString = String;
    const coord = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    const fakeString = Object.assign(
      function (v?: unknown) {
        // Only the kit compares booleans as text; everything else gets the real answer.
        if (typeof v === "boolean") return v ? "a" : "b";
        return arguments.length === 0 ? "" : RealString(v);
      },
      { fromCharCode: RealString.fromCharCode, fromCodePoint: RealString.fromCodePoint, raw: RealString.raw },
    );
    Object.defineProperty(fakeString, "prototype", { value: RealString.prototype });
    document.body.innerHTML = `<div id="a"></div><div id="h"></div><div id="t"></div>`;
    let error: unknown = null;
    let line = "";
    let hbarRows = 0;
    let order: Array<string | null> = [];
    Array.prototype.join = function (this: unknown[], sep?: string) {
      if (this.length > 0 && typeof this[0] === "string" && coord.test(this[0])) return "0,0";
      return realJoin.call(this, sep);
    };
    Array.prototype.slice = function (this: unknown[], ...args: [number?, number?]) {
      if (this.length > 0 && this[0] !== null && typeof this[0] === "object" && "points" in (this[0] as object)) return [];
      return realSlice.apply(this, args);
    } as typeof Array.prototype.slice;
    Reflect.set(globalThis, "String", fakeString);
    try {
      host().chart(document.getElementById("a")!, { viz: "area", title: "A", points: STAGES });
      host().chart(document.getElementById("h")!, { viz: "hbar", title: "H", series: SERIES });
      const t = host().table(document.getElementById("t")!, {
        caption: "Open",
        columns: [{ key: "name", label: "Name" }, { key: "open", label: "Open", sortable: true }],
        rows: [{ name: "A", open: true }, { name: "B", open: false }, { name: "C", open: true }],
      });
      t.sort("open", "asc");
      line = document.querySelector("#a polyline")?.getAttribute("points") ?? "";
      hbarRows = document.querySelectorAll("#h svg .jb-chart-mark").length;
      order = [...document.querySelectorAll("#t tbody tr")].map((tr) => tr.firstElementChild!.textContent);
    } catch (err) {
      error = err;
    } finally {
      Array.prototype.join = realJoin;
      Array.prototype.slice = realSlice;
      Reflect.set(globalThis, "String", RealString);
    }
    expect(error).toBeNull();
    expect(line.split(" ")).toHaveLength(3);
    expect(hbarRows).toBe(2);
    // "false" sorts before "true": B, then A and C in their own order.
    expect(order).toEqual(["B", "A", "C"]);
  });

  test("update(spec) replaces the drawing; destroy() empties the element", () => {
    const { el, handle } = drawChart({ viz: "hbar", title: "First", points: STAGES });
    expect(Object.isFrozen(handle)).toBe(true);
    handle.update({ viz: "donut", title: "Second", points: STAGES.slice(0, 2) });
    expect(el.querySelectorAll("svg")).toHaveLength(1);
    expect(el.querySelector("svg")!.getAttribute("aria-label")).toBe("Second");
    expect(el.querySelectorAll("table")).toHaveLength(1);
    expect(tableRows(el)).toHaveLength(3);
    handle.destroy();
    expect(el.childNodes).toHaveLength(0);
    handle.update({ viz: "bar", title: "After", points: STAGES });
    expect(el.childNodes).toHaveLength(0);
  });
});

// PR 5 Task 5.6 (spec 08 S9.5): host.table.
describe("host.table", () => {
  const COLUMNS = [
    { key: "company", label: "Company", sortable: true },
    { key: "fit", label: "Fit", align: "end", format: "number", sortable: true },
    { key: "seen", label: "First seen", format: "date" },
  ];
  const ROWS = [
    { company: "Globex", fit: 64, seen: "2026-11-02" },
    { company: "<i>Acme</i>", fit: 82, seen: "2026-10-30" },
    { company: "Initech", fit: null, seen: "2026-11-20" },
    { company: "Hooli", fit: 71 },
  ];
  function mount(spec: Record<string, unknown>) {
    document.body.innerHTML = `<div id="t"></div>`;
    const el = document.getElementById("t")!;
    const api = host().table(el, spec);
    return { el, api };
  }
  const column = (el: Element, i: number) => [...el.querySelectorAll("tbody tr")].map((tr) => tr.children[i].textContent);

  test("a real table: caption, column headers, a jb-scroll-x wrapper, cells set as text and formatted", () => {
    const { el, api } = mount({ caption: "Open roles", columns: COLUMNS, rows: ROWS });
    expect(Object.isFrozen(api)).toBe(true);
    const wrap = el.querySelector(".jb-scroll-x")!;
    expect(wrap).not.toBeNull();
    const table = wrap.querySelector("table")!;
    expect(table.classList.contains("jb-table")).toBe(true);
    expect(table.querySelector("caption")?.textContent).toBe("Open roles");
    const heads = [...table.querySelectorAll("thead th")];
    expect(heads.map((th) => th.getAttribute("scope"))).toEqual(["col", "col", "col"]);
    expect(heads.map((th) => th.textContent)).toEqual(["Company", "Fit", "First seen"]);
    expect(column(el, 0)).toEqual(["Globex", "<i>Acme</i>", "Initech", "Hooli"]);
    expect(table.querySelector("tbody i")).toBeNull();
    expect(column(el, 1)).toEqual(["64", "82", "", "71"]);
    expect(column(el, 2)).toEqual(["Nov 2, 2026", "Oct 30, 2026", "Nov 20, 2026", ""]);
    expect(table.querySelector("tbody td:nth-child(2)")!.classList.contains("jb-num")).toBe(true);
    // Only sortable columns get a sort button.
    expect(heads.map((th) => th.querySelector("button") !== null)).toEqual([true, true, false]);
  });

  test("a sortable column's button toggles aria-sort ascending and descending and reorders the rows", () => {
    const { el } = mount({ caption: "Open roles", columns: COLUMNS, rows: ROWS });
    const fitHead = el.querySelectorAll("thead th")[1];
    const button = fitHead.querySelector("button")!;
    expect(fitHead.getAttribute("aria-sort")).toBe("none");
    button.click();
    expect(fitHead.getAttribute("aria-sort")).toBe("ascending");
    expect(column(el, 1)).toEqual(["64", "71", "82", ""]);
    button.click();
    expect(fitHead.getAttribute("aria-sort")).toBe("descending");
    // A missing value stays last either way.
    expect(column(el, 1)).toEqual(["82", "71", "64", ""]);
    const companyHead = el.querySelectorAll("thead th")[0];
    companyHead.querySelector("button")!.click();
    expect(companyHead.getAttribute("aria-sort")).toBe("ascending");
    expect(fitHead.getAttribute("aria-sort")).toBe("none");
    expect(column(el, 0)).toEqual(["<i>Acme</i>", "Globex", "Hooli", "Initech"]);
  });

  test("pageSize defaults to 25 with a Show more button; 600 rows render at most 500", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ company: `C${i}`, fit: i }));
    const { el } = mount({ caption: "Many", columns: COLUMNS, rows: many });
    expect(el.querySelectorAll("tbody tr")).toHaveLength(25);
    const more = [...el.querySelectorAll("button")].find((b) => b.textContent === "Show more")!;
    expect(more).toBeDefined();
    more.click();
    expect(el.querySelectorAll("tbody tr")).toHaveLength(30);
    expect(more.classList.contains("jb-hidden")).toBe(true);

    const huge = Array.from({ length: 600 }, (_, i) => ({ company: `C${i}`, fit: i }));
    const big = mount({ caption: "Huge", columns: COLUMNS, rows: huge, pageSize: 1000 }).el;
    expect(big.querySelectorAll("tbody tr")).toHaveLength(500);
    const paged = mount({ caption: "Paged", columns: COLUMNS, rows: huge, pageSize: 200 }).el;
    const next = [...paged.querySelectorAll("button")].find((b) => b.textContent === "Show more")!;
    next.click();
    next.click();
    next.click();
    expect(paged.querySelectorAll("tbody tr")).toHaveLength(500);
    expect(next.classList.contains("jb-hidden")).toBe(true);
  });

  test("Show more moves focus to the first newly shown row, so focus is not lost when the button hides", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ company: `C${i}`, fit: i }));
    const { el } = mount({ caption: "Many", columns: COLUMNS, rows: many });
    const more = [...el.querySelectorAll("button")].find((b) => b.textContent === "Show more")!;
    more.focus();
    more.click();
    const rows = el.querySelectorAll("tbody tr");
    expect(document.activeElement).toBe(rows[25]);
    expect(rows[25].getAttribute("tabindex")).toBe("-1");
    expect(rows[25].textContent).toContain("C25");

    const pickable = mount({ caption: "Pick", columns: COLUMNS, rows: many, onRowSelect: () => {} }).el;
    const next = [...pickable.querySelectorAll("button")].find((b) => b.textContent === "Show more")!;
    next.click();
    expect(document.activeElement).toBe(pickable.querySelectorAll("tbody tr")[25]);
    expect(pickable.querySelectorAll("tbody tr")[25].getAttribute("tabindex")).toBe("0");
  });

  test("onRowSelect(row, index) fires on click and on Enter, with the row's own index", () => {
    const picked: unknown[] = [];
    const { el } = mount({ caption: "Pick", columns: COLUMNS, rows: ROWS, onRowSelect: (row: unknown, index: number) => picked.push([row, index]) });
    el.querySelectorAll("thead th")[1].querySelector("button")!.click(); // sort by fit: 64, 71, 82, -
    const rows = [...el.querySelectorAll("tbody tr")] as HTMLElement[];
    expect(rows.every((r) => r.getAttribute("tabindex") === "0")).toBe(true);
    rows[2].click();
    press(rows[0], "Enter");
    expect(picked).toEqual([[ROWS[1], 1], [ROWS[0], 0]]);
  });

  test("update(rows) replaces the rows, keeping the sort; sort(key, dir) sorts", () => {
    const { el, api } = mount({ caption: "Open roles", columns: COLUMNS, rows: ROWS });
    api.sort("fit", "desc");
    expect(el.querySelectorAll("thead th")[1].getAttribute("aria-sort")).toBe("descending");
    expect(column(el, 1)).toEqual(["82", "71", "64", ""]);
    api.update([{ company: "Umbrella", fit: 50 }, { company: "Stark", fit: 90 }]);
    expect(column(el, 0)).toEqual(["Stark", "Umbrella"]);
    api.sort("company", "asc");
    expect(column(el, 0)).toEqual(["Stark", "Umbrella"]);
    api.sort("company", "desc");
    expect(column(el, 0)).toEqual(["Umbrella", "Stark"]);
    api.sort("nope", "asc");
    expect(column(el, 0)).toEqual(["Umbrella", "Stark"]);
    // A column that is not sortable is ignored, and its header gets no aria-sort.
    api.sort("seen", "asc");
    expect(column(el, 0)).toEqual(["Umbrella", "Stark"]);
    expect(el.querySelectorAll("thead th")[2].hasAttribute("aria-sort")).toBe(false);
    expect(el.querySelectorAll("thead th")[0].getAttribute("aria-sort")).toBe("descending");
    expect(cssFor(".jb-table__sort")).toMatch(/min-height: var\(--target-size\);/);
    expect(cssFor(".jb-table__more")).toMatch(/min-height: var\(--target-size\);/);
  });
});

// PR 6 Task 6.2 (spec 08 S10.2, layer 1): host.ask posts only while the user has just acted,
// read through navigator.userActivation's isActive getter as the kit found it.
describe("host.ask with navigator.userActivation", () => {
  afterEach(() => {
    activation.active = false;
    document.body.innerHTML = "";
  });

  test("without activation it returns false and posts nothing", async () => {
    const before = ofType("ask").length;
    expect(host().ask("x")).toBe(false);
    await tick();
    expect(ofType("ask")).toHaveLength(before);
  });

  test("with isActive true it posts one ask with the text as a string and returns true", async () => {
    const before = ofType("ask").length;
    activation.active = true;
    expect(host().ask("Compare the top two")).toBe(true);
    expect(host().ask(42)).toBe(true);
    await vi.waitFor(() => expect(ofType("ask")).toHaveLength(before + 2));
    expect(ofType("ask").slice(before)).toEqual([
      { type: "ask", text: "Compare the top two" },
      { type: "ask", text: "42" },
    ]);
    expect(onWindow).toEqual([{ type: "ready" }]); // the port only, never the window
  });

  test("model code cannot fake activation by replacing isActive after the kit ran", async () => {
    const before = ofType("ask").length;
    const proto = FakeUserActivation.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "isActive")!;
    Object.defineProperty(fakeActivation, "isActive", { value: true, configurable: true });
    Object.defineProperty(proto, "isActive", { get: () => true, configurable: true });
    try {
      expect(host().ask("x")).toBe(false);
    } finally {
      Reflect.deleteProperty(fakeActivation, "isActive");
      Object.defineProperty(proto, "isActive", original);
    }
    await tick();
    expect(ofType("ask")).toHaveLength(before);
  });

  test('a click on <jb-button ask="..."> under activation posts that text; without it, nothing', async () => {
    document.body.innerHTML = '<jb-button ask="Compare the top two">Compare</jb-button>';
    const button = document.querySelector("jb-button")!;
    const before = ofType("ask").length;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(ofType("ask")).toHaveLength(before);
    activation.active = true;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(ofType("ask")).toHaveLength(before + 1));
    expect(ofType("ask").at(-1)).toEqual({ type: "ask", text: "Compare the top two" });
  });

  test("a button with both ask and action runs the action only", async () => {
    document.body.innerHTML = `<jb-button ask="Tell me more" action='{"name":"open","target":"shortlist"}'>Go</jb-button>`;
    activation.active = true;
    const asks = ofType("ask").length;
    const acts = ofType("action").length;
    document.querySelector("jb-button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(ofType("action")).toHaveLength(acts + 1));
    await tick();
    expect(ofType("ask")).toHaveLength(asks);
    expect(ofType("action").at(-1)).toEqual({ type: "action", name: "open", args: { target: "shortlist" } });
  });

  test("an aria-disabled ask button posts nothing", async () => {
    document.body.innerHTML = '<jb-button ask="x" aria-disabled="true">x</jb-button>';
    activation.active = true;
    const before = ofType("ask").length;
    document.querySelector("jb-button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(ofType("ask")).toHaveLength(before);
  });
});

// PR 6 Task 6.2: where navigator.userActivation is missing, the kit's own flag. A second kit
// runs here against its own window stand-in (no userActivation, no Trusted Types, its own
// port) with fake timers in place when it starts, so the setTimeout it takes is the fake one
// and the 1,000 ms can be stepped. It is the last block of the file: its listeners on the
// real window (link guard, Escape, the flag) stay for the rest of the run.
describe("host.ask without navigator.userActivation", () => {
  const received: unknown[] = [];
  let ownPort: MessagePort | null = null;
  let ownHost: KitHost | null = null;
  const asks = () => received.filter((m) => m && typeof m === "object" && "type" in m && m.type === "ask");
  /** Lets port messages through without stepping the fake clock (setImmediate is not faked). */
  async function flush(rounds = 5) {
    for (let i = 0; i < rounds; i++) await new Promise<void>((r) => setImmediate(r));
  }
  function fireTrusted(type: string) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const impl = implOf(ev);
    impl.isTrusted = true;
    implOf(document.body)._dispatch(impl);
    expect(ev.isTrusted).toBe(true);
  }

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ownShadow: Record<string | symbol, unknown> = { navigator: {}, trustedTypes: undefined };
    const ownWindow = new Proxy(ownShadow, {
      get(target, key) {
        return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : Reflect.get(globalThis, key);
      },
      getPrototypeOf() {
        return Object.getPrototypeOf(globalThis);
      },
    });
    const ownParent = {
      postMessage(_data: unknown, _origin: string, transfer?: MessagePort[]) {
        if (ownPort === null && transfer?.length === 1) {
          ownPort = transfer[0];
          ownPort.onmessage = (m) => received.push(m.data);
        }
      },
    };
    new Function("parent", "window", KIT_JS)(ownParent, ownWindow);
    const h: unknown = Reflect.get(ownWindow, "host");
    if (!h || typeof h !== "object") throw new Error("no host");
    ownHost = h as KitHost; // test-only view of the kit's global
  });
  afterAll(() => {
    vi.useRealTimers();
    ownPort?.close();
  });

  test("with no user action it returns false and posts nothing", async () => {
    expect(ownHost!.ask("x")).toBe(false);
    await flush();
    expect(asks()).toEqual([]);
  });

  test("an untrusted pointerup or keyup (dispatched by model code) does not arm it", async () => {
    document.body.dispatchEvent(new Event("pointerup", { bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    expect(ownHost!.ask("x")).toBe(false);
    await flush();
    expect(asks()).toEqual([]);
  });

  test("a trusted pointerup arms it for 1,000 ms, then it clears", async () => {
    fireTrusted("pointerup");
    expect(ownHost!.ask("first")).toBe(true);
    vi.advanceTimersByTime(999);
    expect(ownHost!.ask("second")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(ownHost!.ask("third")).toBe(false);
    await flush();
    expect(asks()).toEqual([
      { type: "ask", text: "first" },
      { type: "ask", text: "second" },
    ]);
  });

  test("a trusted keyup arms it too, and a later action restarts the 1,000 ms", async () => {
    received.length = 0;
    fireTrusted("keyup");
    vi.advanceTimersByTime(600);
    fireTrusted("pointerup");
    vi.advanceTimersByTime(600);
    expect(ownHost!.ask("still armed")).toBe(true);
    vi.advanceTimersByTime(400);
    expect(ownHost!.ask("cleared")).toBe(false);
    await flush();
    expect(asks()).toEqual([{ type: "ask", text: "still armed" }]);
  });
});
