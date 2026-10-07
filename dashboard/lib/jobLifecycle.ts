import type { TransactionSql } from "postgres";

export type LifecycleStage = "legacy" | "collect" | "enforced";
export function parseLifecycleStage(value: unknown): LifecycleStage | null {
  return value === "legacy" || value === "collect" || value === "enforced" ? value : null;
}

/** Must be the first lock in a short mutating transaction. No network work here. */
export async function acquireLifecycleGate(tx: TransactionSql): Promise<void> {
  await tx`SELECT set_config('lock_timeout', '2s', true),
                  set_config('statement_timeout', '5s', true)`;
  await tx`SELECT pg_advisory_xact_lock(20916294442894917)`;
}

export async function withJobProtection<T>(
  tx: TransactionSql, jobId: string, versionId: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  await acquireLifecycleGate(tx);
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'lifecycle:job:' + jobId}, 0))`;
  const controls = await tx`SELECT safety_stage FROM lifecycle_control WHERE singleton`;
  const stage = parseLifecycleStage(controls[0]?.safety_stage);
  if (stage === null) throw new Error("Lifecycle control is unavailable");
  const jobs = await tx`SELECT description, description_version_id FROM jobs WHERE id = ${jobId}`;
  if (!jobs[0]) throw new Error("Job is unavailable");
  if (stage === "enforced" && (!versionId || jobs[0].description_version_id !== versionId || typeof jobs[0].description !== "string")) {
    throw new Error("Job payload requires hydration before protection");
  }
  return operation();
}

export interface PayloadDemand {
  id: string; jobId: string; kind: string; status: string;
}
export function parsePayloadDemand(value: unknown): PayloadDemand | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (!("id" in value) || typeof value.id !== "string" ||
      !("job_id" in value) || typeof value.job_id !== "string" ||
      !("kind" in value) || typeof value.kind !== "string" ||
      !["description", "questions", "review", "prepare", "generation"].includes(value.kind) ||
      !("status" in value) || typeof value.status !== "string" ||
      !["pending", "running", "ready", "deferred", "failed", "cancelled"].includes(value.status)) return null;
  return { id: value.id, jobId: value.job_id, kind: value.kind, status: value.status };
}
