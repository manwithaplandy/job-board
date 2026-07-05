// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminNav } from "./AdminNav";

afterEach(cleanup);

describe("AdminNav", () => {
  test("renders links to both admin consoles", () => {
    render(<AdminNav active="invites" />);
    expect(screen.getByRole("link", { name: "Tenants" }).getAttribute("href")).toBe(
      "/admin/tenants",
    );
    expect(screen.getByRole("link", { name: "Invites" }).getAttribute("href")).toBe(
      "/admin/invites",
    );
  });

  test("marks the active section with aria-current=page", () => {
    render(<AdminNav active="tenants" />);
    expect(
      screen.getByRole("link", { name: "Tenants" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Invites" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
