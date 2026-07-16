// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
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

  test("renders disabled tabs as non-actionable, non-focusable content", () => {
    render(<Tabs label="Sections" items={[{ label: "Ready", href: "/ready" }, { label: "Unavailable", href: "/unavailable", disabled: true }]} />);
    expect(screen.getByRole("link", { name: "Ready" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Unavailable" })).toBeNull();
    const disabled = screen.getByText("Unavailable");
    expect(disabled.tagName).toBe("SPAN");
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(disabled.getAttribute("tabindex")).toBeNull();
  });

  test("implements roving radio focus, selection, wrapping, and disabled-item skipping", () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="View" items={[{ label: "List", value: "list" }, { label: "Board", value: "board", disabled: true }, { label: "Grid", value: "grid" }]} value="list" onChange={onChange} />);
    const list = screen.getByRole("radio", { name: "List" });
    const board = screen.getByRole("radio", { name: "Board" });
    const grid = screen.getByRole("radio", { name: "Grid" });
    expect(list.getAttribute("tabindex")).toBe("0");
    expect(grid.getAttribute("tabindex")).toBe("-1");
    list.focus();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement).toBe(grid);
    expect(onChange).toHaveBeenLastCalledWith("grid");
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(document.activeElement).toBe(list);
    fireEvent.keyDown(list, { key: "End" });
    expect(document.activeElement).toBe(grid);
    fireEvent.keyDown(grid, { key: "Home" });
    expect(document.activeElement).toBe(list);
    expect(board.getAttribute("tabindex")).toBe("-1");
  });

  test("defines shared tokens, focus treatment, and 44px interactive targets", () => {
    const globals = readFileSync("app/globals.css", "utf8");
    const css = readFileSync("components/ui/ui.css", "utf8");
    for (const token of ["--font-size-body", "--space-4", "--radius-control", "--control-height", "--control-height-compact", "--content-form", "--content-standard", "--content-workspace", "--elevation-card", "--motion-fast"]) {
      expect(globals).toContain(token);
    }
    expect(css).toMatch(/\.rf-button\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-icon-button\s*\{[^}]*min-width:\s*var\(--target-size\)[^}]*min-height:\s*var\(--target-size\)/s);
    expect(css).toMatch(/\.rf-control\s*\{[^}]*min-height:\s*var\(--control-height\)/s);
    expect(css).toMatch(/\.rf-focusable:focus-visible/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*\.rf-button__spinner\s*\{[^}]*animation:\s*none/s);
  });
});
