// The thread store (Task 0.8). Every call runs through withUserSql, so RLS applies on
// top of the explicit user_id predicate. Threads are user-writable (title, variant);
// messages are read here and written only by lib/agent/runs.ts (service role).
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { parseStoredMessage, type AgentUIMessage } from "@/lib/agent/messageCodec";
import type { Variant } from "@/lib/agent/config";
import { cutCodePoints, squashWhitespace, THREAD_TITLE_MAX } from "@/lib/agent/titles";

export interface AgentThread {
  id: string;
  title: string;
  variant: Variant;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_LIMIT = 50;

const variantSchema = z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]));

// variant is bigint (a string from postgres.js); timestamps arrive as Date.
const threadRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  variant: variantSchema,
  summary: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const createdAtSchema = z.object({ created_at: z.coerce.date().refine((d) => !Number.isNaN(d.getTime())) });

function toThread(raw: unknown): AgentThread | null {
  const r = parseOrNull(threadRowSchema, raw);
  if (!r || Number.isNaN(r.created_at.getTime()) || Number.isNaN(r.updated_at.getTime())) return null;
  return {
    id: r.id,
    title: r.title,
    variant: r.variant,
    summary: r.summary,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function assertVariant(v: unknown): asserts v is Variant {
  if (v !== 1 && v !== 2 && v !== 3) throw new Error("agent: variant must be 1, 2 or 3");
}

// D11 titles are pure text work, shared with the chat client (lib/agent/titles.ts).
export { titleFromFirstMessage } from "@/lib/agent/titles";

export async function createThread(userId: string, variant: Variant): Promise<AgentThread> {
  assertVariant(variant);
  const rows = await withUserSql(userId, (tx) => tx`
    INSERT INTO agent_threads (user_id, variant) VALUES (${userId}::uuid, ${variant})
    RETURNING id, title, variant, summary, created_at, updated_at
  `);
  const thread = toThread(rows[0]);
  if (!thread) throw new Error("agent: createThread returned an unexpected row");
  return thread;
}

/** The caller's unarchived threads, most recently updated first, at most 50. */
export async function listThreads(userId: string): Promise<AgentThread[]> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, title, variant, summary, created_at, updated_at FROM agent_threads
    WHERE user_id = ${userId}::uuid AND archived_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 50
  `);
  const out: AgentThread[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const t = toThread(raw);
    if (t) out.push(t);
    else skipped += 1;
  }
  if (skipped > 0) console.warn(`agent: listThreads skipped ${skipped} unparseable thread row(s)`);
  return out.slice(0, LIST_LIMIT);
}

export async function getThread(userId: string, id: string): Promise<AgentThread | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, title, variant, summary, created_at, updated_at FROM agent_threads
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
  `);
  return rows.length > 0 ? toThread(rows[0]) : null;
}

/**
 * Sets a user-chosen title: whitespace collapsed, at most 120 characters, never empty.
 * Throws for a thread that is not the caller's (the UPDATE touched no row).
 */
export async function renameThread(userId: string, id: string, title: string): Promise<void> {
  const clean = cutCodePoints(squashWhitespace(title), THREAD_TITLE_MAX);
  if (!clean) throw new Error("agent: a thread title cannot be empty");
  if (!UUID_RE.test(id)) throw new Error("agent: thread not found");
  const rows = await withUserSql(userId, (tx) => tx`
    UPDATE agent_threads SET title = ${clean}, updated_at = now()
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    RETURNING id
  `);
  // No row: not this user's thread (or no such thread), so the rename is refused.
  if (rows.length === 0) throw new Error("agent: thread not found");
}

export async function setThreadVariant(userId: string, id: string, variant: Variant): Promise<void> {
  assertVariant(variant);
  if (!UUID_RE.test(id)) throw new Error("agent: thread not found");
  await withUserSql(userId, (tx) => tx`
    UPDATE agent_threads SET variant = ${variant}, updated_at = now()
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
  `);
}

/**
 * The thread's messages in order. A row that fails the parse is skipped and counted in
 * one console warning, never thrown, so one bad row cannot take a conversation down.
 */
export async function loadMessages(userId: string, threadId: string): Promise<AgentUIMessage[]> {
  if (!UUID_RE.test(threadId)) return [];
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, role, parts, status, created_at FROM agent_messages
    WHERE thread_id = ${threadId}::uuid AND user_id = ${userId}::uuid
    ORDER BY seq
  `);
  const out: AgentUIMessage[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const m = parseStoredMessage(raw);
    if (!m) {
      skipped += 1;
      continue;
    }
    // When the row was written travels next to its status, so the page can tell a
    // pending turn that is still running from one that was interrupted (Task 0.14).
    const createdAt = parseOrNull(createdAtSchema, raw);
    out.push(createdAt ? { ...m, metadata: Object.assign({}, m.metadata, { createdAt: createdAt.created_at.toISOString() }) } : m);
  }
  if (skipped > 0) console.warn(`agent: loadMessages skipped ${skipped} unparseable message row(s) in a thread`);
  return out;
}
