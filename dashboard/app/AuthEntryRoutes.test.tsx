// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const auth = vi.hoisted(() => ({ getUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/auth", () => auth);

const { default: LoginPage } = await import("@/app/login/page");
const { default: SignupPage } = await import("@/app/signup/page");
const { default: ResetPasswordPage } = await import("@/app/reset-password/page");
const { default: UpdatePasswordPage } = await import("@/app/reset-password/update/page");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("auth entry route composition", () => {
  it("renders a login error with the sign-in action and both recovery paths", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: "Invalid credentials" }) }));

    expect(screen.getByRole("alert").textContent).toContain("Invalid credentials");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/reset-password");
  });

  it("renders signup confirmation as status with a route back to sign in", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ sent: "1" }) }));

    expect(screen.getByRole("status").textContent).toContain("confirmation link");
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  });

  it("keeps the reset form wired to its email field and submit action", async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));

    const form = screen.getByRole("button", { name: "Send reset link" }).closest("form");
    expect(form).not.toBeNull();
    expect(within(form!).getByRole("textbox", { name: "Email" }).getAttribute("name")).toBe("email");
  });

  it("shows safe update-password errors only after the recovery-session gate", async () => {
    auth.getUserId.mockResolvedValueOnce("user-1");
    render(await UpdatePasswordPage({ searchParams: Promise.resolve({ error: "Password is too weak" }) }));

    expect(auth.getUserId).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("Password is too weak");
    expect(screen.getByRole("button", { name: "Update password" })).toBeTruthy();
  });
});
