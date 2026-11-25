// The first message of a conversation started from the empty agent page (PR I3b review
// I4). The empty page has no thread, so its first Send creates one and opens it; the
// message itself is handed to that thread's chat through this in-memory store (client
// state that survives the client-side navigation), never through the URL, so neither
// the text nor the attached document ids end up in the address bar or history. A full
// reload loses it, and the new thread simply opens empty.

export interface FirstMessage {
  text: string;
  documentIds: string[];
}

const pending = new Map<string, FirstMessage>();

/** Holds the first message for a thread that is about to open. */
export function stashFirstMessage(threadId: string, message: FirstMessage): void {
  pending.set(threadId, message);
}

/** The held first message for this thread, once: it is removed as it is read. */
export function takeFirstMessage(threadId: string): FirstMessage | null {
  const message = pending.get(threadId) ?? null;
  pending.delete(threadId);
  return message;
}
