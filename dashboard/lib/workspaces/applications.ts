// The application tracker (plan Task 1.6): one row per job the user is pursuing, with a
// stage, an append-only history of stage moves and notes, and a next-step date.
//
// applications and application_events carry the lifecycle trigger, so every write runs
// under the lifecycle gate: a move to "applied" inside markAppliedCore's payload
// transaction (the board's own path, so the package is marked applied in the same
// commit), a move from applied-or-later back to preparing or ready inside
// unmarkAppliedCore, every other write in withUserMutation. Only reviewed jobs can be
// tracked. Unattended runs may not change tracker stages or write notes.
//
// Undo (registered below):
// - application.set_stage re-reads the live row, restores only when it still equals the
//   action's `after`, and writes `before` through the same stage core a user move uses.
//   Restoring to preparing or ready from applied-or-later also unmarks the package
//   (unmarkAppliedTx, the board's unmark statements). Restoring forward to
//   applied-or-later from a stage before it re-marks the package (remarkAppliedTx, a
//   status-only update or a content-less marker, since undo cannot open the payload
//   transaction).
// - The board's own Mark applied and Unmark mirror into the tracker through
//   trackAppliedTx and untrackAppliedTx, as the user and with no audit row.
// - application.add_note: events are append-only (owner SELECT and INSERT only), so the
//   note is not deleted. Undo checks the agent's note is still there and unchanged; the
//   action is then marked undone, and listApplications leaves out agent notes whose
//   add_note action is undone.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserMutation, withUserSql } from "@/lib/db";
import { catalogNow } from "@/lib/catalogClock";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { isResumeStale } from "@/lib/resumeStale";
import { parseOrNull } from "@/lib/zodParse";
import { actorFor, logAction, registerUndoer, type AuditCtx, type StoredAction, type UndoOutcome } from "@/lib/agent/actions/audit";
import { markAppliedCore, remarkAppliedTx, unmarkAppliedCore, unmarkAppliedTx } from "@/lib/workspaces/appliedCore";
import { jobFactsRowSchema, toJobFacts } from "@/lib/workspaces/jobFacts";
import { hasReviewTx, NotReviewedError } from "@/lib/workspaces/shortlist";
import type { ApplicationEvent, ApplicationRow, ClosedReason, Stage } from "@/lib/workspaces/types";

export { NotReviewedError };

export const STAGES = ["preparing", "ready", "applied", "interviewing", "offer", "closed"] as const satisfies readonly Stage[];
export const CLOSED_REASONS = ["rejected", "withdrawn", "no_response"] as const satisfies readonly ClosedReason[];
export const NOTE_MAX = 2000;
const PRE_APPLY: ReadonlySet<Stage> = new Set(["preparing", "ready"]);
const APPLIED_OR_LATER: ReadonlySet<Stage> = new Set(["applied", "interviewing", "offer"]);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The request is malformed (unknown job, stage or reason, a reason that does not fit, a bad note or date). */
export class ApplicationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationInputError";
  }
}

/** The job is not on the caller's tracker. */
export class NotTrackedError extends Error {
  constructor() {
    super("This job is not on your tracker.");
    this.name = "NotTrackedError";
  }
}

/** A stage write as stored in an audit row's before and after: closed has a reason, other stages none. */
export const stageWriteSchema = z
  .object({ stage: z.enum(STAGES), closedReason: z.enum(CLOSED_REASONS).nullable() })
  .strict()
  .refine((w) => (w.stage === "closed") === (w.closedReason !== null), { message: "closed needs a reason, other stages none" });
export type StageWrite = z.infer<typeof stageWriteSchema>;

/**
 * An audited stage write's `before` when the write created the tracker row (review G2
 * N1): what the job's application package was just before, so the undo that removes
 * the row never reverts a package the user had already marked applied on the board.
 * Older audit rows recorded plain null for a created row; the undoer still reads those.
 */
export const createdBeforeSchema = z
  .object({ absent: z.literal(true), packageStatus: z.enum(["none", "prepared", "applied"]) })
  .strict();
