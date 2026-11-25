// What the agent page's SurfaceHost renders (plan Task 1.20, PR #52 review M6). Every
// stored surface is total-parsed here, on the server, before a block sees it:
//   - payload by the variant 1 schema, gathered by GatheredDataSchema;
//   - a payload that does not parse falls back to the row's stored fallback, else to
//     fallbackSurface(gathered); gathered data that does not parse falls back to the
//     empty fallback surface, since no block can bind to it.
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
import type { BlockRows, PackageView } from "@/components/agent/blocks/types";
import type { MemoProposal } from "@/lib/workspaces/types";

/** One surface row, parsed and ready for BlockList. */
export interface HostSurface {
  /** The surface row id: BlockList's surfaceKey. */
  id: string;
  /** The row this one replaced, when it updated an earlier surface. */
  supersedes: string | null;
  createdAt: string;
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

/** The payload and gathered data a stored row renders, by the parse rules above. */
export function parseStoredSurface(s: StoredSurface): { payload: SurfacePayloadV1; gathered: GatheredData; degraded: boolean } {
  const gathered = parseGathered(s.gathered);
  if (!gathered) return { payload: fallbackSurface(emptyGathered()), gathered: emptyGathered(), degraded: true };
  const payload = parseOrNull(SurfacePayloadV1Schema, s.payload);
  if (payload) return { payload, gathered, degraded: false };
  const stored = s.fallbackPayload === null ? null : parseOrNull(SurfacePayloadV1Schema, s.fallbackPayload);
  return { payload: stored ?? fallbackSurface(gathered), gathered, degraded: true };
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

async function toHostSurface(userId: string, s: StoredSurface): Promise<HostSurface> {
  const parsed = parseStoredSurface(s);
  return {
    id: s.id,
    supersedes: s.supersedes,
    createdAt: s.createdAt,
    ...parsed,
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
export async function loadThreadSurfaces(userId: string, threadId: string): Promise<HostChain[]> {
  const rows = await listThreadSurfaces(userId, threadId);
  const chains = groupChains(rows);
  return Promise.all(
    chains.map(async (c) => ({ chainId: c.chainId, memberIds: c.memberIds, surface: await toHostSurface(userId, c.latest) })),
  );
}

/** One of the caller's surfaces in this thread, parsed, or null. */
export async function loadHostSurface(userId: string, threadId: string, surfaceId: string): Promise<HostSurface | null> {
  const s = await getSurface(userId, surfaceId);
  if (!s || s.threadId !== threadId) return null;
  return toHostSurface(userId, s);
}
