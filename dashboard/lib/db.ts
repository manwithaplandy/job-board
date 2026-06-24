import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase transaction-mode pooler (PgBouncer) does NOT support prepared
// statements — `prepare: false` is required (PRD §9).
export const sql = postgres(connectionString, { prepare: false });
