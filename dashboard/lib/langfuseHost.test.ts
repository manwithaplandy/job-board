import { describe, it, expect } from "vitest";
import { resolveLangfuseHost, DEFAULT_LANGFUSE_HOST } from "./langfuseHost.ts";

describe("resolveLangfuseHost", () => {
  // The production bug: Vercel stored LANGFUSE_HOST as "" (empty string). An
  // empty string is not undefined, so `?? default` never fired and "" reached
  // the SDK as the base URL — every request died with `fetch failed`
  // (statusCode undefined). Empty/blank must resolve to the default, not "".
  it("returns the default for an empty string", () => {
    expect(resolveLangfuseHost("")).toBe(DEFAULT_LANGFUSE_HOST);
  });

  it("returns the default for a whitespace-only value", () => {
    expect(resolveLangfuseHost("   ")).toBe(DEFAULT_LANGFUSE_HOST);
  });

  it("returns the default when unset (undefined)", () => {
    expect(resolveLangfuseHost(undefined)).toBe(DEFAULT_LANGFUSE_HOST);
  });

  it("passes a real host through", () => {
    expect(resolveLangfuseHost("https://us.cloud.langfuse.com")).toBe(
      "https://us.cloud.langfuse.com",
    );
  });

  it("trims surrounding whitespace off a real host", () => {
    expect(resolveLangfuseHost("  https://eu.langfuse.example  ")).toBe(
      "https://eu.langfuse.example",
    );
  });

  it("defaults to the US cloud region (where this project's data lives)", () => {
    expect(DEFAULT_LANGFUSE_HOST).toBe("https://us.cloud.langfuse.com");
  });
});
