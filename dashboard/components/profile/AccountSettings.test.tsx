// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AccountSettings } from "./AccountSettings";

vi.mock("@/components/theme/AppearanceToggle", () => ({
  AppearanceToggle: () => <div>Theme chooser</div>,
}));

vi.mock("@/components/account/DangerZone", () => ({
  DangerZone: () => <button type="button">Delete account</button>,
}));

afterEach(cleanup);

describe("AccountSettings", () => {
  test("renders account sections in the intended order", () => {
    render(<AccountSettings />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Plan & billing",
      "Appearance",
      "Data & privacy",
    ]);
    expect(screen.getByRole("link", { name: /manage plan and billing/i }).getAttribute("href")).toBe("/billing");
  });

  test("puts account deletion only in the final labelled danger section", () => {
    const { container } = render(<AccountSettings />);
    const danger = screen.getByRole("region", { name: /danger zone/i });

    expect(within(danger).getByRole("button", { name: /delete account/i })).not.toBeNull();
    expect(container.firstElementChild?.lastElementChild).toBe(danger);
    expect(screen.getAllByRole("button", { name: /delete account/i })).toHaveLength(1);
  });

  test("does not expose career profile fields or AI controls", () => {
    render(<AccountSettings />);

    expect(screen.queryByText(/job preferences|résumé|application details|personalization/i)).toBeNull();
    expect(screen.queryByText(/ai settings|model|temperature/i)).toBeNull();
  });
});
