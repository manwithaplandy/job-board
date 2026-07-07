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
vi.mock("@/lib/db", () => {
  const tx = (strings: TemplateStringsArray, ..._vals: unknown[]) => {
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
  };
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});

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

describe("cover-letter fields track the cover-letter write (CASE on cover_letter_json)", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  const allNull = {
    resume: null, coverLetter: null, answersSnapshot: null,
    greenhouseQuestions: null, prefilledAnswers: null, applyUrl: null,
  } as const;

  test("cover_letter_trace_id and cover_letter_instructions refresh only with a new letter", async () => {
    await upsertApplicationPackage("u", "j", { ...allNull });
    const sql = upsertSql();
    expect(sql).toContain(
      "cover_letter_trace_id = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL THEN EXCLUDED.cover_letter_trace_id ELSE application_packages.cover_letter_trace_id END",
    );
    expect(sql).toContain(
      "cover_letter_instructions = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL THEN EXCLUDED.cover_letter_instructions ELSE application_packages.cover_letter_instructions END",
    );
    expect(sql).toContain(
      "resume_instructions = CASE WHEN EXCLUDED.resume_json IS NOT NULL THEN EXCLUDED.resume_instructions ELSE application_packages.resume_instructions END",
    );
  });

  test("a new cover letter supersedes any current edit; a resume-only write does not", async () => {
    await upsertApplicationPackage("u", "j", {
      ...allNull,
      coverLetter: { greeting: "Dear", paragraphs: ["p"], closing: "Sincerely,", signature: "A" },
    });
    const supersede = captured.map(norm).find((s) => s.includes("UPDATE cover_letter_edits"));
    expect(supersede).toBeDefined();
    expect(supersede).toContain("SET superseded_at = now()");
    expect(supersede).toContain("superseded_at IS NULL");

    captured.length = 0;
    await upsertApplicationPackage("u", "j", { ...allNull });
    expect(captured.map(norm).find((s) => s.includes("UPDATE cover_letter_edits"))).toBeUndefined();
  });
});
