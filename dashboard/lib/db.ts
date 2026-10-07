import { acquireLifecycleGate } from "@/lib/jobLifecycle";
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

/** Explicit mutating wrapper; read-only transactions retain their existing path. */
export async function withUserMutation<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return withUserSql(userId, async (tx) => {
    await acquireLifecycleGate(tx);
    return fn(tx);
  });
}

export type PayloadScope = "job_reviews" | "review_corrections" | "application_packages" |
  "generation_jobs" | "resume_scores" | "cover_letter_edits";

/** Service capability setup only; all application DML runs as authenticated.
 * One exact job/scope/backend/transaction reservation, checked by existing guards.
 * The callback must do database work only. Caller supplies a verified auth user ID.
 */
export async function withUserPayloadMutation<T>(
  userId: string, jobId: string, scope: PayloadScope,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  if (!userId || !jobId) throw new Error("Owner and job required");
  return (await serviceSql.begin(async (tx) => {
    await acquireLifecycleGate(tx);
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'lifecycle:job:' + jobId}, 0))`;
    const controls = await tx`SELECT safety_stage FROM lifecycle_control WHERE singleton`;
    let reservation: string | null = null;
    if (controls[0]?.safety_stage === "enforced") {
      // Worst case includes a 10 MiB input snapshot and generated output; the
      // trigger measures actual writes and refuses any underestimate.
      const bytes = 96 * 1024 * 1024;
      const claim = await tx`INSERT INTO lifecycle_claims(kind,work_id,owner_token,lease_until,invoking_role)
        VALUES ('dashboard',gen_random_uuid()::text,gen_random_uuid()::text,
          clock_timestamp()+interval '180 seconds',current_user)
        RETURNING work_id,owner_token,generation`;
      const row = claim[0];
      if (!row) throw new Error("Payload claim unavailable");
      const reservations = await tx`INSERT INTO capacity_reservations
        (claim_kind,claim_id,owner_token,generation,bytes,backend_pid,transaction_id,job_id,scope,subject_id,invoking_role)
        VALUES ('dashboard',${row.work_id},${row.owner_token},${row.generation},${bytes},
          pg_backend_pid(),pg_current_xact_id(),${jobId},${scope},${userId}::uuid,'authenticated') RETURNING id`;
      reservation = typeof reservations[0]?.id === "string" ? reservations[0].id : null;
      if (!reservation) throw new Error("Payload reservation unavailable");
      await tx`SELECT set_config('lifecycle.reservation',${reservation},true)`;
    }
    await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),
      set_config('role','authenticated',true)`;
    const result = await fn(tx);
    if (reservation) {
      // Restore only to settle service-owned capability metadata, never user DML.
      await tx`SELECT set_config('role','none',true),set_config('request.jwt.claims','',true)`;
      await tx`UPDATE capacity_reservations SET state='settled',terminal_at=clock_timestamp(),
        measured_database_bytes=pg_database_size(current_database()) WHERE id=${reservation}::uuid`;
    }
    return result;
  })) as T;
}

/** Read the existing sticky compatibility control, then enqueue/read as owner.
 * Mirrors lifecycle.config.legacy_description_capture_allowed; no shared DML.
 */
export async function withUserDemandSql<T>(
  userId:string, fn:(tx:TransactionSql,legacyAllowed:boolean)=>Promise<T>,
):Promise<T> {
  if(!userId) throw new Error("Owner required");
  return (await serviceSql.begin(async tx=>{
    await acquireLifecycleGate(tx);
    const rows=await tx`SELECT NOT (c.source_enabled OR c.hydration_enabled OR c.maintenance_enabled
      OR c.safety_stage='enforced' OR c.archive_ever_activated OR m.cutover_at IS NOT NULL) AS legacy_allowed
      FROM lifecycle_control c CROSS JOIN lifecycle_maintenance_state m WHERE c.singleton AND m.singleton`;
    const legacyAllowed=rows[0]?.legacy_allowed===true;
    await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),set_config('role','authenticated',true)`;
    return fn(tx,legacyAllowed);
  })) as T;
}