export type CreatedBefore = z.infer<typeof createdBeforeSchema>;

const stageTargetSchema = z.object({ jobId: z.string().regex(JOB_ID_RE) }).strict();
const noteTargetSchema = z.object({ jobId: z.string().regex(JOB_ID_RE), eventId: z.number().int().positive() }).strict();
const noteAfterSchema = z.object({ eventId: z.number().int().positive(), note: z.string().min(1).max(NOTE_MAX * 2) }).strict();

const appRowSchema = z.object({ id: z.string(), stage: z.enum(STAGES), closed_reason: z.enum(CLOSED_REASONS).nullable() });
type LiveApp = { id: string; write: StageWrite };

function sameWrite(a: StageWrite, b: StageWrite): boolean {
  return a.stage === b.stage && a.closedReason === b.closedReason;
}

function parseStageInput(stage: unknown, closedReason: unknown): StageWrite {
  const parsed = stageWriteSchema.safeParse({ stage, closedReason: closedReason ?? null });
  if (!parsed.success) throw new ApplicationInputError("That stage or reason is not allowed here.");
  return parsed.data;
}

function checkCommon(userId: string, a: { jobId: string; actor: string; audit?: AuditCtx }): void {
  if (typeof a.jobId !== "string" || !JOB_ID_RE.test(a.jobId)) throw new ApplicationInputError("Unknown job.");
  if (a.actor !== "user" && a.actor !== "agent") throw new ApplicationInputError("Unknown writer.");
  if (a.audit && a.audit.userId !== userId) throw new ApplicationInputError("Audit context is another user's.");
  if (a.audit?.unattended) throw new ApplicationInputError("An unattended run may not change the tracker.");
}

/** The status of the caller's application package for the job, "none" when there is no package row. */
async function packageStatusTx(tx: TransactionSql, userId: string, jobId: string): Promise<CreatedBefore["packageStatus"]> {
  const rows = await tx`SELECT status FROM application_packages WHERE user_id = ${userId}::uuid AND job_id = ${jobId}`;
  if (rows.length === 0) return "none";
  const r = parseOrNull(z.object({ status: z.enum(["prepared", "applied"]) }), rows[0]);
  if (!r) throw new Error("applications: stored package status failed the parse");
  return r.status;
}

/** The caller's application for the job, locked for the rest of the transaction when `lock`. */
async function readAppTx(tx: TransactionSql, userId: string, jobId: string, lock: boolean): Promise<LiveApp | null> {
  const rows = lock
    ? await tx`SELECT id, stage, closed_reason FROM applications WHERE user_id = ${userId}::uuid AND job_id = ${jobId} FOR UPDATE`
    : await tx`SELECT id, stage, closed_reason FROM applications WHERE user_id = ${userId}::uuid AND job_id = ${jobId}`;
  if (rows.length === 0) return null;
  const r = parseOrNull(appRowSchema, rows[0]);
  if (!r) throw new Error("applications: stored row failed the parse");
  const write = stageWriteSchema.safeParse({ stage: r.stage, closedReason: r.closed_reason });
  if (!write.success) throw new Error("applications: stored row failed the parse");
  return { id: r.id, write: write.data };
}

async function insertStageEventTx(
  tx: TransactionSql,
  userId: string,
  applicationId: string,
  from: Stage | null,
  to: Stage,
  actor: "user" | "agent",
): Promise<void> {
  await tx`
    INSERT INTO application_events (user_id, application_id, kind, from_stage, to_stage, actor)
    VALUES (${userId}::uuid, ${applicationId}::uuid, 'stage', ${from}, ${to}, ${actor})`;
}

/**
 * The caller's application id for the job, creating it at `stage` (with its first stage
 * event) when absent. Throws NotReviewedError for a job the caller has no review of.
 */
export async function ensureApplication(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  stage: Stage,
  actor: "user" | "agent" = "user",
): Promise<string> {
  const existing = await readAppTx(tx, userId, jobId, true);
  if (existing) return existing.id;
  return (await createAppTx(tx, userId, jobId, parseStageInput(stage, null), actor)).id;
}

