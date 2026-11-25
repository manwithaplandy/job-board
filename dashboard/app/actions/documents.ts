"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/safeError";
import { assertNotDeleted } from "@/lib/tombstone";
import { deleteDocument } from "@/lib/workspaces/documents";
import { ResumeInputError, restoreResumeVersion, setResumeFromDocument } from "@/lib/workspaces/resumeVersions";

// The documents page's actions (plan Task 1.11). The user always comes from the session
// and every write is the user's own. A refusal the user can act on comes back as its
// message (a thrown server-action error reaches the browser only as a digest).

export type DocumentActionResult = { ok: true } | { ok: false; message: string };

// The pages that show the résumé source of truth.
const RESUME_PATHS = ["/documents", "/profile", "/profile/resume", "/"] as const;
const GENERIC = "That change could not be saved. Try again.";

async function session(): Promise<string> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  return userId;
}

async function attempt(context: string, work: () => Promise<unknown>, paths: readonly string[]): Promise<DocumentActionResult> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ResumeInputError) return { ok: false, message: error.message };
    return { ok: false, message: safeErrorMessage(context, error, GENERIC) };
  }
  for (const path of paths) revalidatePath(path);
  return { ok: true };
}

/** Deletes one of the user's uploads (its Storage object, then its row). */
export async function deleteDocumentAction(id: string): Promise<DocumentActionResult> {
  const userId = await session();
  return attempt("documents.delete", () => deleteDocument(userId, id), ["/documents"]);
}

/** Makes an upload's text the résumé; the page asks for confirmation first. The current résumé is kept as a version. */
export async function useAsResumeAction(documentId: string): Promise<DocumentActionResult> {
  const userId = await session();
  return attempt("documents.use-as-resume", () => setResumeFromDocument(userId, { documentId, actor: "user" }), RESUME_PATHS);
}

/** Puts an earlier résumé back; the current one is kept as a version. */
export async function restoreResumeVersionAction(version: number): Promise<DocumentActionResult> {
  const userId = await session();
  return attempt("documents.restore-resume", () => restoreResumeVersion(userId, version), RESUME_PATHS);
}
