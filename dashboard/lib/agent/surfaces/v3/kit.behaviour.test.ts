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

const posted: unknown[] = [];
function record(e: MessageEvent) {
  const d: unknown = e.data;
  if (d && typeof d === "object" && "type" in d && d.type !== "init") posted.push(d);
}
function host(): KitHost {
  const h: unknown = Reflect.get(window, "host");
  if (!h || typeof h !== "object") throw new Error("no host");
  return h as KitHost; // test-only view of the kit's global; the shape is asserted below
}
function ofType(type: string): unknown[] {
  return posted.filter((m) => m && typeof m === "object" && "type" in m && m.type === type);
}

beforeAll(() => {
  window.addEventListener("message", record);
  new Function(KIT_JS)();
});
afterAll(() => window.removeEventListener("message", record));

describe("the kit in a document", () => {
  test("it posts ready and a resize, and freezes host", async () => {
    await vi.waitFor(() => expect(ofType("ready")).toHaveLength(1));
    await vi.waitFor(() => expect(ofType("resize").length).toBeGreaterThanOrEqual(1));
    expect(Object.isFrozen(host())).toBe(true);
    expect(host().data).toBeNull();
    expect(host().theme).toBe("light");
  });

  test("init sets data and theme once; a second init is ignored", async () => {
    const seen: unknown[] = [];
    host().onInit((data, theme) => seen.push([data, theme]));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "init", data: { jobs: {} }, theme: "dark" } }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "init", data: { other: 1 }, theme: "light" } }));
    expect(seen).toEqual([[{ jobs: {} }, "dark"]]);
    expect(host().data).toEqual({ jobs: {} });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    const late: unknown[] = [];
    host().onInit((data) => late.push(data));
    expect(late).toEqual([{ jobs: {} }]);
  });

  test("a jb-button press posts its action and nothing else happens", async () => {
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
  });

  test("a jb-button with an action that is not JSON posts nothing", async () => {
    const before = ofType("action").length;
    document.body.innerHTML = `<jb-button action="not json">x</jb-button>`;
    document.querySelector("jb-button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
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
    await new Promise((r) => setTimeout(r, 20));
    expect(ofType("error")).toEqual([{ type: "error", message: "x".repeat(500) }]);
  });
});
