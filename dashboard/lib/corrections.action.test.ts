import { describe, it, expect, vi, beforeEach } from "vitest";

const admin = vi.hoisted(() => ({ isAdmin: true }));
const upsertDatasetItem = vi.hoisted(() => vi.fn(async () => {}));

const calls: { strings: readonly string[]; values: unknown[] }[] = [];
const rows = [{ title: "Eng", company_name: "Acme", location: null, ats: "greenhouse",
               description: "jd text", resume_text: "my resume", instructions: null,
               model_snapshot: {} }];

vi.mock("@/lib/db", () => {
  // The recording tx: the first call (SELECT inputs) resolves to `rows`; the INSERT's
  // result is ignored by the action, so returning `rows` again is harmless. `.json`
  // is used to bind jsonb columns.
  const tx = Object.assign(
    (strings: readonly string[], ...values: unknown[]) => {
      calls.push({ strings, values });
      return Promise.resolve(rows);
    },
    { json: (v: unknown) => v },
  );
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});
vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "user-uuid",
  getUserClaims: async () => ({ id: "user-uuid", email: "a@x.com" }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => admin.isAdmin }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
vi.mock("@/lib/langfuseDataset", () => ({ upsertDatasetItem }));

import { saveReviewCorrection } from "@/app/actions/corrections";

beforeEach(() => {
  calls.length = 0;
  upsertDatasetItem.mockClear();
  admin.isAdmin = true;
});

const baseForm = {
  verdict: "approve" as const, experienceMatch: "match", industry: "software_internet",
  industrySubcategory: null, confidence: "high", roleCategory: "Backend",
  seniority: "senior", workArrangement: "remote",
  skillsScore: 80, experienceScore: 70, compScore: 60,
  reasoning: "fits", about: null, payMin: null, payMax: null,
  payCurrency: null, payPeriod: null, headcount: null,
  redFlags: [], skillGaps: [], benefits: [], requirements: [], note: null,
};

describe("saveReviewCorrection snapshots", () => {
  it("includes description_snapshot, resume_text_snapshot, instructions_snapshot in the upsert", async () => {
    await saveReviewCorrection("greenhouse:acme:1", baseForm);
    const insertCall = calls.find((c) => c.strings.join("").includes("review_corrections"));
    expect(insertCall).toBeDefined();
    const text = insertCall!.strings.join("?");
    expect(text).toContain("description_snapshot");
    expect(text).toContain("resume_text_snapshot");
    expect(text).toContain("instructions_snapshot");
  });

  it("uses SQL now() not new Date() for corrected_at", async () => {
    await saveReviewCorrection("greenhouse:acme:1", baseForm);
    const insertCall = calls.find((c) => c.strings.join("").includes("review_corrections"));
    const text = insertCall!.strings.join("?");
    expect(text).toContain("now()");
    const hasDateInValues = insertCall!.values.some(
      (v) => typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v),
    );
    expect(hasDateInValues).toBe(false);
  });
});

describe("saveReviewCorrection golden-dataset gate (minor 8)", () => {
  it("an admin pushes the correction to the shared reviewer-golden dataset", async () => {
    admin.isAdmin = true;
    const res = await saveReviewCorrection("greenhouse:acme:1", baseForm);
    expect(upsertDatasetItem).toHaveBeenCalledOnce();
    expect(res).toEqual({ ok: true, langfuseSynced: true });
  });

  it("a NON-admin persists the correction but never pushes to the shared dataset", async () => {
    admin.isAdmin = false;
    const res = await saveReviewCorrection("greenhouse:acme:1", baseForm);
    // The DB overlay row still wrote (its correction applies to their own board)…
    expect(calls.some((c) => c.strings.join("").includes("review_corrections"))).toBe(true);
    // …but nothing reached the shared golden dataset, and there is nothing to reconcile.
    expect(upsertDatasetItem).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, langfuseSynced: true });
  });
});