async function createAppTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  w: StageWrite,
  actor: "user" | "agent",
): Promise<{ id: string }> {
  if (!(await hasReviewTx(tx, userId, jobId))) throw new NotReviewedError();
  const rows = await tx`
    INSERT INTO applications (user_id, job_id, stage, closed_reason)
    VALUES (${userId}::uuid, ${jobId}, ${w.stage}, ${w.closedReason})
    RETURNING id`;
  const id = parseOrNull(z.object({ id: z.string() }), rows[0]);
  if (!id) throw new Error("applications: insert returned no id");
  await insertStageEventTx(tx, userId, id.id, null, w.stage, actor);
  return id;
}

/**
 * The one stage write core, shared by setApplicationStage and the undoer: creates or
 * moves the row and appends one stage event, or does nothing when the row already has
 * this stage and reason.
 */
async function writeStageTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  w: StageWrite,
  actor: "user" | "agent",
): Promise<{ before: StageWrite | null; changed: boolean }> {
  const existing = await readAppTx(tx, userId, jobId, true);
  if (!existing) {
    await createAppTx(tx, userId, jobId, w, actor);
    return { before: null, changed: true };
  }
  if (sameWrite(existing.write, w)) return { before: existing.write, changed: false };
  await tx`
    UPDATE applications SET stage = ${w.stage}, closed_reason = ${w.closedReason}, updated_at = now()
    WHERE id = ${existing.id}::uuid AND user_id = ${userId}::uuid`;
  await insertStageEventTx(tx, userId, existing.id, existing.write.stage, w.stage, actor);
  return { before: existing.write, changed: true };
}

/**
 * The board's Mark applied, mirrored into the tracker (run as markAppliedCore's `also`,
 * inside the same transaction). A reviewed job that is untracked, preparing or ready
 * moves to applied with one stage event by the user; interviewing, offer and closed are
 * left alone, and an unreviewed job (the board may mark one) gets no row. No audit row:
 * this is the user's own write.
 */
export async function trackAppliedTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
  if (!(await hasReviewTx(tx, userId, jobId))) return;
  const live = await readAppTx(tx, userId, jobId, true);
  if (live && !PRE_APPLY.has(live.write.stage)) return;
  await writeStageTx(tx, userId, jobId, { stage: "applied", closedReason: null }, "user");
}

/**
 * The board's Unmark, mirrored into the tracker (run as unmarkAppliedCore's `also`): a
 * row at exactly applied moves back to ready with one stage event by the user; any other
 * row, or none, is left alone. No audit row.
 */
export async function untrackAppliedTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
  const live = await readAppTx(tx, userId, jobId, true);
  if (!live || live.write.stage !== "applied") return;
  await writeStageTx(tx, userId, jobId, { stage: "ready", closedReason: null }, "user");
}

/**
 * Moves one job on the caller's tracker (adding it when absent). A move to "applied"
 * marks the job's application package applied in the same transaction (creating the
 * board's content-less marker when there is none); a move from applied-or-later back to
 * preparing or ready unmarks it. Throws ApplicationInputError before any SQL for a
 * malformed request and NotReviewedError for an unreviewed job.
 */
