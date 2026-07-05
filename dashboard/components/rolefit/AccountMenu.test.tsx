// @vitest-environment jsdom
import { type ComponentProps } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountMenu } from "./AccountMenu";

afterEach(cleanup);

const renderMenu = (over: Partial<ComponentProps<typeof AccountMenu>> = {}) =>
  render(<AccountMenu email="a@b.com" {...over} />);

const trigger = () => screen.getByRole("button", { name: /account/i });
const openWithClick = () => fireEvent.click(trigger());

describe("AccountMenu — trigger", () => {
  test("is a closed menu-button showing the email initial with the email as accessible name", () => {
    renderMenu();
    const t = trigger();
    expect(t.getAttribute("aria-haspopup")).toBe("menu");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("aria-label")).toBe("Account: a@b.com");
    expect(t.textContent).toBe("A");
    // Popup is not rendered while closed.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("email=null: accessible name 'Account', bullet initial, no email row when open", () => {
    renderMenu({ email: null });
    const t = trigger();
    expect(t.getAttribute("aria-label")).toBe("Account");
    expect(t.textContent).toBe("•"); // •
    openWithClick();
    expect(screen.getByRole("menu")).not.toBeNull();
    // The email presentation row is absent, so no address text is shown.
    expect(screen.queryByText("a@b.com")).toBeNull();
  });
});

describe("AccountMenu — open contents", () => {
  test("clicking opens the menu with the email row and Profile/Billing items", () => {
    renderMenu();
    openWithClick();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).not.toBeNull();
    expect(screen.getByText("a@b.com")).not.toBeNull();

    const profile = screen.getByRole("menuitem", { name: "Profile" });
    expect(profile.getAttribute("href")).toBe("/profile");
    const billing = screen.getByRole("menuitem", { name: "Billing" });
    expect(billing.getAttribute("href")).toBe("/billing");
  });

  test("Sign out is a submit button (role=menuitem) inside a same-origin form POST", () => {
    renderMenu();
    openWithClick();
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    // Pins the CSRF-guard contract: it MUST stay a form-POST submit, not a link/fetch.
    expect(signOut.tagName).toBe("BUTTON");
    expect(signOut.getAttribute("type")).toBe("submit");
    const form = signOut.closest("form")!;
    expect(form).not.toBeNull();
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/auth/signout");
  });

  test("current='billing' marks the Billing item aria-current=page", () => {
    renderMenu({ current: "billing" });
    openWithClick();
    expect(screen.getByRole("menuitem", { name: "Billing" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
  });

  test("current='admin' marks the Admin item aria-current=page", () => {
    renderMenu({ isAdmin: true, current: "admin" });
    openWithClick();
    expect(screen.getByRole("menuitem", { name: "Admin" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
  });

  test("Analytics/Companies are absent by default", () => {
    renderMenu();
    openWithClick();
    expect(screen.queryByRole("menuitem", { name: "Analytics" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Companies" })).toBeNull();
  });

  test("Admin link is absent by default (non-admins)", () => {
    renderMenu();
    openWithClick();
    expect(screen.queryByRole("menuitem", { name: "Admin" })).toBeNull();
  });

  test("isAdmin reveals an Admin link to /admin/tenants, with Sign out still last", () => {
    renderMenu({ isAdmin: true });
    openWithClick();
    const admin = screen.getByRole("menuitem", { name: "Admin" });
    expect(admin.getAttribute("href")).toBe("/admin/tenants");
    // Admin joins the nav group; Sign out stays the last item so the keyboard-wrap
    // contract (ArrowDown at end → first) is unchanged.
    const items = screen.getAllByRole("menuitem");
    expect((items[items.length - 1] as HTMLElement).textContent).toBe("Sign out");
  });

  test("includeNav prepends Analytics/Companies menuitems", () => {
    renderMenu({ includeNav: true });
    openWithClick();
    const analytics = screen.getByRole("menuitem", { name: "Analytics" });
    expect(analytics.getAttribute("href")).toBe("/analytics");
    const companies = screen.getByRole("menuitem", { name: "Companies" });
    expect(companies.getAttribute("href")).toBe("/companies");
    // They lead the list, ahead of Profile.
    expect(screen.getAllByRole("menuitem")[0]).toBe(analytics);
  });
});

describe("AccountMenu — keyboard + dismissal", () => {
  test("ArrowDown on the closed trigger opens and focuses the first menuitem", () => {
    renderMenu();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(screen.getByRole("menu")).not.toBeNull();
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    expect((items[0] as HTMLElement).textContent).toBe("Profile");
  });

  test("ArrowDown at the last item wraps to the first", () => {
    renderMenu();
    // ArrowUp opens and lands on the last item (Sign out).
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    const last = items[items.length - 1];
    expect(document.activeElement).toBe(last);
    expect((last as HTMLElement).textContent).toBe("Sign out");
    // ArrowDown from the last item wraps to the first.
    fireEvent.keyDown(last, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
  });

  test("Escape closes the menu and returns focus to the trigger", () => {
    renderMenu();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const firstItem = screen.getAllByRole("menuitem")[0];
    fireEvent.keyDown(firstItem, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("a pointerdown outside the menu closes it", () => {
    renderMenu();
    openWithClick();
    expect(screen.getByRole("menu")).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
