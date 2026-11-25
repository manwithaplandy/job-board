// The shortlist (plan Task 1.3): the user's triage of reviewed jobs into suggested,
// shortlisted, later and skipped, with a reason for every skip.
//
// Writes run in withUserMutation (shortlist_items carries the lifecycle trigger). A
// user skip also writes the existing sticky deny (denyJobTx, as rejectJob does) so the
// reviewer never resurrects the job; a row that stops being a user skip clears it again
// (undenyJobTx to unreviewed, see undenyJobTx). An agent skip never writes the deny.
// With `audit`, the write logs shortlist.set in the same transaction. An unattended
// write never overwrites a row the user set, nor touches a job the user rejected by
// hand (job_reviews.human_override, as the board's reject writes).
//
// The shortlist.set undoer re-reads the live row, restores only when it still equals
// the action's `after`, parses `before` with the write schema below, and writes it
// through the same core a user edit uses (writeShortlistTx).
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserMutation, withUserSql } from "@/lib/db";
import { catalogNow } from "@/lib/catalogClock";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { parseOrNull } from "@/lib/zodParse";
import { actorFor, logAction, registerUndoer, type StoredAction, type UndoOutcome } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { denyJobTx, undenyJobTx } from "@/lib/workspaces/stickyDeny";
import { jobFactsRowSchema, toJobFacts } from "@/lib/workspaces/jobFacts";
import type { ShortlistRow, ShortlistState } from "@/lib/workspaces/types";

export const SHORTLIST_STATES = ["suggested", "shortlisted", "later", "skipped"] as const satisfies readonly ShortlistState[];
export const USER_SKIP_REASONS = ["pay", "location", "seniority", "schedule", "company", "stack", "stale", "other"] as const;
export const AGENT_SKIP_REASONS = ["red_flag", "deal_breaker", "missing_pay", "posting_age"] as const;
export const REASON_TEXT_MAX = 500;
export type SetBy = "user" | "agent" | "system";

/** The job has no review for this user (and no shortlist row yet). */
export class NotReviewedError extends Error {
  constructor() {
    super("This job has not been reviewed for you yet.");
    this.name = "NotReviewedError";
  }
}

/** The request is malformed (unknown job id, state, or a reason that does not fit). */
export class ShortlistInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortlistInputError";
  }
}

/**
 * The part of a shortlist row a write sets, as stored in an audit row's before and
 * after. A skip carries a reason from the list its writer may use; other states carry
 * none.
 */
export const shortlistWriteSchema = z
  .object({
    state: z.enum(SHORTLIST_STATES),
    reasonCode: z.string().nullable(),
    reasonText: z.string().max(REASON_TEXT_MAX).nullable(),
    setBy: z.enum(["user", "agent", "system"]),
  })
  .strict()
  .superRefine((w, ctx) => {
    if (w.state !== "skipped") {
      if (w.reasonCode !== null || w.reasonText !== null) ctx.addIssue({ code: "custom", message: "reason on a non-skip" });
      return;
    }
    const allowed: readonly string[] =
      w.setBy === "user" ? USER_SKIP_REASONS : w.setBy === "agent" ? AGENT_SKIP_REASONS : [];
    if (w.reasonCode === null || !allowed.includes(w.reasonCode)) {
      ctx.addIssue({ code: "custom", message: "skip reason not allowed for this writer" });
    }
  });
export type ShortlistWrite = z.infer<typeof shortlistWriteSchema>;

const targetKeySchema = z.object({ jobId: z.string().regex(JOB_ID_RE) }).strict();

const shortlistDbRowSchema = jobFactsRowSchema.extend({
  state: z.enum(SHORTLIST_STATES),
  reason_code: z.string().nullable(),
  reason_text: z.string().nullable(),
  brief_why: z.string().nullable(),
  brief_risk: z.string().nullable(),
  set_by: z.enum(["user", "agent", "system"]),
  updated_at: z.coerce.date(),
  fit_score: z.coerce.number().nullable(),
});

function toRow(raw: unknown, now: Date): ShortlistRow | null {
  const r = parseOrNull(shortlistDbRowSchema, raw);
  if (!r || Number.isNaN(r.updated_at.getTime())) return null;
  const job = toJobFacts(r, now);
  if (!job) return null;
  return {
    jobId: r.j_id,
    state: r.state,
    reasonCode: r.reason_code,
    reasonText: r.reason_text,
    briefWhy: r.brief_why,
    briefRisk: r.brief_risk,
    setBy: r.set_by,
    updatedAt: r.updated_at.toISOString(),
    job,
    fitScore: r.fit_score,
  };
}

function writeOf(row: ShortlistRow): ShortlistWrite {
  return { state: row.state, reasonCode: row.reasonCode, reasonText: row.reasonText, setBy: row.setBy };
}

