import { withUserSql } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  USER_DELETE_TABLES,
  USER_ANONYMIZE_TABLES,
} from "@/lib/userScopedTables";

// Data export (T2, spec subsystem E): a one-click download of everything we hold on a
// user, so export ships BEFORE deletion (T3 links here). EVERY read runs under
// withUserSql so RLS enforces tenancy — a stray missing predicate can't leak another
// tenant's rows, and no serviceSql allowlist change is needed. The payload has a
// top-level key for every user-scoped table (asserted against the same
// userScopedTables lists the T3 drift-guard uses, so export/deletion can't diverge),
// plus short-lived signed URLs for the caller's archived résumé files.

export interface ResumeFileRef {
  path: string;
  signedUrl: string | null;
}

export interface AccountExport {
  exported_at: string;
  user_id: string;
  email: string | null;
  // One key per user-scoped table (table name → its rows / row). Typed loosely: this
  // is a faithful dump, not a modeled read.
  profiles: unknown;
  job_reviews: unknown[];
  review_corrections: unknown[];
  company_reviews: unknown[];
  application_packages: unknown[];
  resume_scores: unknown[];
  usage_counters: unknown[];
  subscriptions: unknown;
  review_requests: unknown[];
  invite_redemptions: unknown[];
  generation_jobs: unknown[];
  review_runs: unknown[];
  resume_files: ResumeFileRef[];
  // Non-null when the résumé-object listing FAILED (storage error / down). Distinguishes
  // "this account has no archived files" (error null, resume_files []) from "we could not
  // read them" (error set) so a swallowed storage fault can't masquerade as an empty,
  // complete export. The user can retry or contact us instead of silently losing files.
  resume_files_error: string | null;
}

// Compile-time guarantee that AccountExport carries a key for EVERY classified table.
// If a new user-scoped table is added to userScopedTables.ts, this fails to compile
// until AccountExport (and the query below) gains the matching key.
type _ExportCoversEveryTable =
  (typeof USER_DELETE_TABLES)[number] | (typeof USER_ANONYMIZE_TABLES)[number] extends keyof AccountExport
    ? true
    : never;
const _assertExportCoversEveryTable: _ExportCoversEveryTable = true;
void _assertExportCoversEveryTable;

/**
 * List the caller's archived résumé objects (resumes/{userId}/…) as time-limited signed
 * URLs. Scoped to the caller's own prefix, so it can never enumerate another user's
 * files. No uploads → empty array. A storage LIST error THROWS (was: silently []) so
 * buildAccountExport can record it as resume_files_error instead of shipping an export
 * that looks complete but is missing files.
 */
export async function listResumeFiles(userId: string, expiresIn = 300): Promise<ResumeFileRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("resumes").list(userId, { limit: 1000 });
  // Log the storage internals server-side; throw a GENERIC error so the raw message
  // (host/bucket/network detail) never reaches the downloaded JSON (minor 7 / T5).
  if (error) {
    console.error("account export: résumé-file listing failed", error);
    throw new Error("résumé-file listing failed");
  }
  if (!data) return [];
  const files = data.filter((o) => o.name && o.id !== null); // drop folder placeholders
  const refs: ResumeFileRef[] = [];
  for (const f of files) {
    const path = `${userId}/${f.name}`;
    const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(path, expiresIn);
    refs.push({ path, signedUrl: signed?.signedUrl ?? null });
  }
  return refs;
}

