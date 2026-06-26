import { describe, expect, test } from "vitest";
import { isPublicPath } from "@/lib/paths";

describe("isPublicPath", () => {
  test("home, login, and auth callback are public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });
  test("profile and other routes are private", () => {
    expect(isPublicPath("/profile")).toBe(false);
    expect(isPublicPath("/something")).toBe(false);
  });
});
