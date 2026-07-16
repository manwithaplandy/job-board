// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// app_settings is service-write-only (shared_read SELECT for reads, no authenticated
// write policy — mirrors tier_settings). saveAppSetting is the ONE write path and is
// called ONLY from isAdmin-gated actions (app/actions/adminSettings.ts). Reads go
// through withAnonSql (shared_read), NOT serviceSql.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
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

const _cached = unstable_cache(fetchAppSettings, ["app-settings"], {
  revalidate: CACHE_TTL_SECONDS,
});

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
}
