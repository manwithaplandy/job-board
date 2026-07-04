// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

const { default: ErrorPage } = await import("@/app/error");

afterEach(() => {
  cleanup();
  nav.refresh.mockClear();
});

const withDigest = (digest?: string) =>
  Object.assign(new Error("boom — should never render"), digest ? { digest } : {});

describe("app/error.tsx — retry", () => {
  test("'Try again' button exists before click", () => {
    render(<ErrorPage error={withDigest()} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  test("clicking 'Try again' calls BOTH router.refresh and reset exactly once", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={withDigest("abc123")} reset={reset} />);
    // Flush the transition so both effects run within act.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    // The whole point of the fix: a server-side error only recovers if refresh() re-runs
    // the server render AND reset() clears the boundary. Dropping either regresses silently.
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  test("never renders error.message", () => {
    render(<ErrorPage error={withDigest("abc123")} reset={vi.fn()} />);
    expect(screen.queryByText(/should never render/)).toBeNull();
  });
});

describe("app/error.tsx — digest reference", () => {
  test("digest present → rendered as the incident reference", () => {
    render(<ErrorPage error={withDigest("abc123")} reset={vi.fn()} />);
    expect(screen.getByText("abc123")).not.toBeNull();
  });

  test("digest absent → no Reference block", () => {
    render(<ErrorPage error={withDigest()} reset={vi.fn()} />);
    expect(screen.queryByText(/Reference:/)).toBeNull();
  });
});
