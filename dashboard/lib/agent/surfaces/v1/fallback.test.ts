// The deterministic fallback (plan Task 1.17, D8): built only from gathered data and
// plain text, so it always passes the variant 1 gate.
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({ withUserSql: vi.fn() }));

import { emptyGathered } from "@/lib/agent/gathered";
import { validateSurface } from "@/lib/agent/surfaces/v1/validate";
import { FALLBACK_EMPTY_TEXT, fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { gatheredFixture, jobFacts, JOB_A, JOB_B, VALUE_METRIC } from "@/lib/agent/surfaces/v1/testFixtures";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("fallbackSurface", () => {
  test("fallbackSurface always passes validateSurface, including with empty gathered data", async () => {
    const many = emptyGathered();
    for (let i = 0; i < 9; i += 1) many.jobs[`greenhouse:acme:${i}`] = jobFacts(`greenhouse:acme:${i}`);
    many.metrics = Array.from({ length: 7 }, () => VALUE_METRIC);
    // A key no JobCard could take is skipped rather than breaking the fallback.
    many.jobs["not a job id"] = jobFacts("not a job id");
    const cases = [
      { gathered: emptyGathered(), text: undefined },
      { gathered: emptyGathered(), text: "   " },
      { gathered: gatheredFixture(), text: "Here is what I found." },
      { gathered: many, text: "x".repeat(1000) },
      { gathered: many, text: "😀".repeat(500) },
    ];
    for (const c of cases) {
      const payload = fallbackSurface(c.gathered, c.text);
      expect(await validateSurface(payload, 1, { userId: USER, gathered: c.gathered })).toEqual({ ok: true, payload });
    }
  });

  test("text first, then one JobCard per gathered job (at most 5), then a StatRow", () => {
    expect(fallbackSurface(gatheredFixture(), "Two matches.")).toEqual({
      variant: 1,
      blocks: [
        { type: "Callout", tone: "info", text: "Two matches." },
        { type: "JobCard", jobId: JOB_A },
        { type: "JobCard", jobId: JOB_B },
        { type: "StatRow", metricRefs: [0, 1] },
      ],
    });
    expect(fallbackSurface(emptyGathered())).toEqual({ variant: 1, blocks: [{ type: "Callout", tone: "info", text: FALLBACK_EMPTY_TEXT }] });
  });
});
