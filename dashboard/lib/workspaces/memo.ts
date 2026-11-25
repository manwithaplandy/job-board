// The versioned search memo (plan Task 1.7): "What I'm looking for", its version
// history, and the agent's proposals, which change nothing until the user approves one.
//
// Every path that creates a version (save, approve, restore) runs in one
// withUserMutation transaction (profiles is behind the lifecycle gate): bump
// search_memos, insert search_memo_versions, and write compileMemo(doc) to
// profiles.instructions with profile_version recomputed by profileVersion(), through
// updateReviewPreferencesWith, the same writer the settings page uses. afterMemoChange
// runs after that transaction commits and enqueues the scoped re-review (Task 1.9);
// it never fails the memo write.
//
// There is no path from a proposal to a version except resolveMemoProposal with
// decision "approve", and a proposal made against an older memo version can never be
// approved.
//
// No section is ever cut off the reviewer's instructions: every write refuses a doc
// whose compiled text would run over the 6,000-character cap (MemoInputError with code
// memo_too_long and how far over). Saving the doc that is already current changes
// nothing. The first version-creating save for a user whose old free-text instructions
// were too long for "Anything else" keeps the full old text as history row version 0
// (doc {legacyInstructions}, which the memo parse never accepts, so it is never listed
// or restored as a memo).
//
// All of these paths run in withUserMutation, whose acquireLifecycleGate takes one
// global advisory lock, so memo writes are serialized; the row locks below keep the
// reads honest within each transaction.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserMutation, withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { updateReviewPreferencesWith } from "@/lib/profileSettings";
import { COMPILED_MEMO_MAX, compiledMemoOverflow, compileMemo } from "@/lib/workspaces/memoCompile";
import {
  emptyMemoDoc, MEMO_RATIONALE_MAX, MEMO_SECTION_MAX, MEMO_SECTIONS, MemoDocSchema,
} from "@/lib/workspaces/memoSchema";
import { enqueueScopedReview, reviewScopeForMemoChange } from "@/lib/workspaces/reviewScope";
import type { MemoDoc, MemoProposal, MemoVersion } from "@/lib/workspaces/types";

export type MemoInputErrorCode = "invalid" | "memo_too_long";

/**
 * A malformed memo or proposal (a section over 2,000 characters, an unknown key), or,
 * with code memo_too_long, a memo whose compiled text would run `over` characters past
 * the 6,000 cap.
 */
export class MemoInputError extends Error {
  constructor(
    message: string,
    readonly code: MemoInputErrorCode = "invalid",
    readonly over: number | null = null,
  ) {
    super(message);
    this.name = "MemoInputError";
  }
}

/** The caller has no profile row to compile the memo into, or no such version. */
export class MemoNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoNotFoundError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSIONS_LIMIT = 100;

/**
 * Runs after a new memo version has committed (save, approve, restore): enqueues one
 * scoped re-review of the shortlist and the newest reviewed jobs (Task 1.9). It never
 * throws: the version is already saved, so a failed enqueue is logged and the memo
 * write still succeeds (the reviewer's regular runs pick up the changed profile).
 */
export async function afterMemoChange(userId: string): Promise<void> {
  try {
    // "already_active": a pending request re-reads the profile when it runs, so it
    // already reviews against this version; a running one is queued again by the
    // reviewer worker when it finishes, because the profile_version it reviewed at is
    // no longer current. "empty": nothing to re-review.
    await enqueueScopedReview(userId, await reviewScopeForMemoChange(userId));
  } catch (e) {
    console.error("memo: could not enqueue the scoped re-review", e instanceof Error ? e.message : String(e));
  }
}

/** Refuses a doc whose compiled text would run over the cap (nothing would be cut). */
function assertFits(doc: MemoDoc): void {
  const over = compiledMemoOverflow(doc);
  if (over > 0) {
    throw new MemoInputError(
      `That memo is ${over} characters too long once its sections are put together ` +
        `(the limit is ${COMPILED_MEMO_MAX.toLocaleString("en-US")}).`,
      "memo_too_long",
      over,
    );
  }
}

function parseDoc(raw: unknown): MemoDoc {
  const doc = MemoDocSchema.safeParse(raw);
  if (!doc.success) throw new MemoInputError("That memo is not valid.");
  assertFits(doc.data);
  return doc.data;
}

