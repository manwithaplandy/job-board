import { describe, expect, test } from "vitest";
import * as queries from "@/lib/queries";

test("arithmetic sanity", () => {
  expect(1 + 1).toBe(2);
});

describe("queries module exports", () => {
  test("exposes getJobs and getLatestReviewRun", () => {
    expect(typeof queries.getJobs).toBe("function");
    expect(typeof queries.getLatestReviewRun).toBe("function");
  });
  test("exposes getReviewStats", () => {
    expect(typeof queries.getReviewStats).toBe("function");
  });
});
