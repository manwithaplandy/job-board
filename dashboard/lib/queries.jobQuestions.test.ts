import { describe, expect, test, vi } from "vitest";

// getJobQuestion runs a tagged-template query on the tx; stub withUserSql to hand the
// callback a tx() that returns our fake rows regardless of the SQL. (Mirrors
// queries.applicationPackages.test.ts, which stubs @/lib/db so module load succeeds.)
const rowsRef: { rows: unknown[] } = { rows: [] };
vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
  withAnonSql: (fn: (t: unknown) => unknown) => fn(() => Promise.resolve(rowsRef.rows)),
}));

import { getJobQuestion } from "@/lib/queries";

// Canonical STORED shape (what the poller writes): a select field's option list lives
// under `options`, not the raw-API `values`. Including a non-empty option list here
// exercises the read path WITH options end-to-end — a parser that dropped stored options
// would return `options: []` and fail the toEqual assertions below.
const GH = {
  questions: [
    {
      label: "Are you authorized to work in the US?",
      required: true,
      fields: [
        {
          name: "question_0",
          type: "multi_value_single_select",
          options: [
            { value: "0", label: "Yes" },
            { value: "1", label: "No" },
          ],
        },
      ],
    },
  ],
};

describe("getJobQuestion", () => {
  test("parses a stored questions jsonb row", async () => {
    rowsRef.rows = [{ job_id: "greenhouse:acme:1", questions: GH }];
    expect(await getJobQuestion("u", "greenhouse:acme:1")).toEqual(GH);
  });

  test("returns null when no row", async () => {
    rowsRef.rows = [];
    expect(await getJobQuestion("u", "missing")).toBeNull();
  });

  test("returns null (not a throw) when the stored questions jsonb is malformed", async () => {
    rowsRef.rows = [{ job_id: "greenhouse:acme:2", questions: "garbage" }];
    expect(await getJobQuestion("u", "greenhouse:acme:2")).toBeNull();
  });
});
