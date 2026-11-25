"use client";

import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV2 } from "@/lib/agent/surfaces/v2/tree";
import { PREP_FIXTURE_GATHERED } from "@/components/agent/blocks/AgentBlocksFixture";
import { TreeRenderer } from "./TreeRenderer";

// The gallery's variant 2 tree (visual fixture agent-tree-sample): the production
// renderer with the variant 1 fixtures' gathered data and inert intents. The tree uses
// every one of the 19 node types and every bind resolves, so no placeholder shows.

const ACME = "greenhouse:acme:1001";
const GLOBEX = "lever:globex:2002";

export const TREE_FIXTURE_GATHERED: GatheredData = PREP_FIXTURE_GATHERED;

export const TREE_FIXTURE_PAYLOAD: SurfacePayloadV2 = {
  variant: 2,
  title: "Two strong matches",
  root: {
    type: "Stack",
    gap: "3",
    children: [
      { type: "Heading", level: 1, text: "Side by side" },
      { type: "Text", text: "Acme pays more and is remote. Globex is on-site in Austin." },
      {
        type: "Grid",
        columns: 2,
        children: [
          {
            type: "Card",
            tone: "accent",
            children: [
              { type: "JobTitle", jobId: ACME },
              {
                type: "Stack",
                gap: "1",
                children: [
                  { type: "FitScore", jobId: ACME },
                  { type: "Pay", jobId: ACME },
                  { type: "Badge", text: "Remote", tone: "success" },
                ],
              },
              { type: "PostingLink", jobId: ACME },
              { type: "Button", label: "Shortlist Acme", variant: "primary", action: { name: "shortlist.set", jobId: ACME, state: "shortlisted" } },
            ],
          },
          {
            type: "Card",
            tone: "warning",
            children: [
              { type: "JobTitle", jobId: GLOBEX },
              {
                type: "Stack",
                gap: "1",
                children: [
                  { type: "FitScore", jobId: GLOBEX },
                  { type: "Badge", text: "On-site", tone: "warning" },
                ],
              },
              { type: "List", items: ["On-call every other week", "Five days on-site"] },
              { type: "PostingLink", jobId: GLOBEX },
              { type: "Button", label: "Later", variant: "secondary", action: { name: "shortlist.set", jobId: GLOBEX, state: "later" } },
            ],
          },
        ],
      },
      { type: "Divider" },
      {
        type: "Tabs",
        tabs: [
          {
            label: "Acme requirements",
            child: {
              type: "Table",
              columns: [
                { header: "Requirement", bind: "/text" },
                { header: "Met", bind: "/met" },
              ],
              rowsBind: `/reviews/${ACME}/requirements`,
            },
          },
          {
            label: "Globex requirements",
            child: {
              type: "Table",
              columns: [
                { header: "Requirement", bind: "/text" },
                { header: "Met", bind: "/met" },
              ],
              rowsBind: `/reviews/${GLOBEX}/requirements`,
            },
          },
        ],
      },
      { type: "Heading", level: 2, text: "Your pipeline" },
      {
        type: "Grid",
        columns: 2,
        children: [
          { type: "Stat", label: "Response rate", bind: "/metrics/0" },
          { type: "Stat", label: "Applications tracked", bind: "/metrics/3" },
        ],
      },
      { type: "Chart", viz: "bar", bind: "/metrics/3", title: "Where your applications are" },
      { type: "Heading", level: 3, text: "Anything to change?" },
      { type: "Field", id: "floor", label: "Your base pay floor", kind: "number" },
      { type: "Select", id: "level", label: "Level you are aiming for", options: ["Senior", "Staff"] },
      { type: "Button", label: "Send answers", variant: "secondary", action: { name: "answer", questionId: "intake", value: "send" } },
      { type: "Button", label: "Open shortlist", variant: "ghost", action: { name: "open", target: "shortlist" } },
    ],
  },
};

const inert = () => {};

export function AgentTreeFixture() {
  return <TreeRenderer payload={TREE_FIXTURE_PAYLOAD} gathered={TREE_FIXTURE_GATHERED} onIntent={inert} />;
}