function sameWrite(a: ShortlistWrite, b: ShortlistWrite): boolean {
  return a.state === b.state && a.reasonCode === b.reasonCode && a.reasonText === b.reasonText && a.setBy === b.setBy;
}

function isUserSkip(w: ShortlistWrite | null): boolean {
  return w !== null && w.state === "skipped" && w.setBy === "user";
}

/** The caller's shortlist rows, optionally of some states only, most recently changed first. */
export async function listShortlist(userId: string, states?: ShortlistState[]): Promise<ShortlistRow[]> {
  const filter = states === undefined ? null : states.filter((s) => (SHORTLIST_STATES as readonly string[]).includes(s));
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT s.state, s.reason_code, s.reason_text, s.brief_why, s.brief_risk, s.set_by, s.updated_at,
           j.id AS j_id, j.title AS j_title, COALESCE(c.display_name, c.name) AS j_company,
           j.location AS j_location, j.remote AS j_remote, j.url AS j_url, j.first_seen_at AS j_first_seen_at,
           (public.lifecycle_source_closed(j.id, j.closed_at)) IS TRUE AS j_closed,
           COALESCE(rc.fit_score, r.fit_score) AS fit_score
    FROM shortlist_items s
    JOIN jobs j ON j.id = s.job_id
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_reviews r ON r.job_id = s.job_id AND r.user_id = s.user_id
    LEFT JOIN review_corrections rc ON rc.job_id = s.job_id AND rc.user_id = s.user_id
    WHERE s.user_id = ${userId}::uuid
      AND (${filter}::text[] IS NULL OR s.state = ANY(${filter}::text[]))
    ORDER BY s.updated_at DESC, s.job_id`);
  const clock = await catalogNow();
  const out: ShortlistRow[] = [];
  for (const raw of rows) {
    const row = toRow(raw, clock.now);
    if (row) out.push(row);
  }
  return out;
}

/**
 * One shortlist row of the caller's, locked (FOR UPDATE OF s) for the rest of the
 * transaction. `now` labels the job's age (the catalog clock, read before the
 * transaction).
 */
async function readRowTx(tx: TransactionSql, userId: string, jobId: string, now: Date): Promise<ShortlistRow | null> {
  const rows = await tx`
    SELECT s.state, s.reason_code, s.reason_text, s.brief_why, s.brief_risk, s.set_by, s.updated_at,
           j.id AS j_id, j.title AS j_title, COALESCE(c.display_name, c.name) AS j_company,
           j.location AS j_location, j.remote AS j_remote, j.url AS j_url, j.first_seen_at AS j_first_seen_at,
           (public.lifecycle_source_closed(j.id, j.closed_at)) IS TRUE AS j_closed,
           COALESCE(rc.fit_score, r.fit_score) AS fit_score
    FROM shortlist_items s
    JOIN jobs j ON j.id = s.job_id
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_reviews r ON r.job_id = s.job_id AND r.user_id = s.user_id
    LEFT JOIN review_corrections rc ON rc.job_id = s.job_id AND rc.user_id = s.user_id
    WHERE s.user_id = ${userId}::uuid AND s.job_id = ${jobId}
    FOR UPDATE OF s`;
  if (rows.length === 0) return null;
  const row = toRow(rows[0], now);
  if (!row) throw new Error("shortlist: stored row failed the parse");
  return row;
}

async function hasReviewTx(tx: TransactionSql, userId: string, jobId: string): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1 FROM job_reviews r
      WHERE r.user_id = ${userId}::uuid AND r.job_id = ${jobId} AND r.error IS NULL
        AND (r.verdict IS NOT NULL OR r.fit_score IS NOT NULL)
    ) AS reviewed`;
  return rows[0]?.reviewed === true;
}

