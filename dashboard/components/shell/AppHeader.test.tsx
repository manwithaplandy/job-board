// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

// The six primary destinations (plan Task 1.23), in order. Board and Companies stay as
// routes until the phase 3 cutover but leave the primary nav: the brand links to the
// board, and the memo page links to Companies.
const PRIMARY = [
  ["agent", "Agent", "/agent"],
  ["shortlist", "Shortlist", "/shortlist"],
  ["applications", "Applications", "/applications"],
  ["looking-for", "Looking for", "/looking-for"],
  ["documents", "Documents", "/documents"],
  ["analytics", "Analytics", "/analytics"],
] as const;

describe("AppHeader", () => {
  test("exposes the six workspace links with their hrefs in the header and marks the current route", () => {
    render(<AppHeader current="analytics" email="person@example.com" />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(PRIMARY.map(([, label, href]) => [label, href]));
    expect(within(nav).getByRole("link", { name: "Analytics" }).getAttribute("aria-current")).toBe("page");
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Account: person@example.com" })).not.toBeNull();
  });

  test("lists the same six links with their hrefs in the mobile menu", () => {
    render(<AppHeader current="agent" email="person@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual(PRIMARY.map(([, label, href]) => [label, href]));
  });

  test.each(PRIMARY)("marks %s current in the header and in the collapsed primary navigation", (current, label) => {
    render(<AppHeader current={current} email="person@example.com" isAdmin />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: label }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("menuitem", { name: label }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("menuitem").filter((item) => item.getAttribute("aria-current") === "page")).toHaveLength(1);
  });

  test("keeps the board reachable from the brand link and drops Board and Companies from the primary nav", () => {
    render(<AppHeader current="board" email="person@example.com" />);
    const brand = screen.getByRole("link", { name: "Rolefit board" });
    expect(brand.getAttribute("href")).toBe("/");
    expect(brand.getAttribute("aria-current")).toBe("page");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("link", { name: "Board" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Companies" })).toBeNull();
    expect(within(nav).getAllByRole("link").some((link) => link.getAttribute("aria-current") === "page")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.queryByRole("menuitem", { name: "Board" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Companies" })).toBeNull();
  });

  test("the brand link is not marked current off the board", () => {
    render(<AppHeader current="shortlist" email="person@example.com" />);
    expect(screen.getByRole("link", { name: "Rolefit board" }).getAttribute("aria-current")).toBeNull();
  });

  test.each([
    ["app/agent/page.tsx", "agent"],
    ["app/shortlist/page.tsx", "shortlist"],
    ["app/applications/page.tsx", "applications"],
    ["app/looking-for/page.tsx", "looking-for"],
    ["app/documents/page.tsx", "documents"],
    ["app/analytics/page.tsx", "analytics"],
  ] as const)("%s passes current=%s to its header", (file, current) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(new RegExp(`<(AppHeader|SlimHeader) current="${current}"`));
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
    expect(primaryDestinations).toEqual(["Agent", "Shortlist", "Applications", "Looking for", "Documents", "Analytics"]);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: /Account:/ }));
    const accountDestinations = screen.getAllByRole("menuitem").map((item) => item.textContent);
    // "Invite" is an account-scoped action (opens the invite modal), not a nav
    // destination, so it lives in the account popup between Billing and Sign out
    // without duplicating any primary-nav link.
    expect(accountDestinations).toEqual(["Profile", "Billing", "Feedback", "Invite", "Sign out"]);
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
