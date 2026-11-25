// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// app_settings is service-write-only (shared_read SELECT for reads, no authenticated
// write policy — mirrors tier_settings). saveInviteSettings (atomic two-key upsert),
// saveAgentSettings (atomic five-key upsert) and saveAppSetting (single-key primitive)
// are the write paths and are called ONLY from
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

/**
 * Agent kill switches and spend ceilings (agent-first redesign, Task 0.6). Ceilings are
 * per user, in micro-dollars. The two ceiling defaults are placeholders until gate A6.
 */
export interface AgentSettingsInput {
  agentEnabled: boolean;
  agentBackgroundEnabled: boolean;
  agentVariant3Enabled: boolean;
  agentDailyCeilingMicros: number;
  agentMonthlyCeilingMicros: number;
}

export interface AppSettings extends AgentSettingsInput {
  inviteCompPlan: InviteCompPlan;
  inviteDefaultAllowance: number;
}

/** Upper bound for an agent ceiling: $1,000 in micros, and inside usage_counters.n (int4). */
export const AGENT_CEILING_MAX_MICROS = 1_000_000_000;

export function isValidAgentCeiling(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= AGENT_CEILING_MAX_MICROS;
}

export function defaultAppSettings(): AppSettings {
  return {
    inviteCompPlan: DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
    inviteDefaultAllowance: 3,
    agentEnabled: true,
    agentBackgroundEnabled: false,
    agentVariant3Enabled: true,
    agentDailyCeilingMicros: 1_000_000,
    agentMonthlyCeilingMicros: 10_000_000,
  };
}

type AgentToggleKey = "agentEnabled" | "agentBackgroundEnabled" | "agentVariant3Enabled";
type AgentCeilingKey = "agentDailyCeilingMicros" | "agentMonthlyCeilingMicros";

const AGENT_TOGGLE_KEYS: Record<string, AgentToggleKey> = {
  agent_enabled: "agentEnabled",
  agent_background_enabled: "agentBackgroundEnabled",
  agent_variant3_enabled: "agentVariant3Enabled",
};
const AGENT_CEILING_KEYS: Record<string, AgentCeilingKey> = {
  agent_daily_ceiling_micros: "agentDailyCeilingMicros",
  agent_monthly_ceiling_micros: "agentMonthlyCeilingMicros",
};

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

/**
 * A boolean switch. Unwrapped one level (a double-encoded "true" is the JSON text of a
 * boolean), but nothing else is coerced: 1, "yes" or "on" keep the default.
 */
function parseToggle(key: string, raw: unknown, fallback: boolean): boolean {
  const v = unwrap(raw);
  if (typeof v === "boolean") return v;
  console.error(`appSettings: ${key} invalid; keeping default`, raw);
  return fallback;
}

/** A ceiling in micros. Like the allowance, NOT unwrapped: a string is invalid. */
function parseCeiling(key: string, raw: unknown, fallback: number): number {
  if (isValidAgentCeiling(raw)) return raw;
  console.error(`appSettings: ${key} invalid; keeping default`, raw);
  return fallback;
}

/** Overlay raw app_settings rows onto the compiled defaults, key-by-key. */
export function overlayAppSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const out = defaultAppSettings();
  const defaults = defaultAppSettings();
  for (const r of rows) {
    const toggle = AGENT_TOGGLE_KEYS[r.key];
    const ceiling = AGENT_CEILING_KEYS[r.key];
    if (r.key === "invite_comp_plan") out.inviteCompPlan = parseCompPlan(r.value);
    else if (r.key === "invite_default_allowance") out.inviteDefaultAllowance = parseDefaultAllowance(r.value);
    else if (toggle) out[toggle] = parseToggle(r.key, r.value, defaults[toggle]);
    else if (ceiling) out[ceiling] = parseCeiling(r.key, r.value, defaults[ceiling]);
  }
  return out;
}

async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const rows = await withAnonSql(async (tx) => {
      const r = await tx`
        SELECT key, value FROM app_settings
        WHERE key IN ('invite_comp_plan', 'invite_default_allowance',
                      'agent_enabled', 'agent_background_enabled', 'agent_variant3_enabled',
                      'agent_daily_ceiling_micros', 'agent_monthly_ceiling_micros')
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

/**
 * Upsert all five agent settings ATOMICALLY (one transaction), like saveInviteSettings:
 * a kill switch and its ceilings are never half-applied. Callers MUST be isAdmin-gated
 * and validate first (saveAgentSettingsAction); overlayAppSettings re-validates on read.
 */
export async function saveAgentSettings(input: AgentSettingsInput): Promise<void> {
  const pairs: [string, boolean | number][] = [
    ["agent_enabled", input.agentEnabled],
    ["agent_background_enabled", input.agentBackgroundEnabled],
    ["agent_variant3_enabled", input.agentVariant3Enabled],
    ["agent_daily_ceiling_micros", input.agentDailyCeilingMicros],
    ["agent_monthly_ceiling_micros", input.agentMonthlyCeilingMicros],
  ];
  await serviceSql.begin(async (tx) => {
    for (const [key, value] of pairs) {
      await tx`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `;
    }
  });
  revalidateAppSettings();
}
