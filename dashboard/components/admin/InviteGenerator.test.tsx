// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The generator is a thin client shell over the server action: assert on rendered
// state and the values handed to the (mocked) action — never real network or DB
// (dashboard-component-tests-jsdom convention).

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

const action = vi.hoisted(() => ({
  createInviteAction: vi.fn<
    (input: unknown) => Promise<{ ok: true; code: string } | { ok: false; error: string }>
  >(async () => ({ ok: true, code: "RF-QQQQ-WWWW" })),
}));
vi.mock("@/app/actions/invites", () => action);

import { InviteGenerator } from "./InviteGenerator";
import { CopyButton } from "./CopyButton";

afterEach(() => {
  cleanup();
  nav.refresh.mockClear();
  action.createInviteAction.mockClear();
});

describe("InviteGenerator", () => {
  test("renders note / max-uses / expires fields and a submit control; custom code starts collapsed", () => {
    render(<InviteGenerator />);
    expect(screen.getByLabelText("Note")).toBeTruthy();
    expect(screen.getByLabelText("Max uses")).toBeTruthy();
    expect(screen.getByLabelText("Expires")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate invite" })).toBeTruthy();
    expect(screen.queryByLabelText("Custom code")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use a custom code" }));
    expect(screen.getByLabelText("Custom code")).toBeTruthy();
  });

  test("submits parsed values, shows the minted code, and refreshes the list", async () => {
    render(<InviteGenerator />);
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "beta friend" } });
    fireEvent.change(screen.getByLabelText("Max uses"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
    expect(await screen.findByText("RF-QQQQ-WWWW")).toBeTruthy();
    expect(action.createInviteAction).toHaveBeenCalledWith({
      note: "beta friend",
      maxUses: 5,
      expiresAt: null,
      code: undefined,
    });
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Copy RF-QQQQ-WWWW" })).toBeTruthy();
  });

  test("defaults an empty Max uses to 1 (server rejects 0)", async () => {
    render(<InviteGenerator />);
    fireEvent.change(screen.getByLabelText("Max uses"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
    expect(await screen.findByText("RF-QQQQ-WWWW")).toBeTruthy();
    expect(action.createInviteAction).toHaveBeenCalledWith({
      note: undefined,
      maxUses: 1,
      expiresAt: null,
      code: undefined,
    });
  });

  test("submits a non-empty expiry date and a trimmed custom code", async () => {
    render(<InviteGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "Use a custom code" }));
    fireEvent.change(screen.getByLabelText("Expires"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.change(screen.getByLabelText("Custom code"), {
      target: { value: " TEAM-2026 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
    expect(await screen.findByText("RF-QQQQ-WWWW")).toBeTruthy();
    expect(action.createInviteAction).toHaveBeenCalledWith({
      note: undefined,
      maxUses: 1,
      expiresAt: "2026-12-31",
      code: "TEAM-2026",
    });
  });

  test("an { ok: false } result shows the error and mints nothing", async () => {
    action.createInviteAction.mockResolvedValueOnce({
      ok: false,
      error: "That code already exists.",
    });
    render(<InviteGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
    expect(await screen.findByText("That code already exists.")).toBeTruthy();
    expect(screen.queryByText(/RF-QQQQ/)).toBeNull();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});

describe("CopyButton", () => {
  test("writes its text to the clipboard and flips to 'Copied'", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CopyButton text="RF-QQQQ-WWWW" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy RF-QQQQ-WWWW" }));
    expect(writeText).toHaveBeenCalledWith("RF-QQQQ-WWWW");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});
