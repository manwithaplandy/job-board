// Which workspace rows carry a "by agent" marker with Undo (plan Task 1.5). A row gets
// one when the newest audited write to it is an agent's that is not undone yet.
//
// listAgentMarkers is the pages' read: one query per kind that takes, for each job, the
// newest action of that kind (DISTINCT ON the target's jobId) and keeps it only when it
// is the agent's and not undone. It replaced a shared read of the newest 100 actions,
// which dropped markers once other writes pushed a job's action past the 100th row.
// agentMarkersByJob applies the same rule to a list already in hand.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { ACTION_KINDS, type ActionKind, type StoredAction } from "@/lib/agent/actions/audit";

const jobTargetSchema = z.object({ jobId: z.string() }).passthrough();
const markerRowSchema = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  job_id: z.string().min(1),
});

/**
 * Job id to the id of the newest action of `kind` on that job, kept only when that
 * action is the agent's (attended or not) and not undone. `actions` must be newest
 * first. A user's later write through the agent page (user_via_surface) hides the
 * marker, since the row is then the user's.
 */
export function agentMarkersByJob(actions: StoredAction[], kind: ActionKind): Record<string, number> {
  const seen = new Set<string>();
  const out: Record<string, number> = {};
  for (const action of actions) {
    if (action.kind !== kind) continue;
    const target = jobTargetSchema.safeParse(action.targetKey);
    if (!target.success || seen.has(target.data.jobId)) continue;
    seen.add(target.data.jobId);
    if (action.undoneAt === null && (action.actor === "agent" || action.actor === "agent_unattended")) {
      out[target.data.jobId] = action.id;
    }
  }
  return out;
}

/** The caller's agent markers for one kind (see the module header), in the same shape as agentMarkersByJob. */
export async function listAgentMarkers(userId: string, kind: ActionKind): Promise<Record<string, number>> {
  if (!(ACTION_KINDS as readonly string[]).includes(kind)) return {};
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, job_id FROM (
      SELECT DISTINCT ON (target_key ->> 'jobId') id, target_key ->> 'jobId' AS job_id, actor, undone_at
      FROM agent_actions
      WHERE user_id = ${userId}::uuid AND kind = ${kind}
        AND jsonb_typeof(target_key -> 'jobId') = 'string'
      ORDER BY target_key ->> 'jobId', created_at DESC, id DESC
    ) newest
    WHERE actor IN ('agent', 'agent_unattended') AND undone_at IS NULL`);
  const out: Record<string, number> = {};
  for (const raw of rows) {
    const r = parseOrNull(markerRowSchema, raw);
    if (r) out[r.job_id] = r.id;
  }
  return out;
}
