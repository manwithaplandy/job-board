// The catalog clock (spec section 9, plan Task 0.9). While discovery is frozen
// (lifecycle_control.source_enabled = false) the newest data is treated as current:
// "now" is max(jobs.last_seen_at), so age labels and "new" badges never claim a
// freshness the catalog does not have. Every age label and "new" badge goes through
// here; it is the one switch to remove once discovery runs again.
//
// Reader: lifecycle_control is readable by `authenticated` only (no anon grant), and
// this value is global, not per user, so it is read through withUserSql under a fixed
// nil-uuid subject. That subject owns no rows; the two tables read here are shared
// (lifecycle_control USING (true), jobs shared_read). No service role.
//
// Cost: max(last_seen_at) has no known index ([Unverified]); the 600 s cache bounds it.
// Only the database read is cached, never the wall clock.
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";

export type CatalogClock = { now: Date; frozen: boolean };

const CATALOG_READER_ID = "00000000-0000-0000-0000-000000000000";
const DAY_MS = 86_400_000;
const NEW_FOR_MS = 2 * DAY_MS;

const clockRowSchema = z.object({
  source_enabled: z.boolean(),
  newest: z.coerce.date().nullable(),
});

// unstable_cache serializes to JSON, so the cached value carries an ISO string, not a Date.
type CachedRead = { frozen: boolean; newestIso: string | null };

async function readCatalogState(): Promise<CachedRead> {
  const rows = await withUserSql(CATALOG_READER_ID, (tx) => tx`
    SELECT c.source_enabled,
           CASE WHEN c.source_enabled THEN NULL ELSE (SELECT max(last_seen_at) FROM jobs) END AS newest
    FROM lifecycle_control c
    WHERE c.singleton
  `);
  const row = parseOrNull(clockRowSchema, rows[0]);
  if (!row || (row.newest !== null && Number.isNaN(row.newest.getTime()))) {
    throw new Error("catalogClock: unexpected lifecycle_control row");
  }
  return { frozen: !row.source_enabled, newestIso: row.newest?.toISOString() ?? null };
}

const cachedRead = unstable_cache(readCatalogState, ["catalog-clock"], {
  revalidate: 600,
  tags: ["catalog-clock"],
});

async function loadCatalogState(): Promise<CachedRead> {
  try {
    return await cachedRead();
  } catch {
    // Outside a Next request context (unit tests, scripts) unstable_cache throws.
    return readCatalogState();
  }
}

/**
 * The clock age labels use. A failed read falls back to the wall clock: the wall clock
 * is never earlier than the newest last_seen_at, so ages only grow and nothing is
 * called new that the catalog clock would not call new.
 */
export async function catalogNow(): Promise<CatalogClock> {
  try {
    const state = await loadCatalogState();
    const now = state.frozen && state.newestIso ? new Date(state.newestIso) : new Date();
    return { now, frozen: state.frozen };
  } catch (e) {
    console.error("catalogClock: read failed; using the wall clock", e);
    return { now: new Date(), frozen: false };
  }
}

function ageMs(firstSeenAt: string, clock: { now: Date }): number {
  return clock.now.getTime() - new Date(firstSeenAt).getTime();
}

/** Whole days since first seen by the given clock, rounded down; never negative. */
export function ageDays(firstSeenAt: string, clock: { now: Date }): number {
  return Math.max(0, Math.floor(ageMs(firstSeenAt, clock) / DAY_MS));
}

/** True when first seen less than two days before the given clock. */
export function isNew(firstSeenAt: string, clock: { now: Date }): boolean {
  const ms = ageMs(firstSeenAt, clock);
  return Number.isFinite(ms) && ms < NEW_FOR_MS;
}
