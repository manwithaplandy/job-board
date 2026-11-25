import { beforeEach, describe, expect, test, vi } from "vitest";

// unstable_cache is replaced per test: either a pass-through (a request context with a
// cache miss) or a function that throws like Next does outside a request context.
const cache = vi.hoisted(() => ({ mode: "pass" as "pass" | "no-context", wrapped: [] as unknown[] }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => {
    cache.wrapped.push(fn);
    return async () => {
      if (cache.mode === "no-context") throw new Error("Invariant: incrementalCache missing in unstable_cache");
      return fn();
    };
  },
}));

import { cachedWithFallback } from "@/lib/cachedWithFallback";

beforeEach(() => {
  cache.mode = "pass";
  cache.wrapped = [];
});

describe("cachedWithFallback", () => {
  test("returns the cached read's value", async () => {
    const read = vi.fn(async () => 7);
    expect(await cachedWithFallback(read, ["k"], { revalidate: 60, tags: ["k"] })()).toBe(7);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test("outside a request context it reads directly, once", async () => {
    cache.mode = "no-context";
    const read = vi.fn(async () => 7);
    expect(await cachedWithFallback(read, ["k"], { revalidate: 60, tags: ["k"] })()).toBe(7);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test("a failed read is rethrown as is and never retried", async () => {
    const boom = new Error("db down");
    const read = vi.fn(async () => {
      throw boom;
    });
    await expect(cachedWithFallback(read, ["k"], { revalidate: 60, tags: ["k"] })()).rejects.toBe(boom);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test("the function handed to unstable_cache rejects on a failed read, so nothing is cached", async () => {
    const read = vi.fn(async () => {
      throw new Error("db down");
    });
    cachedWithFallback(read, ["k"], { revalidate: 60, tags: ["k"] });
    const inner = cache.wrapped[0] as () => Promise<unknown>;
    await expect(inner()).rejects.toThrow();
  });
});
