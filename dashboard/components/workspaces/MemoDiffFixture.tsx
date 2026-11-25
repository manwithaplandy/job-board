"use client";

import { MemoDiffCard } from "@/components/workspaces/MemoDiffCard";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import type { MemoDoc, MemoProposal } from "@/lib/workspaces/types";

// The gallery's memo confirm card (visual fixture workspaces-memo-diff): the production
// card with fixed text and inert buttons. The handlers live here because a server
// component cannot pass functions to client components.

const CURRENT: MemoDoc = {
  ...emptyMemoDoc(),
  role: "Senior backend or platform engineer.",
  compensation: "Market rate.",
  dealBreakers: "No relocation.",
};

const PROPOSAL: MemoProposal = {
  id: "00000000-0000-4000-8000-0000000000a1",
  baseVersion: 3,
  proposedDoc: {
    ...CURRENT,
    compensation: "At least $180k base salary.",
    dealBreakers: "No relocation. No on-call rotations.",
  },
  rationale: "You skipped four jobs for pay and two for on-call duty this week.",
  status: "pending",
  source: "interactive",
  createdAt: "2026-11-20T10:00:00.000Z",
};

const inert = () => {};

export function MemoDiffFixture() {
  return <MemoDiffCard proposal={PROPOSAL} current={CURRENT} onApprove={inert} onEdit={inert} onDecline={inert} />;
}
