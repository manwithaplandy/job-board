// The variant 2 accessibility rules (plan Task 2.1): labelled controls, heading order,
// table headers and unique tab labels, each error naming the node's path.
import { describe, expect, test } from "vitest";
import { checkA11y } from "@/lib/agent/surfaces/v2/a11y";
import type { V2Node } from "@/lib/agent/surfaces/v2/tree";
import { everyNode } from "@/lib/agent/surfaces/v2/testFixtures";

const h = (level: 1 | 2 | 3): V2Node => ({ type: "Heading", level, text: `Level ${level}` });
const stack = (...children: V2Node[]): V2Node => ({ type: "Stack", gap: "2", children });

describe("checkA11y", () => {
  test("the sample tree with every node type is clean", () => {
    expect(checkA11y(stack(...everyNode()))).toEqual([]);
  });

  test("heading levels never skip on the way down; going back up is fine", () => {
    expect(checkA11y(stack(h(1), h(2), h(3), h(2), h(1), h(2)))).toEqual([]);
    expect(checkA11y(stack(h(1), h(3)))).toEqual(["root.children.1: heading level 3 follows level 1; do not skip levels"]);
    // Document order runs through cards and tabs.
    const tabs: V2Node = { type: "Tabs", tabs: [{ label: "A", child: h(2) }, { label: "B", child: h(3) }] };
    expect(checkA11y(stack(h(1), { type: "Card", children: [tabs] }))).toEqual([]);
    expect(checkA11y(stack(h(1), { type: "Card", children: [h(3)] }))).toEqual([
      "root.children.1.children.0: heading level 3 follows level 1; do not skip levels",
    ]);
  });

  test("Field, Select and Button need a label", () => {
    expect(checkA11y({ type: "Field", id: "a", label: " ", kind: "text" })).toEqual(["root: a Field needs a label"]);
    expect(checkA11y({ type: "Select", id: "b", label: "", options: ["x"] })).toEqual(["root: a Select needs a label"]);
    expect(
      checkA11y({ type: "Button", label: "\t", variant: "ghost", action: { name: "open", target: "shortlist" } }),
    ).toEqual(["root: a Button needs a label"]);
  });

  test("every Table has a header on each column", () => {
    expect(checkA11y({ type: "Table", columns: [{ header: "A", bind: "/0" }, { header: " ", bind: "/1" }], rowsBind: "/metrics/0/rows" })).toEqual([
      "root.columns.1: every table column needs a header",
    ]);
    expect(checkA11y({ type: "Table", columns: [], rowsBind: "/metrics/0/rows" })).toEqual(["root: a Table needs header columns"]);
  });

  test("Tabs labels are unique", () => {
    const tabs: V2Node = { type: "Tabs", tabs: [{ label: "Pay", child: h(1) }, { label: " pay ", child: h(1) }] };
    expect(checkA11y(tabs)).toEqual(["root.tabs.1: tab label pay is used twice"]);
  });
});
