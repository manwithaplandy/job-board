// The résumé source of truth and its earlier versions (plan Task 1.11; the agent's
// set_resume tool in Task 1.14 writes through setResumeFromDocument with an audit context).
//
// Every replacement runs in one withUserMutation transaction (profiles is behind the
// lifecycle gate): lock the profile, keep the text it displaces as the next
// resume_versions row (owner SELECT and INSERT only, so history is never rewritten),
// then write the new text through updateResumeSourceWith, the writer the profile pages
// use, so profile_version moves with it. The archived PDF path is left as it is. The
// new text passes the same length check as a résumé saved on the profile page.
//
// resume_versions.source says what displaced the text: "upload" (the user's "Use as
// résumé"), "agent" (set_resume) or "restore" (a Restore or an undo).
//
// Undo of profile.set_resume (registered below) restores only while the live résumé
// still hashes to what the action wrote; it puts the displaced version back through the
// same replacement core, so the agent's text is itself kept as a version.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserMutation, withUserSql } from "@/lib/db";
import { resumeTextError } from "@/lib/profileInputLimits";
import { updateResumeSourceWith } from "@/lib/profileSettings";
import { parseOrNull } from "@/lib/zodParse";
import { actorFor, logAction, registerUndoer, type AuditCtx, type StoredAction, type UndoOutcome } from "@/lib/agent/actions/audit";

export type ResumeVersionSource = "upload" | "agent" | "restore";
export interface ResumeVersion {
  version: number;
  source: ResumeVersionSource;
  documentId: string | null;
  text: string;
  createdAt: string;
}

/** A refused replacement (no readable text, too long, no such document or version, an unattended run). */
export class ResumeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeInputError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSIONS_LIMIT = 50;

const versionRowSchema = z.object({
  version: z.coerce.number().int().nonnegative(),
  resume_text: z.string(),
  source: z.enum(["upload", "agent", "restore"]),
  document_id: z.string().nullable(),
  created_at: z.coerce.date(),
});
const targetSchema = z.object({ documentId: z.string().regex(UUID_RE) }).strict();
const beforeSchema = z.object({ version: z.number().int().positive().nullable() }).strict();
const afterSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict();

export function resumeHash(text: string | null): string {
  return createHash("sha256").update(text ?? "", "utf8").digest("hex");
}

type LockedProfile = { resumeText: string | null; resumeFilePath: string | null };

