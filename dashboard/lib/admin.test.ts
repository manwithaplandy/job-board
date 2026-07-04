import { afterEach, describe, expect, test, vi } from "vitest";
import { isAdmin, adminEmails } from "@/lib/admin";
import { isPublicPath } from "@/lib/paths";

const OLD = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
  vi.restoreAllMocks();
});

describe("isAdmin", () => {
  test("true only for a listed email (case-insensitive, whitespace-tolerant)", () => {
    process.env.ADMIN_EMAILS = " Op@Example.com , second@x.com ";
    expect(isAdmin({ email: "op@example.com" })).toBe(true);
    expect(isAdmin({ email: "OP@EXAMPLE.COM" })).toBe(true);
    expect(isAdmin({ email: "second@x.com" })).toBe(true);
    expect(isAdmin({ email: "stranger@x.com" })).toBe(false);
  });

  test("fails closed when ADMIN_EMAILS is unset or blank", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin({ email: "op@example.com" })).toBe(false);
    process.env.ADMIN_EMAILS = "   ";
    expect(isAdmin({ email: "op@example.com" })).toBe(false);
    expect(adminEmails().size).toBe(0);
  });

  test("null/empty claims are never admin", () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ email: null })).toBe(false);
    expect(isAdmin({})).toBe(false);
  });
});

describe("/admin/tenants is not a public path", () => {
  test("anon requests are not allowlisted (middleware 307s them to /login)", () => {
    expect(isPublicPath("/admin/tenants")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
  });
});
