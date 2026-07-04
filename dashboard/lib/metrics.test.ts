import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DiscoveryStateRow } from "@/lib/types";

// SaaS cutover: metrics runs inside ONE withUserSql(userId, tx) transaction; getFunnel /
// getPipelineHealth are now module-PRIVATE and the query helpers are tx-threaded
// (companyVerdictCountsWith / reviewStatsWith / discoveryStateWith). We test the PUBLIC
// surface (getPipelineSnapshot, getRunSeries), routing the tx tagged-template by
// DISTINCTIVE SQL fragments (not bare count(*), which the distributions queries also
// contain). dbLimit stays REAL so the fan-out wiring is exercised. The *With helpers are
// boundaries with sentinel numbers, so a crossed wire fails.
const route = vi.hoisted(() => ({ fn: (_text: string) => [] as unknown[] }));
const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(),
  companyVerdictCountsWith: vi.fn(),
  reviewStatsWith: vi.fn(),
  discoveryStateWith: vi.fn(),
}));

const fakeTx = (strings: readonly string[], ..._v: unknown[]) =>
  Promise.resolve(route.fn(strings.join(" ")));

vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));
vi.mock("@/lib/queries", () => ({
  companyVerdictCountsWith: mocks.companyVerdictCountsWith,
  reviewStatsWith: mocks.reviewStatsWith,
  discoveryStateWith: mocks.discoveryStateWith,
}));

import { getPipelineSnapshot, getRunSeries } from "@/lib/metrics";

const USER = "user-uuid";

// getPipelineSnapshot ALWAYS computes the funnel (which reads rows[0] of each aggregate),
// so every snapshot test must supply non-empty funnel agg rows even when it only asserts
// health/distributions. This returns zero-filled funnel rows for those four aggregates and
// null for everything else, letting each test layer its own routing on top.
function baseFunnel(t: string): unknown[] | null {
  if (t.includes("application_packages")) return [{ applied: 0 }];
  if (t.includes("AS tracked")) return [{ tracked: 0, active: 0, discovery_sourced: 0, reviewed: 0 }];
  if (t.includes("AS ever_seen")) return [{ ever_seen: 0, open: 0, closed: 0 }];
  if (t.includes("AS manual_rejected")) return [{ reviewed: 0, gate_rejected: 0, approved: 0, denied: 0, manual_rejected: 0 }];
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  route.fn = () => [];
  mocks.withUserSql.mockImplementation((_uid: string, fn: (tx: typeof fakeTx) => unknown) => fn(fakeTx));
  mocks.companyVerdictCountsWith.mockResolvedValue({ include: 0, exclude: 0, unknown: 0 });
  mocks.reviewStatsWith.mockResolvedValue({ unreviewed: 0, errors: 0 });
  mocks.discoveryStateWith.mockResolvedValue({ backlog: 0 } as unknown as DiscoveryStateRow);
});

describe("getPipelineSnapshot — pipeline health composition", () => {
  test("empty run tables → latest & lastSuccess are exactly null (not undefined); totals surface per-table sentinels", async () => {
    route.fn = (t) => {
      const b = baseFunnel(t);
      if (b) return b;
      if (t.includes("AS runs")) {
        if (t.includes("poll_runs")) return [{ runs: 1 }];
        if (t.includes("review_runs")) return [{ runs: 2 }];
        return [{ runs: 3 }];
      }
      // Every LIMIT-1 latest/lastSuccess query (and every distribution) is empty.
      return [];
    };
    const { health } = await getPipelineSnapshot(USER);
    for (const p of [health.jobDiscovery, health.reviewer, health.companyDiscovery]) {
      // A regression to `rows[0]` (undefined) instead of `rows[0] ?? null` crashed the
      // analytics JSX; pin the explicit null.
      expect(p.latest).toBeNull();
      expect(p.lastSuccess).toBeNull();
    }
    expect(health.jobDiscovery.totals).toEqual({ runs: 1 });
    expect(health.reviewer.totals).toEqual({ runs: 2 });
    expect(health.companyDiscovery.totals).toEqual({ runs: 3 });
  });

  test("rows present → latest vs lastSuccess kept distinct per pipeline", async () => {
    route.fn = (t) => {
      const b = baseFunnel(t);
      if (b) return b;
      if (t.includes("AS runs")) return [{ runs: 0 }];
      if (t.includes("ORDER BY started_at DESC LIMIT 1")) {
        const success = t.includes("finished_at");
        if (t.includes("poll_runs")) return [{ id: success ? "poll-success" : "poll-latest" }];
        if (t.includes("review_runs")) return [{ id: success ? "rev-success" : "rev-latest" }];
        return [{ id: success ? "disc-success" : "disc-latest" }];
      }
      return [];
    };
    const { health } = await getPipelineSnapshot(USER);
    expect(health.jobDiscovery.latest).toEqual({ id: "poll-latest" });
    expect(health.jobDiscovery.lastSuccess).toEqual({ id: "poll-success" });
    expect(health.reviewer.latest).toEqual({ id: "rev-latest" });
    expect(health.companyDiscovery.lastSuccess).toEqual({ id: "disc-success" });
  });
});

