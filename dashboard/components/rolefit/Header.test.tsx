// @vitest-environment jsdom
import { type ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Header } from "./Header";
import type { OperatorSignals } from "@/lib/types";

afterEach(cleanup);

const base: ComponentProps<typeof Header> = {
  search: "",
  onSearch: vi.fn(),
  isAuthed: true,
  hasProfile: true,
  viewerEmail: "u@x.com",
  onOpenProfile: vi.fn(),
};

const renderHeader = (over: Partial<ComponentProps<typeof Header>> = {}) =>
  render(<Header {...base} {...over} />);

const op = (over: Partial<OperatorSignals> = {}): OperatorSignals => ({
  health: "ok",
  unreviewed: 0,
  reviewed: 0,
  ...over,
});

describe("Header — unreviewed first-run gating", () => {
  test("unreviewed>0 but reviewed=0 → link suppressed (first-run noise fix)", () => {
    renderHeader({ operator: op({ unreviewed: 12, reviewed: 0 }) });
    expect(screen.queryByText(/12 unreviewed/)).toBeNull();
  });

  test("unreviewed>0 and reviewed>0 → link present, href /analytics", () => {
    renderHeader({ operator: op({ unreviewed: 12, reviewed: 3 }) });
    const link = screen.getByText("12 unreviewed");
    expect(link.getAttribute("href")).toBe("/analytics");
  });

  test("unreviewed=0 (reviewed>0) → nothing to show", () => {
    renderHeader({ operator: op({ unreviewed: 0, reviewed: 5 }) });
    expect(screen.queryByText(/unreviewed/)).toBeNull();
  });
});

describe("Header — profile button label matrix", () => {
  test("anon → 'Sign in' link to /login + 'Sign up' link to /signup, NO account menu", () => {
    renderHeader({ isAuthed: false, hasProfile: false, viewerEmail: null });
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
    // The anon CTA is real navigation now — no button-based CTA, no account menu.
    expect(screen.queryByRole("button", { name: /Sign in/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /account/i })).toBeNull();
  });

  test("authed + hasProfile → 'Résumé'", () => {
    renderHeader({ isAuthed: true, hasProfile: true });
    expect(screen.getByRole("button", { name: /Résumé/ })).not.toBeNull();
  });

  test("authed + no profile → 'Set up profile'", () => {
    renderHeader({ isAuthed: true, hasProfile: false });
    expect(screen.getByRole("button", { name: /Set up profile/ })).not.toBeNull();
  });
});

describe("Header — narrow collapse", () => {
  test("isNarrow=false → top-level Analytics/Companies links + AI-REVIEWED badge, plus account menu", () => {
    renderHeader({ isNarrow: false, operator: op({ unreviewed: 4, reviewed: 2 }) });
    expect(screen.getByRole("link", { name: "Analytics" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Companies" })).not.toBeNull();
    expect(screen.getByText("AI-REVIEWED")).not.toBeNull();
    expect(screen.getByRole("button", { name: /account/i })).not.toBeNull();
  });

  test("isNarrow=true → CSS owns nav collapse while status noise is removed and both menus stay", () => {
    renderHeader({ isNarrow: true, operator: op({ unreviewed: 4, reviewed: 2 }) });
    expect(screen.getByRole("navigation", { name: "Primary" }).className).toContain("app-header__desktop-nav");
    expect(screen.getByRole("button", { name: "Open navigation" })).not.toBeNull();
    expect(screen.queryByText("AI-REVIEWED")).toBeNull();
    expect(screen.queryByText(/unreviewed/)).toBeNull();
    // Account remains a distinct affordance; navigation uses its own responsive menu.
    expect(screen.getByRole("button", { name: /account/i })).not.toBeNull();
  });
});
