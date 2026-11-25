"use client";

import { toast } from "sonner";
import { undoAgentAction } from "@/app/actions/agent";
import { UNDO_REFUSALS } from "@/components/workspaces/AgentMarker";

/** How long an undo toast stays up (plan Task 1.20). */
export const UNDO_TOAST_MS = 10_000;

// A fixed line per write tool; the model's own words never reach the toast.
const WRITE_TOAST: Readonly<Record<string, string>> = {
  set_shortlist_state: "The agent updated your shortlist.",
  set_application_stage: "The agent moved an application.",
  add_application_note: "The agent added a note to an application.",
  set_analytics_tiles: "The agent changed your pinned analytics.",
  update_document_draft: "The agent edited a cover letter draft.",
  set_resume: "Your résumé was updated.",
};
const WRITE_TOAST_DEFAULT = "The agent made a change.";

/** The toast text for a write tool's result. */
export function writeToastText(toolName: string): string {
  return Object.prototype.hasOwnProperty.call(WRITE_TOAST, toolName) ? WRITE_TOAST[toolName] : WRITE_TOAST_DEFAULT;
}

/**
 * A sonner toast with a one-tap Undo of one agent write, up for 10 seconds. Undo calls
 * undoAgentAction; the server re-reads the live row and refuses when it moved on since.
 */
export function showUndoToast({ text, actionId, onUndone }: { text: string; actionId: number; onUndone?: () => void }): void {
  toast(text, {
    duration: UNDO_TOAST_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void undoAgentAction(actionId).then(
          (result) => {
            if (result.ok) {
              toast("Undone.");
              onUndone?.();
            } else toast(UNDO_REFUSALS[result.reason]);
          },
          () => toast("Undo failed. Try again."),
        );
      },
    },
  });
}
