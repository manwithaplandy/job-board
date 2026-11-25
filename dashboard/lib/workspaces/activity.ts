// The activity panel's rows (plan Task 1.20, spec 6.7): what the agent changed, when,
// and whether it ran unattended. Read-only, under RLS, from the audit log
// (listRecentActions). A press the user made on a surface (actor user_via_surface) is
// the user's own change and is not listed. Each row's text is a fixed label for its
// kind plus, where the action names a job, the job's title and company from the
// database; nothing here comes from model output.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { listRecentActions, type ActionKind } from "@/lib/agent/actions/audit";

export interface ActivityItem {
  id: number;
  /** A fixed label for what was changed. */
  label: string;
  /** "Title at Company" when the action names a job that still exists, else null. */
  subject: string | null;
  unattended: boolean;
  undone: boolean;
  createdAt: string;
}

export const ACTIVITY_LABELS: Record<ActionKind, string> = {
  "shortlist.set": "Moved a job on your shortlist",
  "application.set_stage": "Moved an application to a new stage",
  "application.add_note": "Added a note to an application",
  "analytics.set_tiles": "Changed your pinned analytics",
  "document.update_draft": "Edited a cover letter draft",
  "profile.set_resume": "Set your résumé",
};

const ACTIVITY_LIMIT = 30;
const SUBJECT_MAX = 160;

function jobIdOf(targetKey: unknown): string | null {
  const r = parseOrNull(z.object({ jobId: z.string().regex(JOB_ID_RE).max(300) }), targetKey);
  return r?.jobId ?? null;
}

function clamp(text: string): string {
  return text.length <= SUBJECT_MAX ? text : `${Array.from(text).slice(0, SUBJECT_MAX - 1).join("")}…`;
}

const jobRowSchema = z.object({ id: z.string(), title: z.string(), company: z.string() });

/** The agent's newest changes for the caller, newest first. */
export async function listActivity(userId: string): Promise<ActivityItem[]> {
  const actions = (await listRecentActions(userId, ACTIVITY_LIMIT)).filter((a) => a.actor !== "user_via_surface");
  const jobIds = [...new Set(actions.map((a) => jobIdOf(a.targetKey)).filter((id): id is string => id !== null))];
  const subjects = new Map<string, string>();
  if (jobIds.length > 0) {
    const rows = await withUserSql(userId, (tx) => tx`
      SELECT j.id, j.title, COALESCE(c.display_name, c.name) AS company
      FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id = ANY(${jobIds}::text[])`);
    for (const raw of rows) {
      const r = parseOrNull(jobRowSchema, raw);
      if (r) subjects.set(r.id, clamp(`${r.title} at ${r.company}`));
    }
  }
  return actions.map((a) => {
    const jobId = jobIdOf(a.targetKey);
    return {
      id: a.id,
      label: ACTIVITY_LABELS[a.kind],
      subject: jobId === null ? null : (subjects.get(jobId) ?? null),
      unattended: a.actor === "agent_unattended",
      undone: a.undoneAt !== null,
      createdAt: a.createdAt,
    };
  });
}

/** listActivity, or null when the read failed (the panel then shows a fixed line). */
export async function readActivity(userId: string): Promise<ActivityItem[] | null> {
  try {
    return await listActivity(userId);
  } catch (e) {
    console.error("activity: read failed", e);
    return null;
  }
}
