// The analytics tile layout (plan Task 1.13): the user's dashboard of catalog metrics,
// each drawn as a tile, with optional headings. Validated against the metric catalog
// (a tile names a catalog metric and a viz that fits that metric's kind) and versioned:
// every save writes version n+1 to analytics_tiles and appends it to
// analytics_tile_versions, so earlier layouts are kept.
//
// The tables carry no lifecycle trigger, so writes run in withUserSql (RLS scoped to the
// caller). The live row is locked FOR UPDATE before each write; the version bump is the
// upsert itself, so two saves cannot write the same version.
//
// The analytics.set_tiles undoer re-reads the live layout, restores only when it still
// equals the action's `after`, parses `before` with TileLayoutSchema and writes it
// through the same core a user save uses (saveLayoutTx), as a new version.
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { actorFor, logAction, registerUndoer, type AuditCtx, type StoredAction, type UndoOutcome } from "@/lib/agent/actions/audit";
import { METRIC_CATALOG, MetricSpecSchema, type MetricKind } from "@/lib/workspaces/metrics/catalog";

export const VIZ = ["stat", "sparkline", "line", "bar", "stacked_bar", "funnel", "table", "list"] as const;
export type Viz = (typeof VIZ)[number];
/** 1, 2 and 4 columns of a 4 column grid. */
export const TILE_SIZES = ["small", "medium", "large"] as const;
export const TILE_LAYOUT_MAX_ITEMS = 24;
export const TILE_TITLE_MAX = 60;
export const TILE_NOTE_MAX = 140;

/** The vizzes that can draw each metric kind. */
export const VIZ_FOR_KIND: Record<MetricKind, readonly Viz[]> = {
  value: ["stat"],
  series: ["sparkline", "line", "bar", "stacked_bar"],
  rows: ["table", "list", "funnel", "bar"],
};

const nonBlank = (max: number) =>
  z.string().min(1).max(max).refine((s) => s.trim().length > 0, { message: "must not be blank" });

const tileObject = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    // The metric fields are MetricSpecSchema's own; the catalog refinement runs below.
    ...MetricSpecSchema.shape,
    viz: z.enum(VIZ),
    size: z.enum(TILE_SIZES),
    title: nonBlank(TILE_TITLE_MAX),
    note: z.string().max(TILE_NOTE_MAX).optional(),
  })
  .strict();

/** One tile: a catalog metric request, refined by the catalog, and how to draw it. */
export const TileSpecSchema = tileObject.superRefine((tile, ctx) => {
  const spec = MetricSpecSchema.safeParse({
    metric: tile.metric,
    window: tile.window,
    ...(tile.groupBy === undefined ? {} : { groupBy: tile.groupBy }),
    ...(tile.filter === undefined ? {} : { filter: tile.filter }),
  });
  if (!spec.success) {
    for (const issue of spec.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
  const kind = METRIC_CATALOG[tile.metric].kind;
  if (!VIZ_FOR_KIND[kind].includes(tile.viz)) {
    ctx.addIssue({ code: "custom", path: ["viz"], message: `${tile.viz} cannot draw a ${kind} metric` });
  }
});
export type TileSpec = z.infer<typeof TileSpecSchema>;

const TileItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tile"), tile: TileSpecSchema }).strict(),
  z.object({ type: z.literal("heading"), text: nonBlank(TILE_TITLE_MAX) }).strict(),
]);

/** A whole layout: at most 24 tiles and headings, tile ids unique. */
export const TileLayoutSchema = z
  .object({ items: z.array(TileItemSchema).max(TILE_LAYOUT_MAX_ITEMS) })
  .strict()
  .superRefine((layout, ctx) => {
    const seen = new Set<string>();
    layout.items.forEach((item, i) => {
      if (item.type !== "tile") return;
      if (seen.has(item.tile.id)) {
        ctx.addIssue({ code: "custom", path: ["items", i, "tile", "id"], message: "duplicate tile id" });
      }
      seen.add(item.tile.id);
    });
  });
export type TileLayout = z.infer<typeof TileLayoutSchema>;

export const emptyTileLayout = (): TileLayout => ({ items: [] });

/** The layout or the request is malformed. */
export class TileLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileLayoutError";
  }
}

const liveRowSchema = z.object({ version: z.coerce.number().int().min(0), layout: z.unknown() });

/** The locked live row; `layout` is null when the stored layout no longer parses. */
async function readLiveTx(tx: TransactionSql, userId: string, lock: boolean) {
  const rows = lock
    ? await tx`SELECT version, layout FROM analytics_tiles WHERE user_id = ${userId}::uuid FOR UPDATE`
    : await tx`SELECT version, layout FROM analytics_tiles WHERE user_id = ${userId}::uuid`;
  if (rows.length === 0) return null;
  const row = parseOrNull(liveRowSchema, rows[0]);
  if (!row) throw new Error("analyticsTiles: unexpected analytics_tiles row");
  return { version: row.version, layout: parseOrNull(TileLayoutSchema, row.layout) };
}

