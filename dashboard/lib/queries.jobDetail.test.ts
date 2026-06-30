import { describe, expect, test, vi, beforeEach } from "vitest";

// Capture every tagged-template call made through the db `sql` helper, and let
// each test stage the row the query resolves to.
const { calls, rows } = vi.hoisted(() => ({
  calls: [] as { strings: readonly string[]; values: unknown[] }[],
  rows: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({
  sql: (strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    return Promise.resolve(rows);
  },
}));

import { getJobReviewDetail } from "@/lib/queries";

beforeEach(() => {
  calls.length = 0;
  rows.length = 0;
});

describe("getJobReviewDetail", () => {
  test("joins jobs and selects the full JD + apply url alongside review fields", async () => {
    rows.push({ reasoning: null, about: null, red_flags: null, benefits: null, requirements: null, description: null, url: null });
    await getJobReviewDetail("greenhouse:acme:123");
    expect(calls).toHaveLength(1);
    const text = calls[0].strings.join("?");
    // Full JD + apply link come from the jobs table, joined onto the review row.
    expect(text).toMatch(/JOIN\s+jobs\s+j\b/i);
    expect(text).toMatch(/j\.description/);
    expect(text).toMatch(/j\.url/);
  });
});
