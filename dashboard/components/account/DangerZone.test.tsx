// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DangerZone } from "./DangerZone";

vi.mock("@/app/actions/account", () => ({
  deleteMyAccount: vi.fn(),
}));

afterEach(cleanup);

describe("DangerZone", () => {
  test("composes shared controls whose design-system contract provides 44px targets", () => {
    render(<DangerZone />);

    const controls = [
      screen.getByRole("link", { name: /export my data/i }),
      screen.getByRole("textbox", { name: /confirm account deletion/i }),
      screen.getByRole("button", { name: /delete account/i }),
    ];

    expect(controls[0].classList).toContain("rf-button");
    expect(controls[1].classList).toContain("rf-control");
    expect(controls[2].classList).toContain("rf-button");
    expect(controls[2].classList).toContain("rf-button--destructive");
  });
});
