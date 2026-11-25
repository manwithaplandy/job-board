import { beforeEach, describe, expect, test, vi } from "vitest";

// upsertProfile is the legacy whole-profile write boundary used by onboarding and
// pre-route-split callers. It must refuse to write for a tombstoned user so a stale
// JWT can't resurrect erased PII (M-RESURRECT-2).
const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(async (_userId: string, _fn: (tx: unknown) => unknown): Promise<unknown> => undefined),
  isAccountDeleted: vi.fn(async (_userId: string) => false),
}));

// withUserSql is the RLS-scoped executor upsertProfile writes through. The mock just
// records whether the write was attempted (it never runs the SQL template).
vi.mock("@/lib/db", () => ({
  withUserSql: (userId: string, fn: (tx: unknown) => unknown) => mocks.withUserSql(userId, fn),
  withAnonSql: vi.fn(),
}));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: mocks.isAccountDeleted }));

const { upsertProfile } = await import("@/lib/queries");
const { profileVersion } = await import("@/lib/profileVersion");

const data = {
  resumeText: "r", instructions: "i", resumeFilePath: null,
  modelStage1: null, modelStage2: null, preferredLocations: [], modelResume: null,
  companyInstructions: null, modelCompany: null,
  fullName: null, email: null, phone: null, links: {}, location: null,
  workAuthorized: null, needsSponsorship: null,
  eeoGender: null, eeoRace: null, eeoVeteran: null, eeoDisability: null,
  screeningAnswers: {}, modelCover: null,
  reasoningEffortResume: null, reasoningEffortCover: null,
  resumeGenerationInstructions: null, coverLetterGenerationInstructions: null,
};

describe("upsertProfile tombstone guard (M-RESURRECT-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAccountDeleted.mockResolvedValue(false);
  });

  test("writes for a live (non-deleted) user", async () => {
    await upsertProfile("u1", data);
    expect(mocks.isAccountDeleted).toHaveBeenCalledWith("u1");
    expect(mocks.withUserSql).toHaveBeenCalledTimes(1);
  });

  test("keeps a stored profiles.instructions on conflict and hashes the kept value", async () => {
    // A fake tagged-template executor: records each statement, answers RETURNING with
    // the instructions the existing row already holds.
    const calls: { sql: string; values: unknown[] }[] = [];
    const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join("$"), values });
      return Promise.resolve(calls.length === 1 ? [{ instructions: "stored by the user" }] : []);
    };
    mocks.withUserSql.mockImplementationOnce(async (_u, fn) => fn(tx));
    await upsertProfile("u1", { ...data, resumeText: "r", instructions: "onboarding text" });

    const upsert = calls[0].sql.replace(/\s+/g, " ");
    // The insert still binds the onboarding text for a brand-new row …
    expect(calls[0].values).toContain("onboarding text");
    // … but the conflict branch keeps the stored value.
    expect(upsert).toContain("instructions = profiles.instructions");
    expect(upsert).not.toMatch(/ instructions = EXCLUDED\.instructions/);
    expect(upsert).toContain("RETURNING instructions");
    // profile_version is recomputed from the KEPT instructions.
    expect(calls).toHaveLength(2);
    expect(calls[1].sql).toContain("profile_version");
    expect(calls[1].values[0]).toBe(profileVersion("r", "stored by the user"));
  });

  test("a new row (or an unchanged value) needs no second write", async () => {
    const calls: string[] = [];
    const tx = (strings: TemplateStringsArray) => {
      calls.push(strings.join("$"));
      return Promise.resolve([{ instructions: "onboarding text" }]);
    };
    mocks.withUserSql.mockImplementationOnce(async (_u, fn) => fn(tx));
    await upsertProfile("u1", { ...data, instructions: "onboarding text" });
    expect(calls).toHaveLength(1);
  });

  test("refuses to write for a tombstoned user — no DB write at all", async () => {
    mocks.isAccountDeleted.mockResolvedValue(true);
    await upsertProfile("u1", data);
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });
});
