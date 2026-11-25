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

import { serviceSql, withAnonSql } from "@/lib/db";
import { headroom } from "@/lib/agent/budget";
import {
  defaultAppSettings,
  loadAppSettings,
  overlayAppSettings,
  saveAgentSettings,
  saveInviteSettings,
} from "@/lib/appSettings";

describe("overlayAppSettings (total parser — dashboard/CLAUDE.md jsonb discipline)", () => {
  test("empty rows → compiled defaults (standard / 3)", () => {
    expect(overlayAppSettings([])).toEqual(defaultAppSettings());
    expect(overlayAppSettings([])).toMatchObject({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 });
  });
  test("valid rows override both keys", () => {
    const s = overlayAppSettings([
      { key: "invite_comp_plan", value: "pro" },
      { key: "invite_default_allowance", value: 10 },
    ]);
    expect(s).toEqual({ ...defaultAppSettings(), inviteCompPlan: "pro", inviteDefaultAllowance: 10 });
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
  test("agent keys overlay defaults; a present but malformed ceiling reads as 0 (fail closed)", () => {
    const s = overlayAppSettings([
      { key: "agent_enabled", value: false },
      { key: "agent_daily_ceiling_micros", value: "lots" },
    ]);
    expect(s.agentEnabled).toBe(false);
    expect(s.agentDailyCeilingMicros).toBe(0);
    // An absent ceiling row keeps its placeholder default.
    expect(s.agentMonthlyCeilingMicros).toBe(10_000_000);
  });
  test("a present malformed daily ceiling leaves no headroom", () => {
    const s = overlayAppSettings([{ key: "agent_daily_ceiling_micros", value: '"250000"' }]);
    expect(headroom({ dayMicros: 0, monthMicros: 0 }, s)).toEqual({ ok: false, reason: "daily_ceiling" });
  });
  test("agent defaults: on, background off, variant 3 on, placeholder ceilings", () => {
    const s = overlayAppSettings([]);
    expect(s.agentEnabled).toBe(true);
    expect(s.agentBackgroundEnabled).toBe(false);
    expect(s.agentVariant3Enabled).toBe(true);
    expect(s.agentDailyCeilingMicros).toBe(1_000_000);
    expect(s.agentMonthlyCeilingMicros).toBe(10_000_000);
  });
  test("agent toggles accept only booleans (a double-encoded 'true' unwraps, 1 does not)", () => {
    expect(overlayAppSettings([{ key: "agent_background_enabled", value: true }]).agentBackgroundEnabled).toBe(true);
    expect(overlayAppSettings([{ key: "agent_background_enabled", value: "true" }]).agentBackgroundEnabled).toBe(true);
    expect(overlayAppSettings([{ key: "agent_variant3_enabled", value: 0 }]).agentVariant3Enabled).toBe(true);
  });
  test("a malformed kill switch or background switch reads as OFF (fail closed)", () => {
    for (const value of ["no", "off", 0, 1, "yes", null, "", "{garbage"]) {
      expect(overlayAppSettings([{ key: "agent_enabled", value }]).agentEnabled, String(value)).toBe(false);
      expect(
        overlayAppSettings([
          { key: "agent_background_enabled", value: true },
          { key: "agent_background_enabled", value },
        ]).agentBackgroundEnabled,
        String(value),
      ).toBe(false);
    }
  });
  test("a ceiling must be a non-negative integer no larger than 1e9", () => {
    const daily = (value: unknown) =>
      overlayAppSettings([{ key: "agent_daily_ceiling_micros", value }]).agentDailyCeilingMicros;
    const monthly = (value: unknown) =>
      overlayAppSettings([{ key: "agent_monthly_ceiling_micros", value }]).agentMonthlyCeilingMicros;
    expect(daily(0)).toBe(0);
    expect(daily(1_000_000_000)).toBe(1_000_000_000);
    // Present but malformed reads as 0, never as the placeholder default.
    expect(daily(1_000_000_001)).toBe(0);
    expect(daily(-1)).toBe(0);
    expect(daily(2.5)).toBe(0);
    expect(daily("500")).toBe(0);
    expect(daily(null)).toBe(0);
    expect(monthly(25_000_000)).toBe(25_000_000);
    expect(monthly(Number.NaN)).toBe(0);
  });
  test("allowance rejects floats/strings/negatives, accepts 0 (invites off)", () => {
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 2.5 }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: "5" }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 0 }]).inviteDefaultAllowance).toBe(0);
  });
});

describe("loadAppSettings on a failed read (fail closed)", () => {
  beforeEach(() => vi.clearAllMocks());

  test("the agent and background switches read OFF, ceilings 0, invite settings default; one query", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (withAnonSql as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));
    const s = await loadAppSettings();
    expect(s.agentEnabled).toBe(false);
    expect(s.agentBackgroundEnabled).toBe(false);
    expect(s.agentDailyCeilingMicros).toBe(0);
    expect(s.agentMonthlyCeilingMicros).toBe(0);
    expect(s.inviteCompPlan).toBe(defaultAppSettings().inviteCompPlan);
    expect(s.inviteDefaultAllowance).toBe(defaultAppSettings().inviteDefaultAllowance);
    expect(withAnonSql).toHaveBeenCalledTimes(1);
  });

  test("the next load after a failure reads again and sees the stored values", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (withAnonSql as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce([{ key: "agent_enabled", value: true }]);
    expect((await loadAppSettings()).agentEnabled).toBe(false);
    expect((await loadAppSettings()).agentEnabled).toBe(true);
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

describe("saveAgentSettings (atomic five-key upsert)", () => {
  beforeEach(() => vi.clearAllMocks());

  test("writes all five keys in one transaction, and what it writes reads back unchanged", async () => {
    const rows: { key: string; value: unknown }[] = [];
    // The key and the JSON text are the two bound values of each upsert.
    const tx = (_strings: TemplateStringsArray, key: unknown, json: unknown) => {
      rows.push({ key: String(key), value: JSON.parse(String(json)) });
      return Promise.resolve([]);
    };
    (serviceSql.begin as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
    );
    const input = {
      agentEnabled: false,
      agentBackgroundEnabled: true,
      agentVariant3Enabled: false,
      agentDailyCeilingMicros: 250_000,
      agentMonthlyCeilingMicros: 4_000_000,
    };

    await saveAgentSettings(input);

    expect(serviceSql.begin).toHaveBeenCalledTimes(1);
    expect(rows.map((r) => r.key).sort()).toEqual([
      "agent_background_enabled",
      "agent_daily_ceiling_micros",
      "agent_enabled",
      "agent_monthly_ceiling_micros",
      "agent_variant3_enabled",
    ]);
    expect(overlayAppSettings(rows)).toMatchObject(input);
  });
});
