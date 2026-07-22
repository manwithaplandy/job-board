import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { serviceSql } from "@/lib/db";

// getCompaniesBrowse / getCompanyOverrideCounts run under withUserSql; discoveryStateWith
// takes the executor directly. We mock withUserSql to inject a tagged-template tx that
// captures the SQL text (interpolations joined with "?") and the bound values, so we can
// assert the query SHAPE + parameters without a live DB — the same introspection style as
// companiesOverride.action.test.ts.
const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(),
  calls: [] as { text: string; values: unknown[] }[],
}));

const tx = (strings: readonly string[], ...values: unknown[]) => {
  mocks.calls.push({ text: strings.join("?"), values });
  return Promise.resolve([] as unknown[]);
};

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    withUserSql: mocks.withUserSql,
  };
});

import {
  getCompaniesBrowse,
  getCompanyOverrideCounts,
  discoveryStateWith,
  companyBucketFragment,
} from "@/lib/queries";

const USER = "9ae8b777-7c24-4290-8aad-bd2b10eff23b";

beforeEach(() => {
  mocks.calls.length = 0;
  vi.clearAllMocks();
  mocks.withUserSql.mockImplementation((_uid: string, fn: (t: typeof tx) => unknown) => fn(tx));
});
afterEach(() => vi.restoreAllMocks());

// The bucket WHERE fragment is exported for unit tests (mirrors companyNameSearchFragment):
// serviceSql is a real postgres.js instance that never connects here, so it builds genuine
// fragments whose .strings/.args we introspect.
describe("companyBucketFragment (override-verdict bucket)", () => {
  const introspect = (bucket: "all" | "included" | "excluded") =>
    companyBucketFragment(serviceSql, bucket) as unknown as { strings: string[]; args: unknown[] };

  test("all → inert (no text, no params)", () => {
    const f = introspect("all");
    expect(f.strings.join("").trim()).toBe("");
    expect(f.args ?? []).toHaveLength(0);
  });

  test("included → co.verdict = 'include'", () => {
    const text = introspect("included").strings.join(" ").toLowerCase();
    expect(text).toContain("co.verdict");
    expect(text).toContain("include");
    expect(text).not.toContain("exclude");
  });

  test("excluded → co.verdict = 'exclude'", () => {
    const text = introspect("excluded").strings.join(" ").toLowerCase();
    expect(text).toContain("co.verdict");
    expect(text).toContain("exclude");
    expect(text).not.toContain("'include'");
  });
});

describe("getCompaniesBrowse", () => {
  const outer = () => mocks.calls.find((c) => c.text.includes("FROM companies"))!;

  test("joins company_overrides for the viewer, hides manual companies, unclassified last", async () => {
    await getCompaniesBrowse(USER, { bucket: "all" });
    expect(mocks.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
    const o = outer();
    expect(o.text).toContain("LEFT JOIN company_overrides co");
    expect(o.text).toContain("co.company_id = c.id");
    expect(o.text).toContain("c.discovery_source <> 'manual'");
    // Unclassified companies sort to the bottom, then by name.
    expect(o.text.replace(/\s+/g, " ")).toContain("ORDER BY (c.classified_at IS NULL)");
    expect(o.text).not.toContain("company_reviews");
    // userId (RLS-cast) and the LIMIT are bound as parameters on the outer statement.
    expect(o.values).toContain(USER);
    expect(o.values).toContain(200);
  });

  test("binds a custom limit and the industry filter", async () => {
    await getCompaniesBrowse(USER, { bucket: "included", industry: "fintech_finance", limit: 50 });
    const o = outer();
    expect(o.values).toContain(50);
    // industry is bound inside a nested fragment call.
    expect(mocks.calls.some((c) => c.values.includes("fintech_finance"))).toBe(true);
    // industry filter emits a NULL-inclusive equality (COALESCE) against c.industry.
    expect(mocks.calls.some((c) => c.text.includes("COALESCE(c.industry, 'unknown') ="))).toBe(true);
  });

  test("no industry → no c.industry filter fragment", async () => {
    await getCompaniesBrowse(USER, { bucket: "all" });
    expect(mocks.calls.some((c) => c.text.includes("COALESCE(c.industry, 'unknown') ="))).toBe(false);
  });

  test("unknown industry facet is NULL-inclusive (COALESCE), matching sibling surfaces", async () => {
    // The "unknown" bucket must catch NULL-industry companies (never-classified backlog),
    // not just rows whose industry literally equals 'unknown'. The fragment MUST wrap the
    // column in COALESCE(c.industry, 'unknown') so the bound value matches NULL rows too.
    await getCompaniesBrowse(USER, { bucket: "all", industry: "unknown" });
    expect(mocks.calls.some((c) => c.text.includes("COALESCE(c.industry, 'unknown') ="))).toBe(true);
    expect(mocks.calls.some((c) => c.values.includes("unknown"))).toBe(true);
    // The bare (NULL-blind) form must NOT appear.
    expect(mocks.calls.some((c) => c.text.includes("c.industry ="))).toBe(false);
  });
});

describe("getCompanyOverrideCounts", () => {
  test("counts the whole corpus (all) + per-override-verdict, no manual companies", async () => {
    await getCompanyOverrideCounts(USER);
    const o = mocks.calls.find((c) => c.text.includes("company_overrides"))!;
    expect(o.text).toContain("LEFT JOIN company_overrides co");
    expect(o.text).toContain("c.discovery_source <> 'manual'");
    expect(o.text).toContain("co.verdict = 'include'");
    expect(o.text).toContain("co.verdict = 'exclude'");
    expect(o.text).not.toContain("company_reviews");
    expect(o.values).toContain(USER);
  });
});

describe("discoveryStateWith backlog = unclassified corpus", () => {
  test("counts companies with no classification, excluding seed + manual", async () => {
    await discoveryStateWith(tx as never, USER);
    const o = mocks.calls.find((c) => c.text.includes("discovery_state"))!;
    expect(o.text.replace(/\s+/g, " ")).toContain("classified_at IS NULL");
    expect(o.text).toContain("discovery_source NOT IN ('seed', 'manual')");
    // The backlog is now GLOBAL (unclassified companies), not a per-user review delta.
    expect(o.text).not.toContain("company_reviews");
    expect(o.text).not.toContain("company_profile_version");
  });
});
