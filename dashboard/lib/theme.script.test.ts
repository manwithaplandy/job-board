// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

function run(prefersDark: boolean) {
  // Minimal matchMedia stub honoring the dark query.
  window.matchMedia = ((q: string) => ({
    matches: q.includes("dark") ? prefersDark : false,
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  // eslint-disable-next-line no-new-func
  new Function(THEME_INIT_SCRIPT)();
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => localStorage.clear());

describe("THEME_INIT_SCRIPT", () => {
  test("no stored choice + OS dark → data-theme=dark", () => {
    run(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  test("no stored choice + OS light → data-theme=light", () => {
    run(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  test("explicit dark overrides OS light", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  test("junk stored value falls back to system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "banana");
    run(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
