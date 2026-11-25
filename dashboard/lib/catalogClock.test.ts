import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The clock's one read is stubbed: each test sets the row lifecycle_control + jobs
// would return. unstable_cache is a pass-through so every call re-reads.
const read = vi.hoisted(() => ({ row: undefined as unknown, fail: false }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_id: string, fn: (tx: unknown) => Promise<unknown>) => {
    if (read.fail) throw new Error("db down");
    return fn(() => Promise.resolve(read.row === undefined ? [] : [read.row]));
  }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { withUserSql } from "@/lib/db";
import { ageDays, catalogNow, isNew } from "@/lib/catalogClock";

const WALL = new Date("2026-11-25T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WALL);
  read.fail = false;
  read.row = undefined;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("catalogNow", () => {
  test("frozen catalog measures age from the newest last_seen_at", async () => {
    read.row = { source_enabled: false, newest: new Date("2026-11-20T09:00:00Z") };
    const clock = await catalogNow();
    expect(clock).toEqual({ now: new Date("2026-11-20T09:00:00Z"), frozen: true });
    const firstSeen = "2026-11-19T09:00:00Z"; // one day before the newest last_seen_at
    expect(ageDays(firstSeen, clock)).toBe(1);
    expect(isNew(firstSeen, clock)).toBe(true);
    // By the wall clock the same job is six days old and not new.
    expect(ageDays(firstSeen, { now: WALL })).toBe(6);
    expect(isNew(firstSeen, { now: WALL })).toBe(false);
  });

  test("a live catalog uses the wall clock", async () => {
    read.row = { source_enabled: true, newest: null };
    expect(await catalogNow()).toEqual({ now: WALL, frozen: false });
    // The wall clock is read per call, not cached with the database read.
    vi.setSystemTime(new Date("2026-11-25T12:30:00Z"));
    expect((await catalogNow()).now).toEqual(new Date("2026-11-25T12:30:00Z"));
  });

  test("a frozen catalog with no jobs stays frozen on the wall clock", async () => {
    read.row = { source_enabled: false, newest: null };
    expect(await catalogNow()).toEqual({ now: WALL, frozen: true });
  });

  test("a failed or malformed read falls back to the wall clock", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    read.fail = true;
    expect(await catalogNow()).toEqual({ now: WALL, frozen: false });
    read.fail = false;
    read.row = { source_enabled: "no", newest: "yesterday" };
    expect(await catalogNow()).toEqual({ now: WALL, frozen: false });
  });

  test("a failed read queries the database once, not twice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(withUserSql).mockClear();
    read.fail = true;
    await catalogNow();
    expect(withUserSql).toHaveBeenCalledTimes(1);
  });
});

describe("ageDays and isNew", () => {
  const clock = { now: new Date("2026-11-20T00:00:00Z") };
  test("whole days, rounded down; new means under two days old", () => {
    expect(ageDays("2026-11-20T00:00:00Z", clock)).toBe(0);
    expect(ageDays("2026-11-18T00:00:01Z", clock)).toBe(1);
    expect(isNew("2026-11-18T00:00:01Z", clock)).toBe(true);
    expect(ageDays("2026-11-18T00:00:00Z", clock)).toBe(2);
    expect(isNew("2026-11-18T00:00:00Z", clock)).toBe(false);
  });
  test("a first-seen time after the clock is age 0 and new; an unparseable one is never new", () => {
    expect(ageDays("2026-11-21T00:00:00Z", clock)).toBe(0);
    expect(isNew("2026-11-21T00:00:00Z", clock)).toBe(true);
    expect(isNew("not a date", clock)).toBe(false);
  });
  test("an unparseable first-seen time is age 0, never NaN", () => {
    expect(ageDays("not a date", clock)).toBe(0);
    expect(ageDays("", clock)).toBe(0);
  });
});
