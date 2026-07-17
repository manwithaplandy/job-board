// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const actions = vi.hoisted(() => ({
  getInviteStatusAction: vi.fn(),
  sendInvitesAction: vi.fn(),
  generateInviteCodeAction: vi.fn(),
}));
vi.mock("@/app/actions/userInvites", () => actions);

import { InviteModal } from "./InviteModal";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  actions.getInviteStatusAction.mockResolvedValue({
    ok: true, remaining: 2, granted: 3, emailConfigured: true,
  });
});

const open = () => render(<InviteModal open onClose={() => {}} />);

describe("InviteModal", () => {
  test("closed → renders nothing, no status fetch", () => {
    render(<InviteModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.getInviteStatusAction).not.toHaveBeenCalled();
  });

  test("open → dialog with the spec copy and the allowance count", async () => {
    open();
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByText("Invite someone to Rolefit")).not.toBeNull();
    await waitFor(() => expect(screen.getByText(/2 of 3 invites left/)).not.toBeNull());
  });

  test("zero remaining → both controls disabled with the spec zero-state copy", async () => {
    actions.getInviteStatusAction.mockResolvedValue({
      ok: true, remaining: 0, granted: 3, emailConfigured: true,
    });
    open();
    await waitFor(() => expect(screen.getByText("You've used all your invites.")).not.toBeNull());
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /generate code/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("send: shows per-address results and the refreshed count", async () => {
    actions.sendInvitesAction.mockResolvedValue({
      ok: true, remaining: 1,
      results: [
        { email: "a@x.com", status: "sent", detail: "invite sent" },
        { email: "b@y.com", status: "skipped", detail: "already a member" },
      ],
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.change(screen.getByLabelText(/email addresses/i), {
      target: { value: "a@x.com b@y.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
    await waitFor(() => expect(screen.getByText("a@x.com")).not.toBeNull());
    expect(actions.sendInvitesAction).toHaveBeenCalledWith("a@x.com b@y.com");
    expect(screen.getByText(/already a member/)).not.toBeNull();
    expect(screen.getByText(/1 of 3 invites left/)).not.toBeNull();
  });

  test("send disabled when addresses exceed remaining, with 'You can send N more' copy", async () => {
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.change(screen.getByLabelText(/email addresses/i), {
      target: { value: "a@x.com b@y.com c@z.com" }, // 3 addresses, 2 remaining
    });
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/you can send 2 more/i)).not.toBeNull();
    expect(actions.sendInvitesAction).not.toHaveBeenCalled();
  });

  test("generate: shows the code, the link, and the 30-day note", async () => {
    actions.generateInviteCodeAction.mockResolvedValue({
      ok: true, code: "RF-CCCC-3333",
      link: "https://rolefit.app/signup?code=RF-CCCC-3333", remaining: 1,
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.click(screen.getByRole("button", { name: /generate code/i }));
    await waitFor(() => expect(screen.getByText("RF-CCCC-3333")).not.toBeNull());
    expect(screen.getByText(/expires in 30 days/i)).not.toBeNull();
    expect(screen.getByText("https://rolefit.app/signup?code=RF-CCCC-3333")).not.toBeNull();
  });

  test("gate failure (no plan) renders the action's error legibly", async () => {
    actions.getInviteStatusAction.mockResolvedValue({ ok: false, error: "Inviting requires an active plan." });
    open();
    await waitFor(() =>
      expect(screen.getByText("Inviting requires an active plan.")).not.toBeNull(),
    );
  });

  test("email not configured → send disabled with explanatory copy, generate still works", async () => {
    actions.getInviteStatusAction.mockResolvedValue({
      ok: true, remaining: 2, granted: 3, emailConfigured: false,
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/email sending isn't configured/i)).not.toBeNull();
    expect((screen.getByRole("button", { name: /generate code/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
