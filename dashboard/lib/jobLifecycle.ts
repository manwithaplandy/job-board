import type { TransactionSql } from "postgres";
import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

export {sourceClosedPredicate,parseJobLifecycle,unwrapLifecycleJson,discoveryPredicate,discoveryVisible,lifecycleLabels,parseStringList,parseRequirements} from "./jobLifecycleState";
export type {JobLifecycle,SqlFragment} from "./jobLifecycleState";

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
export type DemandResult =
  | {
      status: "legacy" | "pending" | "deferred";
      id: string | null;
      reason?: string;
      description?: string;
      questions?: ReturnType<typeof parseGreenhouseQuestions>;
    }
  | {
      status: "ready";
      id: string;
      versionId: string;
      description: string;
      kind: DemandKind;
      questions: ReturnType<typeof parseGreenhouseQuestions>;
    };

function parseDemandKind(value: unknown): DemandKind | null {
  return value === "description" || value === "questions" || value === "review" ||
    value === "prepare" || value === "generation" ? value : null;
}

export function parseDemandResult(value: unknown): DemandResult | null {
  const basic = parsePayloadDemand(value);
  if (!basic || typeof value !== "object" || value === null) return null;
  if (basic.status !== "ready") return {status: basic.status === "deferred" || basic.status === "failed" || basic.status === "cancelled" ? "deferred" : "pending", id:basic.id};
  if (!("job_version_id" in value) || typeof value.job_version_id !== "string" ||
      !("description_snapshot" in value) || typeof value.description_snapshot !== "string" || !value.description_snapshot.trim()) return null;
  const kind = parseDemandKind(basic.kind);
  if (!kind) return null;
  return {status:"ready",id:basic.id,kind,versionId:value.job_version_id,description:value.description_snapshot,
    questions:parseGreenhouseQuestions("questions_snapshot" in value ? value.questions_snapshot : null)};
}

export function parseRequestBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

/** Non-null generated output is retained work; instructions/status alone are not. */
function hasPackageArtifacts(row: Record<string, unknown>): boolean {
  return row.resume_json != null || row.cover_letter_json != null || row.prefilled_answers != null;
}

