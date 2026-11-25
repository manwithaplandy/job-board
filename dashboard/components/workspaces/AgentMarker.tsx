"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoAgentAction } from "@/app/actions/agent";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";

/** The fixed line for each undo refusal (shared by the activity panel and the agent page's undo toast). */
export const UNDO_REFUSALS = {
  changed_since: "This changed since",
  already_undone: "Already undone",
  not_found: "This can no longer be undone",
} as const;

/**
 * Marks a row the agent set, with a one-tap Undo of that write (plan Task 1.5). The
 * server re-reads the live row: when it moved on since the agent's write, undo refuses
 * with "This changed since" and the row is left alone.
 */
export function AgentMarker({ actionId }: { actionId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const undo = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await undoAgentAction(actionId);
        if (result.ok) router.refresh();
        else setMessage(UNDO_REFUSALS[result.reason]);
      } catch {
        setMessage("Undo failed. Try again.");
      }
    });
  return (
    <span className="rf-ws-marker">
      <Badge tone="accent">by agent</Badge>
      <Button variant="ghost" size="sm" onClick={undo} loading={pending} loadingLabel="Undoing">
        Undo
      </Button>
      {message && (
        <span className="rf-ws-marker__message" role="status">
          {message}
        </span>
      )}
    </span>
  );
}
