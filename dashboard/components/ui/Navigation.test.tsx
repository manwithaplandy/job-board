// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Badge, Card } from "./Panel";
import { BackLink, FormActions, PageHeader, SegmentedControl, Tabs } from "./Navigation";

afterEach(cleanup);

describe("layout and navigation primitives", () => {
  test("provides semantic cards, badges, tabs, segments, headers, and actions", () => {
    render(
      <>
        <PageHeader title="Profile" description="Manage your role fit" actions={<a href="/edit">Edit</a>} />
        <BackLink href="/jobs">Jobs</BackLink>
        <Card as="article"><Badge tone="success">Ready</Badge></Card>
        <Tabs label="Profile sections" items={[{ label: "Account", href: "/account", active: true }]} />
        <SegmentedControl label="View" items={[{ label: "List", value: "list" }, { label: "Grid", value: "grid" }]} value="list" onChange={() => {}} />
        <FormActions><button>Save</button></FormActions>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Profile", level: 1 })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Back to Jobs" })).not.toBeNull();
    expect(screen.getByRole("article")).not.toBeNull();
    expect(screen.getByText("Ready").className).toContain("rf-badge--success");
    expect(screen.getByRole("navigation", { name: "Profile sections" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Account" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("radiogroup", { name: "View" })).not.toBeNull();
    expect(screen.getByRole("radio", { name: "List" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("group", { name: "Form actions" })).not.toBeNull();
  });

  test("defines shared tokens, focus treatment, and 44px interactive targets", () => {
    const globals = readFileSync("app/globals.css", "utf8");
    const css = readFileSync("components/ui/ui.css", "utf8");
    for (const token of ["--font-size-body", "--space-4", "--radius-control", "--control-height", "--content-wide", "--elevation-card", "--motion-fast"]) {
      expect(globals).toContain(token);
    }
    expect(css).toMatch(/\.rf-button\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-icon-button\s*\{[^}]*min-width:\s*var\(--target-size\)[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-control\s*\{[^}]*min-height:\s*var\(--control-height\)/s);
    expect(css).toMatch(/\.rf-focusable:focus-visible/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