export async function requestJobPayload(userId: string, jobId: string, kind: DemandKind): Promise<DemandResult> {
  const { withUserDemandSql } = await import("@/lib/db");
  return withUserDemandSql(userId, async (tx, legacyAllowed) => {
    // The package's saved input is authoritative, including its question schema.
    // A public version identifies metadata/JD, not a particular question capture.
    const packages = kind === "prepare" || kind === "generation"
      ? await tx`SELECT job_version_id, description_snapshot, questions_snapshot, resume_json, cover_letter_json, prefilled_answers
          FROM application_packages WHERE user_id=${userId}::uuid AND job_id=${jobId}`
      : [];
    const saved = packages[0] && hasPackageArtifacts(packages[0]) ? packages[0] : null;
    if (saved && (typeof saved.job_version_id !== "string" || typeof saved.description_snapshot !== "string")) {
      // Never attach later provenance to old artifacts. Pre-cutover legacy work
      // retains its nullable provenance; paused lifecycle work remains honest.
      const unavailable: DemandResult = {
        status: "deferred", id: null,
        reason: "This package has unknown legacy inputs. Its saved artifacts remain available. Preparation needs a full input recapture, which is not yet supported.",
      };
      if (!legacyAllowed) return unavailable;
      let questions = parseGreenhouseQuestions(saved.questions_snapshot);
      if (kind === "prepare" && questions === null) {
        const cached = await tx`SELECT questions FROM job_questions WHERE job_id=${jobId}`;
        questions = parseGreenhouseQuestions(cached[0]?.questions);
        if (questions === null) return unavailable;
      }
      return {
        status: "legacy", id: null, questions,
        ...(typeof saved.description_snapshot === "string" ? {description:saved.description_snapshot} : {}),
      };
    }
    if (saved) {
      const matches = await tx`SELECT d.* FROM job_payload_demands d
        WHERE d.user_id=${userId}::uuid AND d.job_id=${jobId} AND d.status='ready'
          AND d.job_version_id=${saved.job_version_id}::uuid
          AND d.description_snapshot=${saved.description_snapshot}
          AND (d.questions_snapshot IS NOT DISTINCT FROM ${saved.questions_snapshot == null ? null : JSON.stringify(saved.questions_snapshot)}::text::jsonb
            OR (${kind}='prepare' AND ${saved.questions_snapshot == null} AND d.kind='prepare' AND d.questions_snapshot IS NOT NULL))
          AND (${kind}<>'prepare' OR d.questions_snapshot IS NOT NULL)
        ORDER BY d.settled_at, d.id LIMIT 1`;
      const pinned = parseDemandResult(matches[0]);
      if (pinned?.status === "ready" && (kind !== "prepare" || pinned.questions !== null)) return pinned;
      // Missing Q is real preparation work; the worker preserves the saved JD
      // and supplies the first question capture. Missing receipts are recreated
      // from the exact saved package input by the service, never guessed here.
    } else {
      const rows = await tx`SELECT * FROM job_payload_demands WHERE user_id=${userId}::uuid AND job_id=${jobId}
        AND kind=${kind} AND status='ready' AND job_version_id IS NOT NULL
        AND (${kind} NOT IN ('questions','prepare') OR questions_snapshot IS NOT NULL)
        AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-
          CASE WHEN ${kind} IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
        ORDER BY settled_at DESC LIMIT 1`;
      const ready = parseDemandResult(rows[0]);
      if (ready?.status === "ready" && (!(kind === "prepare" || kind === "questions") || ready.questions !== null)) return ready;
      if (legacyAllowed) {
        const cached = await tx`SELECT j.description,c.ats,q.questions FROM jobs j JOIN companies c ON c.id=j.company_id
          LEFT JOIN job_questions q ON q.job_id=j.id WHERE j.id=${jobId}`;
        const row = cached[0];
        if (typeof row?.description === "string" && row.description.trim() &&
          (!(kind === "questions" || kind === "prepare") || row.ats !== "greenhouse" || parseGreenhouseQuestions(row.questions))) {
          return { status: "legacy", id: null };
        }
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

/** Stamp the exact durable receipt consumed, never every capture of a version. */
export async function consumeJobVersion(
  tx: TransactionSql, jobId: string, versionId: string, kind: DemandKind, demandId: string,
  input: { description: string; questions: ReturnType<typeof parseGreenhouseQuestions> },
): Promise<void> {
  const rows = await tx`UPDATE job_payload_demands SET consumed_at=clock_timestamp()
    WHERE id=${demandId}::uuid AND user_id=app_user_id() AND job_id=${jobId}
      AND job_version_id=${versionId}::uuid AND kind=${kind} AND status='ready'
      AND description_snapshot=${input.description}
      AND questions_snapshot IS NOT DISTINCT FROM ${input.questions ? JSON.stringify(input.questions) : null}::text::jsonb
      RETURNING id`;
  if (rows.length !== 1) throw new Error("Exact durable demand receipt required");
}

/** Serialize output/input agreement with the package mutation under its job lock. */
export async function assertPackageInput(tx: TransactionSql, jobId: string, payload?: DemandResult): Promise<boolean> {
  const rows = await tx`SELECT job_version_id,description_snapshot,questions_snapshot,resume_json,cover_letter_json,prefilled_answers FROM application_packages
    WHERE user_id=app_user_id() AND job_id=${jobId} FOR UPDATE`;
  const saved = rows[0];
  if (!saved || !hasPackageArtifacts(saved)) return true;
  if (payload?.status !== "ready") {
    if (saved.job_version_id != null ||
      (typeof saved.description_snapshot === "string" && payload?.description !== saved.description_snapshot)) {
      throw new Error("Package input changed; retry using its saved input");
    }
    return false;
  }
  const matches = await tx`SELECT 1 FROM application_packages WHERE user_id=app_user_id() AND job_id=${jobId}
    AND job_version_id=${payload.versionId}::uuid AND description_snapshot=${payload.description}
    AND (questions_snapshot IS NOT DISTINCT FROM ${payload.questions ? JSON.stringify(payload.questions) : null}::text::jsonb
      OR (questions_snapshot IS NULL AND ${payload.kind}='prepare' AND ${payload.questions !== null}))`;
  if (!matches.length) throw new Error("Package input changed; retry using its saved input");
  return false;
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
  if (row) {
    // An existing artifact with unknown provenance is not a new action.
    return {
      versionId: typeof row.job_version_id === "string" ? row.job_version_id : null,
      description: typeof row.description_snapshot === "string" ? row.description_snapshot : null,
      questions: parseGreenhouseQuestions(row.questions_snapshot),
      capturedAt: row.snapshot_captured_at ?? null,
    };
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
