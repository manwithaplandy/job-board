// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UpsellNotice } from "./UpsellNotice";

afterEach(cleanup);

describe("UpsellNotice accessibility", () => {
  test("announces only the dynamic notice text, outside both actions", () => {
    render(
      <UpsellNotice
        notice={{ message: "Daily review budget used — resumes tomorrow.", cta: "Upgrade to Pro" }}
        marginTop={0}
        onDismiss={vi.fn()}
      />,
    );

    const status = screen.getAllByRole("status").find((node) => node.textContent === "Daily review budget used — resumes tomorrow.")!;
    const link = screen.getByRole("link", { name: /Upgrade to Pro/ });
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(status.textContent).toBe("Daily review budget used — resumes tomorrow.");
    expect(status.contains(link)).toBe(false);
    expect(status.contains(dismiss)).toBe(false);
  });
});
