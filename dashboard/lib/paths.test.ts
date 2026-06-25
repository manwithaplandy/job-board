import { describe, expect, test } from "vitest";
import { isPublicPath } from "@/lib/paths";

describe("isPublicPath", () => {
  test("login and auth callback are public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });
  test("everything else is private", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
  });
});
