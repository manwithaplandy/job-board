import { describe, expect, test } from "vitest";
import { notSpecified, humanizeLabel } from "./analyticsLabels";

// notSpecified is scoped to the two reviewer-extraction charts (approvals-by-seniority,
// work-arrangement) where "unknown" means the model abstained — NOT the company-status
// "Unknown" verdict (GLOSSARY.unknown / humanizeLabel keep that meaning). The bar stays
// (it's a coverage signal); only its label changes to "Not specified" (plan phase J4).
describe("notSpecified", () => {
  test('relabels case-insensitive "unknown" to "Not specified", preserving counts', () => {
    const bars = [
      { label: "unknown", count: 5 },
      { label: "Unknown", count: 3 },
    ];
    expect(notSpecified(bars)).toEqual([
      { label: "Not specified", count: 5 },
      { label: "Not specified", count: 3 },
    ]);
  });

  test("leaves non-unknown labels and all counts intact", () => {
    const bars = [
      { label: "senior", count: 4 },
      { label: "remote", count: 2 },
    ];
    expect(notSpecified(bars)).toEqual(bars);
  });

  test("does not mutate the input array or its bars", () => {
    const bars = [{ label: "unknown", count: 1 }];
    const snapshot = structuredClone(bars);
    notSpecified(bars);
    expect(bars).toEqual(snapshot);
  });
});

describe("humanizeLabel", () => {
  // notSpecified runs BEFORE humanizeLabel in BreakdownsSection; the relabeled
  // "Not specified" must pass through unchanged (it has a space + uppercase, so the
  // "already human" short-circuit keeps it verbatim).
  test('leaves "Not specified" unchanged', () => {
    expect(humanizeLabel("Not specified")).toBe("Not specified");
  });
});
