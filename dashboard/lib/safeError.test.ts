import { afterEach, describe, expect, test, vi } from "vitest";
import { GENERIC_MESSAGE, safeAuthMessage, safeErrorMessage } from "@/lib/safeError";

afterEach(() => vi.restoreAllMocks());

describe("safeErrorMessage", () => {
  test("logs the full error and returns a generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("connection to 10.0.0.5:5432 refused");
    const out = safeErrorMessage("test", err);
    expect(out).toBe(GENERIC_MESSAGE);
    expect(spy).toHaveBeenCalledWith("[test]", err);
  });

  test("honors a custom generic message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(safeErrorMessage("x", new Error("boom"), "Save failed.")).toBe("Save failed.");
  });
});

describe("safeAuthMessage", () => {
  test("an unknown internal error maps to generic and is logged", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = safeAuthMessage("signup", new Error("connection to 10.0.0.5 refused"));
    expect(out).toBe(GENERIC_MESSAGE);
    expect(spy).toHaveBeenCalled();
  });

  test("known-safe 'already registered' passes through without logging as error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = safeAuthMessage("signup", new Error("User already registered"));
    expect(out).toMatch(/already exists/i);
    expect(spy).not.toHaveBeenCalled();
  });

  test("weak-password message passes through", () => {
    const out = safeAuthMessage("signup", new Error("Password should be at least 6 characters"));
    expect(out).toMatch(/too weak/i);
  });

  test("invalid credentials passes through", () => {
    const out = safeAuthMessage("login", new Error("Invalid login credentials"));
    expect(out).toMatch(/incorrect email or password/i);
  });

  test("accepts a raw string as well as an Error", () => {
    expect(safeAuthMessage("login", "Email not confirmed")).toMatch(/confirm your email/i);
  });
});
