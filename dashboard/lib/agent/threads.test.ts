import { beforeEach, describe, expect, test, vi } from "vitest";

// withUserSql is stubbed: each test sets the rows the next query returns, and every
// query's text and bound values are recorded.
const db = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: [] as { userId: string; text: string; values: unknown[] }[],
}));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (userId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      db.calls.push({ userId, text: strings.join("?"), values });
      return Promise.resolve(db.rows);
    }),
  ),
}));

import {
  createThread,
  getThread,
  listThreads,
  loadMessages,
  renameThread,
  setThreadVariant,
  titleFromFirstMessage,
} from "@/lib/agent/threads";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "11111111-1111-4111-8111-111111111111";
const created = new Date("2026-11-25T10:00:00Z");

const threadRow = (extra: Record<string, unknown> = {}) => ({
  id: THREAD,
  title: "Hello",
  variant: "2", // bigint arrives as a string
  summary: null,
  created_at: created,
  updated_at: created,
  ...extra,
});

beforeEach(() => {
  db.rows = [];
  db.calls = [];
  vi.restoreAllMocks();
});

describe("titleFromFirstMessage", () => {
  test("first user message of 200 chars gives a 60 char title", () => {
    expect(titleFromFirstMessage("a".repeat(200))).toHaveLength(60);
  });
  test("whitespace collapses, short text is kept, empty text gets the default title", () => {
    expect(titleFromFirstMessage("  Find   me\nremote\tjobs  ")).toBe("Find me remote jobs");
    expect(titleFromFirstMessage("   ")).toBe("New conversation");
  });
  test("an emoji is never split in half", () => {
    const t = titleFromFirstMessage(`${"a".repeat(59)}😀😀`);
    expect(Array.from(t)).toHaveLength(60);
    expect(t.endsWith("😀")).toBe(true);
  });
});

describe("threads", () => {
  test("createThread inserts for the caller and parses the bigint variant", async () => {
    db.rows = [threadRow()];
    expect(await createThread(USER, 2)).toEqual({
      id: THREAD,
      title: "Hello",
      variant: 2,
      summary: null,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
    expect(db.calls[0]?.userId).toBe(USER);
    expect(db.calls[0]?.values).toContain(USER);
  });

  test("listThreads is newest first, unarchived, at most 50, and skips a bad row", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.rows = [threadRow(), threadRow({ variant: "7" })];
    const out = await listThreads(USER);
    expect(out).toHaveLength(1);
    expect(db.calls[0]?.text).toMatch(/archived_at IS NULL/);
    expect(db.calls[0]?.text).toMatch(/ORDER BY updated_at DESC/);
    expect(db.calls[0]?.text).toMatch(/LIMIT 50/);
  });

  test("getThread returns null for a malformed id without a query, and for no row", async () => {
    expect(await getThread(USER, "not-a-uuid")).toBeNull();
    expect(db.calls).toHaveLength(0);
    expect(await getThread(USER, THREAD)).toBeNull();
  });

  test("renameThread trims and caps the title; an empty title is refused", async () => {
    await renameThread(USER, THREAD, `  ${"t".repeat(200)}  `);
    expect(db.calls[0]?.values).toContain("t".repeat(120));
    await expect(renameThread(USER, THREAD, "   ")).rejects.toThrow();
  });

  test("setThreadVariant refuses a variant outside 1 to 3", async () => {
    await expect(setThreadVariant(USER, THREAD, 4 as never)).rejects.toThrow();
    await setThreadVariant(USER, THREAD, 3);
    expect(db.calls[0]?.values).toEqual(expect.arrayContaining([3, THREAD, USER]));
  });
});

describe("loadMessages", () => {
  test("loadMessages skips a row whose parts is a double-encoded string of garbage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.rows = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }], status: "complete" },
      { id: "a1", role: "assistant", parts: '"{not json at all"', status: "complete" },
      { id: "a2", role: "assistant", parts: [{ type: "text", text: "hello" }], status: "pending" },
    ];
    const out = await loadMessages(USER, THREAD);
    expect(out.map((m) => m.id)).toEqual(["u1", "a2"]);
    expect(out[1]?.metadata).toEqual({ status: "pending" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/1/);
  });

  test("a malformed thread id reads nothing", async () => {
    expect(await loadMessages(USER, "x")).toEqual([]);
    expect(db.calls).toHaveLength(0);
  });
});