describe("getPipelineSnapshot — funnel merge", () => {
  test("each field is picked from the right source (crossed wire fails)", async () => {
    route.fn = (t) => {
      if (t.includes("application_packages")) return [{ applied: 11 }];
      if (t.includes("AS tracked")) return [{ tracked: 20, active: 12, discovery_sourced: 8, reviewed: 5 }];
      if (t.includes("AS ever_seen")) return [{ ever_seen: 100, open: 60, closed: 40 }];
      if (t.includes("AS manual_rejected")) return [{ reviewed: 30, gate_rejected: 4, approved: 9, denied: 6, manual_rejected: 2 }];
      if (t.includes("AS runs")) return [{ runs: 0 }];
      return [];
    };
    mocks.companyVerdictCountsWith.mockResolvedValue({ include: 111, exclude: 222, unknown: 333 });
    mocks.reviewStatsWith.mockResolvedValue({ unreviewed: 444, errors: 555 });
    mocks.discoveryStateWith.mockResolvedValue({ backlog: 777 } as unknown as DiscoveryStateRow);

    const { funnel } = await getPipelineSnapshot(USER);
    // company verdict fields come from companyVerdictCountsWith...
    expect(funnel.companies.include).toBe(111);
    expect(funnel.companies.exclude).toBe(222);
    expect(funnel.companies.unknown).toBe(333);
    // ...backlog from the shared discovery state...
    expect(funnel.companies.backlog).toBe(777);
    // ...structural counts from the company agg query...
    expect(funnel.companies.tracked).toBe(20);
    // ...jobs unreviewed/errors from reviewStatsWith...
    expect(funnel.jobs.unreviewed).toBe(444);
    expect(funnel.jobs.errors).toBe(555);
    // ...applied from its own query, and review verdicts from the review agg.
    expect(funnel.jobs.applied).toBe(11);
    expect(funnel.jobs.approved).toBe(9);
    expect(funnel.jobs.manual_rejected).toBe(2);
  });

  test("the tenant-scoped helpers receive the userId thread", async () => {
    route.fn = (t) => baseFunnel(t) ?? (t.includes("AS runs") ? [{ runs: 0 }] : []);
    await getPipelineSnapshot(USER);
    expect(mocks.companyVerdictCountsWith).toHaveBeenCalledWith(fakeTx, USER);
    expect(mocks.reviewStatsWith).toHaveBeenCalledWith(fakeTx, USER);
    expect(mocks.discoveryStateWith).toHaveBeenCalledWith(fakeTx, USER);
  });
});

describe("getPipelineSnapshot — single transaction + shared state", () => {
  test("runs inside ONE withUserSql transaction scoped to the userId; distributions present as arrays", async () => {
    route.fn = (t) => baseFunnel(t) ?? (t.includes("AS runs") ? [{ runs: 0 }] : []);
    const snap = await getPipelineSnapshot(USER);
    // One tenant-scoped transaction for the whole snapshot.
    expect(mocks.withUserSql).toHaveBeenCalledTimes(1);
    expect(mocks.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
    // Empty routing → asBars([]) for every distribution key.
    expect(Array.isArray(snap.distributions.jobsByLocation)).toBe(true);
    expect(snap.distributions.jobsByLocation).toEqual([]);
    expect(Array.isArray(snap.distributions.topRedFlags)).toBe(true);
    expect(snap.distributions.otherRedFlags).toEqual([]);
  });

  test("reads discovery state once and threads the SAME object into funnel + health", async () => {
    const sharedState = { backlog: 999 } as unknown as DiscoveryStateRow;
    mocks.discoveryStateWith.mockResolvedValue(sharedState);
    route.fn = (t) => baseFunnel(t) ?? (t.includes("AS runs") ? [{}] : []);

    const snap = await getPipelineSnapshot(USER);
    expect(mocks.discoveryStateWith).toHaveBeenCalledTimes(1);
    expect(snap.funnel.companies.backlog).toBe(999);
    // Identity: the funnel's backlog source and health's state are the very same object.
    expect(snap.health.companyDiscovery.state).toBe(sharedState);
  });
});

describe("getRunSeries", () => {
  test("routes the three daily series to their own pipeline tables", async () => {
    route.fn = (t) => {
      if (t.includes("new_jobs")) return [{ day: "2026-07-01", new_jobs: 7 }];
      if (t.includes("gate_rejected")) return [{ day: "2026-07-01", gate_rejected: 3 }];
      if (t.includes("last_backlog")) return [{ day: "2026-07-01", last_backlog: 5 }];
      return [];
    };
    const series = await getRunSeries(USER);
    expect(mocks.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
    expect(series.jobDiscovery).toEqual([{ day: "2026-07-01", new_jobs: 7 }]);
    expect(series.review).toEqual([{ day: "2026-07-01", gate_rejected: 3 }]);
    expect(series.companyDiscovery).toEqual([{ day: "2026-07-01", last_backlog: 5 }]);
  });
});
