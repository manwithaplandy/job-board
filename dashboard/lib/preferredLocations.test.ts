import { describe, expect, test } from "vitest";
import { parsePreferredLocations } from "@/lib/preferredLocations";

describe("parsePreferredLocations", () => {
  test("parses a JSON array and preserves comma-containing values", () => {
    expect(parsePreferredLocations('["San Francisco, CA","Berlin, Germany"]'))
      .toEqual(["San Francisco, CA", "Berlin, Germany"]);
  });

  test("trims, drops empties, and de-dupes (first occurrence wins)", () => {
    expect(parsePreferredLocations('[" Berlin ","Berlin","","   "]'))
      .toEqual(["Berlin"]);
  });

  test("invalid JSON, non-array, or empty input yields []", () => {
    expect(parsePreferredLocations("not json")).toEqual([]);
    expect(parsePreferredLocations('{"a":1}')).toEqual([]);
    expect(parsePreferredLocations("")).toEqual([]);
  });

  test("ignores non-string entries", () => {
    expect(parsePreferredLocations('["Berlin",5,null,"Paris"]'))
      .toEqual(["Berlin", "Paris"]);
  });
});
