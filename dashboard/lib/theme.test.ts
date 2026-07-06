import { describe, expect, test } from "vitest";
import { resolveTheme, parseThemeChoice, THEME_STORAGE_KEY } from "./theme";

describe("resolveTheme", () => {
  test("explicit choices pass through regardless of OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  test("system follows the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("parseThemeChoice", () => {
  test("accepts the three valid choices", () => {
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
  });
  test("defaults to system for junk/null/undefined/objects", () => {
    for (const bad of [null, undefined, "", "DARK", "auto", 3, {}]) {
      expect(parseThemeChoice(bad)).toBe("system");
    }
  });
  test("exposes the storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("rolefit-theme");
  });
});
