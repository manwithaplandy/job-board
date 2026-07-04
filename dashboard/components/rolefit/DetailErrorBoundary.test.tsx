// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DetailErrorBoundary } from "./DetailErrorBoundary";

// This boundary is the crash-containment shipped after a prod incident where one
// malformed job took down the whole board. If a refactor removed the containment,
// the throw would propagate out of render() and these tests would fail.
function Bomb(): never {
  throw new Error("malformed package");
}

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React logs boundary catches to console.error; silence to keep output clean
  // (and to assert the componentDidCatch log fired).
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  errSpy.mockRestore();
});

describe("DetailErrorBoundary", () => {
  test("a throwing child is contained and shows the fallback copy", () => {
    render(
      <DetailErrorBoundary>
        <Bomb />
      </DetailErrorBoundary>,
    );
    expect(screen.getByText(/couldn't be displayed/i)).toBeTruthy();
    expect(screen.getByText(/rest of the board is/i)).toBeTruthy();
    // componentDidCatch logged the underlying error.
    expect(errSpy).toHaveBeenCalled();
  });

  test("a healthy child renders untouched", () => {
    render(
      <DetailErrorBoundary>
        <div>real job detail</div>
      </DetailErrorBoundary>,
    );
    expect(screen.getByText("real job detail")).toBeTruthy();
    expect(screen.queryByText(/couldn't be displayed/i)).toBeNull();
  });

  test("remounting via a new key clears the error state (the key={jobId} contract)", () => {
    const { rerender } = render(
      <DetailErrorBoundary key="job1">
        <Bomb />
      </DetailErrorBoundary>,
    );
    expect(screen.getByText(/couldn't be displayed/i)).toBeTruthy();

    // Selecting another job remounts the boundary with a fresh key → healthy again.
    rerender(
      <DetailErrorBoundary key="job2">
        <div>another role</div>
      </DetailErrorBoundary>,
    );
    expect(screen.getByText("another role")).toBeTruthy();
    expect(screen.queryByText(/couldn't be displayed/i)).toBeNull();
  });
});