/** Whether the caller rejected the job by hand (job_reviews.human_override, as the board's reject writes). */
async function hasHumanOverrideTx(tx: TransactionSql, userId: string, jobId: string): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1 FROM job_reviews r
      WHERE r.user_id = ${userId}::uuid AND r.job_id = ${jobId} AND r.human_override IS TRUE
    ) AS overridden`;
  return rows[0]?.overridden === true;
}

/**
 * The one write core, shared by setShortlistState and the undoer: upserts the row and
 * moves the sticky deny so that it exists exactly while the row is a user skip.
 * `existing` is the locked live row. brief_why and brief_risk are kept on update.
 */
async function writeShortlistTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  existing: ShortlistRow | null,
  w: ShortlistWrite,
): Promise<void> {
  await tx`
    INSERT INTO shortlist_items (user_id, job_id, state, reason_code, reason_text, set_by)
    VALUES (${userId}::uuid, ${jobId}, ${w.state}, ${w.reasonCode}, ${w.reasonText}, ${w.setBy})
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      state = EXCLUDED.state, reason_code = EXCLUDED.reason_code, reason_text = EXCLUDED.reason_text,
      set_by = EXCLUDED.set_by, updated_at = now()`;
  const wasUserSkip = isUserSkip(existing === null ? null : writeOf(existing));
  if (isUserSkip(w) && !wasUserSkip) await denyJobTx(tx, userId, jobId);
  if (!isUserSkip(w) && wasUserSkip) await undenyJobTx(tx, userId, jobId, null);
}

/** Removes a row the undo of a first triage restores to "absent", clearing a user-skip deny. */
async function clearShortlistTx(tx: TransactionSql, userId: string, existing: ShortlistRow): Promise<void> {
  await tx`DELETE FROM shortlist_items WHERE user_id = ${userId}::uuid AND job_id = ${existing.jobId}`;
  if (isUserSkip(writeOf(existing))) await undenyJobTx(tx, userId, existing.jobId, null);
}

export type SetShortlistResult =
  | { before: ShortlistRow | null; after: ShortlistRow; actionId: number | null }
  | { skipped: "user_owned" };

/**
 * Sets one job's shortlist state for the caller. Throws ShortlistInputError before any
 * SQL for a malformed request (a skip without a reason, a reason its writer may not
 * use) and NotReviewedError when the job has no review for the caller and no row yet.
 */
export async function setShortlistState(
  userId: string,
  a: {
    jobId: string;
    state: ShortlistState;
    reasonCode?: string;
    reasonText?: string;
    setBy: "user" | "agent";
    audit?: ToolCtx;
  },
): Promise<SetShortlistResult> {
  if (!JOB_ID_RE.test(a.jobId)) throw new ShortlistInputError("Unknown job.");
  if (a.setBy !== "user" && a.setBy !== "agent") throw new ShortlistInputError("Unknown writer.");
  if (a.audit && a.audit.userId !== userId) throw new ShortlistInputError("Audit context is another user's.");
  if (a.audit?.unattended && a.setBy !== "agent") throw new ShortlistInputError("An unattended write is the agent's.");
  if (a.state === "skipped" && !a.reasonCode) throw new ShortlistInputError("A skip needs a reason.");
  const text = a.reasonText?.trim() ? a.reasonText.trim() : null;
  const parsed = shortlistWriteSchema.safeParse({
    state: a.state,
    reasonCode: a.state === "skipped" ? (a.reasonCode ?? null) : null,
    reasonText: a.state === "skipped" ? text : null,
    setBy: a.setBy,
  });
  if (!parsed.success) throw new ShortlistInputError("That state or reason is not allowed here.");
  const w = parsed.data;
  const audit = a.audit;
  const { now } = await catalogNow();

  return withUserMutation(userId, async (tx): Promise<SetShortlistResult> => {
    const existing = await readRowTx(tx, userId, a.jobId, now);
    if (existing === null && !(await hasReviewTx(tx, userId, a.jobId))) throw new NotReviewedError();
    // An unattended run writes only over an absent row or one the system or agent set,
    // and never for a job the user rejected by hand (the board's reject leaves no row).
    if (audit?.unattended) {
      if (existing !== null && existing.setBy === "user") return { skipped: "user_owned" };
      if (await hasHumanOverrideTx(tx, userId, a.jobId)) return { skipped: "user_owned" };
    }
    await writeShortlistTx(tx, userId, a.jobId, existing, w);
    const after = await readRowTx(tx, userId, a.jobId, now);
    if (!after) throw new Error("shortlist: the written row is missing");
    const actionId = audit
      ? await logAction(tx, {
          ctx: audit,
          actor: a.setBy === "user" ? "user_via_surface" : actorFor(audit),
          kind: "shortlist.set",
          targetKey: { jobId: a.jobId },
          before: existing === null ? null : writeOf(existing),
          after: writeOf(after),
        })
      : null;
    return { before: existing, after, actionId };
  });
}

/** The shortlist.set undoer (see the module header). */
export async function undoShortlistSet(tx: TransactionSql, action: StoredAction, userId: string): Promise<UndoOutcome> {
  const target = targetKeySchema.safeParse(action.targetKey);
  const after = shortlistWriteSchema.safeParse(action.after);
  const before = shortlistWriteSchema.nullable().safeParse(action.before);
  if (!target.success || !after.success || !before.success) return "invalid";
  // Ages are not compared; the wall clock only fills the row's age label here.
  const live = await readRowTx(tx, userId, target.data.jobId, new Date());
  if (live === null || !sameWrite(writeOf(live), after.data)) return "changed_since";
  if (before.data === null) await clearShortlistTx(tx, userId, live);
  else await writeShortlistTx(tx, userId, target.data.jobId, live, before.data);
  return "restored";
}

registerUndoer("shortlist.set", undoShortlistSet);
