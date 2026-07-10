// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DangerZone } from "./DangerZone";

vi.mock("@/app/actions/account", () => ({
  deleteMyAccount: vi.fn(),
}));

afterEach(cleanup);

describe("DangerZone", () => {
  test("gives every interactive control a 44px target", () => {
    render(<DangerZone />);

    const controls = [
      screen.getByRole("link", { name: /export my data/i }),
      screen.getByRole("textbox", { name: /confirm account deletion/i }),
      screen.getByRole("button", { name: /delete account/i }),
    ];

    for (const control of controls) {
      expect(control.style.minHeight).toBe("44px");
      expect(control.style.boxSizing).toBe("border-box");
    }
  });
});