async function lockProfileTx(tx: TransactionSql, userId: string): Promise<LockedProfile> {
  const rows = await tx`SELECT resume_text, resume_file_path FROM profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const r = parseOrNull(z.object({ resume_text: z.string().nullable(), resume_file_path: z.string().nullable() }), rows[0]);
  if (!r) throw new ResumeInputError("Set up your profile before choosing a résumé.");
  return { resumeText: r.resume_text, resumeFilePath: r.resume_file_path };
}

/**
 * The one replacement core: keeps the live text as the next version (when there is
 * one and it differs), then writes `text` as the résumé. Returns whether anything
 * changed and the displaced version's number (null when nothing was displaced). When
 * the live text already equals `text` it writes nothing and returns changed: false, so
 * callers can skip the audit row (an undo of a no-op must never clear the résumé).
 * Runs inside the caller's lifecycle-gated transaction.
 */
async function replaceResumeTx(
  tx: TransactionSql,
  userId: string,
  text: string | null,
  source: ResumeVersionSource,
  documentId: string | null,
): Promise<{ changed: boolean; displaced: number | null }> {
  const live = await lockProfileTx(tx, userId);
  if (live.resumeText === text) return { changed: false, displaced: null };
  let displaced: number | null = null;
  if (live.resumeText !== null && live.resumeText.trim() !== "") {
    const rows = await tx`
      INSERT INTO resume_versions (user_id, version, resume_text, source, document_id)
      SELECT ${userId}::uuid, COALESCE(MAX(version), 0) + 1, ${live.resumeText}, ${source}, ${documentId}::uuid
      FROM resume_versions WHERE user_id = ${userId}::uuid
      RETURNING version`;
    const v = parseOrNull(z.object({ version: z.coerce.number().int().positive() }), rows[0]);
    if (!v) throw new Error("resume: the new version failed the parse");
    displaced = v.version;
  }
  await updateResumeSourceWith(tx, userId, { resumeText: text, resumeFilePath: live.resumeFilePath });
  return { changed: true, displaced };
}

function checkText(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") throw new ResumeInputError("That file had no readable text, so it cannot be your résumé.");
  const tooLong = resumeTextError(trimmed);
  if (tooLong) throw new ResumeInputError(tooLong);
  return trimmed;
}

/**
 * Makes one of the caller's uploaded documents the résumé source of truth. Refuses a
 * document whose extraction is not ok. With `audit` (the agent's set_resume), logs
 * profile.set_resume with the displaced version and a hash of the text written.
 */
export async function setResumeFromDocument(
  userId: string,
  a: { documentId: string; actor: "user" | "agent"; audit?: AuditCtx },
): Promise<{ displacedVersion: number | null; actionId: number | null }> {
  if (typeof a.documentId !== "string" || !UUID_RE.test(a.documentId)) throw new ResumeInputError("No such document.");
  if (a.actor !== "user" && a.actor !== "agent") throw new ResumeInputError("Unknown writer.");
  if (a.audit && a.audit.userId !== userId) throw new ResumeInputError("Audit context is another user's.");
  if (a.audit?.unattended) throw new ResumeInputError("An unattended run may not replace the résumé.");
  return withUserMutation(userId, async (tx) => {
    const rows = await tx`
      SELECT extraction, extracted_text FROM documents
      WHERE id = ${a.documentId}::uuid AND user_id = ${userId}::uuid`;
    const doc = parseOrNull(z.object({ extraction: z.enum(["ok", "empty", "failed"]), extracted_text: z.string().nullable() }), rows[0]);
    if (!doc) throw new ResumeInputError("No such document.");
    if (doc.extraction !== "ok" || doc.extracted_text === null) {
      throw new ResumeInputError("That file had no readable text, so it cannot be your résumé.");
    }
    const text = checkText(doc.extracted_text);
    const { changed, displaced: displacedVersion } = await replaceResumeTx(
      tx, userId, text, a.actor === "user" ? "upload" : "agent", a.documentId,
    );
    let actionId: number | null = null;
    // Nothing changed (the résumé already is this text): no audit row, so there is
    // nothing to undo. An undo of such a row would restore before.version = null.
    if (a.audit && changed) {
      actionId = await logAction(tx, {
        ctx: a.audit,
        actor: a.actor === "user" ? "user_via_surface" : actorFor(a.audit),
        kind: "profile.set_resume",
        targetKey: { documentId: a.documentId },
        before: { version: displacedVersion },
        after: { sha256: resumeHash(text) },
      });
    }
    return { displacedVersion, actionId };
  });
}

/** Puts an earlier version back as the résumé, keeping the text it displaces as a new version. */
export async function restoreResumeVersion(userId: string, version: number): Promise<{ displacedVersion: number | null }> {
  if (!Number.isSafeInteger(version) || version <= 0) throw new ResumeInputError("No such version.");
  return withUserMutation(userId, async (tx) => {
    const text = await versionTextTx(tx, userId, version);
    if (text === null) throw new ResumeInputError("No such version.");
    return { displacedVersion: (await replaceResumeTx(tx, userId, checkText(text), "restore", null)).displaced };
  });
}

async function versionTextTx(tx: TransactionSql, userId: string, version: number): Promise<string | null> {
  const rows = await tx`SELECT resume_text FROM resume_versions WHERE user_id = ${userId}::uuid AND version = ${version}`;
  return parseOrNull(z.object({ resume_text: z.string() }), rows[0])?.resume_text ?? null;
}

/** The caller's earlier résumés, newest first (at most 50). */
export async function listResumeVersions(userId: string): Promise<ResumeVersion[]> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT version, resume_text, source, document_id, created_at FROM resume_versions
    WHERE user_id = ${userId}::uuid
    ORDER BY version DESC
    LIMIT ${VERSIONS_LIMIT}`);
  const out: ResumeVersion[] = [];
  for (const raw of rows) {
    const r = parseOrNull(versionRowSchema, raw);
    if (!r || Number.isNaN(r.created_at.getTime())) continue;
    out.push({ version: r.version, source: r.source, documentId: r.document_id, text: r.resume_text, createdAt: r.created_at.toISOString() });
  }
  return out;
}

/** The profile.set_resume undoer (see the module header). */
export async function undoProfileSetResume(tx: TransactionSql, action: StoredAction, userId: string): Promise<UndoOutcome> {
  const target = targetSchema.safeParse(action.targetKey);
  const before = beforeSchema.safeParse(action.before);
  const after = afterSchema.safeParse(action.after);
  if (!target.success || !before.success || !after.success) return "invalid";
  const live = await lockProfileTx(tx, userId);
  if (resumeHash(live.resumeText) !== after.data.sha256) return "changed_since";
  let text: string | null = null;
  if (before.data.version !== null) {
    text = await versionTextTx(tx, userId, before.data.version);
    if (text === null) return "invalid";
  }
  await replaceResumeTx(tx, userId, text, "restore", null);
  return "restored";
}

registerUndoer("profile.set_resume", undoProfileSetResume);
