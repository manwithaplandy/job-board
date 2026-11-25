// Which workspace rows carry a "by agent" marker with Undo (plan Task 1.5). A row gets
// one when the newest audited write to it is an agent's that is not undone yet. The
// page reads the caller's recent actions (listRecentActions, newest first) and passes
// the result to the board; nothing here writes.
import { z } from "zod";
import type { ActionKind, StoredAction } from "@/lib/agent/actions/audit";

const jobTargetSchema = z.object({ jobId: z.string() }).passthrough();

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
