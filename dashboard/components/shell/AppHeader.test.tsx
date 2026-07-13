// @vitest-environment jsdom
import { readFileSync } from "node:fs";
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

  test.each([
    ["board", "Board"],
    ["analytics", "Analytics"],
    ["companies", "Companies"],
  ] as const)("marks %s current in the collapsed primary navigation", (current, label) => {
    render(<AppHeader current={current} email="person@example.com" isAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("menuitem", { name: label }).getAttribute("aria-current")).toBe("page");
  });

  test.each([
    ["profile", "Profile"],
    ["billing", "Billing"],
    ["admin", "Admin"],
  ] as const)("marks %s current in the account menu", (current, label) => {
    render(<AppHeader current={current} email="person@example.com" isAdmin />);
    fireEvent.click(screen.getByRole("button", { name: /Account:/ }));
    expect(screen.getByRole("menuitem", { name: label }).getAttribute("aria-current")).toBe("page");
  });

  test("uses a distinct CSS-switched navigation menu without duplicating links in the account popup", () => {
    render(<AppHeader current="board" email="person@example.com" />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toContain("app-header__desktop-nav");

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const primaryDestinations = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(primaryDestinations).toEqual(["Board", "Analytics", "Companies"]);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: /Account:/ }));
    const accountDestinations = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(accountDestinations).toEqual(["Profile", "Billing", "Sign out"]);
    expect(primaryDestinations.filter((destination) => accountDestinations.includes(destination))).toEqual([]);

    const css = readFileSync("components/shell/shell.css", "utf8");
    expect(css).toMatch(/\.app-header__mobile-nav\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*\.app-header__desktop-nav[^}]*display:\s*none/s);
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*\.app-header__mobile-nav[^}]*display:\s*block/s);
  });

  test("supports keyboard entry, movement, and escape in the responsive navigation", () => {
    render(<AppHeader current="board" email="person@example.com" />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Navigation" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
