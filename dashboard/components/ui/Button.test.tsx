// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Button, ButtonLink } from "./Button";

afterEach(cleanup);

describe("Button contracts", () => {
  test("exposes the complete canonical variant and size vocabulary without inline presentation", () => {
    const variants = ["primary", "secondary", "outline", "ghost", "destructive", "text-link"] as const;
    render(
      <>
        {variants.map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}
        <Button variant="danger">legacy danger</Button>
        {(["compact", "sm", "md", "lg"] as const).map((size) => <Button key={size} size={size}>size {size}</Button>)}
      </>,
    );
    for (const variant of variants) {
      const button = screen.getByRole<HTMLButtonElement>("button", { name: variant });
      expect(button.className).toContain(`rf-button--${variant}`);
      expect(button.getAttribute("style")).toBeNull();
    }
    expect(screen.getByRole("button", { name: "legacy danger" }).className).toContain("rf-button--destructive");
    for (const size of ["compact", "sm", "md", "lg"]) {
      expect(screen.getByRole("button", { name: `size ${size}` }).className).toContain(`rf-button--${size}`);
    }
  });

  test("makes loading authoritative over consumer disabled and ARIA props", () => {
    render(<Button loading loadingLabel="Saving changes" aria-label="Save" aria-busy="false">Save changes</Button>);
    const loading = screen.getByRole<HTMLButtonElement>("button", { name: "Saving changes" });
    expect(loading.disabled).toBe(true);
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.querySelector(".rf-button__spinner")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("renders links as anchors without button-only attributes", () => {
    render(<ButtonLink href="/profile" variant="text-link">Open profile</ButtonLink>);
    const link = screen.getByRole("link", { name: "Open profile" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/profile");
    expect(link.className).toContain("rf-button--text-link");
    expect(link.className).toContain("rf-focusable");
  });
});
