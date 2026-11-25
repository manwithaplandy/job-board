// The agent page's thread actions. withUserSql is stubbed (the next query returns
// db.rows); lib/agent/threads.ts is real, so an UPDATE that touches no row is refused.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => fn(() => Promise.resolve(m.rows))),
}));

import { renameThreadAction } from "@/app/actions/agent";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
});

test("renaming one of the caller's threads is ok and revalidates the page", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: true });
  expect(m.revalidatePath).toHaveBeenCalledWith("/agent");
});

test("an unknown thread is refused, not reported ok, and nothing is revalidated", async () => {
  m.rows = [];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("a malformed id or a blank title is refused", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction("not-a-uuid", "Remote ML roles")).toEqual({ ok: false });
  expect(await renameThreadAction(THREAD, "   ")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});
