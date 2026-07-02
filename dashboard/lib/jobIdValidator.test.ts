import { describe, expect, test } from "vitest";
import { JOB_ID_RE } from "@/lib/jobIdValidator";

describe("job id validator", () => {
  test("accepts valid ats:token:id format", () => {
    expect(JOB_ID_RE.test("greenhouse:acme:123")).toBe(true);
    expect(JOB_ID_RE.test("lever:my-company:uuid-here")).toBe(true);
  });
  test("accepts Workday ids whose external path contains slashes", () => {
    // workday:{token}:{externalPath} — the path segment must not 404.
    expect(JOB_ID_RE.test("workday:acme:/job/San-Francisco/Engineer_R-123")).toBe(true);
    expect(JOB_ID_RE.test("workday:acme:/job/x%20y")).toBe(true);
  });
  test("rejects bare strings (not found)", () => {
    expect(JOB_ID_RE.test("foo")).toBe(false);
    expect(JOB_ID_RE.test("../etc/passwd")).toBe(false);
    expect(JOB_ID_RE.test("javascript:alert(1)")).toBe(false);
    expect(JOB_ID_RE.test("workday:acme")).toBe(false); // missing the third segment
  });
  test("rejects empty string", () => {
    expect(JOB_ID_RE.test("")).toBe(false);
  });
});
