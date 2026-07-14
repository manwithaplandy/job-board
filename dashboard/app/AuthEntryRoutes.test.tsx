// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { signUp } from "@/app/actions/signup";

const auth = vi.hoisted(() => ({ getUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/auth", () => auth);

const { default: LoginPage } = await import("@/app/login/page");
const { default: SignupPage } = await import("@/app/signup/page");
const { default: ResetPasswordPage } = await import("@/app/reset-password/page");
const { default: UpdatePasswordPage } = await import("@/app/reset-password/update/page");

function findForm(node: ReactNode): ReactElement<{ action?: unknown; children?: ReactNode }> {
  if (Array.isArray(node)) {
    for (const child of node) {
      try { return findForm(child); } catch { /* keep walking */ }
    }
  }
  if (isValidElement<{ action?: unknown; children?: ReactNode }>(node)) {
    if (node.type === "form") return node;
    if (node.props.children != null) return findForm(node.props.children);
  }
  throw new Error("form not found in route element tree");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("auth entry route composition", () => {
  it("renders a login error with the sign-in action and both recovery paths", async () => {
    const tree = await LoginPage({ searchParams: Promise.resolve({ error: "Invalid credentials" }) });
    expect(typeof findForm(tree).props.action).toBe("function");
    render(tree);

    expect(screen.getByRole("alert").textContent).toContain("Invalid credentials");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/reset-password");
  });

  it("wires the signup form to the exported signUp server action by identity", async () => {
    const tree = await SignupPage({ searchParams: Promise.resolve({}) });

    expect(findForm(tree).props.action).toBe(signUp);
    render(tree);
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("renders signup confirmation as status with a route back to sign in", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ sent: "1" }) }));

    expect(screen.getByRole("status").textContent).toContain("confirmation link");
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  });

  it("keeps the reset form wired to its email field and submit action", async () => {
    const tree = await ResetPasswordPage({ searchParams: Promise.resolve({}) });
    const secondTree = await ResetPasswordPage({ searchParams: Promise.resolve({}) });
    const action = findForm(tree).props.action;
    expect(typeof action).toBe("function");
    expect(findForm(secondTree).props.action).toBe(action);
    render(tree);

    const form = screen.getByRole("button", { name: "Send reset link" }).closest("form");
    expect(form).not.toBeNull();
    expect(within(form!).getByRole("textbox", { name: "Email" }).getAttribute("name")).toBe("email");
  });

  it("shows safe update-password errors only after the recovery-session gate", async () => {
    auth.getUserId.mockResolvedValueOnce("user-1");
    const tree = await UpdatePasswordPage({ searchParams: Promise.resolve({ error: "Password is too weak" }) });
    expect(typeof findForm(tree).props.action).toBe("function");
    render(tree);

    expect(auth.getUserId).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("Password is too weak");
    expect(screen.getByRole("button", { name: "Update password" })).toBeTruthy();
  });
});
