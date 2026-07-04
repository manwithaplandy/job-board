import { describe, expect, test } from "vitest";
import { isDisposableEmail } from "@/lib/emailGuard";

describe("isDisposableEmail", () => {
  test("flags a known disposable domain", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("hello@guerrillamail.com")).toBe(true);
  });

  test("flags a subdomain of a disposable domain", () => {
    expect(isDisposableEmail("x@a.mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@inbox.deep.mailinator.com")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isDisposableEmail("X@MailInator.COM")).toBe(true);
  });

  test("allows real / custom-company domains", () => {
    expect(isDisposableEmail("jane@gmail.com")).toBe(false);
    expect(isDisposableEmail("jane@outlook.com")).toBe(false);
    expect(isDisposableEmail("jane@acme-corp.io")).toBe(false);
    // A domain that merely CONTAINS a listed one as a non-suffix substring is safe.
    expect(isDisposableEmail("jane@notmailinator.com")).toBe(false);
    expect(isDisposableEmail("jane@mailinator.com.evil.example")).toBe(false);
  });

  test("does not match the bare TLD", () => {
    expect(isDisposableEmail("jane@something.com")).toBe(false);
  });

  test("malformed emails return false (left to existing validation)", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
    expect(isDisposableEmail("@mailinator.com")).toBe(false);
    expect(isDisposableEmail("x@")).toBe(false);
    expect(isDisposableEmail("x@ ")).toBe(false);
    expect(isDisposableEmail("x@a..b")).toBe(false);
    // @ts-expect-error runtime guard for non-string input
    expect(isDisposableEmail(null)).toBe(false);
  });
});
