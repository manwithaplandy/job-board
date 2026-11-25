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
import { everyNodePayload } from "@/lib/agent/surfaces/v2/testFixtures";

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

// Task 2.8: the renderer follows the row's recorded variant (R13) and the mount gate (R15).
const V3_HTML = '<div id="list"></div><script>host.onInit(function (data, theme) { void data; void theme; });</script>';
const V3_PAYLOAD = { variant: 3, title: "Picks", html: V3_HTML };
const ON = { variant3Enabled: true };
const OFF = { variant3Enabled: false };

test("an older surface still renders with its recorded variant", () => {
  // A variant 1 row in a thread switched to variant 2 later: blocks, as recorded.
  expect(parseStoredSurface(stored("s1"), ON).view).toEqual({ kind: "blocks" });
  // A variant 2 row renders its validated tree whatever the thread is set to now.
  const tree = parseStoredSurface(stored("s2", { variant: 2, payload: everyNodePayload() as unknown as Record<string, unknown>, fallbackPayload: STORED_FALLBACK }), OFF);
  expect(tree).toMatchObject({ view: { kind: "tree", tree: everyNodePayload() }, payload: STORED_FALLBACK, degraded: false });
});

test("a variant 2 row whose payload is not a valid tree today renders its variant 1 fallback (R13)", () => {
  // R13: a fallen-back row keeps variant 2 with the variant 1 fallback in payload and fallback_payload.
  const fallenBack = parseStoredSurface(stored("s1", { variant: 2, payload: STORED_FALLBACK, fallbackPayload: STORED_FALLBACK, outcome: "fallback" }));
  expect(fallenBack).toMatchObject({ view: { kind: "blocks" }, payload: STORED_FALLBACK });
  // A tree that binds a job the gathered data does not hold fails the full validator at read time.
  const unbound = { variant: 2, title: "x", root: { type: "Stack", gap: "3", children: [{ type: "JobRow", bind: "/jobs/nope" }] } };
  expect(parseStoredSurface(stored("s1", { variant: 2, payload: unbound, fallbackPayload: STORED_FALLBACK })).view).toEqual({ kind: "blocks" });
});

test("a variant 3 row mounts the sandbox only with the switch on and canMountSandbox passing (R15)", () => {
  const row = stored("s3", { variant: 3, payload: V3_PAYLOAD, fallbackPayload: STORED_FALLBACK });
  expect(parseStoredSurface(row, ON)).toMatchObject({ view: { kind: "sandbox", document: V3_PAYLOAD }, payload: STORED_FALLBACK, degraded: false });
  // Switched off: the stored fallback, never a frame. The default options are off too.
  expect(parseStoredSurface(row, OFF)).toMatchObject({ view: { kind: "blocks" }, payload: STORED_FALLBACK, degraded: false });
  expect(parseStoredSurface(row).view).toEqual({ kind: "blocks" });
});

test("a variant 3 row that failed, fell back, or no longer validates renders its fallback (R13, R15)", () => {
  const base = { variant: 3 as const, payload: V3_PAYLOAD, fallbackPayload: STORED_FALLBACK };
  for (const extra of [
    { failure: "no_handshake" },
    { outcome: "fallback" as const, payload: STORED_FALLBACK },
    { payload: { variant: 3, title: "Picks", html: "<script>fetch('x')</script>" } },
    { payload: { variant: 3, title: "Picks", html: '<a href="x">x</a>' } },
  ]) {
    const out = parseStoredSurface(stored("s3", { ...base, ...extra }), ON);
    expect(out.view, JSON.stringify(extra)).toEqual({ kind: "blocks" });
    expect(out.payload).toEqual(STORED_FALLBACK);
  }
});

test("a variant 3 row mounts only when its stored fallback parses as variant 1 (stricter than canMountSandbox)", () => {
  const out = parseStoredSurface(stored("s3", { variant: 3, payload: V3_PAYLOAD, fallbackPayload: { variant: 1, blocks: "x" } }), ON);
  expect(out.view).toEqual({ kind: "blocks" });
  expect(out.payload).toEqual(fallbackSurface(gatheredFixture()));
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
