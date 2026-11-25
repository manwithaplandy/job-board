// The user's own agent preferences (agent_settings, migration 17; plan Task 2.8). Read and
// written as the user through withUserSql, so RLS (agent_settings_owner) applies on top of
// the explicit user_id predicate. The row is optional: a user without one has the column
// defaults (default_variant 1).
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import type { Variant } from "@/lib/agent/config";
import { isVariant } from "@/lib/agent/variants";

// default_variant is bigint (a string from postgres.js).
const rowSchema = z.object({
  default_variant: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])),
});

/** The variant new threads start with: the stored default, else 1 (no row or a malformed one). */
export async function getDefaultVariant(userId: string): Promise<Variant> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT default_variant FROM agent_settings WHERE user_id = ${userId}::uuid`);
  return parseOrNull(rowSchema, rows[0])?.default_variant ?? 1;
}

/** Stores the variant new threads start with (creates the row when the user has none). */
export async function setDefaultVariant(userId: string, variant: Variant): Promise<void> {
  if (!isVariant(variant)) throw new Error("agent: variant must be 1, 2 or 3");
  await withUserSql(userId, (tx) => tx`
    INSERT INTO agent_settings (user_id, default_variant) VALUES (${userId}::uuid, ${variant})
    ON CONFLICT (user_id) DO UPDATE SET default_variant = EXCLUDED.default_variant, updated_at = now()`);
}
