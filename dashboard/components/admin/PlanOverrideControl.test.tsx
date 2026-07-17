// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Thin client shell over the server action: assert rendered state + the values handed
// to the (mocked) action — never real network or DB (dashboard-component-tests-jsdom
// convention, same as InviteGenerator.test.tsx).

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

const action = vi.hoisted(() => ({
  setPlanOverrideAction: vi.fn<
    (input: unknown) => Promise<{ ok: true } | { ok: false; error: string }>
  >(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/adminSettings", () => action);

import { PlanOverrideControl } from "./PlanOverrideControl";

const UID = "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f";

afterEach(() => {
  cleanup();
  nav.refresh.mockClear();
  action.setPlanOverrideAction.mockClear();
});

describe("PlanOverrideControl", () => {
  test("expiry and note stay hidden until a plan is picked", () => {
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    expect((screen.getByLabelText("Plan override") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByLabelText("Override expiry (optional)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "pro" } });
    expect(screen.getByLabelText("Override expiry (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Override note (optional)")).toBeTruthy();
  });

  test("Set submits plan/expiry/note and refreshes on success", async () => {
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "pro" } });
    fireEvent.change(screen.getByLabelText("Override expiry (optional)"), { target: { value: "2099-01-02" } });
    fireEvent.change(screen.getByLabelText("Override note (optional)"), { target: { value: "beta comp" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("button", { name: "Set" })).toBeTruthy(); // action settled
    expect(action.setPlanOverrideAction).toHaveBeenCalledWith({
      userId: UID, plan: "pro", expiresAt: "2099-01-02", note: "beta comp",
    });
    expect(nav.refresh).toHaveBeenCalled();
  });

  test("switching back to No override submits an empty plan (clear)", async () => {
    render(<PlanOverrideControl userId={UID} plan="pro" expiresAt="2099-01-02" note="x" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("button", { name: "Set" })).toBeTruthy();
    expect(action.setPlanOverrideAction).toHaveBeenCalledWith({
      userId: UID, plan: "", expiresAt: "", note: "",
    });
  });

  test("an action error surfaces as an alert and does not refresh", async () => {
    action.setPlanOverrideAction.mockResolvedValueOnce({ ok: false, error: "Expiry must be in the future." });
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
