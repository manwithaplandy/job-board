import { beforeEach, describe, expect, test, vi } from "vitest";

// Read-path guard: the package reads LEFT JOIN the viewer's CURRENT (non-superseded)
// cover_letter_edits row, and toApplicationPackage maps the new columns. SQL-shape
// assertions (the dashboard mocks the DB); runtime behavior of the join predicate is
// covered by the RLS suite's real-Postgres seeds.
const { captured } = vi.hoisted(() => ({ captured: [] as string[] }));
vi.mock("@/lib/db", () => {
  const tx = (strings: TemplateStringsArray, ..._vals: unknown[]) => {
    captured.push(strings.join(" ? "));
    return Promise.resolve([
      {
        job_id: "ashby:vetcove:6b80fa7d", status: "prepared",
        resume_json: null, cover_letter_json: null, answers_snapshot: null,
        greenhouse_questions: null, prefilled_answers: null, apply_url: null,
        profile_version: null, resume_instructions: "R focus",
        cover_letter_instructions: "C focus",
        cover_letter_edited_text: "Dear Hiring Manager,\n\nEdited.\n",
        prepared_at: new Date("2026-07-07T00:00:00.000Z"), applied_at: null,
      },
    ]);
  };
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});

import { getApplicationPackage, getApplicationPackages, toApplicationPackage } from "@/lib/queries";

const norm = (s: string): string => s.replace(/\s+/g, " ");

beforeEach(() => { captured.length = 0; });

describe("package reads join the current cover-letter edit", () => {
  test("getApplicationPackage: LEFT JOIN with superseded_at IS NULL + new columns; row maps through", async () => {
    const pkg = await getApplicationPackage("u", "j");
    const sql = norm(captured[0]);
    expect(sql).toContain("LEFT JOIN cover_letter_edits");
    expect(sql).toContain("superseded_at IS NULL");
    expect(sql).toContain("resume_instructions");
    expect(sql).toContain("cover_letter_instructions");
    expect(pkg?.coverLetterEditedText).toBe("Dear Hiring Manager,\n\nEdited.\n");
    expect(pkg?.resumeInstructions).toBe("R focus");
    expect(pkg?.coverLetterInstructions).toBe("C focus");
  });

  test("getApplicationPackages carries the same join", async () => {
    await getApplicationPackages("u");
    const sql = norm(captured[0]);
    expect(sql).toContain("LEFT JOIN cover_letter_edits");
    expect(sql).toContain("superseded_at IS NULL");
  });
});

describe("toApplicationPackage", () => {
  test("missing edit/instruction columns (upsert RETURNING path) map to null", () => {
    const pkg = toApplicationPackage({
      job_id: "j", status: "prepared", resume_json: null, cover_letter_json: null,
      answers_snapshot: null, greenhouse_questions: null, prefilled_answers: null,
      apply_url: null, profile_version: null, prepared_at: new Date(), applied_at: null,
    });
    expect(pkg.coverLetterEditedText).toBeNull();
    expect(pkg.resumeInstructions).toBeNull();
    expect(pkg.coverLetterInstructions).toBeNull();
  });
});
