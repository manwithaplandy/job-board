// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { AppearanceToggle } from "./AppearanceToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("dark") ? prefersDark : false, media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {},
    removeListener() {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
const renderToggle = () => render(<ThemeProvider><AppearanceToggle /></ThemeProvider>);

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });
afterEach(cleanup);

describe("AppearanceToggle", () => {
  test("renders three radios in a labelled radiogroup, System checked by default", () => {
    mockMatchMedia(true);
    renderToggle();
    expect(screen.getByRole("radiogroup", { name: /theme/i })).not.toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /system/i }).getAttribute("aria-checked")).toBe("true");
  });

  test("choosing Dark checks it, persists, and sets data-theme", () => {
    mockMatchMedia(false);
    renderToggle();
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(screen.getByRole("radio", { name: /dark/i }).getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("arrow keys move roving focus to the newly-selected radio", () => {
    mockMatchMedia(false);
    renderToggle();
    const system = screen.getByRole("radio", { name: /system/i });
    system.focus();
    fireEvent.keyDown(system, { key: "ArrowRight" });
    const light = screen.getByRole("radio", { name: /light/i });
    expect(light.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(light);
  });
});
