import { describe, expect, test } from "vitest";
import { applyUrl } from "@/lib/rolefit/applyUrl";

describe("applyUrl", () => {
  test("greenhouse uses the absolute_url as-is", () => {
    const u = "https://boards.greenhouse.io/acme/jobs/12345";
    expect(applyUrl("greenhouse", u)).toBe(u);
  });

  test("ashby uses the jobUrl as-is", () => {
    const u = "https://jobs.ashbyhq.com/acme/abc-def";
    expect(applyUrl("ashby", u)).toBe(u);
  });

  test("lever appends /apply to the hostedUrl", () => {
    expect(applyUrl("lever", "https://jobs.lever.co/acme/uuid"))
      .toBe("https://jobs.lever.co/acme/uuid/apply");
  });

  test("lever handles a trailing slash", () => {
    expect(applyUrl("lever", "https://jobs.lever.co/acme/uuid/"))
      .toBe("https://jobs.lever.co/acme/uuid/apply");
  });

  test("lever does not double up when /apply is already present", () => {
    const u = "https://jobs.lever.co/acme/uuid/apply";
    expect(applyUrl("lever", u)).toBe(u);
  });

  test("lever strips a trailing slash after an existing /apply", () => {
    expect(applyUrl("lever", "https://jobs.lever.co/acme/uuid/apply/"))
      .toBe("https://jobs.lever.co/acme/uuid/apply");
  });

  test("ats matching is case-insensitive", () => {
    expect(applyUrl("Lever", "https://jobs.lever.co/acme/uuid"))
      .toBe("https://jobs.lever.co/acme/uuid/apply");
  });

  test("unknown ats returns the url unchanged", () => {
    const u = "https://careers.acme.com/job/42";
    expect(applyUrl("workday", u)).toBe(u);
  });

  test("empty url returns null", () => {
    expect(applyUrl("greenhouse", "")).toBeNull();
    expect(applyUrl("lever", "   ")).toBeNull();
  });

  test("missing url returns null", () => {
    expect(applyUrl("lever", null)).toBeNull();
    expect(applyUrl("greenhouse", undefined)).toBeNull();
  });

  test("missing ats falls back to the url unchanged", () => {
    const u = "https://careers.acme.com/job/42";
    expect(applyUrl(null, u)).toBe(u);
  });
});