/** The one write core: bumps the version, stores the layout, appends the version row. */
async function saveLayoutTx(
  tx: TransactionSql,
  userId: string,
  layout: TileLayout,
  changedBy: "user" | "agent",
): Promise<number> {
  const text = JSON.stringify(layout);
  const rows = await tx`
    INSERT INTO analytics_tiles (user_id, version, layout)
    VALUES (${userId}::uuid, 1, ${text}::text::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET
      version = analytics_tiles.version + 1, layout = EXCLUDED.layout, updated_at = now()
    RETURNING version`;
  const row = parseOrNull(z.object({ version: z.coerce.number().int().positive() }), rows[0]);
  if (!row) throw new Error("analyticsTiles: the upsert returned no version");
  await tx`
    INSERT INTO analytics_tile_versions (user_id, version, layout, changed_by)
    VALUES (${userId}::uuid, ${row.version}, ${text}::text::jsonb, ${changedBy})`;
  return row.version;
}

/** The caller's layout. Version 0 and the empty layout when none is stored; the empty layout when it no longer parses. */
export async function getTileLayout(userId: string): Promise<{ version: number; layout: TileLayout }> {
  const live = await withUserSql(userId, (tx) => readLiveTx(tx, userId, false));
  if (live === null) return { version: 0, layout: emptyTileLayout() };
  return { version: live.version, layout: live.layout ?? emptyTileLayout() };
}

/**
 * Saves a new layout version for the caller. Throws TileLayoutError before any SQL for a
 * layout the schema refuses. With `audit`, logs analytics.set_tiles in the same
 * transaction, with the layout it replaced as `before`.
 */
// TODO(Task 1.18): the set_tiles agent tool must refuse unattended runs; this function does not check `audit.unattended`.
export async function saveTileLayout(
  userId: string,
  layout: TileLayout,
  changedBy: "user" | "agent",
  audit?: AuditCtx,
): Promise<{ version: number; actionId: number | null }> {
  if (changedBy !== "user" && changedBy !== "agent") throw new TileLayoutError("Unknown writer.");
  if (audit && audit.userId !== userId) throw new TileLayoutError("Audit context is another user's.");
  if (audit?.unattended && changedBy !== "agent") throw new TileLayoutError("An unattended write is the agent's.");
  const parsed = TileLayoutSchema.safeParse(layout);
  if (!parsed.success) throw new TileLayoutError("That layout is not allowed.");
  const next = parsed.data;

  return withUserSql(userId, async (tx) => {
    const live = await readLiveTx(tx, userId, true);
    const version = await saveLayoutTx(tx, userId, next, changedBy);
    const actionId = audit
      ? await logAction(tx, {
          ctx: audit,
          actor: changedBy === "user" ? "user_via_surface" : actorFor(audit),
          kind: "analytics.set_tiles",
          targetKey: { version },
          before: live?.layout ?? emptyTileLayout(),
          after: next,
        })
      : null;
    return { version, actionId };
  });
}

/**
 * Restores the layout before the current one as a new version (the history keeps both).
 * Null when there is no earlier version, or it no longer parses.
 */
export async function undoTileLayout(userId: string): Promise<number | null> {
  return withUserSql(userId, async (tx) => {
    const live = await readLiveTx(tx, userId, true);
    if (live === null || live.version <= 1) return null;
    const rows = await tx`
      SELECT layout FROM analytics_tile_versions
      WHERE user_id = ${userId}::uuid AND version = ${live.version - 1}`;
    const prior = parseOrNull(TileLayoutSchema, rows[0]?.layout);
    if (prior === null) return null;
    return saveLayoutTx(tx, userId, prior, "user");
  });
}

/** The analytics.set_tiles undoer (see the module header). */
export async function undoTileLayoutAction(
  tx: TransactionSql,
  action: StoredAction,
  userId: string,
): Promise<UndoOutcome> {
  const after = TileLayoutSchema.safeParse(action.after);
  const before = TileLayoutSchema.safeParse(action.before);
  if (!after.success || !before.success) return "invalid";
  const live = await readLiveTx(tx, userId, true);
  if (live === null || live.layout === null || !isDeepStrictEqual(live.layout, after.data)) return "changed_since";
  await saveLayoutTx(tx, userId, before.data, "user");
  return "restored";
}

registerUndoer("analytics.set_tiles", undoTileLayoutAction);
