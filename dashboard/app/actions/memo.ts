"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/safeError";
import { assertNotDeleted } from "@/lib/tombstone";
import {
  MemoInputError,
  MemoNotFoundError,
  resolveMemoProposal,
  restoreMemoVersion,
  saveMemo,
} from "@/lib/workspaces/memo";
import type { MemoDoc } from "@/lib/workspaces/types";

// The "What I'm looking for" page's actions (plan Task 1.8). The user always comes from
// the session. A refusal the user can act on (too long, unknown version, an outdated
// proposal) comes back as its message, because a thrown server-action error reaches the
// browser only as a generic digest in production. Locations and company filters are not
// written here: their existing actions on the job-preferences page stay their writers.

export type MemoActionResult = { ok: true; version: number } | { ok: false; message: string };

const PAGE = "/looking-for";
const GENERIC = "That change could not be saved. Try again.";

async function session(): Promise<string> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  return userId;
}

async function attempt(context: string, work: () => Promise<number | null>, missing: string): Promise<MemoActionResult> {
  let version: number | null;
  try {
    version = await work();
  } catch (error) {
    if (error instanceof MemoInputError || error instanceof MemoNotFoundError) return { ok: false, message: error.message };
    return { ok: false, message: safeErrorMessage(context, error, GENERIC) };
  }
  if (version === null) return { ok: false, message: missing };
  revalidatePath(PAGE);
  return { ok: true, version };
}

/** Saves the memo as the user's new version (nothing changes when it equals the current one). */
export async function saveMemoAction(doc: MemoDoc): Promise<MemoActionResult> {
  const userId = await session();
  return attempt("memo.save", () => saveMemo(userId, doc, "user"), GENERIC);
}

/** Approves (optionally with the user's edits) or declines one of the user's pending proposals. */
export async function resolveProposalAction(
  id: string,
  decision: "approve" | "decline",
  editedDoc?: MemoDoc,
): Promise<MemoActionResult> {
  const userId = await session();
  return attempt(
    "memo.resolve",
    async () => {
      const out =
        editedDoc === undefined
          ? await resolveMemoProposal(userId, id, decision)
          : await resolveMemoProposal(userId, id, decision, editedDoc);
      return out?.version ?? null;
    },
    "This proposal is no longer open. It may be out of date or already handled.",
  );
}

/** Restores an earlier version as a new version. */
export async function restoreMemoAction(version: number): Promise<MemoActionResult> {
  const userId = await session();
  return attempt("memo.restore", () => restoreMemoVersion(userId, version), GENERIC);
}
