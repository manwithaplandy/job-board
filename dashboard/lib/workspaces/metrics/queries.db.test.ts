// The ten catalog metrics against real Postgres and RLS (Task 1.12), on one seeded
// fixture with exact expected numbers. Runs only under `npm run test:db`.
//
// Every fixture timestamp is T0 (the database's now() read once) minus a whole number of
// days, kept away from the 7, 30 and 90 day window edges and the 10 day stale edge, so
// the later now() each query reads cannot move a row across a boundary.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

const clock = vi.hoisted(() => ({ value: null as { now: Date; frozen: boolean } | null }));
vi.mock("@/lib/catalogClock", () => ({
  catalogNow: vi.fn(async () => clock.value ?? { now: new Date(), frozen: false }),
}));

import { openTestDb, seedJob, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { runMetric } from "@/lib/workspaces/metrics/queries";
import type { MetricResult, MetricSpec } from "@/lib/workspaces/types";

const DAY = 86_400_000;
const job = (n: number) => `lever:fixture-co:metric-${n}`;
const app = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

let db: TestDb;
let T0: Date;
const ago = (days: number) => new Date(T0.getTime() - days * DAY);

beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

async function addApp(user: string, n: number, stage: string, createdDaysAgo: number,
  events: Array<[stage: string, daysAgo: number]>, closedReason: string | null = null) {
  const lastEvent = Math.min(createdDaysAgo, ...events.map(([, d]) => d));
  await db.sql`INSERT INTO applications (id, user_id, job_id, stage, closed_reason, created_at, updated_at)
               VALUES (${app(n)}, ${user}, ${job(n)}, ${stage}, ${closedReason}, ${ago(createdDaysAgo)}, ${ago(lastEvent)})`;
  for (const [to, d] of events) {
    await db.sql`INSERT INTO application_events (user_id, application_id, kind, to_stage, actor, created_at)
                 VALUES (${user}, ${app(n)}, 'stage', ${to}, 'user', ${ago(d)})`;
  }
}

async function addShortlist(user: string, n: number, state: string, setBy: string, daysAgo: number,
  reason: string | null = null) {
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, reason_code, set_by, created_at, updated_at)
               VALUES (${user}, ${job(n)}, ${state}, ${reason}, ${setBy}, ${ago(daysAgo)}, ${ago(daysAgo)})`;
}

async function addMemoVersion(user: string, version: number, daysAgo: number) {
  await db.sql`INSERT INTO search_memo_versions (user_id, version, doc, changed_by, created_at)
               VALUES (${user}, ${version}, ${db.sql.json({})}, 'user', ${ago(daysAgo)})`;
}

beforeEach(async () => {
  clock.value = null;
  await db.sql`DELETE FROM application_events`;
  await db.sql`DELETE FROM applications`;
  await db.sql`DELETE FROM shortlist_items`;
  await db.sql`DELETE FROM search_memo_versions`;
  await db.sql`DELETE FROM review_corrections`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM jobs WHERE id LIKE 'lever:fixture-co:metric-%'`;
  T0 = (await db.sql`SELECT now() AS now`)[0].now as Date;
  for (let n = 1; n <= 12; n++) await seedJob(db.sql, job(n));

  // USER_A's tracker.
  await addApp(USER_A, 1, "applied", 40, [["applied", 40]]);
  await addApp(USER_A, 2, "interviewing", 20, [["applied", 20], ["interviewing", 11]]);
  await addApp(USER_A, 3, "closed", 5, [["applied", 5], ["closed", 2]], "rejected");
  await addApp(USER_A, 4, "preparing", 3, [["preparing", 3]]);
  await addApp(USER_A, 5, "offer", 60, [["applied", 60], ["interviewing", 50], ["offer", 31]]);
  await db.sql`INSERT INTO application_events (user_id, application_id, kind, note, actor, created_at)
               VALUES (${USER_A}, ${app(5)}, 'note', 'Call went well', 'user', ${ago(1)})`;
  // The agent's note is not the user's action: weekly_activity never counts it.
  await db.sql`INSERT INTO application_events (user_id, application_id, kind, note, actor, created_at)
               VALUES (${USER_A}, ${app(2)}, 'note', 'Agent summary', 'agent', ${ago(2)})`;

  // USER_A's shortlist.
  await addShortlist(USER_A, 1, "shortlisted", "user", 45);
  await addShortlist(USER_A, 2, "shortlisted", "user", 25);
  await addShortlist(USER_A, 6, "skipped", "user", 4, "pay");
  await addShortlist(USER_A, 7, "skipped", "user", 6, "location");
  await addShortlist(USER_A, 8, "skipped", "agent", 50, "pay");
  await addShortlist(USER_A, 9, "suggested", "system", 1);

  // Fit: job 2's correction (50) wins over its review (70).
  await seedReview(db.sql, USER_A, job(1), { fit_score: 80 });
  await seedReview(db.sql, USER_A, job(2), { fit_score: 70 });
  await seedReview(db.sql, USER_A, job(3), { fit_score: 60 });
  await seedReview(db.sql, USER_A, job(5), { fit_score: 90 });
  await db.sql`INSERT INTO review_corrections (user_id, job_id, fit_score) VALUES (${USER_A}, ${job(2)}, 50)`;

  // Version 0 (the old instructions kept at the first save) is not a memo change.
  await addMemoVersion(USER_A, 0, 2);
  await addMemoVersion(USER_A, 1, 40);
  await addMemoVersion(USER_A, 2, 3);
  await addMemoVersion(USER_A, 3, 1);

  // USER_B's rows, which no USER_A figure may count.
  await addApp(USER_B, 11, "applied", 1, [["applied", 1]]);
  await addShortlist(USER_B, 1, "skipped", "user", 1, "pay");
  await seedReview(db.sql, USER_B, job(1), { fit_score: 10 });
  await addMemoVersion(USER_B, 1, 1);
});

