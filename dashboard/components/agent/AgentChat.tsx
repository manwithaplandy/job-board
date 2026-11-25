"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * What a failed request means for the page. `rollback` is true when nothing was stored,
 * so the optimistic message comes back out and its text returns to the composer.
 */
type Rejection = ({ notice: AgentBlockingNotice } | { message: string }) & { rollback: boolean };

const GENERIC_PROBLEM = "The assistant could not answer just now. Try again.";

// The route's own refusals, each answered before anything is stored (app/api/agent/route.ts).
// Any other status (a 5xx) may come after the server stored the user message, so the
// message stays and a reload shows what was kept.
const NOTHING_STORED = new Set([400, 402, 404, 409, 429, 503]);

function rejectionFrom(status: number, body: unknown): Rejection {
  const rollback = NOTHING_STORED.has(status);
  const reason = z.object({ reason: z.string() }).safeParse(body);
  if (status === 429) return { rollback, notice: reason.success && reason.data.reason === "monthly_ceiling" ? "monthly_ceiling" : "daily_ceiling" };
  if (status === 503) return { rollback, notice: "agent_disabled" };
  if (status === 402) return { rollback, notice: "no_plan" };
  if (status === 409) return { rollback, message: "A reply is still being written in this conversation. Wait for it to finish, then send again." };
  if (status === 404) return { rollback, message: "This conversation was not found. Start a new one from the list." };
  return { rollback, message: GENERIC_PROBLEM };
}

// How often the stale-turn check is re-run, so a pending reply turns "interrupted" once
// it passes AGENT_LIMITS.staleTurnMs without a reload.
const CLOCK_TICK_MS = 15_000;

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
      let res: Response;
      try {
        res = await globalThis.fetch(input, init);
      } catch (e) {
        // A network failure: treated like a refusal, so the text goes back to the
        // composer for a resend (unless the user aborted it, which is no error).
        if (!init?.signal?.aborted) rejected = { rollback: true, message: GENERIC_PROBLEM };
        throw e;
      }
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);
  const named = useRef(!autoTitle);
  // One transport per mounted chat (the page keys AgentChat by thread id).
  const [{ transport, book }] = useState(() => chatTransport(threadId));

  const { messages, sendMessage, setMessages, status } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    generateId,
    onError: () => {
      // A refusal or a network failure stored nothing; a 5xx or an error mid-stream may
      // come after the server saved the message, so it stays.
      const { rejected, sent } = book.take();
      const r = rejected ?? rejectionFrom(0, null);
      if (sent && r.rollback) {
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
        // aria-busy holds the live region's announcement while a reply streams, so a
        // screen reader reads the finished reply once, not every token.
        <ol className="rf-agent-transcript" aria-live="polite" aria-busy={busy}>
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
