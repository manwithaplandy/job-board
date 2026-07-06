// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

let listeners: Array<(e: { matches: boolean }) => void>;
function mockMatchMedia(prefersDark: boolean) {
  listeners = [];
  window.matchMedia = ((q: string) => ({
    matches: q.includes("dark") ? prefersDark : false,
    media: q,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Probe() {
  const { choice, resolvedTheme, setChoice } = useTheme();
  return (
    <div>
      <span data-testid="choice">{choice}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setChoice("dark")}>go-dark</button>
      <button onClick={() => setChoice("system")}>go-system</button>
    </div>
  );
}
const renderProbe = () => render(<ThemeProvider><Probe /></ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(cleanup);

describe("ThemeProvider / useTheme", () => {
  test("defaults to system and resolves via OS (dark)", () => {
    mockMatchMedia(true);
    renderProbe();
    expect(screen.getByTestId("choice").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  test("setChoice persists, updates state and data-theme", () => {
    mockMatchMedia(false);
    renderProbe();
    fireEvent.click(screen.getByText("go-dark"));
    expect(screen.getByTestId("choice").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("in system mode, an OS change flips resolvedTheme live", () => {
    mockMatchMedia(false);
    renderProbe();
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    // Dispatch the synthetic OS-preference change inside act() so React flushes the
    // resulting state update before we assert (React 19 createRoot defers updates
    // triggered from a raw callback outside act — this is a test-harness requirement,
    // not a product concern: the listener + closure themselves are exercised as-is).
    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });
});
