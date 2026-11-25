// The runtime gate for a surface payload (plan Task 1.17, spec 12 "Runtime gate"). For
// variant 1: the strict schema, then every id must resolve to data this turn actually
// read under the user's RLS (ctx.gathered), or, for a memo proposal, to one of the
// user's pending proposals. A payload that fails is never rendered; the present tool
// stores the deterministic fallback instead.
//
// Variants 2 and 3 get their grammars in later tasks (2.x); until then they fail here,
// and present falls back to variant 1 as the spec's variant 2/3 failure path does.
import { z } from "zod";
import type { Variant } from "@/lib/agent/config";
import type { GatheredData } from "@/lib/agent/gathered";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { VIZ_FOR_KIND } from "@/lib/workspaces/analyticsTiles";
import { SurfacePayloadV1Schema, type SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";

/** A validated payload of any variant (only variant 1 exists so far). */
export type SurfacePayload = SurfacePayloadV1;

export type SurfaceValidation = { ok: true; payload: SurfacePayload } | { ok: false; errors: string[] };

const ERRORS_MAX = 20;

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

async function isPendingProposal(userId: string, proposalId: string): Promise<boolean> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT 1 AS ok FROM search_memo_proposals
    WHERE id = ${proposalId}::uuid AND user_id = ${userId}::uuid AND status = 'pending'`);
  return parseOrNull(z.object({ ok: z.literal(1) }), rows[0]) !== null;
}

/** The id checks of a schema-valid variant 1 payload; the memo proposals are returned for the database check. */
function checkIds(payload: SurfacePayloadV1, g: GatheredData): { errors: string[]; proposals: Map<string, string> } {
  const errors: string[] = [];
  const proposals = new Map<string, string>();
  const job = (id: string, path: string) => {
    if (!has(g.jobs, id)) errors.push(`${path}: job ${id} was not read this turn`);
  };
  const metric = (ref: number, path: string) => {
    if (ref >= g.metrics.length) errors.push(`${path}: no metric ${ref} was read this turn`);
    return g.metrics[ref];
  };
  payload.blocks.forEach((b, i) => {
    const at = `blocks.${i}`;
    switch (b.type) {
      case "JobCard":
      case "PrepChecklist":
      case "DocumentPreview":
        job(b.jobId, `${at}.jobId`);
        break;
      case "JobComparison":
      case "ShortlistQueue":
        b.jobIds.forEach((id, k) => job(id, `${at}.jobIds.${k}`));
        break;
      case "EvidenceMap": {
        job(b.jobId, `${at}.jobId`);
        const requirements = has(g.reviews, b.jobId) ? g.reviews[b.jobId].requirements : null;
        if (requirements === null) {
          errors.push(`${at}.jobId: no review of ${b.jobId} was read this turn`);
          break;
        }
        b.rows.forEach((r, k) => {
          if (r.requirementIndex >= requirements.length) {
            errors.push(`${at}.rows.${k}.requirementIndex: the review has no requirement ${r.requirementIndex}`);
          }
        });
        break;
      }
      case "StatRow":
        b.metricRefs.forEach((ref, k) => metric(ref, `${at}.metricRefs.${k}`));
        break;
      case "MetricChart": {
        const m = metric(b.metricRef, `${at}.metricRef`);
        if (m && !VIZ_FOR_KIND[m.kind].includes(b.viz)) errors.push(`${at}.viz: ${b.viz} cannot draw a ${m.kind} metric`);
        break;
      }
      case "MemoDiff":
        proposals.set(b.proposalId, `${at}.proposalId`);
        break;
      case "IntakeQuestions":
      case "ProfileReadback":
      case "StaleList":
      case "Callout":
        break;
    }
  });
  return { errors, proposals };
}

export async function validateSurface(
  payload: unknown,
  variant: Variant,
  ctx: { userId: string; gathered: GatheredData },
): Promise<SurfaceValidation> {
  if (variant !== 1) return { ok: false, errors: [`variant ${variant} has no grammar yet`] };
  const parsed = SurfacePayloadV1Schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, ERRORS_MAX).map((i) => `${i.path.join(".") || "payload"}: ${i.message}`),
    };
  }
  const { errors, proposals } = checkIds(parsed.data, ctx.gathered);
  for (const [id, path] of proposals) {
    if (!(await isPendingProposal(ctx.userId, id))) errors.push(`${path}: no pending memo proposal ${id}`);
  }
  return errors.length > 0 ? { ok: false, errors: errors.slice(0, ERRORS_MAX) } : { ok: true, payload: parsed.data };
}
