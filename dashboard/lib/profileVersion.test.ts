import { describe, expect, test } from "vitest";
import { profileVersion } from "@/lib/profileVersion";

describe("profileVersion (parity with Python compute_profile_version)", () => {
  test("empty/empty and null/null match the Python vector", () => {
    const empty = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    expect(profileVersion("", "")).toBe(empty);
    expect(profileVersion(null, null)).toBe(empty);
  });

  test("populated vector matches Python", () => {
    expect(profileVersion("Alice resume", "focus backend")).toBe(
      "54ca176e51d41e4cd93a5ff3d49fc12ab756df0d81223c3f5e0c14feb425b37c",
    );
  });
});
