// The audit trail of agent writes, with undo (plan Task 1.2, migration 19). Every write
// the agent makes for the user is logged with what it changed, in the same transaction
// as the write, through the SECURITY DEFINER function agent_log_action.
//
// agent_log_action is callable with the user's own token (plan Spec gaps S3), so a
// stored action is never trusted. Undo goes through the undoer the writing library
// registered for that kind (registerUndoer). An undoer re-reads the live target,
// restores only when the live value still equals `after`, parses `before` with the
// same schema a normal edit uses, and writes it through the same library function a
// user edit uses. A forged row therefore gains nothing a direct edit could not do.
//
// Undoers are registered at module load by each library. undoAction loads
// lib/agent/actions/undoers.ts (which imports every such library) lazily, so this
// module and the libraries never import each other at load time.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserMutation, withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import type { ToolCtx } from "@/lib/agent/tools";

export const ACTION_KINDS = [
  "shortlist.set",
  "application.set_stage",
  "application.add_note",
  "analytics.set_tiles",
  "document.update_draft",
  "profile.set_resume",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_ACTORS = ["agent", "agent_unattended", "user_via_surface"] as const;
export type ActionActor = (typeof ACTION_ACTORS)[number];

export interface StoredAction {
  id: number;
  kind: ActionKind;
  actor: ActionActor;
  targetKey: unknown;
  before: unknown;
  after: unknown;
  undoneAt: string | null;
  createdAt: string;
}

export type UndoResult = { ok: true } | { ok: false; reason: "changed_since" | "already_undone" | "not_found" };

/**
 * What an undoer reports. "invalid" means the stored action cannot be undone as it
 * stands (its `before` or target key fails the library's write schema, as a forged row
 * would); undoAction answers it as not_found and writes nothing.
 */
export type UndoOutcome = "restored" | "changed_since" | "invalid";
/** `userId` is the caller undoing it, the same user the transaction's RLS is scoped to. */
export type Undoer = (tx: TransactionSql, action: StoredAction, userId: string) => Promise<UndoOutcome>;

const UNDOERS = new Map<ActionKind, Undoer>();

/** Called once per kind by the library that writes it, at module load. */
export function registerUndoer(kind: ActionKind, fn: Undoer): void {
  UNDOERS.set(kind, fn);
}

/** The kinds that currently have an undoer (for the undoers.ts completeness test). */
export function registeredUndoKinds(): ActionKind[] {
  return ACTION_KINDS.filter((k) => UNDOERS.has(k));
}

/** The audit actor for a write made under `ctx`. */
export function actorFor(ctx: ToolCtx): ActionActor {
  return ctx.unattended ? "agent_unattended" : "agent";
}

const ACTION_ID_MAX = Number.MAX_SAFE_INTEGER;
const LIST_LIMIT_MAX = 100;

// id is bigint (a string from postgres.js); timestamps arrive as Date.
const actionRowSchema = z.object({
  id: z.coerce.number().int().positive().max(ACTION_ID_MAX),
  kind: z.enum(ACTION_KINDS),
  actor: z.enum(ACTION_ACTORS),
  target_key: z.unknown(),
  before: z.unknown(),
  after: z.unknown(),
  undone_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
});

function validDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

function toAction(raw: unknown): StoredAction | null {
  const r = parseOrNull(actionRowSchema, raw);
  if (!r || !validDate(r.created_at) || (r.undone_at !== null && !validDate(r.undone_at))) return null;
  return {
    id: r.id,
    kind: r.kind,
    actor: r.actor,
    targetKey: r.target_key ?? null,
    before: r.before ?? null,
    after: r.after ?? null,
    undoneAt: r.undone_at === null ? null : r.undone_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

/** The caller's newest actions, newest first. Rows that fail the parse are skipped. */
export async function listRecentActions(userId: string, limit = 30): Promise<StoredAction[]> {
  const n = Number.isFinite(limit) ? Math.min(LIST_LIMIT_MAX, Math.max(1, Math.floor(limit))) : 30;
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, kind, actor, target_key, before, after, undone_at, created_at
    FROM agent_actions
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC, id DESC
    LIMIT ${n}`);
  const out: StoredAction[] = [];
  for (const raw of rows) {
    const action = toAction(raw);
    if (action) out.push(action);
  }
  return out;
}

/**
 * A jsonb argument as JSON text: SQL NULL for null/undefined. Sent as `::text::jsonb`
 * (the house pattern, lib/agent/runs.ts): a bare `::jsonb` parameter would make
 * postgres.js JSON-encode the text a second time.
 */
export function jsonText(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/**
 * Appends one audit row inside the caller's transaction and returns its id. The
 * definer function stamps the user from the transaction's JWT claims; the run and
 * thread come from `ctx` (null for a write with no agent run).
 */
export async function logAction(
  tx: TransactionSql,
  a: { ctx: ToolCtx | null; actor: ActionActor; kind: ActionKind; targetKey: unknown; before: unknown; after: unknown },
): Promise<number> {
  if (!(ACTION_KINDS as readonly string[]).includes(a.kind)) throw new Error("audit: unknown action kind");
  if (!(ACTION_ACTORS as readonly string[]).includes(a.actor)) throw new Error("audit: unknown actor");
  if (a.targetKey === null || a.targetKey === undefined) throw new Error("audit: target key required");
  const rows = await tx`
    SELECT public.agent_log_action(
      ${a.ctx?.runId ?? null}::uuid, ${a.ctx?.threadId ?? null}::uuid, ${a.actor}, ${a.kind},
      ${jsonText(a.targetKey)}::text::jsonb, ${jsonText(a.before)}::text::jsonb, ${jsonText(a.after)}::text::jsonb
    ) AS id`;
  const id = parseOrNull(z.object({ id: z.coerce.number().int().positive() }), rows[0]);
  if (!id) throw new Error("audit: agent_log_action returned no id");
  return id.id;
}

/** Thrown inside the undo transaction to roll it back when the mark lost a race. */
class UndoMarkLost extends Error {}

async function loadUndoers(): Promise<void> {
  await import("@/lib/agent/actions/undoers");
}

/**
 * Undoes one of the caller's actions. Runs in one withUserMutation transaction: read
 * the action (RLS hides another user's), dispatch to its kind's undoer, then mark it
 * undone. Nothing is written unless the undoer restored and the mark succeeded.
 */
export async function undoAction(userId: string, actionId: number): Promise<UndoResult> {
  if (!Number.isSafeInteger(actionId) || actionId <= 0) return { ok: false, reason: "not_found" };
  await loadUndoers();
  try {
    return await withUserMutation(userId, async (tx): Promise<UndoResult> => {
      const rows = await tx`
        SELECT id, kind, actor, target_key, before, after, undone_at, created_at
        FROM agent_actions
        WHERE id = ${actionId} AND user_id = ${userId}::uuid`;
      if (rows.length === 0) return { ok: false, reason: "not_found" };
      const action = toAction(rows[0]);
      if (!action) return { ok: false, reason: "not_found" };
      if (action.undoneAt !== null) return { ok: false, reason: "already_undone" };
      const undoer = UNDOERS.get(action.kind);
      if (!undoer) return { ok: false, reason: "not_found" };
      const outcome = await undoer(tx, action, userId);
      if (outcome === "changed_since") return { ok: false, reason: "changed_since" };
      if (outcome !== "restored") return { ok: false, reason: "not_found" };
      const marked = await tx`SELECT public.agent_mark_action_undone(${actionId}::bigint) AS ok`;
      if (marked[0]?.ok !== true) throw new UndoMarkLost();
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof UndoMarkLost) return { ok: false, reason: "already_undone" };
    throw error;
  }
}
