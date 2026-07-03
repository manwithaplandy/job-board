import { beforeEach, describe, expect, test, vi } from "vitest";

// The fix lives in the ON CONFLICT clause of upsertApplicationPackage: a NULL from a
// single-artifact route must preserve the stored value, not overwrite it. The dashboard
// mocks the DB in every test (no real-Postgres harness), so this guards the emitted SQL
// SHAPE — enough to fail loudly if the clause is ever reverted to `col = EXCLUDED.col`.
// The runtime PRESERVE behavior is verified against real Postgres separately (a
// non-destructive TEMP TABLE simulation; see the résumé-replacement follow-up notes).
//
// `sql` is used as a tagged template, so the mock receives the static string fragments;
// the ON CONFLICT block has no interpolations, so it survives intact in one fragment.
// The mock returns a plausible row so toApplicationPackage (called on the result) is happy.
// vi.hoisted: the mock factory is hoisted above module init, so `captured` must be too.
const { captured } = vi.hoisted(() => ({ captured: [] as string[] }));
vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray, ..._vals: unknown[]) => {
    captured.push(strings.join(" ? "));
    return Promise.resolve([
      {
        job_id: "ashby:vetcove:6b80fa7d",
        status: "prepared",
        resume_json: null,
        cover_letter_json: null,
        answers_snapshot: null,
        greenhouse_questions: null,
        prefilled_answers: null,
        apply_url: null,
        profile_version: null,
        prepared_at: new Date("2026-07-02T20:40:54.000Z"),
        applied_at: null,
      },
    ]);
  },
}));

import { upsertApplicationPackage } from "@/lib/queries";

const norm = (s: string): string => s.replace(/\s+/g, " ");

const upsertSql = (): string => {
  const stmt = captured.find((s) => s.includes("INSERT INTO application_packages"));
  if (!stmt) throw new Error("upsert INSERT not captured");
  return norm(stmt);
};

describe("upsertApplicationPackage ON CONFLICT preserves stored artifacts on NULL", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  const allNull = {
    resume: null,
    coverLetter: null,
    answersSnapshot: null,
    greenhouseQuestions: null,
    prefilledAnswers: null,
    applyUrl: null,
  } as const;

  test("content columns COALESCE an incoming NULL to the stored value", async () => {
    await upsertApplicationPackage("u", "j", { ...allNull });
    const sql = upsertSql();
    for (const col of [
      "resume_json",
      "cover_letter_json",
      "answers_snapshot",
      "greenhouse_questions",
      "prefilled_answers",
      "apply_url",
    ]) {
      expect(sql).toContain(`${col} = COALESCE(EXCLUDED.${col}, application_packages.${col})`);
    }
  });

  test("no content column is a bare `= EXCLUDED.*` overwrite (the clobber bug)", async () => {
    await upsertApplicationPackage("u", "j", { ...allNull });
    const sql = upsertSql();
    for (const col of [
      "resume_json",
      "cover_letter_json",
      "answers_snapshot",
      "greenhouse_questions",
      "prefilled_answers",
      "apply_url",
    ]) {
      expect(sql).not.toContain(`${col} = EXCLUDED.${col},`);
    }
  });

  test("profile_version and resume_trace_id track the résumé write (CASE on resume_json)", async () => {
    await upsertApplicationPackage("u", "j", { ...allNull });
    const sql = upsertSql();
    expect(sql).toContain(
      "profile_version = CASE WHEN EXCLUDED.resume_json IS NOT NULL THEN EXCLUDED.profile_version ELSE application_packages.profile_version END",
    );
    expect(sql).toContain(
      "resume_trace_id = CASE WHEN EXCLUDED.resume_json IS NOT NULL THEN EXCLUDED.resume_trace_id ELSE application_packages.resume_trace_id END",
    );
  });
});
