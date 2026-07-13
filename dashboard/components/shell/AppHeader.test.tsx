// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

describe("AppHeader", () => {
  test("exposes the shared route navigation and marks the current route", () => {
    render(<AppHeader current="analytics" email="person@example.com" />);

    expect(screen.getByRole("link", { name: "Board" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Analytics" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Companies" }).getAttribute("href")).toBe("/companies");
    expect(screen.getByRole("button", { name: "Account: person@example.com" })).not.toBeNull();
  });

  test("collapses page navigation into the account menu on narrow screens", () => {
    render(<AppHeader current="board" email="person@example.com" />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toContain("app-header__desktop-nav");

    fireEvent.click(screen.getByRole("button", { name: /Account:/ }));
    expect(screen.getByRole("menuitem", { name: "Board" })).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Analytics" })).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Companies" })).not.toBeNull();
  });

  test("keeps board-specific content in the shared header slots", () => {
    render(
      <AppHeader
        current="board"
        email="person@example.com"
        center={<label>Search roles<input /></label>}
        actions={<button type="button">Board action</button>}
      />,
    );
    expect(screen.getByLabelText("Search roles")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Board action" })).not.toBeNull();
  });
});
