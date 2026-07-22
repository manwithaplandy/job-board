import { describe, expect, test } from "vitest";
import { parseClassificationJob } from "@/lib/classificationJobCodec";

// A postgres.js-shaped row: INT as number, NUMERIC/BIGINT as string, timestamptz as Date.
const dbRow = {
  id: 7,
  status: "running",
  model: "google/gemini-3.5-flash-lite",
  company_cap: 1000,
  selection_mode: "unclassified",
  use_serp: false,
  est_cost: "1.1400",
  processed: 120,
  errored: 3,
  serp_queries: 0,
  actual_prompt_tokens: "156000",
  actual_completion_tokens: "36000",
  actual_cost: null,
  error: null,
  created_at: new Date("2026-07-21T10:00:00.000Z"),
  started_at: new Date("2026-07-21T10:01:00.000Z"),
  finished_at: null,
};

describe("parseClassificationJob", () => {
  test("parses a snake_case DB row, coercing NUMERIC/BIGINT strings to numbers", () => {
    const row = parseClassificationJob(dbRow);
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      id: 7,
      status: "running",
      model: "google/gemini-3.5-flash-lite",
      companyCap: 1000,
      selectionMode: "unclassified",
      useSerp: false,
      estCost: 1.14,
      processed: 120,
      errored: 3,
      serpQueries: 0,
      actualPromptTokens: 156000,
      actualCompletionTokens: 36000,
      actualCost: null,
      error: null,
      createdAt: "2026-07-21T10:00:00.000Z",
      startedAt: "2026-07-21T10:01:00.000Z",
      finishedAt: null,
    });
  });

  test("round-trips through JSON (camel-case wire shape) unchanged", () => {
    const first = parseClassificationJob(dbRow)!;
    const overWire = JSON.parse(JSON.stringify(first));
    expect(parseClassificationJob(overWire)).toEqual(first);
  });

  test("drops a row with a bad status enum", () => {
    expect(parseClassificationJob({ ...dbRow, status: "sideways" })).toBeNull();
  });

  test("drops a row with a bad selection_mode enum", () => {
    expect(parseClassificationJob({ ...dbRow, selection_mode: "everything" })).toBeNull();
  });

  test("drops a row missing a required column", () => {
    const { id: _omit, ...noId } = dbRow;
    expect(parseClassificationJob(noId)).toBeNull();
  });

  test("rejects non-object input", () => {
    expect(parseClassificationJob(null)).toBeNull();
    expect(parseClassificationJob("nope")).toBeNull();
    expect(parseClassificationJob(42)).toBeNull();
  });
});