export async function setApplicationStage(
  userId: string,
  a: { jobId: string; stage: Stage; closedReason?: ClosedReason; actor: "user" | "agent"; audit?: AuditCtx },
): Promise<{ actionId: number | null }> {
  checkCommon(userId, a);
  const w = parseStageInput(a.stage, a.closedReason);
  const audit = a.audit;

  // Read-only pre-check: the current stage picks the transaction, and an untracked,
  // unreviewed job is refused before anything (including a payload request) happens.
  // The package's status is read here, before markAppliedCore can change it, so a
  // created row's audit `before` records what the user's package was (review G2 N1).
  const pre = await withUserSql(userId, async (tx) => ({
    app: await readAppTx(tx, userId, a.jobId, false),
    reviewed: await hasReviewTx(tx, userId, a.jobId),
    packageStatus: await packageStatusTx(tx, userId, a.jobId),
  }));
  if (!pre.app && !pre.reviewed) throw new NotReviewedError();

  let actionId: number | null = null;
  const also = async (tx: TransactionSql): Promise<void> => {
    const { before, changed } = await writeStageTx(tx, userId, a.jobId, w, a.actor);
    if (!audit || !changed) return;
    const created: CreatedBefore = { absent: true, packageStatus: pre.packageStatus };
    actionId = await logAction(tx, {
      ctx: audit,
      actor: a.actor === "user" ? "user_via_surface" : actorFor(audit),
      kind: "application.set_stage",
      targetKey: { jobId: a.jobId },
      before: before ?? created,
      after: w,
    });
  };
  if (w.stage === "applied") await markAppliedCore(userId, a.jobId, also);
  else if (PRE_APPLY.has(w.stage) && pre.app && APPLIED_OR_LATER.has(pre.app.write.stage)) {
    await unmarkAppliedCore(userId, a.jobId, also);
  } else await withUserMutation(userId, also);
  return { actionId };
}

/** Counts characters as Postgres char_length does (code points), so an emoji is one. */
function charLength(text: string): number {
  return Array.from(text).length;
}

/**
 * Adds a note to the job's history (adding the job to the tracker at preparing when
 * absent). Throws ApplicationInputError before any SQL for an empty note or one over
 * 2000 characters.
 */
export async function addApplicationNote(
  userId: string,
  a: { jobId: string; note: string; actor: "user" | "agent"; audit?: AuditCtx },
): Promise<{ eventId: number; actionId: number | null }> {
  checkCommon(userId, a);
  const note = typeof a.note === "string" ? a.note.trim() : "";
  if (note === "") throw new ApplicationInputError("A note cannot be empty.");
  if (charLength(note) > NOTE_MAX) throw new ApplicationInputError(`A note can be at most ${NOTE_MAX} characters.`);
  const audit = a.audit;
  return withUserMutation(userId, async (tx) => {
    const applicationId = await ensureApplication(tx, userId, a.jobId, "preparing", a.actor);
    const rows = await tx`
      INSERT INTO application_events (user_id, application_id, kind, note, actor)
      VALUES (${userId}::uuid, ${applicationId}::uuid, 'note', ${note}, ${a.actor})
      RETURNING id`;
    const id = parseOrNull(z.object({ id: z.coerce.number().int().positive() }), rows[0]);
    if (!id) throw new Error("applications: note insert returned no id");
    const actionId = audit
      ? await logAction(tx, {
          ctx: audit,
          actor: a.actor === "user" ? "user_via_surface" : actorFor(audit),
          kind: "application.add_note",
          targetKey: { jobId: a.jobId, eventId: id.id },
          before: null,
          after: { eventId: id.id, note },
        })
      : null;
    return { eventId: id.id, actionId };
  });
}

