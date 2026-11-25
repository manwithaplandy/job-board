"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";
import { USER_SKIP_REASON_LABELS, USER_SKIP_REASON_ORDER } from "@/lib/workspaces/labels";

const NOTE_MAX = 500;

/**
 * Asks why a job is skipped: one tap on one of the eight user reasons sends it, with an
 * optional short note (plan Task 1.5). The reason is stored with the skip and the job
 * is never reviewed again for this user.
 */
export function SkipReasonPicker({
  onPick,
  onCancel,
  disabled = false,
}: {
  onPick: (reasonCode: string, reasonText: string | undefined) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const labelId = `${id}-label`;
  return (
    <div className="rf-ws-skip">
      <p id={labelId} className="rf-ws-skip__title">
        Why skip this job?
      </p>
      <TextField
        id={`${id}-note`}
        label="Note (optional)"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(event) => setNote(event.currentTarget.value)}
      />
      <div className="rf-ws-skip__reasons" role="group" aria-labelledby={labelId}>
        {USER_SKIP_REASON_ORDER.map((code) => (
          <Button
            key={code}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onPick(code, note.trim() ? note.trim() : undefined)}
          >
            {USER_SKIP_REASON_LABELS[code]}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
