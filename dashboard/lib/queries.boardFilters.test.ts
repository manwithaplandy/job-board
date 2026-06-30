import { describe, expect, test, vi, beforeEach } from "vitest";

// Capture every tagged-template call made through the db `sql` helper.
const { calls } = vi.hoisted(() => ({
  calls: [] as { strings: readonly string[]; values: unknown[] }[],
}));
vi.mock("@/lib/db", () => ({
  sql: (strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    return Promise.resolve([]);
  },
}));

import { saveBoardFilters } from "@/lib/queries";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

beforeEach(() => {
  calls.length = 0;
});

describe("saveBoardFilters", () => {
  test("issues a bare UPDATE — never touches updated_at, never INSERTs", async () => {
    await saveBoardFilters("11111111-1111-1111-1111-111111111111", {
      ...DEFAULT_FILTERS,
      sort: "pay",
    });
    expect(calls).toHaveLength(1);
    const text = calls[0].strings.join("?");
    expect(text).toMatch(/UPDATE\s+profiles/i);
    expect(text).toMatch(/board_filters/);
    expect(text).not.toMatch(/updated_at/i);
    expect(text).not.toMatch(/INSERT/i);
  });

  test("binds the serialized filters and the user id", async () => {
    const filters = { ...DEFAULT_FILTERS, sort: "pay" as const };
    await saveBoardFilters("22222222-2222-2222-2222-222222222222", filters);
    expect(calls[0].values[0]).toBe(JSON.stringify(filters));
    expect(calls[0].values[1]).toBe("22222222-2222-2222-2222-222222222222");
  });
});
