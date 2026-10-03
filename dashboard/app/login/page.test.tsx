import { beforeEach, describe, expect, test, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const state = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getProfile: vi.fn(),
  saveBoardFilters: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: state.signInWithPassword } }),
}));
vi.mock("@/lib/queries", () => ({ getProfile: state.getProfile, saveBoardFilters: state.saveBoardFilters }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: state.getCookie, delete: state.deleteCookie }) }));
// Keep Next's real redirect exception: the action's chosen destination is the
// observable result, without rendering or invoking any external auth service.
import LoginPage from "./page";

function formAction(node: ReactNode): (form: FormData) => Promise<void> {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findAction(child);
      if (found) return found;
    }
  }
  const found = findAction(node);
  if (found) return found;
  throw new Error("Login form action missing");
}
function findAction(node: ReactNode): ((form: FormData) => Promise<void>) | undefined {
  if (!isValidElement<{ action?: unknown; children?: ReactNode }>(node)) return;
  if (node.type === "form") return node.props.action as (form: FormData) => Promise<void>;
  if (node.props.children != null) return formAction(node.props.children);
}
async function submit() {
  const tree = await LoginPage({ searchParams: Promise.resolve({}) });
  const form = new FormData();
  form.set("email", "local-test@example.invalid");
  form.set("password", "local-test-only");
  form.set("user_id", "untrusted-form-user");
  return formAction(tree)(form);
}

beforeEach(() => {
  vi.resetAllMocks();
  state.signInWithPassword.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  state.getProfile.mockResolvedValue(null);
});

describe("login destination", () => {
  test("sends a profile-less user directly to onboarding without a board detour", async () => {
    await expect(submit()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/onboarding;307;" });
    expect(state.getProfile).toHaveBeenCalledWith("verified-user");
  });
  test("keeps established users on their board", async () => {
    state.getProfile.mockResolvedValue({ user_id: "verified-user" });
    await expect(submit()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/;307;" });
    expect(state.getProfile).toHaveBeenCalledWith("verified-user");
  });
  test("rejects invalid credentials before any profile lookup", async () => {
    state.signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error("Invalid login credentials") });
    await expect(submit()).rejects.toMatchObject({ digest: expect.stringContaining("/login?error=") });
    expect(state.getProfile).not.toHaveBeenCalled();
  });
  test("does not turn a profile lookup failure into a successful landing", async () => {
    state.getProfile.mockRejectedValue(new Error("profile lookup unavailable"));
    await expect(submit()).rejects.toThrow("profile lookup unavailable");
  });
});
