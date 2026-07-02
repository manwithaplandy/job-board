import { describe, expect, test } from "vitest";
import { dbLimit } from "@/lib/dbLimit";

describe("dbLimit", () => {
  test("resolves all tasks and preserves order", async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => () => Promise.resolve(n * 10));
    const results = await dbLimit(tasks);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  test("limits concurrency to the given cap", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 1));
      concurrent--;
      return i;
    });
    await dbLimit(tasks, 2);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test("works with a single task", async () => {
    const result = await dbLimit([() => Promise.resolve(42)]);
    expect(result).toEqual([42]);
  });

  test("returns empty array for empty tasks", async () => {
    expect(await dbLimit([])).toEqual([]);
  });

  test("respects limit larger than tasks", async () => {
    const tasks = [1, 2].map((n) => () => Promise.resolve(n));
    expect(await dbLimit(tasks, 10)).toEqual([1, 2]);
  });
});
