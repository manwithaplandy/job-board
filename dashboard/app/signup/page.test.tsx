// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The page imports the signUp server action (next/headers, supabase) — stub it out.
vi.mock("@/app/actions/signup", () => ({ signUp: async () => {} }));

import SignupPage from "@/app/signup/page";

afterEach(cleanup);

describe("SignupPage invite-code prefill", () => {
  test("?code= pre-fills the invite input (still editable + required)", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ code: "RF-AAAA-2222" }) }));
    const input = screen.getByPlaceholderText("Your invite code") as HTMLInputElement;
    expect(input.value).toBe("RF-AAAA-2222");
    expect(input.required).toBe(true);
    expect(input.readOnly).toBe(false);
  });
  test("no code param → empty input", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));
    const input = screen.getByPlaceholderText("Your invite code") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
