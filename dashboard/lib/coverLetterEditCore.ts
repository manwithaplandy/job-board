// The cover letter edit overlay's write core (plan Task 1.15), lifted out of the
// saveCoverLetterEdit server action so the agent's update_document_draft tool and its
// undoer write the same row the same way.
//
// cover_letter_edits holds one row per user and job: the user's edited text over the
// generated letter (application_packages.cover_letter_json), which is never changed
// here. writeCoverLetterEditTx reads the replay context (the package, job, review and
// profile) and upserts the row, reviving a superseded edit; it reports the text the row
// held before (null when there was no row or it was superseded). saveCoverLetterEditCore
// runs it in a payload mutation transaction, with an optional `also` in the same
// transaction (the agent's audit row). The server action keeps the golden dataset push;
// agent edits are not pushed.
//
// The document.update_draft undoer (registered below) re-reads the live row and
// restores only while it still holds the agent's text: it writes the previous text back
// through writeCoverLetterEditTx, or deletes the row when there was none. Neither the
// agent's edit nor its undo passes a comment, so the user's comment on their edit is
// kept throughout. It runs in
// undoAction's lifecycle-gated transaction, which takes no payload reservation, so under
// an enforced lifecycle stage the row's trigger may refuse the restore; the whole undo
// then rolls back and nothing changes.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserPayloadMutation } from "@/lib/db";
import { readPrivateSnapshot } from "@/lib/jobLifecycle";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import { parseOrNull } from "@/lib/zodParse";
import { registerUndoer, type StoredAction, type UndoOutcome } from "@/lib/agent/actions/audit";

export const EDITED_TEXT_MAX_LENGTH = 20_000;

/** The edit is refused: empty or too long text, no generated letter for the job. */
export class CoverLetterEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverLetterEditError";
  }
}

const stringList = z.array(z.string()).catch([]);
const sourceRowSchema = z.object({
  cover_letter_json: z.unknown(),
  cover_letter_trace_id: z.string().nullable().catch(null),
  cover_letter_instructions: z.string().nullable().catch(null),
  title: z.string(),
  company_name: z.string(),
  description: z.string().nullable().catch(null),
  about: z.string().nullable().catch(null),
  requirements: z.array(z.object({ text: z.string(), met: z.boolean() })).catch([]),
  skill_gaps: stringList,
  red_flags: stringList,
  resume_text: z.string().nullable().catch(null),
  full_name: z.string().nullable().catch(null),
  model_cover: z.string().nullable().catch(null),
  previous_edited_text: z.string().nullable().optional(),
  previous_superseded: z.boolean().nullable().optional(),
});

export interface CoverLetterEditSource {
  coverLetterTraceId: string | null;
  coverLetterInstructions: string | null;
  title: string;
  companyName: string;
  description: string | null;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skillGaps: string[];
  redFlags: string[];
  resumeText: string | null;
  fullName: string | null;
  modelCover: string | null;
  /** The composed text of the generated letter, null when the stored letter does not parse. */
  originalText: string | null;
  /** The edit the row held before this write; null when there was none or it was superseded. */
  previousText: string | null;
}

function checkText(editedText: string): string {
  const text = typeof editedText === "string" ? editedText.trim() : "";
  if (!text) throw new CoverLetterEditError("edited cover letter must not be empty");
  if (text.length > EDITED_TEXT_MAX_LENGTH) {
    throw new CoverLetterEditError(`edited cover letter too long (max ${EDITED_TEXT_MAX_LENGTH} characters)`);
  }
  return text;
}

/**
 * Reads the replay context and upserts the overlay row inside the caller's transaction.
 * With `requireGenerated`, refuses when the stored letter does not parse.
 */
