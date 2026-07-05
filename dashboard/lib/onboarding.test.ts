import { describe, expect, test } from "vitest";
import { validateOnboarding, hasErrors } from "@/lib/onboarding";

const base = {
  invited: true,
  hasProfile: false,
  resumeText: "Jane Doe — Staff Engineer",
  preferredLocations: ["Remote"],
};

describe("validateOnboarding", () => {
  test("passes with an invited account, résumé text, and at least one location", () => {
    const e = validateOnboarding(base);
    expect(hasErrors(e)).toBe(false);
  });

  test("rejects a non-invited account with no existing profile (gate before fields)", () => {
    const e = validateOnboarding({ ...base, invited: false, hasProfile: false });
    expect(e.form).toBeTruthy();
    // The invite gate short-circuits — no field-level detail leaks to a stranger.
    expect(e.resume).toBeUndefined();
    expect(e.locations).toBeUndefined();
  });

  test("allows a non-invited caller who already has a profile (re-onboard / legacy)", () => {
    const e = validateOnboarding({ ...base, invited: false, hasProfile: true });
    expect(hasErrors(e)).toBe(false);
  });

  test("rejects an empty résumé", () => {
    const e = validateOnboarding({ ...base, resumeText: "   " });
    expect(e.resume).toBeTruthy();
    expect(e.form).toBeUndefined();
  });

  test("rejects empty locations (mandatory cost control)", () => {
    const e = validateOnboarding({ ...base, preferredLocations: [] });
    expect(e.locations).toBeTruthy();
  });

  test("reports both field errors together when résumé and locations are missing", () => {
    const e = validateOnboarding({ ...base, resumeText: "", preferredLocations: [] });
    expect(e.resume).toBeTruthy();
    expect(e.locations).toBeTruthy();
  });
});
