import { describe, expect, test } from "vitest";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";

const base: Filters = {
  companies: [],
  include: [],
  exclude: [],
  remoteOnly: false,
  status: "open",
};

describe("buildJobsQuery", () => {
  test("default open status adds closed_at IS NULL and orders by first_seen_at DESC", () => {
    const q = buildJobsQuery(base);
    expect(q.text).toContain("j.closed_at IS NULL");
    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
    expect(q.values).toEqual([]);
  });

  test("status closed / all", () => {
    expect(buildJobsQuery({ ...base, status: "closed" }).text).toContain(
      "j.closed_at IS NOT NULL",
    );
    const all = buildJobsQuery({ ...base, status: "all" });
    expect(all.text).not.toContain("closed_at IS NULL");
    expect(all.text).not.toContain("closed_at IS NOT NULL");
  });

  test("company filter uses ANY($n) with an int array param", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] });
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.values).toEqual([[1, 2]]);
  });

  test("include/exclude become ILIKE / NOT ILIKE with %kw% params", () => {
    const q = buildJobsQuery({
      ...base,
      include: ["engineer"],
      exclude: ["manager"],
    });
    expect(q.text).toContain("j.title ILIKE $1");
    expect(q.text).toContain("j.title NOT ILIKE $2");
    expect(q.values).toEqual(["%engineer%", "%manager%"]);
  });

  test("combined filters keep placeholder numbers in lockstep with values order", () => {
    const q = buildJobsQuery({
      ...base,
      companies: [1, 2],
      include: ["engineer"],
      exclude: ["manager"],
    });
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.text).toContain("j.title ILIKE $2");
    expect(q.text).toContain("j.title NOT ILIKE $3");
    expect(q.values).toEqual([[1, 2], "%engineer%", "%manager%"]);
  });

  test("remoteOnly adds remote IS TRUE", () => {
    expect(buildJobsQuery({ ...base, remoteOnly: true }).text).toContain(
      "j.remote IS TRUE",
    );
  });
});