function sameDoc(a: MemoDoc, b: MemoDoc): boolean {
  return MEMO_SECTIONS.every(({ key }) => a[key] === b[key]);
}

/** The first `max` UTF-16 units of `text`, never ending on half of a surrogate pair. */
function cutUnits(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** Old free-text instructions too long for "Anything else" (compared trimmed, in UTF-16 units). */
function legacyTooLong(instructions: string | null | undefined): boolean {
  return (instructions?.trim().length ?? 0) > MEMO_SECTION_MAX;
}

const versionNumber = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

// version and base_version are bigint (strings from postgres.js); timestamps arrive as Date.
const memoRowSchema = z.object({ version: versionNumber, doc: z.unknown() });
const proposalRowSchema = z.object({
  id: z.string(),
  base_version: versionNumber,
  proposed_doc: z.unknown(),
  rationale: z.string().nullable(),
  status: z.enum(["pending", "approved", "declined", "superseded"]),
  source: z.enum(["interactive", "background"]),
  created_at: z.coerce.date(),
});
const versionRowSchema = z.object({
  version: versionNumber,
  doc: z.unknown(),
  changed_by: z.enum(["user", "proposal", "restore"]),
  created_at: z.coerce.date(),
});

function toProposal(raw: unknown): MemoProposal | null {
  const r = parseOrNull(proposalRowSchema, raw);
  if (!r || Number.isNaN(r.created_at.getTime())) return null;
  const doc = parseOrNull(MemoDocSchema, r.proposed_doc);
  if (!doc) return null;
  return {
    id: r.id,
    baseVersion: r.base_version,
    proposedDoc: doc,
    rationale: r.rationale ?? "",
    status: r.status,
    source: r.source,
    createdAt: r.created_at.toISOString(),
  };
}

export type MemoRead = {
  version: number;
  doc: MemoDoc;
  pending: MemoProposal[];
  /**
   * Present only with no memo yet and old instructions longer than "Anything else"
   * holds: the doc carries their first 2,000 characters, `legacyLength` is the full
   * (trimmed) length, and the UI should say so before the first save. That save keeps
   * the full old text as history version 0.
   */
  legacyTruncated?: true;
  legacyLength?: number;
};

/**
 * The caller's memo and its pending proposals. With no memo yet: version 0 with the
 * old free-text instructions in "Anything else" (cut to 2,000 UTF-16 units, flagged
 * legacyTruncated) when there are any, else null. A stored doc that no longer parses
 * reads as an empty doc at its stored version, so the next save still moves the
 * version on.
 */
export async function getMemo(userId: string): Promise<MemoRead | null> {
  const [memoRows, proposalRows, profileRows] = await withUserSql(userId, async (tx) => [
    await tx`SELECT version, doc FROM search_memos WHERE user_id = ${userId}::uuid`,
    await tx`
      SELECT id, base_version, proposed_doc, rationale, status, source, created_at
      FROM search_memo_proposals
      WHERE user_id = ${userId}::uuid AND status = 'pending'
      ORDER BY created_at DESC, id`,
    await tx`SELECT instructions FROM profiles WHERE user_id = ${userId}::uuid`,
  ]);
  const pending: MemoProposal[] = [];
  for (const raw of proposalRows) {
    const p = toProposal(raw);
    if (p) pending.push(p);
  }
  const memo = parseOrNull(memoRowSchema, memoRows[0]);
  if (memo) {
    const doc = parseOrNull(MemoDocSchema, memo.doc);
    if (!doc) console.warn("memo: stored doc failed the parse; read as empty");
    return { version: memo.version, doc: doc ?? emptyMemoDoc(), pending };
  }
  const instructions = parseOrNull(z.object({ instructions: z.string().nullable() }), profileRows[0])?.instructions;
  const trimmed = instructions?.trim();
  if (!trimmed) return pending.length > 0 ? { version: 0, doc: emptyMemoDoc(), pending } : null;
  const doc = { ...emptyMemoDoc(), other: cutUnits(trimmed, MEMO_SECTION_MAX) };
  if (!legacyTooLong(trimmed)) return { version: 0, doc, pending };
  return { version: 0, doc, pending, legacyTruncated: true, legacyLength: trimmed.length };
}

/** The caller's current memo version and doc under a row lock (version 0, doc null, when there is no memo). */
async function lockedMemoTx(tx: TransactionSql, userId: string): Promise<{ version: number; doc: MemoDoc | null }> {
  const rows = await tx`SELECT version, doc FROM search_memos WHERE user_id = ${userId}::uuid FOR UPDATE`;
  if (rows.length === 0) return { version: 0, doc: null };
  const m = parseOrNull(memoRowSchema, rows[0]);
  if (!m) throw new Error("memo: stored version failed the parse");
  return { version: m.version, doc: parseOrNull(MemoDocSchema, m.doc) };
}

/**
 * The one version-creating core: version n+1 in search_memos and its history row, and
 * the compiled memo in profiles.instructions with profile_version recomputed. Refuses a
 * doc over the compiled cap before any write. When the doc equals the current one and
 * profiles.instructions already holds its compiled text, writes nothing and returns
 * the current version with changed false. The first version for a user whose old
 * instructions were too long for "Anything else" also stores them whole as version 0.
 */
async function writeVersionTx(
  tx: TransactionSql,
  userId: string,
  doc: MemoDoc,
  changedBy: "user" | "proposal" | "restore",
  proposalId: string | null,
): Promise<{ version: number; changed: boolean }> {
  assertFits(doc);
  const profile = await tx`SELECT instructions FROM profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
  if (profile.length === 0) throw new MemoNotFoundError("Set up your profile before saving what you are looking for.");
  const instructions = parseOrNull(z.object({ instructions: z.string().nullable() }), profile[0])?.instructions ?? null;
  const current = await lockedMemoTx(tx, userId);
  const compiled = compileMemo(doc);
  if (current.version > 0 && current.doc !== null && sameDoc(current.doc, doc) && (instructions ?? "") === compiled) {
    return { version: current.version, changed: false };
  }
  if (current.version === 0 && legacyTooLong(instructions)) {
    await tx`
      INSERT INTO search_memo_versions (user_id, version, doc, changed_by, proposal_id)
      VALUES (${userId}::uuid, ${0}, ${JSON.stringify({ legacyInstructions: instructions })}::text::jsonb, ${"user"}, NULL)
      ON CONFLICT (user_id, version) DO NOTHING`;
  }
  const version = current.version + 1;
  const docJson = JSON.stringify(doc);
  await tx`
    INSERT INTO search_memos (user_id, version, doc, updated_at)
    VALUES (${userId}::uuid, ${version}, ${docJson}::text::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET version = EXCLUDED.version, doc = EXCLUDED.doc, updated_at = now()`;
  await tx`
    INSERT INTO search_memo_versions (user_id, version, doc, changed_by, proposal_id)
    VALUES (${userId}::uuid, ${version}, ${docJson}::text::jsonb, ${changedBy}, ${proposalId}::uuid)`;
  await updateReviewPreferencesWith(tx, userId, compiled === "" ? null : compiled);
  return { version, changed: true };
}

/**
 * Saves the memo as a new version by the user (or a restore) and returns its number;
 * the current number, with nothing written, when the doc equals the current one.
 */
export async function saveMemo(userId: string, doc: MemoDoc, changedBy: "user" | "restore"): Promise<number> {
  if (changedBy !== "user" && changedBy !== "restore") throw new MemoInputError("Unknown writer.");
  const valid = parseDoc(doc);
  const out = await withUserMutation(userId, (tx) => writeVersionTx(tx, userId, valid, changedBy, null));
  if (out.changed) await afterMemoChange(userId);
  return out.version;
}

/**
 * Records a proposed memo against the current version. Older pending proposals become
 * superseded. Nothing about the memo itself changes.
 */
export async function createMemoProposal(
  userId: string,
  a: { proposedDoc: MemoDoc; rationale: string; source: "interactive" | "background" },
): Promise<MemoProposal> {
  const doc = parseDoc(a.proposedDoc);
  const rationale = a.rationale.trim();
  if (rationale.length > MEMO_RATIONALE_MAX) throw new MemoInputError("The rationale is too long.");
  if (a.source !== "interactive" && a.source !== "background") throw new MemoInputError("Unknown source.");
  const rows = await withUserSql(userId, async (tx) => {
    const memo = await tx`SELECT version FROM search_memos WHERE user_id = ${userId}::uuid`;
    const base = memo.length === 0 ? 0 : parseOrNull(z.object({ version: versionNumber }), memo[0])?.version;
    if (base === undefined) throw new Error("memo: stored version failed the parse");
    await tx`
      UPDATE search_memo_proposals SET status = 'superseded', resolved_at = now()
      WHERE user_id = ${userId}::uuid AND status = 'pending'`;
    return tx`
      INSERT INTO search_memo_proposals (user_id, base_version, proposed_doc, rationale, source)
      VALUES (${userId}::uuid, ${base}, ${JSON.stringify(doc)}::text::jsonb, ${rationale}, ${a.source})
      RETURNING id, base_version, proposed_doc, rationale, status, source, created_at`;
  });
  const proposal = toProposal(rows[0]);
  if (!proposal) throw new Error("memo: the new proposal failed the parse");
  return proposal;
}

/**
 * Approves or declines one of the caller's pending proposals. Approve writes a new
 * version (the edited doc when given, else the proposal's) and returns its number, or
 * the current number when that doc equals the current one; it throws MemoInputError
 * (memo_too_long) and leaves the proposal pending when the doc is over the cap;
 * decline changes only the proposal's status and returns the current version. Null
 * when the proposal is unknown, not pending, or was made against an older version (it
 * is then marked superseded and nothing else changes).
 */
export async function resolveMemoProposal(
  userId: string,
  id: string,
  decision: "approve" | "decline",
  editedDoc?: MemoDoc,
): Promise<{ version: number } | null> {
  if (!UUID_RE.test(id)) return null;
  if (decision !== "approve" && decision !== "decline") throw new MemoInputError("Unknown decision.");
  const edited = editedDoc === undefined ? null : parseDoc(editedDoc);
  const result = await withUserMutation(userId, async (tx): Promise<{ version: number; changed: boolean } | null> => {
    const rows = await tx`
      SELECT id, base_version, proposed_doc, rationale, status, source, created_at
      FROM search_memo_proposals
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      FOR UPDATE`;
    const proposal = parseOrNull(proposalRowSchema, rows[0]);
    if (!proposal || proposal.status !== "pending") return null;
    const current = (await lockedMemoTx(tx, userId)).version;
    if (decision === "decline") {
      await tx`
        UPDATE search_memo_proposals SET status = 'declined', resolved_at = now()
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
      return { version: current, changed: false };
    }
    if (proposal.base_version !== current) {
      await tx`
        UPDATE search_memo_proposals SET status = 'superseded', resolved_at = now()
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
      return null;
    }
    const doc = edited ?? parseOrNull(MemoDocSchema, proposal.proposed_doc);
    if (!doc) return null;
    const out = await writeVersionTx(tx, userId, doc, "proposal", id);
    await tx`
      UPDATE search_memo_proposals SET status = 'approved', resolved_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
    return out;
  });
  if (!result) return null;
  if (result.changed) await afterMemoChange(userId);
  return { version: result.version };
}

