import { describe, expect, test, vi } from "vitest";

// Mock the db module BEFORE importing appSettings — loadAppSettings/saveAppSetting
// touch withAnonSql/serviceSql; overlay tests are pure and never reach them.
vi.mock("@/lib/db", () => ({
  withAnonSql: vi.fn(),
  serviceSql: Object.assign(() => Promise.resolve([]), { begin: vi.fn() }),
}));

import { defaultAppSettings, overlayAppSettings } from "@/lib/appSettings";

describe("overlayAppSettings (total parser — dashboard/CLAUDE.md jsonb discipline)", () => {
  test("empty rows → compiled defaults (standard / 3)", () => {
    expect(overlayAppSettings([])).toEqual({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 });
  });
  test("valid rows override both keys", () => {
    const s = overlayAppSettings([
      { key: "invite_comp_plan", value: "pro" },
      { key: "invite_default_allowance", value: 10 },
    ]);
    expect(s).toEqual({ inviteCompPlan: "pro", inviteDefaultAllowance: 10 });
  });
  test("'none' is a valid comp plan (comping off)", () => {
    expect(overlayAppSettings([{ key: "invite_comp_plan", value: "none" }]).inviteCompPlan).toBe("none");
  });
  test("a DOUBLE-ENCODED jsonb string scalar is unwrapped one level", () => {
    // postgres.js returns a double-encoded write as the JS string '"pro"'.
    expect(overlayAppSettings([{ key: "invite_comp_plan", value: '"pro"' }]).inviteCompPlan).toBe("pro");
  });
  test("garbage values keep the default field-by-field", () => {
    const s = overlayAppSettings([
      { key: "invite_comp_plan", value: "platinum" },
      { key: "invite_default_allowance", value: -2 },
    ]);
    expect(s).toEqual(defaultAppSettings());
  });
  test("allowance rejects floats/strings/negatives, accepts 0 (invites off)", () => {
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 2.5 }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: "5" }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 0 }]).inviteDefaultAllowance).toBe(0);
  });
});
