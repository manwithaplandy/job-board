// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfileSectionNav } from "./ProfileSectionNav";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/resume",
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("ProfileSectionNav", () => {
  test("has desktop links and exactly one compact mobile section selector", () => {
    render(<ProfileSectionNav />);
    expect(screen.getByRole("link", { name: "Résumé & experience" }).getAttribute("aria-current")).toBe("page");
    const selectors = screen.getAllByRole("combobox", { name: "Profile section" });
    expect(selectors).toHaveLength(1);
    expect(selectors[0].getAttribute("value") ?? (selectors[0] as HTMLSelectElement).value).toBe("/profile/resume");
    expect(selectors[0].className).toContain("rf-select");
    expect(selectors[0].className).toContain("rf-focusable");
    expect(selectors[0].closest(".rf-select-wrap")?.querySelector(".rf-icon")).not.toBeNull();
  });

  test("navigates when the mobile section changes", () => {
    render(<ProfileSectionNav />);
    fireEvent.change(screen.getByRole("combobox", { name: "Profile section" }), {
      target: { value: "/profile/account" },
    });
    expect(push).toHaveBeenCalledWith("/profile/account");
  });

  test("mobile hide rule outranks the later legacy settings-nav display rule", () => {
    const shellCss = readFileSync("components/shell/shell.css", "utf8");
    const profileCss = readFileSync("app/profile/profile-settings.css", "utf8");
    expect(profileCss).toMatch(/\.settings-nav\s*\{[^}]*display:\s*flex/s);
    expect(shellCss).toMatch(/\.profile-section-nav__desktop\s*\{[^}]*display:\s*flex/s);
    expect(shellCss).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.profile-section-nav \.profile-section-nav__desktop\s*\{[^}]*display:\s*none/s,
    );
    expect(shellCss).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.profile-section-nav__mobile\s*\{[^}]*display:\s*block/s,
    );
  });
});
