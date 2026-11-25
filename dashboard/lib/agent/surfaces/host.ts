// What the agent page's SurfaceHost renders (plan Task 1.20, PR #52 review M6). Every
// stored surface is total-parsed here, on the server, before a block sees it:
//   - gathered by GatheredDataSchema; gathered data that does not parse falls back to the
//     empty fallback surface, since nothing can bind to it;
//   - the renderer is picked by whether the payload passes the gate of the row's variant
//     now (plan Task 2.8, notes R13 and R15), not by the row's variant alone:
//       variant 1: the variant 1 schema;
//       variant 2: validateSurfaceV2 against the row's own gathered data (caps first, so a
//         hostile depth never reaches the recursive schema), then the tree renderer;
//       variant 3: canMountSandbox (v3/mount.ts: not fallen back, no failure recorded, a
//         stored fallback, and validateSurfaceV3 passing now) and the operator switch
//         agentVariant3Enabled on, then SandboxFrame. A runtime failure that
//         reportSurfaceFailure stored is therefore sticky: the frame never mounts again;
//   - anything else shows the variant 1 payload through BlockList: the row's stored
//     fallback_payload, else its payload when that is a variant 1 payload (a fallen-back
//     variant 2 or 3 row holds the fallback in both, R13), else fallbackSurface(gathered).
// Every surface carries a variant 1 payload (`payload`), so a tree or frame that fails in
// the browser always has blocks to fall back to.
// The rows a block binds to beyond the gathered data (packages, question schemas, the
// memo, the catalog clock) are read under RLS, keyed only by ids taken from the parsed
// payload. Nothing here writes: the page calls it while rendering, and previews read the
// production database.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { catalogNow } from "@/lib/catalogClock";
import { getMemo } from "@/lib/workspaces/memo";
import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import { parseGathered } from "@/lib/agent/gatheredSchema";
import { getSurface, listThreadSurfaces, type StoredSurface } from "@/lib/agent/surfaces/store";
import { SurfacePayloadV1Schema, type SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { validateSurfaceV2, type SurfacePayloadV2 } from "@/lib/agent/surfaces/v2/tree";
import { SurfacePayloadV3Schema, type SurfacePayloadV3 } from "@/lib/agent/surfaces/v3/document";
import { canMountSandbox } from "@/lib/agent/surfaces/v3/mount";
import type { Variant } from "@/lib/agent/config";
import type { BlockRows, PackageView } from "@/components/agent/blocks/types";
import type { MemoProposal } from "@/lib/workspaces/types";

/**
 * Which renderer shows a surface. `blocks` draws `payload` through BlockList; `tree` and
 * `sandbox` carry their own validated payload and fall back to `payload` in the browser.
 */
export type SurfaceView =
  | { kind: "blocks" }
  | { kind: "tree"; tree: SurfacePayloadV2 }
  | { kind: "sandbox"; document: SurfacePayloadV3 };

/** How the host reads stored surfaces. */
export interface HostOptions {
  /** The operator switch agentVariant3Enabled: while false no sandbox frame is mounted. */
  variant3Enabled: boolean;
}

/** One surface row, parsed and ready for its renderer. */
export interface HostSurface {
  /** The surface row id: BlockList's surfaceKey. */
  id: string;
  threadId: string;
  /** The row this one replaced, when it updated an earlier surface. */
  supersedes: string | null;
  /** The surface this row re-renders (Task 2.9), or null for an original. */
  rerenderOf: string | null;
  createdAt: string;
  /** The variant recorded on the row (the one that produced it). */
  variant: Variant;
  view: SurfaceView;
  /** The variant 1 payload: what BlockList shows for `blocks`, and the browser fallback of a tree or frame. */
  payload: SurfacePayloadV1;
  gathered: GatheredData;
  rows: BlockRows;
  /** True when the stored payload or gathered data did not parse and a fallback is shown. */
  degraded: boolean;
}

/** One chain of surfaces (a surface and every update of it), shown once at its latest row. */
export interface HostChain {
  /** The id of the chain's oldest row the page knows. */
  chainId: string;
  /** Every row id of the chain the page knows, so a later update finds its chain. */
  memberIds: string[];
  surface: HostSurface;
}

/** The ids the payload's blocks name, for the row reads. */
function payloadKeys(payload: SurfacePayloadV1): { jobIds: string[]; memo: boolean; clock: boolean } {
  const jobIds = new Set<string>();
  let memo = false;
  let clock = false;
  for (const block of payload.blocks) {
    if (block.type === "PrepChecklist" || block.type === "EvidenceMap" || block.type === "DocumentPreview") {
      jobIds.add(block.jobId);
    } else if (block.type === "MemoDiff") memo = true;
    else if (block.type === "StaleList") clock = true;
  }
  return { jobIds: [...jobIds], memo, clock };
}

export interface ParsedSurface {
  view: SurfaceView;
  payload: SurfacePayloadV1;
  gathered: GatheredData;
  degraded: boolean;
}

/** The row's variant 1 fallback: its stored fallback_payload, else its payload as variant 1, else one built from gathered. */
function blocksFallback(s: StoredSurface, gathered: GatheredData): SurfacePayloadV1 {
  const stored = s.fallbackPayload === null ? null : parseOrNull(SurfacePayloadV1Schema, s.fallbackPayload);
  return stored ?? parseOrNull(SurfacePayloadV1Schema, s.payload) ?? fallbackSurface(gathered);
}

/**
 * What a stored row renders, by the parse rules above. `options` defaults to variant 3
 * off, so a caller that does not say never mounts a frame.
 */
export function parseStoredSurface(s: StoredSurface, options: HostOptions = { variant3Enabled: false }): ParsedSurface {
  const gathered = parseGathered(s.gathered);
  if (!gathered) return { view: { kind: "blocks" }, payload: fallbackSurface(emptyGathered()), gathered: emptyGathered(), degraded: true };
  if (s.variant === 1) {
    const payload = parseOrNull(SurfacePayloadV1Schema, s.payload);
    if (payload) return { view: { kind: "blocks" }, payload, gathered, degraded: false };
    return { view: { kind: "blocks" }, payload: blocksFallback(s, gathered), gathered, degraded: true };
  }
  if (s.variant === 2) {
    const tree = validateSurfaceV2(s.payload, gathered);
    if (tree.ok) return { view: { kind: "tree", tree: tree.payload }, payload: blocksFallback(s, gathered), gathered, degraded: false };
    return { view: { kind: "blocks" }, payload: blocksFallback(s, gathered), gathered, degraded: true };
  }
  // Variant 3: a frame needs the operator switch, canMountSandbox, and a stored fallback
  // that parses as variant 1 (the frame's only fallback), stricter than canMountSandbox's
  // "is an object".
  const fallback = s.fallbackPayload === null ? null : parseOrNull(SurfacePayloadV1Schema, s.fallbackPayload);
  const document = fallback !== null && canMountSandbox(s) ? parseOrNull(SurfacePayloadV3Schema, s.payload) : null;
  if (document && fallback) {
    // Mountable. With the switch off it shows its fallback, which is not a degradation.
    if (options.variant3Enabled) return { view: { kind: "sandbox", document }, payload: fallback, gathered, degraded: false };
    return { view: { kind: "blocks" }, payload: fallback, gathered, degraded: false };
  }
  return { view: { kind: "blocks" }, payload: blocksFallback(s, gathered), gathered, degraded: true };
}

const packageRowSchema = z.object({
  job_id: z.string(),
  status: z.enum(["prepared", "applied"]),
  resume_json: z.unknown(),
  cover_letter_json: z.unknown(),
  edited_text: z.string().nullable(),
  prefilled_answers: z.unknown(),
  apply_url: z.string().nullable(),
  ats: z.string().nullable(),
});

const questionRowSchema = z.object({ job_id: z.string(), questions: z.unknown() });

/**
 * The caller's application packages and the postings' stored question schemas for these
 * jobs. A job with no package has no key; a malformed row is skipped.
 */
export async function loadPackageRows(
  userId: string,
  jobIds: readonly string[],
): Promise<{ packages: Record<string, PackageView>; questions: Record<string, unknown> }> {
  const packages: Record<string, PackageView> = {};
  const questions: Record<string, unknown> = {};
  if (jobIds.length === 0) return { packages, questions };
  const ids = [...jobIds];
  const [packageRows, questionRows] = await withUserSql(userId, async (tx) => [
    await tx`
      SELECT p.job_id, p.status, p.resume_json, p.cover_letter_json, e.edited_text,
             p.prefilled_answers, p.apply_url, c.ats
      FROM application_packages p
      JOIN jobs j ON j.id = p.job_id
      JOIN companies c ON c.id = j.company_id
      LEFT JOIN cover_letter_edits e ON e.user_id = p.user_id AND e.job_id = p.job_id AND e.superseded_at IS NULL
      WHERE p.user_id = ${userId}::uuid AND p.job_id = ANY(${ids}::text[])`,
    await tx`SELECT job_id, questions FROM job_questions WHERE job_id = ANY(${ids}::text[])`,
  ]);
  for (const raw of packageRows) {
    const r = parseOrNull(packageRowSchema, raw);
    if (!r) continue;
    packages[r.job_id] = {
      status: r.status,
      resume: r.resume_json ?? null,
      coverLetter: r.cover_letter_json ?? null,
      coverLetterEditedText: r.edited_text,
      prefilledAnswers: r.prefilled_answers ?? null,
      applyUrl: r.apply_url,
      ats: r.ats,
    };
  }
  for (const raw of questionRows) {
    const r = parseOrNull(questionRowSchema, raw);
    if (r) questions[r.job_id] = r.questions ?? null;
  }
  return { packages, questions };
}

/** The rows a parsed payload's blocks bind to. A failed read leaves that field out (the block shows its fixed line). */
export async function loadBlockRows(userId: string, payload: SurfacePayloadV1): Promise<BlockRows> {
  const keys = payloadKeys(payload);
  const rows: BlockRows = {};
  const reads: Promise<void>[] = [];
  if (keys.jobIds.length > 0) {
    reads.push(
      loadPackageRows(userId, keys.jobIds).then(
        (r) => {
          rows.packages = r.packages;
          rows.questions = r.questions;
        },
        (e) => console.error("surface host: package rows read failed", e),
      ),
    );
  }
  if (keys.memo) {
    reads.push(
      getMemo(userId).then(
        (m) => {
          if (!m) return;
          const proposals: Record<string, MemoProposal> = {};
          for (const p of m.pending) proposals[p.id] = p;
          rows.memo = { current: m.doc, version: m.version, proposals };
        },
        (e) => console.error("surface host: memo read failed", e),
      ),
    );
  }
  if (keys.clock) {
    reads.push(catalogNow().then((c) => void (rows.now = c.now.toISOString())));
  }
  await Promise.all(reads);
  return rows;
}

async function toHostSurface(userId: string, s: StoredSurface, options: HostOptions): Promise<HostSurface> {
  const parsed = parseStoredSurface(s, options);
  return {
    id: s.id,
    threadId: s.threadId,
    supersedes: s.supersedes,
    rerenderOf: s.rerenderOf,
    createdAt: s.createdAt,
    variant: s.variant,
    ...parsed,
    // The rows of the variant 1 payload: BlockList's, for blocks and for a browser fallback.
    rows: await loadBlockRows(userId, parsed.payload),
  };
}

/**
 * Groups rows (oldest first) into chains by `supersedes`. Each chain is keyed by its
 * oldest known row; a predecessor older than the rows read starts its own chain. Cycle
 * safe: a row is placed once.
 */
export function groupChains(rows: readonly StoredSurface[]): Array<{ chainId: string; memberIds: string[]; latest: StoredSurface }> {
  const chainOf = new Map<string, string>();
  const chains = new Map<string, { chainId: string; memberIds: string[]; latest: StoredSurface }>();
  for (const s of rows) {
    if (chainOf.has(s.id)) continue;
    const prev = s.supersedes === null ? undefined : chainOf.get(s.supersedes);
    const chainId = prev ?? s.id;
    chainOf.set(s.id, chainId);
    const chain = chains.get(chainId);
    if (chain) {
      chain.memberIds.push(s.id);
      chain.latest = s;
    } else chains.set(chainId, { chainId, memberIds: [s.id], latest: s });
  }
  // Ordered by each chain's latest row, so an updated surface becomes the newest one.
  return [...chains.values()].sort((a, b) => a.latest.createdAt.localeCompare(b.latest.createdAt));
}

/** The thread's surface chains, oldest first, each at its latest row. */
export async function loadThreadSurfaces(userId: string, threadId: string, options: HostOptions): Promise<HostChain[]> {
  const rows = await listThreadSurfaces(userId, threadId);
  const chains = groupChains(rows);
  return Promise.all(
    chains.map(async (c) => ({ chainId: c.chainId, memberIds: c.memberIds, surface: await toHostSurface(userId, c.latest, options) })),
  );
}

/** One of the caller's surfaces in this thread, parsed, or null. */
export async function loadHostSurface(
  userId: string,
  threadId: string,
  surfaceId: string,
  options: HostOptions,
): Promise<HostSurface | null> {
  const s = await getSurface(userId, surfaceId);
  if (!s || s.threadId !== threadId) return null;
  return toHostSurface(userId, s, options);
}