/** Monday (UTC) of the week holding `d`, as YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

/** The expected weekly series: every Monday from `fromDaysAgo` to now, counting `eventDaysAgo`. */
function weeks(fromDaysAgo: number, eventDaysAgo: number[]) {
  const counts = new Map<string, number>();
  for (const d of eventDaysAgo) counts.set(mondayOf(ago(d)), (counts.get(mondayOf(ago(d))) ?? 0) + 1);
  const points: Array<{ x: string; y: number }> = [];
  const end = mondayOf(new Date());
  for (let x = mondayOf(ago(fromDaysAgo)); x <= end; x = new Date(Date.parse(x) + 7 * DAY).toISOString().slice(0, 10)) {
    points.push({ x, y: counts.get(x) ?? 0 });
  }
  return points;
}

const STAGE_ROWS = (c: Record<string, number>) =>
  ["preparing", "ready", "applied", "interviewing", "offer", "closed"].map((s) => [s, c[s] ?? 0]);

type Case = [name: string, spec: MetricSpec, expected: () => Omit<MetricResult, "spec">];

const CASES: Case[] = [
  ["applications_by_stage, all", { metric: "applications_by_stage", groupBy: "stage", window: "all" }, () => ({
    kind: "rows", columns: ["stage", "count"],
    rows: STAGE_ROWS({ preparing: 1, applied: 1, interviewing: 1, offer: 1, closed: 1 }), n: 5,
  })],
  ["applications_by_stage, 30d", { metric: "applications_by_stage", window: "30d" }, () => ({
    kind: "rows", columns: ["stage", "count"], rows: STAGE_ROWS({ preparing: 1, interviewing: 1, closed: 1 }), n: 3,
  })],
  ["applications_by_stage, stage filter",
    { metric: "applications_by_stage", window: "30d", filter: { stage: ["applied", "interviewing"] } }, () => ({
      kind: "rows", columns: ["stage", "count"], rows: [["applied", 0], ["interviewing", 1]], n: 1,
    })],
  ["applications_over_time, all", { metric: "applications_over_time", groupBy: "week", window: "all" }, () => ({
    kind: "series", points: weeks(60, [60, 40, 20, 5]), n: 4,
  })],
  ["applications_over_time, 30d", { metric: "applications_over_time", window: "30d" }, () => ({
    kind: "series", points: weeks(30, [20, 5]), n: 2,
  })],
  // Four applied applications: below the minimum sample.
  ["response_rate, all", { metric: "response_rate", window: "all" }, () => ({ kind: "value", value: null, n: 4 })],
  ["time_in_stage, all", { metric: "time_in_stage", groupBy: "stage", window: "all" }, () => ({
    kind: "rows", columns: ["stage", "median_days", "moves"], rows: [["applied", 9, 3], ["interviewing", 19, 1]], n: 4,
  })],
  ["time_in_stage, 30d", { metric: "time_in_stage", window: "30d" }, () => ({
    kind: "rows", columns: ["stage", "median_days", "moves"], rows: [["applied", 6, 2]], n: 2,
  })],
  ["shortlist_funnel, all", { metric: "shortlist_funnel", window: "all" }, () => ({
    kind: "rows", columns: ["step", "count"],
    rows: [["in_shortlist", 6], ["kept", 2], ["applied", 2], ["interviewing", 1], ["offer", 0]], n: 6,
  })],
  ["shortlist_funnel, 30d", { metric: "shortlist_funnel", window: "30d" }, () => ({
    kind: "rows", columns: ["step", "count"],
    rows: [["in_shortlist", 4], ["kept", 1], ["applied", 1], ["interviewing", 1], ["offer", 0]], n: 4,
  })],
  ["skip_reasons, all", { metric: "skip_reasons", groupBy: "reason", window: "all" }, () => ({
    kind: "rows", columns: ["reason", "count"], rows: [["pay", 2], ["location", 1]], n: 3,
  })],
  ["skip_reasons, 7d", { metric: "skip_reasons", window: "7d" }, () => ({
    kind: "rows", columns: ["reason", "count"], rows: [["location", 1], ["pay", 1]], n: 2,
  })],
  ["fit_shortlisted_vs_applied, all", { metric: "fit_shortlisted_vs_applied", window: "all" }, () => ({
    kind: "rows", columns: ["group", "avg_fit", "jobs"], rows: [["shortlisted", 65, 2], ["applied", 70, 4]], n: 6,
  })],
  ["fit_shortlisted_vs_applied, 30d", { metric: "fit_shortlisted_vs_applied", window: "30d" }, () => ({
    kind: "rows", columns: ["group", "avg_fit", "jobs"], rows: [["shortlisted", 50, 1], ["applied", 55, 2]], n: 3,
  })],
  ["weekly_activity, 7d", { metric: "weekly_activity", groupBy: "week", window: "7d" }, () => ({
    // User events 5, 3, 2, 1 (note) days ago; user shortlist rows 4 and 6 days ago. Not the
    // agent's note 2 days ago, nor the agent and system shortlist rows.
    kind: "series", points: weeks(7, [5, 3, 2, 1, 4, 6]), n: 6,
  })],
  ["weekly_activity, all", { metric: "weekly_activity", window: "all" }, () => ({
    // Every user event and user shortlist row; the agent's note is left out.
    kind: "series", points: weeks(60, [40, 20, 11, 5, 2, 3, 60, 50, 31, 1, 45, 25, 4, 6]), n: 14,
  })],
  ["stale_applications", { metric: "stale_applications", window: "all" }, () => ({ kind: "value", value: 1, n: 1 })],
  ["memo_changes, all", { metric: "memo_changes", window: "all" }, () => ({ kind: "value", value: 3, n: 3 })],
  ["memo_changes, 7d", { metric: "memo_changes", window: "7d" }, () => ({ kind: "value", value: 2, n: 2 })],
];