function validDate(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Sets or clears the date of the next step for a job on the caller's tracker. */
export async function setNextStep(userId: string, jobId: string, date: string | null): Promise<void> {
  if (typeof jobId !== "string" || !JOB_ID_RE.test(jobId)) throw new ApplicationInputError("Unknown job.");
  if (date !== null && (typeof date !== "string" || !validDate(date))) throw new ApplicationInputError("That is not a date.");
  const rows = await withUserMutation(userId, (tx) => tx`
    UPDATE applications SET next_step_on = ${date}::date, updated_at = now()
    WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
    RETURNING id`);
  if (rows.length === 0) throw new NotTrackedError();
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Each of the caller's tracked jobs mapped to its stage (the shortlist shows it per row). */
export async function listTrackedStages(userId: string): Promise<Record<string, Stage>> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT job_id, stage FROM applications WHERE user_id = ${userId}::uuid`);
  const out: Record<string, Stage> = {};
  for (const raw of rows) {
    const r = parseOrNull(z.object({ job_id: z.string(), stage: z.enum(STAGES) }), raw);
    if (r) out[r.job_id] = r.stage;
  }
  return out;
}

const listRowSchema = jobFactsRowSchema.extend({
  id: z.string(),
  stage: z.enum(STAGES),
  closed_reason: z.enum(CLOSED_REASONS).nullable(),
  next_step_on: z.string().regex(DATE_RE).nullable(),
  updated_at: z.coerce.date(),
  has_resume: z.boolean(),
  has_cover: z.boolean(),
  package_profile_version: z.string().nullable(),
  current_profile_version: z.string().nullable(),
});

const eventRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  application_id: z.string(),
  kind: z.enum(["stage", "note"]),
  from_stage: z.enum(STAGES).nullable(),
  to_stage: z.enum(STAGES).nullable(),
  note: z.string().nullable(),
  actor: z.enum(["user", "agent"]),
  created_at: z.coerce.date(),
});

function toEvent(raw: unknown): (ApplicationEvent & { applicationId: string }) | null {
  const r = parseOrNull(eventRowSchema, raw);
  if (!r || Number.isNaN(r.created_at.getTime())) return null;
  return {
    id: r.id,
    applicationId: r.application_id,
    kind: r.kind,
    fromStage: r.from_stage,
    toStage: r.to_stage,
    note: r.note,
    actor: r.actor,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * The caller's tracked applications, optionally of some stages only, most recently
 * changed first, each with its history oldest first. Agent notes whose add_note action
 * was undone are left out.
 */
export async function listApplications(userId: string, stages?: Stage[]): Promise<ApplicationRow[]> {
  const filter = stages === undefined ? null : stages.filter((s) => (STAGES as readonly string[]).includes(s));
  const { rows, events } = await withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT a.id, a.stage, a.closed_reason, a.next_step_on::text AS next_step_on, a.updated_at,
             j.id AS j_id, j.title AS j_title, COALESCE(c.display_name, c.name) AS j_company,
             j.location AS j_location, j.remote AS j_remote, j.url AS j_url, j.first_seen_at AS j_first_seen_at,
             (public.lifecycle_source_closed(j.id, j.closed_at)) IS TRUE AS j_closed,
             COALESCE(jsonb_typeof(p.resume_json) = 'object', false) AS has_resume,
             COALESCE(jsonb_typeof(p.cover_letter_json) = 'object', false) AS has_cover,
             p.profile_version AS package_profile_version,
             pr.profile_version AS current_profile_version
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
      LEFT JOIN application_packages p ON p.user_id = a.user_id AND p.job_id = a.job_id
      LEFT JOIN profiles pr ON pr.user_id = a.user_id
      WHERE a.user_id = ${userId}::uuid
        AND (${filter}::text[] IS NULL OR a.stage = ANY(${filter}::text[]))
      ORDER BY a.updated_at DESC, a.id`;
    const ids = rows.map((r) => String(r.id));
    const events = ids.length === 0 ? [] : await tx`
      SELECT e.id, e.application_id, e.kind, e.from_stage, e.to_stage, e.note, e.actor, e.created_at
      FROM application_events e
      WHERE e.user_id = ${userId}::uuid AND e.application_id = ANY(${ids}::uuid[])
        AND NOT (e.kind = 'note' AND e.actor = 'agent' AND EXISTS (
          SELECT 1 FROM agent_actions aa
          WHERE aa.user_id = e.user_id AND aa.kind = 'application.add_note'
            AND aa.undone_at IS NOT NULL AND aa.after ->> 'eventId' = e.id::text))
      ORDER BY e.created_at, e.id`;
    return { rows, events };
  });
  const byApp = new Map<string, ApplicationEvent[]>();
  for (const raw of events) {
    const e = toEvent(raw);
    if (!e) continue;
    const { applicationId, ...event } = e;
    const list = byApp.get(applicationId) ?? [];
    list.push(event);
    byApp.set(applicationId, list);
  }
  const clock = await catalogNow();
  const out: ApplicationRow[] = [];
  for (const raw of rows) {
    const r = parseOrNull(listRowSchema, raw);
    if (!r || Number.isNaN(r.updated_at.getTime())) continue;
    const job = toJobFacts(r, clock.now);
    if (!job) continue;
    out.push({
      id: r.id,
      jobId: r.j_id,
      stage: r.stage,
      closedReason: r.closed_reason,
      nextStepOn: r.next_step_on,
      updatedAt: r.updated_at.toISOString(),
      job,
      events: byApp.get(r.id) ?? [],
      documents: {
        resume: r.has_resume,
        cover: r.has_cover,
        outdated: isResumeStale({
          hasResume: r.has_resume,
          packageProfileVersion: r.package_profile_version,
          currentProfileVersion: r.current_profile_version,
        }),
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/** The application.set_stage undoer (see the module header). */
export async function undoApplicationSetStage(tx: TransactionSql, action: StoredAction, userId: string): Promise<UndoOutcome> {
  const target = stageTargetSchema.safeParse(action.targetKey);
  const after = stageWriteSchema.safeParse(action.after);
  const before = z.union([stageWriteSchema, createdBeforeSchema, z.null()]).safeParse(action.before);
  if (!target.success || !after.success || !before.success) return "invalid";
  const jobId = target.data.jobId;
  const live = await readAppTx(tx, userId, jobId, true);
  if (!live || !sameWrite(live.write, after.data)) return "changed_since";
  if (before.data === null || "absent" in before.data) {
    // The action created the row. Remove it only while its first stage event is all it
    // holds; a note or another move since means the user has built on it.
    const counted = await tx`SELECT count(*) AS n FROM application_events WHERE application_id = ${live.id}::uuid AND user_id = ${userId}::uuid`;
    const n = parseOrNull(z.object({ n: z.coerce.number().int() }), counted[0]);
    if (!n || n.n > 1) return "changed_since";
    await tx`DELETE FROM applications WHERE id = ${live.id}::uuid AND user_id = ${userId}::uuid`;
    // A package the user had already marked applied on the board stays applied: the
    // agent's move did not make it so. Older rows (plain null) keep the earlier rule.
    const packageWasApplied = before.data !== null && before.data.packageStatus === "applied";
    if (APPLIED_OR_LATER.has(after.data.stage) && !packageWasApplied) await unmarkAppliedTx(tx, userId, jobId);
    return "restored";
  }
  await writeStageTx(tx, userId, jobId, before.data, "user");
  if (PRE_APPLY.has(before.data.stage) && APPLIED_OR_LATER.has(after.data.stage)) await unmarkAppliedTx(tx, userId, jobId);
  else if (APPLIED_OR_LATER.has(before.data.stage) && !APPLIED_OR_LATER.has(after.data.stage)) {
    await remarkAppliedTx(tx, userId, jobId);
  }
  return "restored";
}

/** The application.add_note undoer (see the module header). Writes nothing itself. */
export async function undoApplicationAddNote(tx: TransactionSql, action: StoredAction, userId: string): Promise<UndoOutcome> {
  const target = noteTargetSchema.safeParse(action.targetKey);
  const after = noteAfterSchema.safeParse(action.after);
  if (!target.success || !after.success || target.data.eventId !== after.data.eventId) return "invalid";
  const rows = await tx`
    SELECT e.note, e.actor, a.job_id
    FROM application_events e
    JOIN applications a ON a.id = e.application_id
    WHERE e.id = ${target.data.eventId} AND e.user_id = ${userId}::uuid AND e.kind = 'note'`;
  if (rows.length === 0) return "changed_since";
  const r = parseOrNull(z.object({ note: z.string(), actor: z.enum(["user", "agent"]), job_id: z.string() }), rows[0]);
  // Only the agent's own note, on the job the action names, with the text it wrote.
  if (!r || r.actor !== "agent" || r.job_id !== target.data.jobId || r.note !== after.data.note) return "invalid";
  return "restored";
}

registerUndoer("application.set_stage", undoApplicationSetStage);
registerUndoer("application.add_note", undoApplicationAddNote);
