import { describe, expect, test, vi, beforeEach } from "vitest";

// Capture every tagged-template call made through the withUserSql/withAnonSql
// executor `tx`, and let each test stage the row the query resolves to.
const { calls, rows } = vi.hoisted(() => ({
  calls: [] as { strings: readonly string[]; values: unknown[] }[],
  rows: [] as unknown[],
}));
vi.mock("@/lib/db", () => {
  const tx = (strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    return Promise.resolve(rows);
  };
  return {
    withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
    withAnonSql: (fn: (t: unknown) => unknown) => fn(tx),
  };
});

import { getJobReviewDetail } from "@/lib/queries";

beforeEach(() => {
  calls.length = 0;
  rows.length = 0;
});

describe("getJobReviewDetail", () => {
  test("drives FROM jobs and selects the full JD + apply url alongside review fields", async () => {
    rows.push({ reasoning: null, about: null, red_flags: null, benefits: null, requirements: null, description: null, url: null });
    await getJobReviewDetail("greenhouse:acme:123", "user-1");
    expect(calls).toHaveLength(1);
    const text = calls[0].strings.join("?");
    // The query is driven FROM jobs so the JD + apply link always return, even for a
    // pending or anonymous viewer; the review tables are LEFT JOINed on.
    expect(text).toMatch(/FROM\s+jobs\s+j\b/i);
    expect(text).toMatch(/LEFT JOIN\s+job_reviews\s+r\b/i);
    expect(text).toMatch(/j\.description/);
    expect(text).toMatch(/j\.url/);
  });

  test("binds the passed viewer userId (viewer-scoped, not a board-owner subquery)", async () => {
    rows.push({ reasoning: null, description: null, url: null });
    await getJobReviewDetail("greenhouse:acme:123", "viewer-42");
    const { strings, values } = calls[0];
    // The review + corrections joins each bind the viewer's id, and there is no
    // is_owner subquery in the SQL text.
    expect(values).toContain("viewer-42");
    expect(strings.join(" ")).not.toMatch(/is_owner/i);
  });

  test("anonymous viewer (null userId) still issues the job-only query", async () => {
    rows.push({ reasoning: null, description: "jd", url: "https://x" });
    await getJobReviewDetail("greenhouse:acme:123", null);
    const { values } = calls[0];
    expect(values).toContain(null);
  });
});