test("each of the ten metrics returns the expected result for the seeded fixture", async () => {
  expect(new Set(CASES.map(([, s]) => s.metric)).size).toBe(10);
  const [{ tz }] = await db.sql`SELECT current_setting('TimeZone') AS tz`;
  expect(["UTC", "Etc/UTC"]).toContain(tz);
  for (const [name, spec, expected] of CASES) {
    expect({ name, result: await runMetric(USER_A, spec) }).toEqual({ name, result: { spec, ...expected() } });
  }
});

test("response_rate with 4 applications returns value null and n 4", async () => {
  expect(await runMetric(USER_A, { metric: "response_rate", window: "all" })).toMatchObject({ value: null, n: 4 });
  // Two more applied with no answer: 3 of 6 responded (interview, offer, rejection).
  await addApp(USER_A, 10, "applied", 12, [["applied", 12]]);
  await addApp(USER_A, 12, "applied", 15, [["applied", 15]]);
  expect(await runMetric(USER_A, { metric: "response_rate", window: "all" })).toMatchObject({ value: 0.5, n: 6 });
});

test("metrics only see the caller's rows", async () => {
  expect(await runMetric(USER_B, { metric: "applications_by_stage", window: "all" })).toMatchObject({
    rows: STAGE_ROWS({ applied: 1 }), n: 1,
  });
  expect(await runMetric(USER_B, { metric: "skip_reasons", window: "all" })).toMatchObject({ rows: [["pay", 1]], n: 1 });
  expect(await runMetric(USER_B, { metric: "memo_changes", window: "all" })).toMatchObject({ value: 1, n: 1 });
  expect(await runMetric(USER_B, { metric: "fit_shortlisted_vs_applied", window: "all" })).toMatchObject({
    rows: [], n: 0,
  });
  expect(await runMetric(USER_B, { metric: "stale_applications", window: "all" })).toMatchObject({ value: 0, n: 1 });
});

test("stale_applications uses the catalog clock, not the wall clock", async () => {
  // By the wall clock application 1 (last event 40 days ago) is stale.
  expect(await runMetric(USER_A, { metric: "stale_applications", window: "all" })).toMatchObject({ value: 1, n: 1 });
  // Catalog frozen 35 days ago: its last event is 5 days old by that clock.
  clock.value = { now: ago(35), frozen: true };
  expect(await runMetric(USER_A, { metric: "stale_applications", window: "all" })).toMatchObject({ value: 0, n: 1 });
  // Frozen 25 days ago, the same event is 15 days old: stale again.
  clock.value = { now: ago(25), frozen: true };
  expect(await runMetric(USER_A, { metric: "stale_applications", window: "all" })).toMatchObject({ value: 1, n: 1 });
});
