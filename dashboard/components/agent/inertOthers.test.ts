// @vitest-environment jsdom
// inertOthers (spec 08 S6.3, PR 3 Task 3.1): everything but the kept elements and their
// ancestors is made inert, the toast container is skipped, and restore undoes exactly what
// the call did.
import { afterEach, beforeEach, expect, test } from "vitest";
import { inertOthers, isToastContainer } from "./inertOthers";

let el: Record<string, HTMLElement>;

beforeEach(() => {
  // body > (header, main > (list, chat > (msgA > view, msgB, dock)), toasts)
  document.body.innerHTML = `
    <header id="header"></header>
    <main id="main">
      <nav id="list"></nav>
      <section id="chat">
        <article id="msgA"><div id="view"></div></article>
        <article id="msgB"></article>
        <div id="dock"></div>
      </section>
    </main>
    <section id="toasts"></section>`;
  el = Object.fromEntries([...document.body.querySelectorAll<HTMLElement>("[id]")].map((e) => [e.id, e]));
});
afterEach(() => {
  document.body.innerHTML = "";
});

const skipToasts = (e: Element) => e.id === "toasts";
const inert = (id: string) => el[id].hasAttribute("inert");

test("siblings off the kept paths are inert; the paths, the kept elements and the skipped container are not", () => {
  const restore = inertOthers([el.view, el.dock], skipToasts);
  for (const id of ["header", "list", "msgB"]) expect({ id, inert: inert(id) }).toEqual({ id, inert: true });
  for (const id of ["main", "chat", "msgA", "view", "dock", "toasts"]) expect({ id, inert: inert(id) }).toEqual({ id, inert: false });
  restore();
});

test("restore clears what the call set and leaves an element that was already inert as it was", () => {
  el.header.setAttribute("inert", "");
  const restore = inertOthers([el.view, el.dock], skipToasts);
  expect(inert("header")).toBe(true);
  restore();
  expect(inert("header")).toBe(true);
  for (const id of ["list", "msgB", "main", "chat", "msgA", "view", "dock", "toasts"]) expect({ id, inert: inert(id) }).toEqual({ id, inert: false });
});

test("calling restore twice is harmless", () => {
  const restore = inertOthers([el.view, el.dock], skipToasts);
  restore();
  el.list.setAttribute("inert", "");
  restore();
  // The second call touched nothing, not even an attribute set after the first.
  expect(inert("list")).toBe(true);
  expect(inert("msgB")).toBe(false);
});

test("without a skip predicate the toast container is inert too", () => {
  const restore = inertOthers([el.view, el.dock]);
  expect(inert("toasts")).toBe(true);
  restore();
  expect(inert("toasts")).toBe(false);
});

test("isToastContainer recognises the toast region and its list, nothing else", () => {
  const region = document.createElement("section");
  region.setAttribute("aria-label", "Notifications alt+T");
  const list = document.createElement("ol");
  list.setAttribute("data-sonner-toaster", "");
  expect(isToastContainer(region)).toBe(true);
  expect(isToastContainer(list)).toBe(true);
  expect(isToastContainer(el.chat)).toBe(false);
  expect(isToastContainer(el.toasts)).toBe(false);
});
