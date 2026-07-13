// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Button, ButtonLink } from "./Button";

afterEach(cleanup);

describe("Button contracts", () => {
  test("exposes variant, size, disabled, and loading states", () => {
    render(
      <>
        <Button variant="danger" size="lg">Delete role</Button>
        <Button loading loadingLabel="Saving changes">Save changes</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Delete role" }).className).toContain("rf-button--danger");
    expect(screen.getByRole("button", { name: "Delete role" }).className).toContain("rf-button--lg");
    const loading = screen.getByRole<HTMLButtonElement>("button", { name: "Saving changes" });
    expect(loading.disabled).toBe(true);
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.className).toContain("rf-focusable");
  });

  test("renders links as anchors without button-only attributes", () => {
    render(<ButtonLink href="/profile" variant="secondary">Open profile</ButtonLink>);
    const link = screen.getByRole("link", { name: "Open profile" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/profile");
    expect(link.className).toContain("rf-button--secondary");
    expect(link.className).toContain("rf-focusable");
  });
});
