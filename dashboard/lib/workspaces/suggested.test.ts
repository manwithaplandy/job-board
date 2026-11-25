import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({
  calls: [] as { wrapper: string; text: string; values: unknown[] }[],
  rows: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({
  withUserMutation: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) =>
    fn({
      unsafe: (text: string, values: unknown[]) => {
        db.calls.push({ wrapper: "withUserMutation", text, values });
        return Promise.resolve(db.rows);
      },
    }),
  ),
}));

import { boardOpenPredicateSql } from "@/lib/jobsQuery";
import { fillSuggested, fillSuggestedSql } from "@/lib/workspaces/suggested";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  db.calls = [];
  db.rows = [];
});

test("never holds more than 10 suggested rows", async () => {
  db.rows = [{ job_id: "a:b:1" }, { job_id: "a:b:2" }];
  expect(await fillSuggested(USER, 25)).toBe(2);
  expect(db.calls).toHaveLength(1);
  expect(db.calls[0].wrapper).toBe("withUserMutation");
  // The cap is clamped to 10 and bound, never spliced; so is the user id.
  expect(db.calls[0].values).toEqual([USER, 10]);
  expect(db.calls[0].text).toContain("GREATEST(0, $2::bigint - count(*))");
  expect(await fillSuggested(USER, 0)).toBe(0);
  expect(db.calls).toHaveLength(1);
});

test("one statement: approved, scored, current-version, open reviews with no shortlist row, best fit first", () => {
  const text = fillSuggestedSql();
  expect(text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
  expect(text).toContain("COALESCE(rc.fit_score, r.fit_score) IS NOT NULL");
  expect(text).toContain("r.profile_version = p.profile_version");
  expect(text).toContain("r.error IS NULL");
  expect(text).toContain(boardOpenPredicateSql());
  expect(text).toContain("NOT EXISTS (SELECT 1 FROM shortlist_items s");
  expect(text).toContain("ORDER BY COALESCE(rc.fit_score, r.fit_score) DESC, r.job_id");
  expect(text).toContain("'suggested', 'system'");
  expect(text).toContain("ON CONFLICT (user_id, job_id) DO NOTHING");
  // No placeholder beyond the two bound values.
  expect(text.match(/\$\d+/g)?.every((p) => p === "$1" || p === "$2")).toBe(true);
});
