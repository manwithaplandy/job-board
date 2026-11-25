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

beforeAll(() => {
  window.addEventListener("message", record);
  new Function("parent", KIT_JS)(fakeParent);
});
afterAll(() => {
  window.removeEventListener("message", record);
  port?.close();
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
