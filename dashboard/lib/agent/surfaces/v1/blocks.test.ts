// The variant 1 block catalog (plan Task 1.17): exactly 13 block types, and no field a
// model could use to put a link, an image or markup on the page.
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { SurfacePayloadV1Schema, V1BlockSchema, V1_BLOCK_TYPES } from "@/lib/agent/surfaces/v1/blocks";
import { askUserInput } from "@/lib/agent/tools/askUser";

const FORBIDDEN_KEY = /^(url|href|src|html)$/i;

/** Every property name anywhere in a JSON schema, nested objects, arrays and unions included. */
function propertyNames(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) propertyNames(child, out);
    return out;
  }
  if (typeof node !== "object" || node === null) return out;
  for (const [key, child] of Object.entries(node)) {
    if (key === "properties" && typeof child === "object" && child !== null) out.push(...Object.keys(child));
    propertyNames(child, out);
  }
  return out;
}

describe("V1BlockSchema", () => {
  test("is closed over exactly the 13 block types", () => {
    expect([...V1_BLOCK_TYPES].sort()).toEqual(
      [
        "Callout", "DocumentPreview", "EvidenceMap", "IntakeQuestions", "JobCard", "JobComparison", "MemoDiff",
        "MetricChart", "PrepChecklist", "ProfileReadback", "ShortlistQueue", "StaleList", "StatRow",
      ].sort(),
    );
  });

  test("no block schema has a url, href, src or html field", () => {
    for (const schema of [V1BlockSchema, SurfacePayloadV1Schema, askUserInput]) {
      const names = propertyNames(z.toJSONSchema(schema, { io: "input" }));
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((n) => FORBIDDEN_KEY.test(n))).toEqual([]);
    }
  });

  test("IntakeQuestions: choice and multi need options, text and locations take none, ids are unique", () => {
    const q = (questions: unknown) => V1BlockSchema.safeParse({ type: "IntakeQuestions", questions }).success;
    expect(q([{ id: "seniority", label: "Level?", kind: "choice", options: ["Senior", "Staff"] }])).toBe(true);
    expect(q([{ id: "seniority", label: "Level?", kind: "choice" }])).toBe(false);
    expect(q([{ id: "where", label: "Where?", kind: "locations", options: ["a", "b"] }])).toBe(false);
    expect(q([{ id: "a", label: "A?", kind: "text" }, { id: "a", label: "B?", kind: "text" }])).toBe(false);
    // Options are picked by their text, so a duplicate (after trimming) is refused.
    expect(q([{ id: "level", label: "Level?", kind: "multi", options: ["Staff", "Senior", "Staff"] }])).toBe(false);
    expect(q([{ id: "level", label: "Level?", kind: "choice", options: ["Staff", " Staff "] }])).toBe(false);
    expect(q(Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, label: "Q?", kind: "text" })))).toBe(false);
  });
});
