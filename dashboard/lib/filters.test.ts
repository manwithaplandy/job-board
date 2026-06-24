import { describe, expect, test } from "vitest";
import { parseFilters } from "@/lib/filters";

const D = { include: ["engineer"] };

describe("parseFilters", () => {
  test("empty params → defaults: open status, default include keywords", () => {
    expect(parseFilters({}, D)).toEqual({
      companies: [],
      include: ["engineer"],
      exclude: [],
      remoteOnly: false,
      status: "open",
    });
  });

  test("any filter param present suppresses default include", () => {
    expect(parseFilters({ status: "all" }, D).include).toEqual([]);
  });

  test("parses csv company ids, include/exclude, remote, status", () => {
    const f = parseFilters(
      { company: "1,2", include: "staff,backend", exclude: "manager", remote: "1", status: "closed" },
      D,
    );
    expect(f.companies).toEqual([1, 2]);
    expect(f.include).toEqual(["staff", "backend"]);
    expect(f.exclude).toEqual(["manager"]);
    expect(f.remoteOnly).toBe(true);
    expect(f.status).toBe("closed");
  });

  test("invalid status falls back to open; non-numeric company ids dropped", () => {
    const f = parseFilters({ status: "bogus", company: "1,x" }, D);
    expect(f.status).toBe("open");
    expect(f.companies).toEqual([1]);
  });
});
