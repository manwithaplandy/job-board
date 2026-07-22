import { beforeEach, describe, expect, test, vi } from "vitest";

// Minimal withUserSql stand-in: the template-tag executor answers from a queue;
// tx.unsafe records the built delta query (text + params) and answers from the same
// queue. Mirrors lib/reviewRequests.test.ts.
const state = vi.hoisted(() => ({
  calls: [] as { text: string; values: unknown[] }[],
  unsafeCalls: [] as { text: string; params: unknown[] }[],
  rowQueue: [] as unknown[][],
}));

function tx(strings: readonly string[], ...values: unknown[]) {
  state.calls.push({ text: strings.join(" "), values });
  return Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);
}
tx.unsafe = (text: string, params: unknown[]) => {
  state.unsafeCalls.push({ text, params });
  return Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);
};

vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
  withAnonSql: (fn: (t: unknown) => unknown) => fn(tx),
}));

import { getReviewFeed } from "@/lib/queries";

beforeEach(() => {
  state.calls.length = 0;
  state.unsafeCalls.length = 0;
  state.rowQueue.length = 0;
});

const CURSOR_DATE = new Date("2026-07-16T12:00:00.000Z");

describe("getReviewFeed", () => {
  test("since=null only establishes the cursor — no delta query runs", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);
    const feed = await getReviewFeed("u1", null);
    expect(feed).toEqual({ cursor: "2026-07-16T12:00:00.000Z", newMatches: [] });
    expect(state.unsafeCalls).toHaveLength(0);
  });

  test("with since: runs the approve-verdict delta scoped to the viewer's locations", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);                 // SELECT now()
    state.rowQueue.push([{ preferred_locations: ["Phoenix, AZ"] }]); // profile locations
    state.rowQueue.push([
      {
        id: "greenhouse:acme:1", title: "Staff Engineer", location: "Phoenix, AZ",
        remote: true, first_seen_at: new Date("2026-07-01T00:00:00.000Z"),
        closed_at: null, company_name: "Acme", ats: "greenhouse",
        verdict: "approve", human_override: false, corrected: false,
        role_category: "engineering", seniority: "staff", work_arrangement: "remote",
        pay_min: 150000, pay_max: 200000, pay_currency: "USD", pay_period: "year",
        headcount: null, skills_score: 8, experience_score: 8, comp_score: 8,
        fit_score: 88, skill_gaps: [],
      },
    ]);
    const feed = await getReviewFeed("u1", "2026-07-16T11:59:00.000Z");
    expect(feed.cursor).toBe("2026-07-16T12:00:00.000Z");
    expect(feed.newMatches).toHaveLength(1);
    // toJobRow normalized the timestamp; the row is board-shaped.
    expect(feed.newMatches[0]).toMatchObject({
      id: "greenhouse:acme:1",
      first_seen_at: "2026-07-01T00:00:00.000Z",
      fit_score: 88,
    });
    // The delta query carries the cursor predicate, approve verdict, and locations.
    expect(state.unsafeCalls).toHaveLength(1);
    const { text, params } = state.unsafeCalls[0];
    expect(text).toContain("::timestamptz - interval '10 seconds'");
    expect(text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
    // ...and the per-user company-exclusion / override gate (companyFiltersFromProfile),
    // so a company the viewer excluded mid-run never streams onto the board. Mirrors
    // getJobs / getRejectedJobs; the authoritative board query applies the same gate.
    expect(text).toContain("LEFT JOIN company_overrides co");
    expect(text).toContain("co.verdict = 'include'");
    expect(text).toContain("jsonb_array_elements_text(p.company_exclusions->'industries')");
    expect(text).toContain(
      "jsonb_array_elements_text(p.company_exclusions->'redFlagCategories')",
    );
    expect(params).toEqual(["u1", "2026-07-16T11:59:00.000Z", ["Phoenix, AZ"]]);
  });

  test("profile-less viewer (no locations row) still queries with empty locations", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);
    state.rowQueue.push([]); // no profiles row
    state.rowQueue.push([]);
    const feed = await getReviewFeed("u1", "2026-07-16T11:59:00.000Z");
    expect(feed.newMatches).toEqual([]);
    expect(state.unsafeCalls[0].params).toEqual(["u1", "2026-07-16T11:59:00.000Z"]);
  });
});
