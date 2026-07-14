// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ButtonLink } from "./Button";
import { Alert, EmptyState, ErrorState, LoadingState } from "./SystemStates";

afterEach(cleanup);

describe("shared system states", () => {
  it("announces danger alerts and exposes their title and action", () => {
    render(
      <Alert tone="danger" title="Could not save" action={<ButtonLink href="/profile">Review profile</ButtonLink>}>
        Check the highlighted fields and try again.
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("rf-alert rf-alert--danger");
    expect(screen.getByRole("heading", { name: "Could not save" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review profile" }).getAttribute("href")).toBe("/profile");
  });

  it("announces success alerts as polite status messages", () => {
    render(<Alert tone="success">Your account and data have been permanently deleted.</Alert>);

    expect(screen.getByRole("status").className).toContain("rf-alert--success");
  });

  it("gives empty states a specific next action", () => {
    render(
      <EmptyState
        title="No roles match your filters"
        description="Try removing one or more filters."
        action={<button type="button">Clear filters</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No roles match your filters" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  });

  it("supports a compact empty state inside fixed-height data cards", () => {
    render(<EmptyState compact title="No trend data yet" description="Run a review to populate this chart." />);

    expect(screen.getByRole("heading", { name: "No trend data yet" }).parentElement?.className)
      .toContain("rf-empty-state--compact");
  });

  it("exposes loading progress without using a raw text-only placeholder", () => {
    render(<LoadingState label="Loading role details" />);

    const status = screen.getByRole("status", { name: "Loading role details" });
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.querySelector(".rf-loading-state__indicator")).not.toBeNull();
  });

  it("uses an alert role for recoverable error states", () => {
    render(
      <ErrorState
        title="This role couldn't be displayed"
        description="Pick another role, or reload the page to try again."
      />,
    );

    expect(screen.getByRole("alert").className).toContain("rf-error-state");
    expect(screen.getByText(/pick another role/i)).toBeTruthy();
  });
});
