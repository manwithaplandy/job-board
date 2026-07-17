import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the db module BEFORE importing appSettings — loadAppSettings/save* touch
// withAnonSql/serviceSql; overlay tests are pure and never reach them.
vi.mock("@/lib/db", () => ({
  withAnonSql: vi.fn(),
  serviceSql: Object.assign(() => Promise.resolve([]), { begin: vi.fn() }),
}));
// unstable_cache wraps at import; revalidateTag fires after a write — both stubbed so
// the atomic-save test never needs a Next request context.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

import { serviceSql } from "@/lib/db";
import { defaultAppSettings, overlayAppSettings, saveInviteSettings } from "@/lib/appSettings";

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

describe("saveInviteSettings (atomic two-key upsert)", () => {
  beforeEach(() => vi.clearAllMocks());

  test("runs BOTH upserts inside one serviceSql.begin transaction", async () => {
    const sql: string[] = [];
    const tx = (strings: TemplateStringsArray) => {
      sql.push(strings.join("?"));
      return Promise.resolve([]);
    };
    (serviceSql.begin as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
    );

    await saveInviteSettings("pro", 7);

    expect(serviceSql.begin).toHaveBeenCalledTimes(1);
    expect(sql).toHaveLength(2);
    expect(sql[0]).toContain("invite_comp_plan");
    expect(sql[1]).toContain("invite_default_allowance");
  });
});
