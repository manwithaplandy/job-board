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

export type DemandKind = "description" | "questions" | "review" | "prepare" | "generation";
export type DemandResult = { status: "legacy" | "pending" | "deferred"; id: string | null } |
  { status: "ready"; id: string; versionId: string; description: string; kind?: DemandKind; questions: ReturnType<typeof parseGreenhouseQuestions> };
import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

export function parseDemandResult(value: unknown): DemandResult | null {
  const basic = parsePayloadDemand(value);
  if (!basic || typeof value !== "object" || value === null) return null;
  if (basic.status !== "ready") return {status: basic.status === "deferred" || basic.status === "failed" || basic.status === "cancelled" ? "deferred" : "pending", id:basic.id};
  if (!("job_version_id" in value) || typeof value.job_version_id !== "string" ||
      !("description_snapshot" in value) || typeof value.description_snapshot !== "string" || !value.description_snapshot.trim()) return null;
  return {status:"ready",id:basic.id,versionId:value.job_version_id,description:value.description_snapshot,
    questions:parseGreenhouseQuestions("questions_snapshot" in value ? value.questions_snapshot : null)};
}

export function parseRequestBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

export async function requestJobPayload(userId: string, jobId: string, kind: DemandKind): Promise<DemandResult> {
  const {withUserDemandSql} = await import("@/lib/db");
  return withUserDemandSql(userId, async (tx,legacyAllowed) => {
    // Regenerating one leg of an existing package must use its immutable input,
    // otherwise a single package could silently mix two description versions.
    if (kind === "prepare" || kind === "generation") {
      const existing = await tx`SELECT d.* FROM application_packages p JOIN job_payload_demands d
        ON d.user_id=p.user_id AND d.job_id=p.job_id AND d.job_version_id=p.job_version_id
        WHERE p.user_id=${userId}::uuid AND p.job_id=${jobId} AND d.status='ready'
        ORDER BY d.settled_at DESC LIMIT 1`;
      const pinned = parseDemandResult(existing[0]);
      if (pinned?.status === "ready") {
        const storedKind = parsePayloadDemand(existing[0])?.kind;
        return {...pinned,kind: storedKind === "prepare" ? "prepare" : storedKind === "generation" ? "generation" : kind};
      }
    }
    const rows = await tx`SELECT * FROM job_payload_demands WHERE user_id=${userId}::uuid AND job_id=${jobId}
      AND kind=${kind} AND status='ready' AND job_version_id IS NOT NULL
      AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-
        CASE WHEN ${kind} IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
      ORDER BY settled_at DESC LIMIT 1`;
    const ready = parseDemandResult(rows[0]);
    if (ready?.status === "ready") return {...ready,kind};
    if (legacyAllowed) {
      const cached=await tx`SELECT j.description,c.ats,q.questions FROM jobs j JOIN companies c ON c.id=j.company_id
        LEFT JOIN job_questions q ON q.job_id=j.id WHERE j.id=${jobId}`;
      const row=cached[0];
      if (typeof row?.description === "string" && row.description.trim() &&
        (!(kind === "questions" || kind === "prepare") || row.ats !== "greenhouse" || parseGreenhouseQuestions(row.questions))) {
        return {status:"legacy",id:null};
      }
    }
    await tx`INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES(${userId}::uuid,${jobId},${kind})
      ON CONFLICT(user_id,job_id,kind) WHERE status IN ('pending','running') DO NOTHING`;
    const pending = await tx`SELECT * FROM job_payload_demands WHERE user_id=${userId}::uuid AND job_id=${jobId}
      AND kind=${kind} AND status IN ('pending','running') LIMIT 1`;
    const result = parseDemandResult(pending[0]);
    if (!result) throw new Error("Demand could not be persisted");
    return result;
  });
}

/** Call after successful private writes in their same owner transaction. */
export async function consumeJobVersion(tx: TransactionSql, jobId: string, versionId: string, kind: DemandKind): Promise<void> {
  const rows = await tx`UPDATE job_payload_demands SET consumed_at=clock_timestamp()
    WHERE user_id=app_user_id() AND job_id=${jobId} AND job_version_id=${versionId}::uuid
      AND kind=${kind} AND status='ready' AND NULLIF(btrim(description_snapshot),'') IS NOT NULL RETURNING id`;
  if (!rows.length) throw new Error("Exact durable demand version required");
}

export async function readJobSnapshot(tx: TransactionSql, jobId: string) {
  const rows = await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at
    FROM job_payload_demands WHERE user_id=app_user_id() AND job_id=${jobId} AND status='ready'
    ORDER BY settled_at DESC LIMIT 1`;
  const row = rows[0];
  return row && typeof row.job_version_id === "string" && typeof row.description_snapshot === "string"
    ? {versionId:row.job_version_id,description:row.description_snapshot,
       questions:parseGreenhouseQuestions(row.questions_snapshot),capturedAt:row.snapshot_captured_at}
    : null;
}

export async function readPrivateSnapshot(tx: TransactionSql, jobId: string, source: "application_packages" | "job_reviews") {
  const rows = source === "application_packages"
    ? await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at FROM application_packages WHERE user_id=app_user_id() AND job_id=${jobId}`
    : await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at FROM job_reviews WHERE user_id=app_user_id() AND job_id=${jobId}`;
  const row = rows[0];
  if (row && typeof row.job_version_id === "string" && typeof row.description_snapshot === "string") {
    return {versionId:row.job_version_id,description:row.description_snapshot,questions:parseGreenhouseQuestions(row.questions_snapshot),capturedAt:row.snapshot_captured_at};
  }
  return readJobSnapshot(tx, jobId);
}

/** Total parser shared by generation context reads, including malformed jsonb. */
export function parseGenerationContext(value: unknown) {
  const row = parseRequestBody(value);
  if (typeof row.title !== "string" || typeof row.company_name !== "string") return null;
  const text = (v:unknown) => typeof v === "string" ? v : null;
  const strings = (v:unknown) => Array.isArray(v) ? v.filter((x):x is string => typeof x === "string") : [];
  const requirements: {text:string;met:boolean}[] = [];
  if (Array.isArray(row.requirements)) for (const raw of row.requirements) {
    const item = parseRequestBody(raw);
    if (typeof item.text === "string" && typeof item.met === "boolean") requirements.push({text:item.text,met:item.met});
  }
  return {title:row.title,company_name:row.company_name,description:text(row.description),about:text(row.about),
    url:text(row.url) ?? "", external_id:text(row.external_id) ?? "", ats:text(row.ats) ?? "", company_token:text(row.company_token) ?? "",
    requirements,skill_gaps:strings(row.skill_gaps),red_flags:strings(row.red_flags)};
}
