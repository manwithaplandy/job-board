"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createIdGenerator, DefaultChatTransport, type UIMessage } from "ai";
import { z } from "zod";
import { renameThreadAction } from "@/app/actions/agent";
import { Alert } from "@/components/ui/SystemStates";
import { AGENT_LIMITS } from "@/lib/agent/config";
import type { AgentRequest } from "@/lib/agent/request";
import { titleFromFirstMessage } from "@/lib/agent/titles";
import { AgentNotice, type AgentBlockingNotice } from "./AgentNotice";
import { Composer } from "./Composer";

// The text-only agent chat (plan Task 0.14). The server owns history (D7): every request
// carries only the thread id and the new message's id and text, built from the last
// message alone; the route loads the rest from agent_messages. Assistant text is
// rendered as React text nodes, never as HTML or markdown, so model output cannot
// inject markup or links.

const generateId = createIdGenerator({ prefix: "u", size: 16 });

// A stored message's metadata (lib/agent/threads.ts loadMessages): a total parse, so a
// stray shape reads as "no status" rather than crashing the page.
const metadataSchema = z.object({
  status: z.enum(["complete", "pending", "failed"]),
  createdAt: z.string().optional(),
});

function metaOf(m: UIMessage): z.infer<typeof metadataSchema> | null {
  const r = metadataSchema.safeParse(m.metadata);
  return r.success ? r.data : null;
}

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/**
 * The last reply never finished: a failed assistant row, or one still pending after the
 * stale-turn window (the server aborts such a run on the next turn, AGENT_LIMITS.staleTurnMs).
 */
function isInterrupted(messages: UIMessage[], now: number): boolean {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return false;
  const meta = metaOf(last);
  if (!meta) return false;
  if (meta.status === "failed") return true;
  if (meta.status !== "pending" || !meta.createdAt) return false;
  const at = Date.parse(meta.createdAt);
  return Number.isFinite(at) && now - at > AGENT_LIMITS.staleTurnMs;
}

/** What a rejected request means for the page. */
type Rejection = { notice: AgentBlockingNotice } | { message: string };

function rejectionFrom(status: number, body: unknown): Rejection {
  const reason = z.object({ reason: z.string() }).safeParse(body);
  if (status === 429) return { notice: reason.success && reason.data.reason === "monthly_ceiling" ? "monthly_ceiling" : "daily_ceiling" };
  if (status === 503) return { notice: "agent_disabled" };
  if (status === 402) return { notice: "no_plan" };
  if (status === 409) return { message: "A reply is still being written in this conversation. Wait for it to finish, then send again." };
  if (status === 404) return { message: "This conversation was not found. Start a new one from the list." };
  return { message: "The assistant could not answer just now. Try again." };
}

/**
 * The HTTP transport plus a small ledger of the request in flight: its message id and
 * text, and how the route rejected it, so a rejection can take the optimistic message
 * back out and return the text to the composer.
 */
function chatTransport(threadId: string) {
  let sent: { id: string; text: string } | null = null;
  let rejected: Rejection | null = null;
  const transport = new DefaultChatTransport<UIMessage>({
    api: "/api/agent",
    prepareSendMessagesRequest: ({ messages }) => {
      const last = messages.at(-1);
      const text = last ? textOf(last) : "";
      const body: AgentRequest = { threadId, kind: "message", id: last?.id ?? generateId(), text };
      sent = { id: body.id, text };
      rejected = null;
      return { body };
    },
    fetch: async (input, init) => {
      const res = await globalThis.fetch(input, init);
      if (!res.ok) rejected = rejectionFrom(res.status, await res.clone().json().catch(() => null));
      return res;
    },
  });
  const book = {
    take: () => {
      const out = { sent, rejected };
      rejected = null;
      return out;
    },
  };
  return { transport, book };
}

function MessageView({ message }: { message: UIMessage }) {
  const who = message.role === "user" ? "You" : "Assistant";
  return (
    <li className={`rf-agent-message rf-agent-message--${message.role}`}>
      <span className="rf-agent-message__role">{who}</span>
      {message.parts.map((part, i) => {
        if (part.type === "text") return <p key={i} className="rf-agent-message__text">{part.text}</p>;
        if (part.type.startsWith("tool-")) return <p key={i} className="rf-agent-message__tool">Looked up {part.type.slice("tool-".length).replace(/_/g, " ")}</p>;
        return null;
      })}
    </li>
  );
}

export function AgentChat({
  threadId,
  initialMessages,
  notice,
  autoTitle = false,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  notice: AgentBlockingNotice | null;
  autoTitle?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [blocking, setBlocking] = useState<AgentBlockingNotice | null>(notice);
  const [problem, setProblem] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const named = useRef(!autoTitle);
  // One transport per mounted chat (the page keys AgentChat by thread id).
  const [{ transport, book }] = useState(() => chatTransport(threadId));

  const { messages, sendMessage, setMessages, status } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    generateId,
    onError: () => {
      // An HTTP rejection stored nothing; an error mid-stream comes after the server
      // saved the message, so it stays.
      const { rejected, sent } = book.take();
      const wasRejected = rejected !== null;
      const r = rejected ?? rejectionFrom(0, null);
      if (sent && wasRejected) {
        // Nothing was stored for a rejected request: take the message back out.
        setMessages((prev) => prev.filter((m) => m.id !== sent.id));
        setDraft((d) => (d === "" ? sent.text : d));
      }
      if ("notice" in r) {
        setBlocking(r.notice);
        setProblem(null);
      } else setProblem(r.message);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const interrupted = !busy && isInterrupted(messages, now);
  const lastUserText = [...messages].reverse().find((m) => m.role === "user");

  const send = (text: string) => {
    setProblem(null);
    setDraft("");
    if (!named.current) {
      named.current = true;
      void renameThreadAction(threadId, titleFromFirstMessage(text)).catch(() => {});
    }
    void sendMessage({ text });
  };

  return (
    <section className="rf-agent-chat" aria-label="Conversation">
      {messages.length === 0 ? (
        <p className="rf-agent-chat__empty">Ask about your reviewed jobs, a company, or your profile.</p>
      ) : (
        <ol className="rf-agent-transcript" aria-live="polite">
          {messages.map((m) => (
            <MessageView key={m.id} message={m} />
          ))}
        </ol>
      )}
      {interrupted && !blocking && (
        <AgentNotice kind="interrupted" onRetry={lastUserText ? () => send(textOf(lastUserText)) : undefined} />
      )}
      {blocking && <AgentNotice kind={blocking} />}
      {problem && !blocking && <Alert tone="danger">{problem}</Alert>}
      <Composer value={draft} onChange={setDraft} onSend={send} disabled={blocking !== null} busy={busy} />
    </section>
  );
}