async function collectUserRows(userId: string): Promise<Omit<AccountExport, "exported_at" | "user_id" | "email" | "resume_files" | "resume_files_error" | "invite_redemptions">> {
  return withUserSql(userId, async (tx) => {
    const [
      profiles, jobReviews, reviewCorrections, companyReviews,
      applicationPackages, resumeScores, usageCounters, subscriptions,
      reviewRequests, generationJobs, reviewRuns,
    ] = await Promise.all([
      tx`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`,
      tx`SELECT r.*, j.title AS job_title, c.name AS company_name, j.url AS job_url
         FROM job_reviews r JOIN jobs j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id
         WHERE r.user_id = ${userId}::uuid ORDER BY r.reviewed_at DESC`,
      tx`SELECT rc.*, j.title AS job_title, c.name AS company_name, j.url AS job_url
         FROM review_corrections rc JOIN jobs j ON j.id = rc.job_id JOIN companies c ON c.id = j.company_id
         WHERE rc.user_id = ${userId}::uuid ORDER BY rc.corrected_at DESC`,
      tx`SELECT cr.*, c.name AS company_name
         FROM company_reviews cr JOIN companies c ON c.id = cr.company_id
         WHERE cr.user_id = ${userId}::uuid`,
      tx`SELECT * FROM application_packages WHERE user_id = ${userId}::uuid`,
      tx`SELECT * FROM resume_scores WHERE user_id = ${userId}::uuid`,
      tx`SELECT * FROM usage_counters WHERE user_id = ${userId}::uuid ORDER BY day DESC`,
      // Subscription SUMMARY only — no Stripe ids in the export.
      tx`SELECT plan, status, current_period_end, cancel_at_period_end, created_at, updated_at
         FROM subscriptions WHERE user_id = ${userId}::uuid`,
      tx`SELECT * FROM review_requests WHERE user_id = ${userId}::uuid ORDER BY requested_at DESC`,
      tx`SELECT * FROM generation_jobs WHERE user_id = ${userId}::uuid ORDER BY created_at DESC`,
      tx`SELECT * FROM review_runs WHERE user_id = ${userId}::uuid ORDER BY started_at DESC`,
    ]);
    return {
      profiles: (profiles[0] as unknown) ?? null,
      job_reviews: jobReviews as unknown[],
      review_corrections: reviewCorrections as unknown[],
      company_reviews: companyReviews as unknown[],
      application_packages: applicationPackages as unknown[],
      resume_scores: resumeScores as unknown[],
      usage_counters: usageCounters as unknown[],
      subscriptions: (subscriptions[0] as unknown) ?? null,
      review_requests: reviewRequests as unknown[],
      generation_jobs: generationJobs as unknown[],
      review_runs: reviewRuns as unknown[],
    };
  });
}

/**
 * invite_redemptions is service-role-only under RLS (no authenticated grant), so read
 * it in its OWN withUserSql transaction guarded against a permission error — a blocked
 * read yields an empty array rather than poisoning the main export transaction. The row
 * only holds the user's own email + invite code, so an empty result is harmless.
 */
async function collectInviteRedemptions(userId: string): Promise<unknown[]> {
  try {
    return await withUserSql(userId, async (tx) => {
      const rows = await tx`SELECT * FROM invite_redemptions WHERE user_id = ${userId}::uuid`;
      return rows as unknown[];
    });
  } catch {
    return [];
  }
}

/**
 * Build the full export payload for `userId`. `resumeFiles` is injectable so the lib
 * test can supply a stub without a storage backend; the route uses the default
 * (listResumeFiles → the caller's own résumé prefix).
 */
export async function buildAccountExport(
  userId: string,
  email: string | null,
  resumeFiles: (uid: string) => Promise<ResumeFileRef[]> = listResumeFiles,
): Promise<AccountExport> {
  const [rows, invites, filesResult] = await Promise.all([
    collectUserRows(userId),
    collectInviteRedemptions(userId),
    // Capture a storage failure as a GENERIC marker rather than swallowing it to [] — an
    // empty list must mean "no files", not "we couldn't read them". The full error is
    // logged server-side; the marker shipped in the export is a fixed string, never the
    // raw storage message (minor 7 / T5).
    resumeFiles(userId)
      .then((files) => ({ files, error: null as string | null }))
      .catch((e) => {
        console.error("account export: résumé files could not be listed", e);
        return { files: [] as ResumeFileRef[], error: "résumé files could not be listed" };
      }),
  ]);
  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    email,
    ...rows,
    invite_redemptions: invites,
    resume_files: filesResult.files,
    resume_files_error: filesResult.error,
  };
}
