// Shared fixtures for the variant 2 tree tests (plan Tasks 2.1 to 2.3). Test-only. Every
// node is valid against gatheredFixture() from the variant 1 fixtures.
import { JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";
import type { SurfacePayloadV2, V2Node } from "@/lib/agent/surfaces/v2/tree";

const text = (t = "Hello"): V2Node => ({ type: "Text", text: t });

/** One sample of every node type, in schema order. */
export function everyNode(): V2Node[] {
  return [
    { type: "Stack", gap: "1", children: [text()] },
    { type: "Grid", columns: 2, children: [text(), text()] },
    { type: "Card", tone: "accent", children: [text()] },
    { type: "Tabs", tabs: [{ label: "One", child: text("First tab") }, { label: "Two", child: text("Second tab") }] },
    { type: "Divider" },
    { type: "Heading", level: 1, text: "Matches" },
    { type: "Text", text: "Plain", tone: "warning" },
    { type: "Badge", text: "New", tone: "success" },
    { type: "List", items: ["a", "b"] },
    { type: "Stat", label: "Fit", bind: `/reviews/${JOB_A}/fitScore` },
    { type: "Table", columns: [{ header: "Requirement", bind: "/text" }], rowsBind: `/reviews/${JOB_A}/requirements` },
    { type: "Chart", viz: "line", bind: "/metrics/1", title: "Over time" },
    { type: "Button", label: "Shortlist", variant: "primary", action: { name: "shortlist.set", jobId: JOB_A, state: "shortlisted" } },
    { type: "Field", id: "min_pay", label: "Minimum pay", kind: "number" },
    { type: "Select", id: "where", label: "Where", options: ["Remote", "Austin"] },
    { type: "JobTitle", jobId: JOB_A },
    { type: "FitScore", jobId: JOB_A },
    { type: "Pay", jobId: JOB_A },
    { type: "PostingLink", jobId: JOB_B },
  ];
}

/** A valid variant 2 payload holding every node type. */
export function everyNodePayload(): SurfacePayloadV2 {
  return { variant: 2, title: "Your matches", root: { type: "Stack", gap: "3", children: everyNode() } };
}
