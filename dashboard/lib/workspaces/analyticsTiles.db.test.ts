// The analytics tile store and its undo against real Postgres, RLS and the real
// agent_log_action / agent_mark_action_undone (Task 1.13). Runs only under
// `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import {
  getTileLayout, saveTileLayout, undoTileLayout, type TileLayout,
} from "@/lib/workspaces/analyticsTiles";

const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

const ctx = (extra: Partial<ToolCtx> = {}): ToolCtx => ({
  userId: USER_A, email: null, threadId: THREAD, runId: RUN, variant: 1, unattended: false,
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 }, fromView: false, ...extra,
});

const layout = (title: string): TileLayout => ({
  items: [
    { type: "heading", text: "Pipeline" },
    { type: "tile", tile: { id: "stages", metric: "applications_by_stage", window: "30d", viz: "bar", size: "large", title } },
  ],
});

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM analytics_tile_versions`;
  await db.sql`DELETE FROM analytics_tiles`;
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const versions = async (user = USER_A) =>
  (await db.sql`SELECT version, changed_by, layout FROM analytics_tile_versions WHERE user_id = ${user} ORDER BY version`)
    .map((r) => [Number(r.version), r.changed_by, (r.layout as TileLayout).items.length === 0 ? "empty"
      : ((r.layout as TileLayout).items[1] as { tile: { title: string } }).tile.title]);

test("saving creates version n+1 and keeps version n", async () => {
  expect(await getTileLayout(USER_A)).toEqual({ version: 0, layout: { items: [] } });
  expect(await saveTileLayout(USER_A, layout("One"), "user")).toEqual({ version: 1, actionId: null });
  expect(await saveTileLayout(USER_A, layout("Two"), "agent")).toEqual({ version: 2, actionId: null });
  expect(await getTileLayout(USER_A)).toEqual({ version: 2, layout: layout("Two") });
  expect(await versions()).toEqual([[1, "user", "One"], [2, "agent", "Two"]]);
  // Another user's layout is separate and invisible.
  expect(await getTileLayout(USER_B)).toEqual({ version: 0, layout: { items: [] } });
});

test("undo restores the previous layout as a new version", async () => {
  expect(await undoTileLayout(USER_A)).toBeNull();
  await saveTileLayout(USER_A, layout("One"), "user");
  expect(await undoTileLayout(USER_A)).toBeNull();
  await saveTileLayout(USER_A, layout("Two"), "agent");
  expect(await undoTileLayout(USER_A)).toBe(3);
  expect(await getTileLayout(USER_A)).toEqual({ version: 3, layout: layout("One") });
  expect(await versions()).toEqual([[1, "user", "One"], [2, "agent", "Two"], [3, "user", "One"]]);
});

test("a stored layout that no longer parses reads back as the empty layout", async () => {
  await saveTileLayout(USER_A, layout("One"), "user");
  await db.sql`UPDATE analytics_tiles SET layout = ${db.sql.json({ tiles: [{ metric: "retired_metric" }] })}
               WHERE user_id = ${USER_A}`;
  expect(await getTileLayout(USER_A)).toEqual({ version: 1, layout: { items: [] } });
  // The next save still moves forward from the stored version.
  expect((await saveTileLayout(USER_A, layout("Two"), "user")).version).toBe(2);
});

test("an audited agent save is undone through undoAction, once, and not after a later change", async () => {
  await saveTileLayout(USER_A, layout("Mine"), "user");
  const first = await saveTileLayout(USER_A, layout("Agent's"), "agent", ctx());
  expect(first.actionId).not.toBeNull();
  const [row] = await db.sql`SELECT actor, kind, target_key FROM agent_actions WHERE id = ${first.actionId}`;
  expect(row).toEqual({ actor: "agent", kind: "analytics.set_tiles", target_key: { version: 2 } });

  expect(await undoAction(USER_A, first.actionId!)).toEqual({ ok: true });
  expect(await getTileLayout(USER_A)).toEqual({ version: 3, layout: layout("Mine") });
  expect(await undoAction(USER_A, first.actionId!)).toEqual({ ok: false, reason: "already_undone" });

  // A later edit wins over an older action's undo.
  const second = await saveTileLayout(USER_A, layout("Agent again"), "agent", ctx());
  await saveTileLayout(USER_A, layout("Edited since"), "user");
  expect(await undoAction(USER_A, second.actionId!)).toEqual({ ok: false, reason: "changed_since" });
  expect((await getTileLayout(USER_A)).layout).toEqual(layout("Edited since"));
  // Another user cannot undo it.
  expect(await undoAction(USER_B, second.actionId!)).toEqual({ ok: false, reason: "not_found" });
});

test("an action whose before fails the layout schema is refused without a write", async () => {
  const saved = await saveTileLayout(USER_A, layout("Agent's"), "agent", ctx());
  await db.sql`UPDATE agent_actions SET before = ${db.sql.json({ items: "drop" })} WHERE id = ${saved.actionId}`;
  expect(await undoAction(USER_A, saved.actionId!)).toEqual({ ok: false, reason: "not_found" });
  expect(await getTileLayout(USER_A)).toEqual({ version: 1, layout: layout("Agent's") });
});
