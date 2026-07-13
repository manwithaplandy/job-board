// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
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
});
