import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake of the three statements reviewScope runs, routed by SQL text; every statement
// is recorded with the user its withUserSql transaction ran as.
const db = vi.hoisted(() => ({
  shortlisted: [] as unknown[],
  newest: [] as unknown[],
  insert: (() => Promise.resolve([{ id: "7" }])) as () => Promise<unknown[]>,
  calls: [] as { user: string; text: string; values: unknown[] }[],
}));

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (user: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      db.calls.push({ user, text, values });
      // job_reviews first: the newest-reviewed query also names shortlist_items (NOT EXISTS).
      if (text.includes("FROM job_reviews r")) return Promise.resolve(db.newest);
      if (text.includes("FROM shortlist_items s")) return Promise.resolve(db.shortlisted);
      if (text.includes("INSERT INTO review_scope_requests")) return db.insert();
      return Promise.resolve([]);
    }),
  ),
}));

import {
  enqueueScopedReview, reviewScopeForMemoChange, SCOPE_MAX, SCOPE_NEWEST_CAP,
} from "@/lib/workspaces/reviewScope";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const job = (n: number | string) => `lever:acme:${n}`;
const rows = (ids: string[]) => ids.map((job_id) => ({ job_id }));

beforeEach(() => {
  db.shortlisted = [];
  db.newest = [];
  db.insert = () => Promise.resolve([{ id: "7" }]);
  db.calls = [];
});

describe("reviewScopeForMemoChange", () => {
  test("scope is shortlist minus skipped plus newest reviewed, capped at 200", async () => {
    db.shortlisted = rows([job(1), job(2)]);
    db.newest = rows([job(3), job(2), job(4)]);
    expect(await reviewScopeForMemoChange(USER)).toEqual([job(1), job(2), job(3), job(4)]);

    const [shortlist, newest] = db.calls;
    expect(shortlist.text).toContain("s.state <> 'skipped'");
    expect(shortlist.values).toEqual([USER, SCOPE_MAX]);
    expect(newest.text).toContain("ORDER BY j.first_seen_at DESC");
    expect(newest.text).toContain("r.verdict IS DISTINCT FROM 'deny'");
    expect(newest.text).toContain("NOT EXISTS");
    expect(newest.values).toEqual([USER, SCOPE_NEWEST_CAP]);
    expect(SCOPE_NEWEST_CAP).toBe(50);
    for (const c of db.calls) expect(c.user).toBe(USER);

    // A full shortlist leaves no room: the result never exceeds 200 ids.
    db.shortlisted = rows(Array.from({ length: 200 }, (_, i) => job(`s${i}`)));
    db.newest = rows(Array.from({ length: 50 }, (_, i) => job(`n${i}`)));
    const capped = await reviewScopeForMemoChange(USER);
    expect(capped).toHaveLength(SCOPE_MAX);
    expect(capped.at(-1)).toBe(job("s199"));
  });

  test("rows that fail the parse are dropped, not cast", async () => {
    db.shortlisted = [{ job_id: job(1) }, { job_id: null }, { job_id: "not a job id" }, "junk", null];
    db.newest = [{ job_id: 42 }, { job_id: job(2) }];
    expect(await reviewScopeForMemoChange(USER)).toEqual([job(1), job(2)]);
  });

  test("no shortlist and no reviews is an empty scope", async () => {
    expect(await reviewScopeForMemoChange(USER)).toEqual([]);
  });
});

describe("enqueueScopedReview", () => {
  test("an empty scope enqueues nothing", async () => {
    expect(await enqueueScopedReview(USER, [])).toBe("empty");
    expect(await enqueueScopedReview(USER, ["", "bad id"])).toBe("empty");
    expect(db.calls).toEqual([]);
  });

  test("queues one request as the user, with distinct ids cut to 200", async () => {
    const many = Array.from({ length: 205 }, (_, i) => job(i));
    expect(await enqueueScopedReview(USER, [job(0), ...many])).toBe("queued");
    expect(db.calls).toHaveLength(1);
    const [insert] = db.calls;
    expect(insert.user).toBe(USER);
    expect(insert.text).toContain("INSERT INTO review_scope_requests (user_id, job_ids, reason)");
    expect(insert.values[0]).toBe(USER);
    expect(insert.values[1]).toEqual(many.slice(0, SCOPE_MAX));
  });

  test("a unique violation is already_active; any other error is thrown", async () => {
    db.insert = () => Promise.reject(Object.assign(new Error("duplicate key"), { code: "23505" }));
    expect(await enqueueScopedReview(USER, [job(1)])).toBe("already_active");
    db.insert = () => Promise.reject(Object.assign(new Error("permission denied"), { code: "42501" }));
    await expect(enqueueScopedReview(USER, [job(1)])).rejects.toThrow("permission denied");
  });

  test("an insert whose returned row fails the parse is still queued, and logged as such", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const returned of [[{ id: null }], []]) {
        db.insert = () => Promise.resolve(returned);
        expect(await enqueueScopedReview(USER, [job(1)])).toBe("queued");
      }
      expect(logged).toHaveBeenCalledTimes(2);
      for (const [message] of logged.mock.calls) {
        expect(message).toBe("reviewScope: the scoped re-review was queued, but its returned row did not parse");
        expect(String(message)).not.toMatch(/could not enqueue/);
      }
    } finally {
      logged.mockRestore();
    }
  });
});
