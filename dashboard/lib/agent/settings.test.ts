// The user's default variant (agent_settings, plan Task 2.8). withUserSql is stubbed: the
// next query returns db.rows, and every query's text and values are kept.
import { beforeEach, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as { userId: string; text: string; values: unknown[] }[] }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (userId: string, fn: (tx: unknown) => unknown) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      db.calls.push({ userId, text: strings.join("?"), values });
      return Promise.resolve(db.rows);
    }),
  ),
}));

import { getDefaultVariant, setDefaultVariant } from "@/lib/agent/settings";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  db.rows = [];
  db.calls = [];
});

test("the stored default is read as the user (bigint arrives as a string)", async () => {
  db.rows = [{ default_variant: "2" }];
  expect(await getDefaultVariant(USER)).toBe(2);
  expect(db.calls[0]).toMatchObject({ userId: USER, values: [USER] });
  expect(db.calls[0].text).toContain("FROM agent_settings WHERE user_id");
});

test("no row, or a value outside 1 to 3, reads as variant 1", async () => {
  expect(await getDefaultVariant(USER)).toBe(1);
  db.rows = [{ default_variant: "7" }];
  expect(await getDefaultVariant(USER)).toBe(1);
  db.rows = [{ default_variant: null }];
  expect(await getDefaultVariant(USER)).toBe(1);
});

test("setting the default upserts the caller's own row", async () => {
  await setDefaultVariant(USER, 3);
  expect(db.calls[0]).toMatchObject({ userId: USER, values: [USER, 3] });
  expect(db.calls[0].text).toContain("ON CONFLICT (user_id) DO UPDATE SET default_variant = EXCLUDED.default_variant");
});

test("a variant outside 1 to 3 is refused before any query", async () => {
  await expect(setDefaultVariant(USER, 4 as never)).rejects.toThrow();
  expect(db.calls).toEqual([]);
});
