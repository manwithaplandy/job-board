import { describe, expect, test } from "vitest";
import { isResumeStale } from "@/lib/resumeStale";

describe("isResumeStale", () => {
  const V1 = "a".repeat(64);
  const V2 = "b".repeat(64);

  test("stale: résumé shown, both versions present and different", () => {
    expect(
      isResumeStale({ hasResume: true, packageProfileVersion: V1, currentProfileVersion: V2 }),
    ).toBe(true);
  });

  test("not stale: versions match", () => {
    expect(
      isResumeStale({ hasResume: true, packageProfileVersion: V1, currentProfileVersion: V1 }),
    ).toBe(false);
  });

  test("not stale: no résumé is shown", () => {
    expect(
      isResumeStale({ hasResume: false, packageProfileVersion: V1, currentProfileVersion: V2 }),
    ).toBe(false);
  });

  test("not stale: package has no stored version (pre-column row → provenance unknown)", () => {
    expect(
      isResumeStale({ hasResume: true, packageProfileVersion: null, currentProfileVersion: V2 }),
    ).toBe(false);
    expect(
      isResumeStale({ hasResume: true, packageProfileVersion: undefined, currentProfileVersion: V2 }),
    ).toBe(false);
  });

  test("not stale: no live version (anon / profile-less viewer)", () => {
    expect(
      isResumeStale({ hasResume: true, packageProfileVersion: V1, currentProfileVersion: null }),
    ).toBe(false);
  });
});
