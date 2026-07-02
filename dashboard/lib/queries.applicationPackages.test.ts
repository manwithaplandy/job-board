import { describe, expect, test, vi } from "vitest";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

// queries.ts imports `sql` from @/lib/db, whose module load throws without DATABASE_URL.
// toApplicationPackage never touches sql, but queries.ts also calls sql`...` as a tagged
// template at module scope (BARE_MARKER_PREDICATE), so the stub must be callable — matches
// the sql mock pattern used in queries.jobDetail.test.ts / queries.boardFilters.test.ts.
vi.mock("@/lib/db", () => ({ sql: () => Promise.resolve([]) }));

import { toApplicationPackage } from "@/lib/queries";

const validResume: TailoredResume = {
  name: "Andrew Malvani",
  contact: "a@b.com",
  headline: "AI/ML Engineer",
  summary: "Summary.",
  skills: ["Python"],
  experience: [{ role: "Engineer", company: "Acme", dates: "2020–2024", bullets: ["Did X"] }],
  education: ["BS CS"],
  certifications: [],
};

const baseRow = (over: Record<string, unknown>): Record<string, unknown> => ({
  job_id: "ashby:vetcove:6b80fa7d",
  status: "prepared",
  resume_json: null,
  cover_letter_json: null,
  answers_snapshot: null,
  greenhouse_questions: null,
  prefilled_answers: null,
  apply_url: null,
  prepared_at: new Date("2026-07-02T20:40:54.000Z"),
  applied_at: null,
  ...over,
});

describe("toApplicationPackage", () => {
  test("valid resume_json object → parsed résumé", () => {
    const pkg = toApplicationPackage(baseRow({ resume_json: validResume }));
    expect(pkg.resume).toEqual(validResume);
  });

  test("double-encoded resume_json string (the vetcove bug) → repaired, not a crash", () => {
    const pkg = toApplicationPackage(baseRow({ resume_json: JSON.stringify(validResume) }));
    expect(pkg.resume).toEqual(validResume);
  });

  test("garbage resume_json → null (degrades to 'not generated') + warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pkg = toApplicationPackage(baseRow({ resume_json: "not a resume" }));
    expect(pkg.resume).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("resume_json"));
    warn.mockRestore();
  });

  test("null jsonb columns stay null without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pkg = toApplicationPackage(baseRow({}));
    expect(pkg.resume).toBeNull();
    expect(pkg.coverLetter).toBeNull();
    expect(pkg.prefilledAnswers).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("preserves scalar fields", () => {
    const pkg = toApplicationPackage(baseRow({ status: "applied", apply_url: "https://x", applied_at: new Date("2026-07-02T21:00:00.000Z") }));
    expect(pkg.jobId).toBe("ashby:vetcove:6b80fa7d");
    expect(pkg.status).toBe("applied");
    expect(pkg.applyUrl).toBe("https://x");
    expect(pkg.appliedAt).toBe("2026-07-02T21:00:00.000Z");
  });
});
