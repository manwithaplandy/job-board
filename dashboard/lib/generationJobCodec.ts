// Wire/DB codec for generation_jobs rows (async background generation tracking).
//
// Pure module — importable from BOTH the server data layer (lib/generationJobs.ts)
// and the client poller (components/generation/GenerationToastProvider.tsx), so
// "valid generation job" has one definition and serialize/deserialize can't drift.
// House boundary rule (dashboard/CLAUDE.md): values that crossed the DB or fetch
// boundary go through a total parser, never a bare `as` cast — kind/status are
// CHECK-constrained in Postgres, but a manual write or a stale client build could
// still hand us anything.

export type GenerationJobKind = "resume" | "cover" | "prepare";
export type GenerationJobStatus = "pending" | "ready" | "failed";

/** One tracked generation, as served by GET /api/generations and the 202 bodies. */
export interface GenerationJobView {
  id: string;
  jobId: string;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  /** User-safe failure (or partial-failure) message — never a raw upstream error. */
  error: string | null;
  /** Joined from jobs/companies for toast copy; null if the job row vanished. */
  jobTitle: string | null;
  company: string | null;
  createdAt: string;
  updatedAt: string;
}

const KINDS: readonly GenerationJobKind[] = ["resume", "cover", "prepare"];
const STATUSES: readonly GenerationJobStatus[] = ["pending", "ready", "failed"];

export function parseGenerationJobKind(v: unknown): GenerationJobKind | null {
  return KINDS.includes(v as GenerationJobKind) ? (v as GenerationJobKind) : null;
}

export function parseGenerationJobStatus(v: unknown): GenerationJobStatus | null {
  return STATUSES.includes(v as GenerationJobStatus) ? (v as GenerationJobStatus) : null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
// timestamptz arrives as a Date from postgres.js and as an ISO string over the wire.
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" && v !== "" ? v : null;

/** Total parse of one generation job (DB row in snake_case or wire view in camelCase). */
export function parseGenerationJob(raw: unknown): GenerationJobView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const jobId = str(r.jobId ?? r.job_id);
  const kind = parseGenerationJobKind(r.kind);
  const status = parseGenerationJobStatus(r.status);
  const createdAt = iso(r.createdAt ?? r.created_at);
  const updatedAt = iso(r.updatedAt ?? r.updated_at);
  if (!id || !jobId || !kind || !status || !createdAt || !updatedAt) return null;
  return {
    id,
    jobId,
    kind,
    status,
    error: str(r.error),
    jobTitle: str(r.jobTitle ?? r.job_title),
    company: str(r.company),
    createdAt,
    updatedAt,
  };
}

/**
 * Total parse of the GET /api/generations body ({ generations: [...] }). Malformed
 * entries are dropped (never propagated to React), a malformed envelope yields [].
 */
export function parseGenerationJobList(body: unknown): GenerationJobView[] {
  if (typeof body !== "object" || body === null) return [];
  const list = (body as Record<string, unknown>).generations;
  if (!Array.isArray(list)) return [];
  return list
    .map(parseGenerationJob)
    .filter((j): j is GenerationJobView => j !== null);
}

/**
 * Kinds currently pending for one board job — drives the per-job "generating…"
 * indicator from the provider's server-backed state (correct across navigation
 * and reloads, unlike the old per-component boolean). A pending 'prepare' implies
 * both panels are busy; the caller expands it.
 */
export function pendingKindsForJob(
  jobs: GenerationJobView[],
  jobId: string,
): Set<GenerationJobKind> {
  const kinds = new Set<GenerationJobKind>();
  for (const j of jobs) if (j.status === "pending" && j.jobId === jobId) kinds.add(j.kind);
  return kinds;
}

// Custom event the toast's "View" action dispatches so an already-mounted board
// selects the job in place (the listener calls preventDefault to claim it); when
// nothing claims it, the provider falls back to a router push to /?job=<id>, which
// the board's mount-time deep-link seed resolves.
export const OPEN_JOB_EVENT = "rolefit:open-job";
