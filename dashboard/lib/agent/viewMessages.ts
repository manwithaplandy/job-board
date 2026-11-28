// PR 6 (spec 08 S10.4): the marker on a message sent from a view. Its own module (it was in
// loop.ts, which re-exports it) so the thread summary (summary.ts, which loop.ts imports)
// can mark view messages too without an import cycle (polish wave, M3).
import type { UIMessage } from "ai";
import { isViewMessageId } from "@/lib/agent/request";

/**
 * PR 6 (spec 08 S10.4): the fixed words the model sees before a message sent from a view.
 * Added only when the history or the summary's transcript is built for the model, never
 * stored.
 */
export const VIEW_MESSAGE_MARKER = "(Sent from a button in a generated view.) ";

/**
 * Copies of the messages in which the first text part of every user message with a view id
 * starts with VIEW_MESSAGE_MARKER (spec 08 S10.4); every other message is returned as it is.
 * Nothing stored changes: the loop applies this to what it sends the model, and the summary
 * to the transcript it summarises.
 */
export function markViewMessages<M extends UIMessage>(messages: readonly M[]): M[] {
  return messages.map((m) => {
    if (m.role !== "user" || !isViewMessageId(m.id)) return m;
    const at = m.parts.findIndex((p) => p.type === "text");
    if (at < 0) return m;
    const parts = m.parts.map((p, i) => (i === at && p.type === "text" ? { ...p, text: VIEW_MESSAGE_MARKER + p.text } : p));
    return { ...m, parts };
  });
}
