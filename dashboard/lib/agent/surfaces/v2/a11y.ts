// The basic accessibility rules a variant 2 tree must pass (plan Task 2.1, spec 7.1
// "basic a11y rules (labels, heading order, table headers)"):
//   - every Field, Select and Button has a non-empty label;
//   - heading levels never skip on the way down (1 then 3 is an error; 3 then 1 is fine;
//     the first heading may be any level, since the surface sits under the page's own);
//   - every Table has a header on each column;
//   - Tabs labels are unique (trimmed, ignoring case).
// The tree is walked in document order, through cards and every tab. Each error names
// the node's path from "root", so it works as repair feedback.
import type { V2Node } from "@/lib/agent/surfaces/v2/tree";

const blank = (s: string) => s.trim().length === 0;

export function checkA11y(root: V2Node): string[] {
  const errors: string[] = [];
  let lastHeading: number | null = null;

  const visit = (n: V2Node, path: string): void => {
    switch (n.type) {
      case "Stack":
      case "Grid":
      case "Card":
        n.children.forEach((c, i) => visit(c, `${path}.children.${i}`));
        return;
      case "Tabs": {
        const seen = new Set<string>();
        n.tabs.forEach((t, i) => {
          const key = t.label.trim().toLowerCase();
          if (blank(t.label)) errors.push(`${path}.tabs.${i}: every tab needs a label`);
          else if (seen.has(key)) errors.push(`${path}.tabs.${i}: tab label ${t.label.trim()} is used twice`);
          seen.add(key);
        });
        n.tabs.forEach((t, i) => visit(t.child, `${path}.tabs.${i}.child`));
        return;
      }
      case "Heading":
        if (lastHeading !== null && n.level > lastHeading + 1) {
          errors.push(`${path}: heading level ${n.level} follows level ${lastHeading}; do not skip levels`);
        }
        lastHeading = n.level;
        return;
      case "Field":
      case "Select":
      case "Button":
        if (blank(n.label)) errors.push(`${path}: a ${n.type} needs a label`);
        return;
      case "Table":
        if (n.columns.length === 0) errors.push(`${path}: a Table needs header columns`);
        n.columns.forEach((c, k) => {
          if (blank(c.header)) errors.push(`${path}.columns.${k}: every table column needs a header`);
        });
        return;
      default:
        return;
    }
  };
  visit(root, "root");
  return errors;
}
