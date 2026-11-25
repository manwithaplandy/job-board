"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveProposalAction, restoreMemoAction, saveMemoAction, type MemoActionResult } from "@/app/actions/memo";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/SystemStates";
import { MemoDiffCard } from "@/components/workspaces/MemoDiffCard";
import { MemoVersions } from "@/components/workspaces/MemoVersions";
import { COMPILED_MEMO_MAX, compiledMemoOverflow } from "@/lib/workspaces/memoCompile";
import { MEMO_SECTION_MAX, MEMO_SECTIONS } from "@/lib/workspaces/memoSchema";
import type { MemoDoc, MemoProposal, MemoVersion } from "@/lib/workspaces/types";

/** What the page reads (getMemo's shape; null when the user has no memo and no old instructions). */
export type MemoEditorRead = {
  version: number;
  doc: MemoDoc;
  pending: MemoProposal[];
  legacyTruncated?: true;
  legacyLength?: number;
};

const SECTION_HINTS: Partial<Record<keyof MemoDoc, string>> = {
  role: "The kind of role and level you want.",
  locations: "Anything about place or arrangement the location list does not say.",
  dealBreakers: "What rules a job out.",
};

function sameDoc(a: MemoDoc, b: MemoDoc): boolean {
  return MEMO_SECTIONS.every(({ key }) => a[key] === b[key]);
}

/**
 * "What I'm looking for" (plan Task 1.8): the agent's pending proposals as fixed
 * confirm cards, the seven-section memo editor, and its version history. Every change
 * is the user's: a proposal changes nothing until Approve, Edit loads its text into the
 * editor to approve with edits, and Restore saves an old version as a new one.
 */
export function MemoEditor({ memo, versions }: { memo: MemoEditorRead; versions: MemoVersion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<MemoDoc>(memo.doc);
  const [editing, setEditing] = useState<MemoProposal | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  // When a refresh brings a newer version (an approval or save elsewhere), an editor the
  // user has not touched follows it; unsaved edits are kept for the user to decide.
  const [seen, setSeen] = useState<{ version: number; doc: MemoDoc }>({ version: memo.version, doc: memo.doc });
  if (memo.version !== seen.version) {
    setSeen({ version: memo.version, doc: memo.doc });
    if (!editing && sameDoc(draft, seen.doc)) setDraft(memo.doc);
  }

  const base = editing ? editing.proposedDoc : memo.doc;
  const overflow = compiledMemoOverflow(draft);
  const dirty = !sameDoc(draft, memo.doc);

  const run = (work: () => Promise<MemoActionResult>, done: (version: number) => string, after?: () => void) =>
    startTransition(async () => {
      setMessage(null);
      try {
        const out = await work();
        if (!out.ok) {
          setMessage({ tone: "danger", text: out.message });
          return;
        }
        after?.();
        setMessage({ tone: "success", text: done(out.version) });
        router.refresh();
      } catch {
        setMessage({ tone: "danger", text: "That change could not be saved. Try again." });
      }
    });

  const approve = (p: MemoProposal) =>
    run(() => resolveProposalAction(p.id, "approve"), (v) => `Approved. Your memo is now version ${v}.`, () => setDraft(p.proposedDoc));
  const decline = (p: MemoProposal) =>
    run(() => resolveProposalAction(p.id, "decline"), () => "Declined. Your memo did not change.", () => {
      if (editing?.id === p.id) {
        setEditing(null);
        setDraft(memo.doc);
      }
    });
  const startEdit = (p: MemoProposal) => {
    setMessage(null);
    setEditing(p);
    setDraft(p.proposedDoc);
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft(memo.doc);
  };
  const approveEdited = (p: MemoProposal) =>
    run(() => resolveProposalAction(p.id, "approve", draft), (v) => `Approved with your edits. Your memo is now version ${v}.`, () => setEditing(null));
  const save = () => run(() => saveMemoAction(draft), (v) => `Saved as version ${v}.`);
  const restore = (version: number) =>
    run(() => restoreMemoAction(version), (v) => `Restored version ${version} as version ${v}.`, () => {
      const found = versions.find((x) => x.version === version);
      if (found) setDraft(found.doc);
      setEditing(null);
    });

  return (
    <div className="rf-ws-board">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {memo.pending.length > 0 && (
        <section className="rf-ws-section" aria-labelledby="ws-memo-proposals">
          <h2 id="ws-memo-proposals" className="rf-ws-section__title">
            Proposed changes <span className="rf-ws-section__count">{memo.pending.length}</span>
          </h2>
          <div className="rf-ws-list">
            {memo.pending.map((p) => (
              <MemoDiffCard
                key={p.id}
                proposal={p}
                current={memo.doc}
                outdated={p.baseVersion !== memo.version}
                pending={pending}
                onApprove={() => approve(p)}
                onEdit={() => startEdit(p)}
                onDecline={() => decline(p)}
              />
            ))}
          </div>
        </section>
      )}
      <section className="rf-ws-section" aria-labelledby="ws-memo-editor">
        <h2 id="ws-memo-editor" className="rf-ws-section__title">
          Your memo{" "}
          <span className="rf-ws-section__count">{memo.version > 0 ? `Version ${memo.version}` : "Not saved yet"}</span>
        </h2>
        {memo.legacyTruncated && memo.legacyLength !== undefined && (
          <Alert tone="warning">
            Your earlier instructions were {memo.legacyLength.toLocaleString("en-US")} characters, more than &quot;Anything
            else&quot; holds, so only the first {MEMO_SECTION_MAX.toLocaleString("en-US")} are shown. Your first save keeps
            the full old text in the history.
          </Alert>
        )}
        {editing && (
          <Alert tone="info">
            You are editing the agent&apos;s proposal. Approving saves your edited text as a new version.
          </Alert>
        )}
        <div className="rf-ws-memo">
          {MEMO_SECTIONS.map(({ key, label }) => (
            <TextArea
              key={key}
              label={label}
              description={SECTION_HINTS[key]}
              rows={3}
              maxLength={MEMO_SECTION_MAX}
              value={draft[key]}
              disabled={pending}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [key]: value }));
              }}
            />
          ))}
        </div>
        {overflow > 0 && (
          <Alert tone="danger">
            This memo is {overflow.toLocaleString("en-US")} characters too long once its sections are put together (the
            limit is {COMPILED_MEMO_MAX.toLocaleString("en-US")}). Shorten a section to save it.
          </Alert>
        )}
        <div className="rf-ws-row__actions">
          {editing ? (
            <>
              <Button disabled={pending || overflow > 0} onClick={() => approveEdited(editing)}>
                Approve with edits
              </Button>
              <Button variant="ghost" disabled={pending} onClick={cancelEdit}>
                Cancel edit
              </Button>
            </>
          ) : (
            <>
              <Button disabled={pending || overflow > 0 || !dirty} onClick={save}>
                Save
              </Button>
              <Button variant="ghost" disabled={pending || sameDoc(draft, base)} onClick={() => setDraft(base)}>
                Discard changes
              </Button>
            </>
          )}
        </div>
      </section>
      <section className="rf-ws-section" aria-labelledby="ws-memo-versions">
        <h2 id="ws-memo-versions" className="rf-ws-section__title">
          Versions
        </h2>
        <MemoVersions versions={versions} currentVersion={memo.version} pending={pending} onRestore={restore} />
      </section>
    </div>
  );
}
