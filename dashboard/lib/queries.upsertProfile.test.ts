import { beforeEach, describe, expect, test, vi } from "vitest";

// upsertProfile is the DEFINITIVE profile write boundary — every writer (onboarding,
// /profile save, résumé save) funnels through it. It must refuse to write for a
// tombstoned user so a stale JWT can't resurrect erased PII (M-RESURRECT-2).
const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(async (_userId: string, _fn: (tx: unknown) => unknown) => undefined),
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

const data = {
  resumeText: "r", instructions: "i", resumeFilePath: null,
  modelStage1: null, modelStage2: null, preferredLocations: [], modelResume: null,
  companyInstructions: null, modelCompany: null,
  fullName: null, email: null, phone: null, links: {}, location: null,
  workAuthorized: null, needsSponsorship: null,
  eeoGender: null, eeoRace: null, eeoVeteran: null, eeoDisability: null,
  screeningAnswers: {}, modelCover: null,
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

  test("refuses to write for a tombstoned user — no DB write at all", async () => {
    mocks.isAccountDeleted.mockResolvedValue(true);
    await upsertProfile("u1", data);
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });
});