export async function writeCoverLetterEditTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  text: string,
  opts: { comment?: string | null; requireGenerated?: boolean } = {},
): Promise<CoverLetterEditSource> {
  const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
  const rows = await tx`
    SELECT ap.cover_letter_json, ap.cover_letter_trace_id, ap.cover_letter_instructions,
           j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
           r.about,
           COALESCE(r.requirements, '[]'::jsonb) AS requirements,
           COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
           COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
           p.resume_text, p.full_name, p.model_cover,
           e.edited_text AS previous_edited_text, (e.superseded_at IS NOT NULL) AS previous_superseded
    FROM application_packages ap
    JOIN jobs j       ON j.id = ap.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN job_reviews r ON r.job_id = ap.job_id AND r.user_id = ${userId}::uuid
    LEFT JOIN profiles p    ON p.user_id = ${userId}::uuid
    LEFT JOIN cover_letter_edits e ON e.user_id = ap.user_id AND e.job_id = ap.job_id
    WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
  `;
  const s = rows?.[0] === undefined ? null : parseOrNull(sourceRowSchema, rows[0]);
  if (!s) throw new CoverLetterEditError(`no cover letter generated for job ${jobId}`);

  // The eval "before": composed text of the stored structured letter. A malformed
  // jsonb (total parser returns null) degrades to null, never a crash.
  const parsed = parseTailoredCoverLetter(s.cover_letter_json);
  const originalText = parsed ? composeCoverLetterText(parsed) : null;
  if (opts.requireGenerated && originalText === null) {
    throw new CoverLetterEditError(`no cover letter generated for job ${jobId}`);
  }

  // Re-saving overwrites (last-write-wins) and REVIVES a superseded edit
  // (superseded_at back to NULL) — the fresh edit is current again. A caller that passes
  // no comment (the agent's edit, its undo) leaves the stored comment as it is; the user's
  // save passes its comment (null clears it).
  const keepComment = opts.comment === undefined;
  await tx`
    INSERT INTO cover_letter_edits
      (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, edited_text, original_text, cover_letter_trace_id,
       model, comment, superseded_at, edited_at)
    VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
      ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${text}, ${originalText}, ${s.cover_letter_trace_id},
            ${s.model_cover}, ${opts.comment ?? null}, NULL, now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      edited_text = EXCLUDED.edited_text, original_text = EXCLUDED.original_text,
      cover_letter_trace_id = EXCLUDED.cover_letter_trace_id, model = EXCLUDED.model,
      comment = CASE WHEN ${keepComment}::boolean THEN cover_letter_edits.comment ELSE EXCLUDED.comment END,
      superseded_at = NULL, edited_at = now()
  `;
  const previousText =
    typeof s.previous_edited_text === "string" && s.previous_superseded !== true ? s.previous_edited_text : null;
  return {
    coverLetterTraceId: s.cover_letter_trace_id,
    coverLetterInstructions: s.cover_letter_instructions,
    title: s.title,
    companyName: s.company_name,
    description: snapshot ? snapshot.description : s.description,
    about: s.about,
    requirements: s.requirements,
    skillGaps: s.skill_gaps,
    redFlags: s.red_flags,
    resumeText: s.resume_text,
    fullName: s.full_name,
    modelCover: s.model_cover,
    originalText,
    previousText,
  };
}

/**
 * Saves the caller's edit of the generated letter for `jobId` in one payload mutation
 * transaction, then runs `also` (given the source, previous text included) in the same
 * transaction.
 */
export async function saveCoverLetterEditCore(
  userId: string,
  jobId: string,
  editedText: string,
  opts: {
    comment?: string | null;
    requireGenerated?: boolean;
    also?: (tx: TransactionSql, src: CoverLetterEditSource, text: string) => Promise<void>;
  } = {},
): Promise<{ text: string; src: CoverLetterEditSource }> {
  const text = checkText(editedText);
  const src = await withUserPayloadMutation(userId, jobId, "cover_letter_edits", async (tx) => {
    const out = await writeCoverLetterEditTx(tx, userId, jobId, text, opts);
    if (opts.also) await opts.also(tx, out, text);
    return out;
  });
  return { text, src };
}

/** Drops the caller's overlay row for the job, inside the caller's transaction. */
export async function deleteCoverLetterEditTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
  await tx`DELETE FROM cover_letter_edits WHERE user_id = ${userId}::uuid AND job_id = ${jobId}`;
}

// ---------------------------------------------------------------------------
// Undo of document.update_draft
// ---------------------------------------------------------------------------

export const draftTargetSchema = z.object({ jobId: z.string().regex(JOB_ID_RE) }).strict();
const draftTextSchema = z.string().min(1).max(EDITED_TEXT_MAX_LENGTH);

/** The document.update_draft undoer (see the module header). */
export async function undoDocumentUpdateDraft(tx: TransactionSql, action: StoredAction, userId: string): Promise<UndoOutcome> {
  const target = draftTargetSchema.safeParse(action.targetKey);
  const after = draftTextSchema.safeParse(action.after);
  const before = draftTextSchema.nullable().safeParse(action.before);
  if (!target.success || !after.success || !before.success) return "invalid";
  const jobId = target.data.jobId;
  const rows = await tx`
    SELECT edited_text, superseded_at FROM cover_letter_edits
    WHERE user_id = ${userId}::uuid AND job_id = ${jobId} FOR UPDATE`;
  const live = parseOrNull(z.object({ edited_text: z.string(), superseded_at: z.unknown() }), rows[0]);
  if (!live || live.superseded_at !== null || live.edited_text !== after.data) return "changed_since";
  if (before.data === null) await deleteCoverLetterEditTx(tx, userId, jobId);
  else await writeCoverLetterEditTx(tx, userId, jobId, before.data);
  return "restored";
}

registerUndoer("document.update_draft", undoDocumentUpdateDraft);
