// @vitest-environment jsdom
// useExpandedView (spec 08 S6.3, PR 3 Task 3.2): the one expanded view, the history entry
// that Back closes, Escape on the page, the <html> class, and cleanup.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EXPANDED_HTML_CLASS, useExpandedView } from "./useExpandedView";

const A = "chain-a";
const B = "chain-b";

let push: ReturnType<typeof vi.spyOn>;
let replace: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Start every test from a plain entry.
  window.history.replaceState(null, "");
  push = vi.spyOn(window.history, "pushState");
  replace = vi.spyOn(window.history, "replaceState");
  // A real back() would traverse asynchronously; the tests drive popstate themselves.
  back = vi.spyOn(window.history, "back").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove(EXPANDED_HTML_CLASS);
});

type Props = { chainIds: readonly string[]; blocked?: boolean; initial?: string };

function mount(initialProps: Props = { chainIds: [A, B] }) {
  return renderHook(({ chainIds, blocked = false, initial }: Props) => useExpandedView({ chainIds, blocked: () => blocked, initial }), { initialProps });
}

const popstate = (state: unknown) => act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state })));
const escape = (init: KeyboardEventInit = {}) => act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init })));
const htmlClass = () => document.documentElement.classList.contains(EXPANDED_HTML_CLASS);

test("expand pushes one history entry naming the chain, with the URL unchanged", () => {
  const before = window.location.href;
  const { result } = mount();
  act(() => result.current.expand(A));
  expect(result.current.expandedChainId).toBe(A);
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith({ rfView: A }, "");
  expect(window.history.state).toEqual({ rfView: A });
  expect(window.location.href).toBe(before);
});

test("collapse goes back once when the view's entry is on top", () => {
  const { result } = mount();
  act(() => result.current.expand(A));
  act(() => result.current.collapse());
  expect(back).toHaveBeenCalledTimes(1);
  expect(result.current.expandedChainId).toBeNull();
});

test("collapse does not go back when the entry on top is not the view's", () => {
  const { result } = mount();
  act(() => result.current.expand(A));
  window.history.replaceState({ other: true }, "");
  act(() => result.current.collapse());
  expect(back).not.toHaveBeenCalled();
  expect(result.current.expandedChainId).toBeNull();
});

test("expanding another view while one is expanded replaces the entry, so one Back still closes it", () => {
  const { result } = mount();
  act(() => result.current.expand(A));
  act(() => result.current.expand(B));
  expect(result.current.expandedChainId).toBe(B);
  expect(push).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenLastCalledWith({ rfView: B }, "");
  expect(window.history.state).toEqual({ rfView: B });
});

test("a popstate with null state collapses", () => {
  const { result } = mount();
  act(() => result.current.expand(A));
  popstate(null);
  expect(result.current.expandedChainId).toBeNull();
  expect(back).not.toHaveBeenCalled();
});

test("a popstate naming a chain on the page expands it; one naming an unknown chain changes nothing", () => {
  const { result } = mount();
  popstate({ rfView: B });
  expect(result.current.expandedChainId).toBe(B);
  popstate({ rfView: "not-on-the-page" });
  expect(result.current.expandedChainId).toBe(B);
  act(() => result.current.collapse());
  popstate({ rfView: "not-on-the-page" });
  expect(result.current.expandedChainId).toBeNull();
  // Popstate never writes history.
  expect(push).not.toHaveBeenCalled();
});

test("Escape on the page collapses", () => {
  const { result } = mount();
  act(() => result.current.expand(A));
  escape();
  expect(result.current.expandedChainId).toBeNull();
  expect(back).toHaveBeenCalledTimes(1);
});

test("Escape does nothing while blocked (a confirm card shows) or when something already handled it", () => {
  const { result, rerender } = mount({ chainIds: [A, B], blocked: true });
  act(() => result.current.expand(A));
  escape();
  expect(result.current.expandedChainId).toBe(A);
  rerender({ chainIds: [A, B], blocked: false });
  const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  handled.preventDefault();
  act(() => void document.dispatchEvent(handled));
  expect(result.current.expandedChainId).toBe(A);
  escape({ key: "Enter" });
  expect(result.current.expandedChainId).toBe(A);
});

test("the html class is set while expanded and removed on collapse", () => {
  const { result } = mount();
  expect(htmlClass()).toBe(false);
  act(() => result.current.expand(A));
  expect(htmlClass()).toBe(true);
  act(() => result.current.collapse());
  expect(htmlClass()).toBe(false);
});

test("a chain that leaves the page collapses with no history call (Review Focus 3)", () => {
  const { result, rerender } = mount();
  act(() => result.current.expand(A));
  push.mockClear();
  rerender({ chainIds: [B] });
  expect(result.current.expandedChainId).toBeNull();
  expect(htmlClass()).toBe(false);
  expect(back).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

test("the fixture seam starts expanded and pushes no entry", () => {
  const { result } = mount({ chainIds: [A, B], initial: B });
  expect(result.current.expandedChainId).toBe(B);
  expect(htmlClass()).toBe(true);
  expect(push).not.toHaveBeenCalled();
  // Its collapse has no entry of its own to go back over.
  act(() => result.current.collapse());
  expect(back).not.toHaveBeenCalled();
  expect(result.current.expandedChainId).toBeNull();
});

test("unmount while expanded removes the class and the listeners and does not touch history", () => {
  const { result, unmount } = mount();
  act(() => result.current.expand(A));
  push.mockClear();
  unmount();
  expect(htmlClass()).toBe(false);
  expect(back).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  // The listeners are gone: nothing throws or changes on a later Escape or popstate.
  escape();
  popstate(null);
  expect(back).not.toHaveBeenCalled();
});
