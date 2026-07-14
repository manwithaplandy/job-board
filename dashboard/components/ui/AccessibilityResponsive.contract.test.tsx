// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useState } from "react";
import { Button } from "./Button";

afterEach(cleanup);

const read = (path: string) => readFileSync(path, "utf8");

describe("accessibility and responsive acceptance contracts", () => {
  test("announces the idle-to-loading transition outside the disabled control", () => {
    function LoadingAction() {
      const [loading, setLoading] = useState(false);
      return <Button loading={loading} loadingLabel="Saving profile" onClick={() => setLoading(true)}>Save profile</Button>;
    }

    const { container } = render(<LoadingAction />);
    const idle = screen.getByRole("button", { name: "Save profile" });
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    expect(idle.contains(status)).toBe(false);

    fireEvent.click(idle);

    const button = screen.getByRole("button", { name: "Saving profile" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(status.textContent).toBe("Saving profile");
    expect(button.contains(status)).toBe(false);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  test("defines keyboard focus, pressed, disabled, and minimum target states for every shared action family", () => {
    const css = read("components/ui/ui.css");

    expect(css).toMatch(/\.rf-button:active:not\(:disabled\)/);
    expect(css).toMatch(/\.rf-icon-button:active:not\(:disabled\)/);
    expect(css).toMatch(/\.rf-segments__item:active:not\(:disabled\)/);
    expect(css).toMatch(/\.rf-icon-button:disabled[^}]*cursor:\s*not-allowed/s);
    expect(css).toMatch(/\.rf-segments__item\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-tabs__item\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-back-link\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
  });

  test("disables all decorative motion when the user requests reduced motion", () => {
    const globals = read("app/globals.css");

    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*animation-duration:\s*\.01ms\s*!important/s);
    expect(globals).toMatch(/prefers-reduced-motion:[\s\S]*transition-duration:\s*\.01ms\s*!important/s);
    expect(globals).toMatch(/prefers-reduced-motion:[\s\S]*scroll-behavior:\s*auto\s*!important/s);
  });

  test("board status surfaces use shared, target-safe actions", () => {
    const review = read("components/rolefit/ReviewNowPanel.tsx");
    const upsell = read("components/rolefit/UpsellNotice.tsx");

    expect(review).toContain("<Button");
    expect(review).toContain("loading={busy}");
    expect(review).toContain('flexWrap: "wrap"');
    expect(upsell).toContain('role="status"');
    expect(upsell).toContain("<ButtonLink");
    expect(upsell).toContain("<Button");
  });

  test("keeps shared page, state, and navigation content shrinkable instead of creating route overflow", () => {
    const css = read("components/ui/ui.css");

    expect(css).toMatch(/\.rf-page-header__copy[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-page-header__actions[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-alert__copy[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-empty-state__description[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.rf-error-state__description[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.rf-tabs__list[^}]*min-width:\s*max-content/s);
  });
});