/** The caller's memo versions, newest first (rows whose doc no longer parses are skipped). */
export async function listMemoVersions(userId: string): Promise<MemoVersion[]> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT version, doc, changed_by, created_at FROM search_memo_versions
    WHERE user_id = ${userId}::uuid
    ORDER BY version DESC
    LIMIT ${VERSIONS_LIMIT}`);
  const out: MemoVersion[] = [];
  for (const raw of rows) {
    const r = parseOrNull(versionRowSchema, raw);
    const doc = r ? parseOrNull(MemoDocSchema, r.doc) : null;
    if (!r || !doc || Number.isNaN(r.created_at.getTime())) continue;
    out.push({ version: r.version, doc, changedBy: r.changed_by, createdAt: r.created_at.toISOString() });
  }
  return out;
}

/** Restores an earlier version as a new version (history is never rewritten). */
export async function restoreMemoVersion(userId: string, version: number): Promise<number> {
  if (!Number.isSafeInteger(version) || version < 0) throw new MemoNotFoundError("No such version.");
  const next = await withUserMutation(userId, async (tx) => {
    const rows = await tx`
      SELECT doc FROM search_memo_versions WHERE user_id = ${userId}::uuid AND version = ${version}`;
    const doc = parseOrNull(MemoDocSchema, parseOrNull(z.object({ doc: z.unknown() }), rows[0])?.doc);
    if (!doc) throw new MemoNotFoundError("No such version.");
    return writeVersionTx(tx, userId, doc, "restore", null);
  });
  if (next.changed) await afterMemoChange(userId);
  return next.version;
}
