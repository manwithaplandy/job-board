// app_settings writes against real Postgres: what an admin saves must read back as the
// same value. A bare `${JSON.stringify(v)}::jsonb` parameter is typed jsonb, so
// postgres.js JSON-encodes the string again and stores a jsonb STRING ("250000"),
// which the ceiling and allowance parsers reject, silently keeping the defaults.
// Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { loadAppSettings, saveAgentSettings, saveAppSetting, saveInviteSettings } from "@/lib/appSettings";
import { serviceSql } from "@/lib/db";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});
beforeEach(async () => {
  await db.sql`TRUNCATE app_settings`;
});

async function types(): Promise<Record<string, string>> {
  const rows = await db.sql`SELECT key, jsonb_typeof(value) AS t FROM app_settings`;
  return Object.fromEntries(rows.map((r) => [String(r.key), String(r.t)]));
}

test("saved agent settings are stored as jsonb scalars and read back unchanged", async () => {
  const input = {
    agentEnabled: false,
    agentBackgroundEnabled: true,
    agentVariant3Enabled: false,
    agentDailyCeilingMicros: 250_000,
    agentMonthlyCeilingMicros: 4_000_000,
  };
  await saveAgentSettings(input);
  expect(await types()).toEqual({
    agent_enabled: "boolean",
    agent_background_enabled: "boolean",
    agent_variant3_enabled: "boolean",
    agent_daily_ceiling_micros: "number",
    agent_monthly_ceiling_micros: "number",
  });
  expect(await loadAppSettings()).toMatchObject(input);
});

test("saved invite settings read back unchanged", async () => {
  await saveInviteSettings("pro", 7);
  expect(await types()).toEqual({ invite_comp_plan: "string", invite_default_allowance: "number" });
  expect(await loadAppSettings()).toMatchObject({ inviteCompPlan: "pro", inviteDefaultAllowance: 7 });
  await saveAppSetting("invite_default_allowance", 9);
  await saveAppSetting("invite_comp_plan", "none");
  expect(await loadAppSettings()).toMatchObject({ inviteCompPlan: "none", inviteDefaultAllowance: 9 });
});
