import { describe, expect, test, vi } from "vitest";

// getJobQuestions runs a tagged-template query on the tx; stub withUserSql to hand the
// callback a tx() that returns our fake rows regardless of the SQL. (Mirrors
// queries.applicationPackages.test.ts, which stubs @/lib/db so module load succeeds.)
const rowsRef: { rows: unknown[] } = { rows: [] };
vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
  withAnonSql: (fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
}));

import { getJobQuestion, getJobQuestions } from "@/lib/queries";

const GH = { questions: [{ label: "Why us?", required: true, fields: [] }] };

describe("getJobQuestion / getJobQuestions", () => {
  test("parses a stored questions jsonb row", async () => {
    rowsRef.rows = [{ job_id: "greenhouse:acme:1", questions: GH }];
    expect(await getJobQuestion("u", "greenhouse:acme:1")).toEqual(GH);
  });

  test("returns null when no row", async () => {
    rowsRef.rows = [];
    expect(await getJobQuestion("u", "missing")).toBeNull();
  });

  test("getJobQuestions keys parsed rows by job_id and skips malformed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rowsRef.rows = [
      { job_id: "greenhouse:acme:1", questions: GH },
      { job_id: "greenhouse:acme:2", questions: "garbage" },
    ];
    const map = await getJobQuestions("u", ["greenhouse:acme:1", "greenhouse:acme:2"]);
    expect(map["greenhouse:acme:1"]).toEqual(GH);
    expect(map["greenhouse:acme:2"]).toBeUndefined(); // malformed dropped
    warn.mockRestore();
  });

  test("getJobQuestions returns {} for an empty id list without querying", async () => {
    rowsRef.rows = [{ job_id: "x", questions: GH }];
    expect(await getJobQuestions("u", [])).toEqual({});
  });
});
