import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import { diffMemo } from "@/lib/workspaces/memoCompile";
import { MEMO_SECTIONS } from "@/lib/workspaces/memoSchema";
import type { MemoDoc, MemoProposal } from "@/lib/workspaces/types";

const LABELS = Object.fromEntries(MEMO_SECTIONS.map(({ key, label }) => [key, label])) as Record<keyof MemoDoc, string>;

function Text({ value }: { value: string }) {
  return value.trim() === "" ? <p className="rf-ws-memo-diff__empty">(empty)</p> : <p className="rf-ws-memo-diff__text">{value}</p>;
}

/**
 * The fixed confirm card for a memo change (plan Task 1.8; the agent page reuses it in
 * Task 1.18). Presentational only: per changed section, before and after as plain
 * text, the rationale, and Approve, Edit and Decline, which the caller wires. A
 * proposal made against an older version can only be declined.
 */
export function MemoDiffCard({
  proposal,
  current,
  outdated = false,
  pending = false,
  onApprove,
  onEdit,
  onDecline,
}: {
  proposal: MemoProposal;
  current: MemoDoc;
  outdated?: boolean;
  pending?: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onDecline: () => void;
}) {
  const changes = diffMemo(current, proposal.proposedDoc);
  const titleId = `ws-memo-proposal-${proposal.id}`;
  return (
    <article className="rf-ws-memo-diff" aria-labelledby={titleId}>
      <div className="rf-ws-memo-diff__head">
        <p id={titleId} className="rf-ws-memo-diff__title">
          Proposed change to what you&apos;re looking for
        </p>
        <Badge tone="accent">{proposal.source === "background" ? "Suggested by the agent" : "From your conversation"}</Badge>
      </div>
      {proposal.rationale && <p className="rf-ws-memo-diff__rationale">{proposal.rationale}</p>}
      {changes.length === 0 ? (
        <p className="rf-ws-memo-diff__empty">This proposal matches your current memo.</p>
      ) : (
        changes.map((change) => (
          <section key={change.section} className="rf-ws-memo-diff__section">
            <h3 className="rf-ws-memo-diff__label">{LABELS[change.section]}</h3>
            <div className="rf-ws-memo-diff__pair">
              <div>
                <p className="rf-ws-memo-diff__caption">Before</p>
                <Text value={change.before} />
              </div>
              <div>
                <p className="rf-ws-memo-diff__caption">After</p>
                <Text value={change.after} />
              </div>
            </div>
          </section>
        ))
      )}
      {outdated && (
        <p className="rf-ws-memo-diff__note" role="note">
          This was proposed against an older version of your memo, so it can no longer be approved.
        </p>
      )}
      <div className="rf-ws-row__actions">
        {!outdated && (
          <>
            <Button size="sm" disabled={pending} onClick={onApprove}>
              Approve
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={onEdit}>
              Edit
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" disabled={pending} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </article>
  );
}
