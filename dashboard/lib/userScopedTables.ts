// The canonical classification of every user-scoped table (T2 export ↔ T3 deletion).
// user_id is deliberately NOT foreign-keyed to auth.users, so both "export everything
// we hold on a user" and "delete everything we hold on a user" are EXPLICIT lists, not
// an FK cascade. This ONE module is the single source both features + the CI drift-guard
// read, so export and deletion can never silently diverge: a new user-scoped table that
// isn't classified here breaks lib/accountDeletion.test.ts's schema drift-guard.
//
// Classification rules:
//   DELETE    — rows are erased on account deletion (and exported first).
//   ANONYMIZE — rows are KEPT but their user_id is set NULL (accounting/history that
//               must survive the user, e.g. review_runs pipeline stats).
//   EXCLUDED  — a user_id column that is NOT personal data of the account (none today);
//               each entry needs a written justification.

/** Tables whose rows are erased on deletion (and included in the export). */
export const USER_DELETE_TABLES = [
  "profiles",
  "job_reviews",
  "review_corrections",
  "company_reviews",
  // Per-company manual include/exclude (replaces company_reviews.human_override).
  "company_overrides",
  "application_packages",
  "resume_scores",
  // Cover-letter edit overlay (owner data; the golden push is a separate LangFuse copy).
  "cover_letter_edits",
  "usage_counters",
  "subscriptions",
  "review_requests",
  "invite_redemptions",
  // Async-generation status rows (transient; most are pruned within a day anyway).
  "generation_jobs",
  // Per-user invite budget (user-sent invites). The codes a user MINTED are handled
  // separately in accountDeletion.ts (anonymized, never deleted).
  "invite_allowances",
  // Operator-pinned effective tier. Deleting the row with the account is correct:
  // a pin for an erased user is meaningless, and absence is the well-defined state.
  "plan_overrides",
] as const;

/** Tables whose rows are kept but de-identified (user_id → NULL) on deletion. */
export const USER_ANONYMIZE_TABLES = ["review_runs"] as const;

/**
 * user_id columns that are intentionally neither deleted nor anonymized. Each key MUST
 * carry a justification.
 */
export const USER_EXCLUDED_TABLES: Record<string, string> = {
  // The erasure ledger itself: its user_id IS the retained proof that this account was
  // deleted (paired with a hash of the email, never plaintext). Deleting or anonymizing
  // it would destroy the very record deletion creates.
  account_deletions:
    "erasure-proof ledger — user_id is retained deliberately as deletion evidence",
};

export type UserScopedTable =
  | (typeof USER_DELETE_TABLES)[number]
  | (typeof USER_ANONYMIZE_TABLES)[number];

/** Every classified table name (delete ∪ anonymize ∪ excluded). */
export const ALL_CLASSIFIED_TABLES: ReadonlySet<string> = new Set<string>([
  ...USER_DELETE_TABLES,
  ...USER_ANONYMIZE_TABLES,
  ...Object.keys(USER_EXCLUDED_TABLES),
]);
