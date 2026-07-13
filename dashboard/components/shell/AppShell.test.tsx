// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  test("provides a shared bounded shell around authenticated page content", () => {
    render(<AppShell header={<div>Shared header</div>}><main>Page content</main></AppShell>);
    expect(screen.getByTestId("app-shell").className).toContain("app-shell");
    expect(screen.getByText("Shared header")).not.toBeNull();
    expect(screen.getByRole("main")).not.toBeNull();
  });
});
