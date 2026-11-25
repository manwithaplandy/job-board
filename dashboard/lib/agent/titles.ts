// Thread title text (D11). Pure, so the chat client can name a thread from its first
// message without a model call; lib/agent/threads.ts re-exports titleFromFirstMessage.

export const DEFAULT_THREAD_TITLE = "New conversation";
export const THREAD_TITLE_MAX = 120; // agent_threads.title CHECK
const AUTO_TITLE_MAX = 60; // D11

/** Whitespace collapsed to single spaces and trimmed. */
export function squashWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The first `max` code points of `text`, so a surrogate pair is never split. */
export function cutCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("").trimEnd();
}

/** D11: the thread title is the first user message, whitespace collapsed, cut to 60 characters. */
export function titleFromFirstMessage(text: string): string {
  return cutCodePoints(squashWhitespace(text), AUTO_TITLE_MAX) || DEFAULT_THREAD_TITLE;
}
