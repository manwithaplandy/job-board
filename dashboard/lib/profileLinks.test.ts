import { describe, expect, test } from "vitest";
import { parseProfileLinks } from "@/lib/profileLinks";

describe("parseProfileLinks", () => {
  const obj = { linkedin: "https://linkedin.com/in/x", github: "https://github.com/x", portfolio: "https://x.com" };

  test("passes a clean object through, keeping only known keys", () => {
    expect(parseProfileLinks({ ...obj, junk: "drop me" })).toEqual(obj);
  });

  test("unwraps a single-encoded JSON string", () => {
    expect(parseProfileLinks(JSON.stringify(obj))).toEqual(obj);
  });

  test("unwraps a triple-encoded JSON string (the prod corruption)", () => {
    let v: string = JSON.stringify(obj);
    v = JSON.stringify(v);
    v = JSON.stringify(v);
    expect(parseProfileLinks(v)).toEqual(obj);
  });

  test("coerces missing/blank fields and null input to an empty object", () => {
    expect(parseProfileLinks(null)).toEqual({});
    expect(parseProfileLinks(undefined)).toEqual({});
    expect(parseProfileLinks("not json")).toEqual({});
    expect(parseProfileLinks({ linkedin: "  ", github: 42 })).toEqual({});
  });
});
