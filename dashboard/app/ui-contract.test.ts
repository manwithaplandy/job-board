import { describe, expect, test } from "vitest";
import { auditFixtureFile, auditProductionUi, auditSource, type UiContractCode } from "@/lib/uiContract";

const FIXTURE_BY_CODE: Record<UiContractCode, string> = {
  "raw-control": "raw-controls.tsx", "unicode-control-icon": "unicode-icons.tsx",
  "inline-geometry": "inline-geometry.tsx", "raw-theme-value": "theme-drift.css",
  "undersized-target": "undersized-target.css", "overflow-risk": "overflow.css",
  "missing-shared-shell": "missing-shell.tsx", "unapproved-svg-icon": "unapproved-svg.tsx",
  "unapproved-action": "unapproved-action.tsx", "undocumented-compact-density": "compact-density.tsx",
};

describe("cohesive interface source contracts", () => {
  test.each(Object.entries(FIXTURE_BY_CODE) as [UiContractCode, string][])("isolates the purpose-built %s fixture", (code, fixture) => {
    expect(auditFixtureFile(`app/__fixtures__/ui-contract/${fixture}`).map((violation) => violation.code)).toEqual([code]);
  });

  test("does not grant whole-file immunity to a new raw control in a legacy composite", () => {
    const mutation = `export function FilterBar() { return <><div data-ui-contract-composite="filter listbox">ok</div><button>New unrelated action</button></>; }`;
    expect(auditSource("components/rolefit/FilterBar.tsx", mutation, false).map((violation) => violation.code)).toContain("raw-control");
  });

  test("rejects theme and layout bypass forms", () => {
    expect(auditSource("components/NewWidget.tsx", `export const X=()=> <div style={{ color: "hsl(1 2% 3%)", width: 500 }}>x</div>`, false).map((v) => v.code)).toEqual(expect.arrayContaining(["raw-theme-value", "inline-geometry"]));
    expect(auditSource("components/new-widget.css", `.cta:hover { height: 30px; color: blue } .container { min-width: 600px }`, false).map((v) => v.code)).toEqual(expect.arrayContaining(["raw-theme-value", "undersized-target", "overflow-risk"]));
  });

  test("rejects raw-control and class-prefix bypass forms", () => {
    const fieldButton = auditSource("components/NewWidget.tsx", `export const X=()=> <Field id="x"><button>Bypass</button></Field>`, false);
    const prefixedClass = auditSource("components/NewWidget.tsx", `export const X=()=> <button className="rf-control-bypass">Bypass</button>`, false);
    expect(fieldButton.map((violation) => violation.code)).toContain("raw-control");
    expect(prefixedClass.map((violation) => violation.code)).toContain("raw-control");
  });

  test("rejects base-selector and calculated-geometry bypass forms", () => {
    const baseSelector = auditSource("components/new-widget.css", `.cta { height: 30px; }`, false);
    const calculatedGeometry = auditSource("components/NewWidget.tsx", `export const X=()=> <div style={{ width: "calc(100% + 40px)" }}>x</div>`, false);
    expect(baseSelector.map((violation) => violation.code)).toContain("undersized-target");
    expect(calculatedGeometry.map((violation) => violation.code)).toContain("inline-geometry");
    const boardMutation = auditSource("components/rolefit/RolefitBoard.tsx", `export function RolefitBoard(){return <div style={{ width: "calc(100% + 40px)" }}>unsafe</div>}`, false);
    expect(boardMutation.map((violation) => violation.code)).toContain("inline-geometry");
  });

  test("production UI satisfies every source contract", () => {
    expect(auditProductionUi()).toEqual([]);
  });
});
