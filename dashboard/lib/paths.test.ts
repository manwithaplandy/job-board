import { describe, expect, test } from "vitest";
import { internalPathFromReferer, isPublicPath } from "@/lib/paths";

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
  test("the board-filters API is public (anon must save filters) but other APIs stay private", () => {
    expect(isPublicPath("/api/board-filters")).toBe(true);
    expect(isPublicPath("/api/resume")).toBe(false);
  });
  test("account-lifecycle pages are public (logged-out visitors must reach them)", () => {
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });
  test("/reset-password/update is reachable (its page enforces the recovery session)", () => {
    // It matches the /reset-password prefix — intentional; the page itself gates on
    // a valid recovery session before allowing a password change.
    expect(isPublicPath("/reset-password/update")).toBe(true);
  });
});

describe("internalPathFromReferer", () => {
  test("returns same-host pathname and preserves the query string", () => {
    expect(internalPathFromReferer("https://jobs.example.com/?status=open", "jobs.example.com"))
      .toBe("/?status=open");
  });
  test("falls back to / when the referer is missing", () => {
    expect(internalPathFromReferer(null, "jobs.example.com")).toBe("/");
    expect(internalPathFromReferer("", "jobs.example.com")).toBe("/");
  });
  test("falls back to / for a different host (open-redirect guard)", () => {
    expect(internalPathFromReferer("https://evil.example.com/phish", "jobs.example.com"))
      .toBe("/");
  });
  test("falls back to / for an unparseable referer", () => {
    expect(internalPathFromReferer("not a url", "jobs.example.com")).toBe("/");
  });
  test("falls back to / when the referer is the profile page (avoids a loop)", () => {
    expect(internalPathFromReferer("https://jobs.example.com/profile", "jobs.example.com"))
      .toBe("/");
  });
  test("honors a custom fallback", () => {
    expect(internalPathFromReferer(null, "jobs.example.com", "/login")).toBe("/login");
  });
});
