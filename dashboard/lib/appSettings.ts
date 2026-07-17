// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// app_settings is service-write-only (shared_read SELECT for reads, no authenticated
// write policy — mirrors tier_settings). saveInviteSettings (atomic two-key upsert) and
// saveAppSetting (single-key primitive) are the write paths and are called ONLY from
// isAdmin-gated actions (app/actions/adminSettings.ts). Reads go through withAnonSql
// (shared_read), NOT serviceSql.
// ─────────────────────────────────────────────────────────────────────────────
import { revalidateTag, unstable_cache } from "next/cache";
import { serviceSql, withAnonSql } from "@/lib/db";
import { DEFAULT_INVITE_COMP_PLAN, type InviteCompPlan } from "@/lib/entitlements";

// Operator app config (user-sent invites, spec 2026-07-13). Same pattern as
// lib/tierConfig.ts: compiled defaults + a DB overlay read through a HAND-ROLLED
// TOTAL PARSER (dashboard/CLAUDE.md jsonb discipline) — a bad/absent value keeps the
// default for THAT key and logs; the loader never throws to a page/route.

const CACHE_TTL_SECONDS = 60;

export interface AppSettings {
  inviteCompPlan: InviteCompPlan;
  inviteDefaultAllowance: number;
}

export function defaultAppSettings(): AppSettings {
  return {
    inviteCompPlan: DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
    inviteDefaultAllowance: 3,
  };
}

/** Unwrap one level of a double-encoded jsonb string scalar (mirrors tierConfig.ts). */
function unwrap(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // a plain string value ("standard") is not JSON — keep it as-is
  }
}

function parseCompPlan(raw: unknown): InviteCompPlan {
  const v = unwrap(raw);
  if (v === "standard" || v === "pro" || v === "none") return v;
  console.error("appSettings: invite_comp_plan invalid; keeping default", raw);
  return defaultAppSettings().inviteCompPlan;
}

/**
 * A non-negative integer allowance (0 = user invites off). NOT unwrapped: a valid
 * numeric write (saveAppSetting stores JSON.stringify(n)::jsonb) round-trips through
 * postgres.js as a JS number, so a string value is invalid — never a double-encoded
 * number to rescue. (jsonb discipline: reject rather than coerce "5" → 5.)
 */
function parseDefaultAllowance(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 1000) return raw;
  console.error("appSettings: invite_default_allowance invalid; keeping default", raw);
  return defaultAppSettings().inviteDefaultAllowance;
}

/** Overlay raw app_settings rows onto the compiled defaults, key-by-key. */
export function overlayAppSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const out = defaultAppSettings();
  for (const r of rows) {
    if (r.key === "invite_comp_plan") out.inviteCompPlan = parseCompPlan(r.value);
    else if (r.key === "invite_default_allowance") out.inviteDefaultAllowance = parseDefaultAllowance(r.value);
  }
  return out;
}

async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const rows = await withAnonSql(async (tx) => {
      const r = await tx`
        SELECT key, value FROM app_settings
        WHERE key IN ('invite_comp_plan', 'invite_default_allowance')
      `;
      return r as unknown as { key: string; value: unknown }[];
    });
    return overlayAppSettings(rows);
  } catch (e) {
    // A read failure must never take a gated page down — degrade to defaults.
    console.error("appSettings: failed to load app_settings; using compiled defaults", e);
    return defaultAppSettings();
  }
}

const CACHE_TAG = "app-settings";

const _cached = unstable_cache(fetchAppSettings, ["app-settings"], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [CACHE_TAG],
});

/**
 * Bust the loadAppSettings cache after a write so an admin sees fresh values immediately
 * (not up to CACHE_TTL_SECONDS stale under a "Saved." message). The "max" second arg is
 * Next 16's required cache-life profile (a bare one-arg call is deprecated and warns).
 * revalidateTag THROWS outside a Next request context (unit tests, scripts) — degrade
 * silently there; the TTL still refreshes the value.
 */
function revalidateAppSettings(): void {
  try {
    revalidateTag(CACHE_TAG, "max");
  } catch {
    // Not in a request context — fall back to the ~60s TTL.
  }
}

/** The DB-overlaid operator settings, cached ~60s. Degrades to compiled defaults. */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    return await _cached();
  } catch {
    // Outside a Next request context (unit tests, scripts) unstable_cache throws.
    return fetchAppSettings();
  }
}

/**
 * Upsert one operator setting. Callers MUST be isAdmin-gated (the table has no
 * authenticated write policy by design — this is the serviceSql escape hatch).
 * The value is stored as a jsonb scalar; overlayAppSettings re-validates on read.
 */
export async function saveAppSetting(
  key: "invite_comp_plan" | "invite_default_allowance",
  value: string | number,
): Promise<void> {
  await serviceSql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  revalidateAppSettings();
}

/**
 * Upsert BOTH invite operator settings ATOMICALLY (one transaction) so a half-applied
 * pair — e.g. comp plan written, allowance not — can never persist. Callers MUST be
 * isAdmin-gated (same serviceSql-escape-hatch contract as saveAppSetting). Values are
 * stored as jsonb scalars; overlayAppSettings re-validates on read.
 */
export async function saveInviteSettings(
  compPlan: string,
  defaultAllowance: number,
): Promise<void> {
  await serviceSql.begin(async (tx) => {
    await tx`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('invite_comp_plan', ${JSON.stringify(compPlan)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    await tx`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('invite_default_allowance', ${JSON.stringify(defaultAllowance)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  });
  revalidateAppSettings();
}
