import postgres, { type TransactionSql } from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase transaction-mode pooler (PgBouncer/Supavisor) does NOT support prepared
// statements — `prepare: false` is required (PRD §9).
//
// `max: 3` caps connections per serverless instance. The /analytics page fans out
// ~29 queries at once; with the default pool (max 10) a single render requested more
// pooled connections than the transaction pooler would grant simultaneously, so some
// connection requests hung and the render timed out (300s Vercel limit) without any
// statement ever running. A small pool is the correct serverless pattern: each
// instance holds few connections and the queries cycle through them (each is <120ms),
// while cross-instance concurrency is handled by the pooler. `idle_timeout` releases
// connections between requests so frozen serverless instances don't hold pooler slots.
//
// ─────────────────────────────────────────────────────────────────────────────
// TENANT-ISOLATION TRUST MODEL (spec 2026-07-03 subsystem B — read before using)
//
// This pool connects as the privileged `postgres` role, which OWNS the tables and
// therefore BYPASSES row-level security. That is correct for BACKEND paths that
// legitimately operate across all users, but it is NOT safe for user-facing reads:
// a stray missing `user_id` predicate would silently expose another tenant's data.
//
// So the export is deliberately named `serviceSql`, not `sql`: every remaining
// privileged call site is now a conscious, greppable choice. User-facing dashboard
// reads/writes must instead go through `withUserSql`/`withAnonSql`, which drop the
// transaction into the non-owner `authenticated`/`anon` Postgres role so the T1 RLS
// policies apply. The identity that drives the Postgres role is the SAME locally
// verified JWT `sub` from lib/auth.ts getClaims() — so this is the user's own JWT
// enforcing their own row access, not an ambient trusted operator.
//
// serviceSql is the ALLOWLISTED escape hatch. Its only legitimate importers are:
//   - this module,
//   - lib/invites.ts (pre-auth signup redemption — before a session/JWT exists),
//   - lib/subscriptions.ts internals + app/api/stripe/webhook (Stripe posts with no
//     user session; it is the sole writer of the subscriptions mirror).
// That set is enforced in CI by lib/serviceRoleAllowlist.test.ts — adding an import
// requires updating that allowlist with a justification, which forces review.
// See dashboard/CLAUDE.md for the surrounding data-boundary guidance.
// ─────────────────────────────────────────────────────────────────────────────
export const serviceSql = postgres(connectionString, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  max_lifetime: 300,
  connect_timeout: 5,
  connection: {
    application_name: "job-board-dashboard",
    statement_timeout: 15_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 15_000,
  },
});

/**
 * Run `fn` inside a transaction dropped into the `authenticated` Postgres role and
 * scoped to `userId`, so RLS policies (T1) enforce per-user access even if a query
 * forgets its user_id predicate. The first statement sets request.jwt.claims (which
 * public.app_user_id() reads) AND the `role` GUC — both transaction-LOCAL (the third
 * set_config arg is `true`), so nothing persists on the pooled connection after the
 * transaction ends. `userId` is bound as a parameter inside a JSON.stringify'd
 * object (never string-concatenated). A postgres.js exception in `fn` rolls the
 * transaction back.
 */
export async function withUserSql<T>(
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  if (!userId) {
    // Fail loud rather than silently run privileged/anon — a falsy userId here is a bug.
    throw new Error("withUserSql requires a non-empty userId");
  }
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return (await serviceSql.begin(async (tx) => {
    await tx`SELECT set_config('request.jwt.claims', ${claims}, true),
                    set_config('role', 'authenticated', true)`;
    return fn(tx);
  })) as T;
}

/**
 * Run `fn` inside a transaction dropped into the `anon` Postgres role (empty
 * claims). For anon-reachable reads (the public board, anonymous job-open). Only the
 * shared-read RLS policies grant rows; owner tables return zero rows. Same
 * transaction-local config discipline as withUserSql.
 */
export async function withAnonSql<T>(
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return (await serviceSql.begin(async (tx) => {
    await tx`SELECT set_config('request.jwt.claims', '', true),
                    set_config('role', 'anon', true)`;
    return fn(tx);
  })) as T;
}
