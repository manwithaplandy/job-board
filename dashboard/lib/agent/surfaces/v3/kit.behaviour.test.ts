// @vitest-environment jsdom
// Runs KIT_JS once in jsdom. jsdom has no sandbox and parent === window here, so this
// checks the kit's own behaviour only (what it posts, what it renders); the sandbox and
// the CSP are Task 2.7's real-browser tests.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { KIT_JS } from "@/lib/agent/surfaces/v3/kit";

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
function host(): KitHost {
  const h: unknown = Reflect.get(window, "host");
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
  new Function("parent", KIT_JS)(fakeParent);
});
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
    for (const bad of ["<script>x</script>", "<SCRIPT src=x>", "<iframe srcdoc=x>", "<frame>", "<object>", "<embed>", "<portal>", "<fencedframe>"]) {
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
