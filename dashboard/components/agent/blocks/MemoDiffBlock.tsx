"use client";

import { Button } from "@/components/ui/Button";
import { MemoDiffCard } from "@/components/workspaces/MemoDiffCard";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { BlockFrame, own } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type MemoDiff = Extract<V1Block, { type: "MemoDiff" }>;

export const MEMO_GONE_TEXT = "This proposed change is no longer waiting for you.";
export const MEMO_OUTDATED_TEXT = "This proposal is out of date";

/**
 * A pending memo proposal (spec 5(a) step 5), drawn with the workspace's fixed memo
 * card: before and after per section, as plain text, from the proposal row the host
 * read, never from payload text. Approve and Decline emit memo.resolve, which resolves
 * it in place; Edit emits memo.review, which opens "What I'm looking for". A proposal
 * made against an older memo version shows a fixed line and only the Review button.
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
  const outdated = proposal.baseVersion !== rows.memo.version;
  const review = () => onIntent({ name: "memo.review", proposalId: block.proposalId });
  return (
    // The workspace card draws its own frame, so this wrapper has none.
    <div className="rf-block-memo">
      <MemoDiffCard
        proposal={proposal}
        current={rows.memo.current}
        onApprove={() => onIntent({ name: "memo.resolve", proposalId: block.proposalId, decision: "approve" })}
        onEdit={review}
        onDecline={() => onIntent({ name: "memo.resolve", proposalId: block.proposalId, decision: "decline" })}
        actions={
          outdated ? (
            <>
              <p className="rf-block__unavailable" role="note">
                {MEMO_OUTDATED_TEXT}
              </p>
              <Button size="sm" onClick={review}>
                Review this change
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  );
}
