import { describe, expect, test } from "vitest";
import { auditFixtureDirectory, auditProductionUi, type UiContractCode } from "@/lib/uiContract";

const EXPECTED_FIXTURE_CODES: UiContractCode[] = [
  "raw-control",
  "unicode-control-icon",
  "inline-geometry",
  "raw-theme-value",
  "undersized-target",
  "overflow-risk",
  "missing-shared-shell",
  "unapproved-svg-icon",
  "unapproved-action",
  "undocumented-compact-density",
];

describe("cohesive interface source contracts", () => {
  test.each(EXPECTED_FIXTURE_CODES)("rejects the purpose-built %s fixture", (code) => {
    const violations = auditFixtureDirectory("app/__fixtures__/ui-contract");
    expect(violations.map((violation) => violation.code)).toContain(code);
  });

  test("production UI satisfies every source contract", () => {
    expect(auditProductionUi()).toEqual([]);
  });
});
