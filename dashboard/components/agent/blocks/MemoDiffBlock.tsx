"use client";

import { Button } from "@/components/ui/Button";
import { MemoDiffCard } from "@/components/workspaces/MemoDiffCard";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { BlockFrame, own } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type MemoDiff = Extract<V1Block, { type: "MemoDiff" }>;

export const MEMO_GONE_TEXT = "This proposed change is no longer waiting for you.";

const inert = () => {};

/**
 * A pending memo proposal (spec 5(a) step 5), drawn with the workspace's fixed memo
 * card: before and after per section, as plain text, from the proposal row the host
 * read, never from payload text. Its one control emits memo.review, which opens "What
 * I'm looking for", where the same card approves, edits or declines it.
 */
export function MemoDiffBlock({ block, rows, onIntent }: { block: MemoDiff; rows: BlockRows; onIntent: OnIntent }) {
  const proposal = rows.memo ? own(rows.memo.proposals, block.proposalId) : null;
  if (!rows.memo || !proposal || proposal.status !== "pending") {
    return (
      <BlockFrame title="Proposed memo change" className="rf-block-memo">
        <p className="rf-block__unavailable">{MEMO_GONE_TEXT}</p>
      </BlockFrame>
    );
  }
  return (
    // The workspace card draws its own frame, so this wrapper has none.
    <div className="rf-block-memo">
      <MemoDiffCard
        proposal={proposal}
        current={rows.memo.current}
        onApprove={inert}
        onEdit={inert}
        onDecline={inert}
        actions={
          <Button size="sm" onClick={() => onIntent({ name: "memo.review", proposalId: block.proposalId })}>
            Review this change
          </Button>
        }
      />
    </div>
  );
}
