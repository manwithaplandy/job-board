// The agent page's surface host reader (plan Task 1.20, review item M6): the total parse
// with its fallbacks, chain grouping by supersedes, and the row reads keyed by the payload.
import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({
  queue: [] as unknown[][],
  calls: [] as { text: string; values: unknown[] }[],
}));
const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
  db.calls.push({ text: strings.join("?"), values });
  return Promise.resolve(db.queue.shift() ?? []);
};
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
}));
vi.mock("@/lib/catalogClock", () => ({ catalogNow: vi.fn(async () => ({ now: new Date("2026-11-20T00:00:00Z"), frozen: true })) }));
vi.mock("@/lib/workspaces/memo", () => ({ getMemo: vi.fn() }));

import { emptyGathered } from "@/lib/agent/gathered";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { gatheredFixture, JOB_A } from "@/lib/agent/surfaces/v1/testFixtures";
import type { StoredSurface } from "@/lib/agent/surfaces/store";
import { groupChains, loadBlockRows, parseStoredSurface } from "@/lib/agent/surfaces/host";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "22222222-2222-4222-8222-222222222222";
const GOOD = { variant: 1, blocks: [{ type: "Callout", tone: "info", text: "Two jobs match." }] };
const STORED_FALLBACK = { variant: 1, blocks: [{ type: "Callout", tone: "warning", text: "Stored fallback." }] };

function stored(id: string, extra: Partial<StoredSurface> = {}): StoredSurface {
  return {
    id,
    threadId: THREAD,
    runId: null,
    variant: 1,
    payload: GOOD,
    fallbackPayload: null,
    gathered: gatheredFixture() as unknown as Record<string, unknown>,
    outcome: "valid",
    failure: null,
    supersedes: null,
    rerenderOf: null,
    model: null,
    latencyMs: null,
    createdAt: "2026-11-25T10:00:00.000Z",
    ...extra,
  };
}

beforeEach(() => {
  db.queue = [];
  db.calls = [];
});

test("a stored payload that parses renders as is", () => {
  const out = parseStoredSurface(stored("s1"));
  expect(out.degraded).toBe(false);
  expect(out.payload).toEqual(GOOD);
});

test("a payload that does not parse falls back to the stored fallback, else one built from gathered", () => {
  const bad = { variant: 1, blocks: [{ type: "Script", src: "x" }] };
  const withStored = parseStoredSurface(stored("s1", { payload: bad, fallbackPayload: STORED_FALLBACK }));
  expect(withStored).toMatchObject({ degraded: true, payload: STORED_FALLBACK });
  const built = parseStoredSurface(stored("s1", { payload: bad, fallbackPayload: { nope: true } }));
  expect(built.degraded).toBe(true);
  expect(built.payload).toEqual(fallbackSurface(gatheredFixture()));
});

test("gathered data that does not parse renders the empty fallback, never the stored payload", () => {
  const out = parseStoredSurface(stored("s1", { gathered: { jobs: "not a list" } }));
  expect(out.degraded).toBe(true);
  expect(out.gathered).toEqual(emptyGathered());
  expect(out.payload).toEqual(fallbackSurface(emptyGathered()));
});

test("updates join their chain, the chain shows its latest row, and chains sort by that row", () => {
  const rows = [
    stored("a", { createdAt: "2026-11-25T10:00:00.000Z" }),
    stored("b", { createdAt: "2026-11-25T10:01:00.000Z" }),
    stored("a2", { supersedes: "a", createdAt: "2026-11-25T10:02:00.000Z" }),
    stored("x", { supersedes: "missing", createdAt: "2026-11-25T10:03:00.000Z" }),
    stored("a2", { createdAt: "2026-11-25T10:04:00.000Z" }),
  ];
  const chains = groupChains(rows);
  expect(chains.map((c) => [c.chainId, c.memberIds, c.latest.id])).toEqual([
    ["b", ["b"], "b"],
    ["a", ["a", "a2"], "a2"],
    ["x", ["x"], "x"],
  ]);
});

test("rows are read only for the ids the payload names", async () => {
  expect(await loadBlockRows(USER, GOOD as never)).toEqual({});
  expect(db.calls).toHaveLength(0);

  const prep = { variant: 1, blocks: [{ type: "PrepChecklist", jobId: JOB_A }, { type: "StaleList", rows: [] }] };
  db.queue = [[], []];
  const rows = await loadBlockRows(USER, prep as never);
  expect(rows.now).toBe("2026-11-20T00:00:00.000Z");
  expect(rows.packages).toEqual({});
  const pkgQuery = db.calls.find((c) => c.text.includes("application_packages"));
  expect(pkgQuery?.values).toContainEqual([JOB_A]);
  expect(pkgQuery?.values).toContain(USER);
});
