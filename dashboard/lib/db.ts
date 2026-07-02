import postgres from "postgres";

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
export const sql = postgres(connectionString, {
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
