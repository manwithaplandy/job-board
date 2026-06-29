export type Health = "ok" | "warn" | "stale";

const HOUR_MS = 3_600_000;

export function computeHealth(
  run: { finished_at: string | null; failures: number | null } | null,
  now: Date,
  staleHours: number,
): Health {
  if (!run || !run.finished_at) return "stale";
  const ageHours = (now.getTime() - new Date(run.finished_at).getTime()) / HOUR_MS;
  if (ageHours > staleHours) return "stale";
  if ((run.failures ?? 0) > 0) return "warn";
  return "ok";
}

export function isNew(firstSeenAt: string, now: Date, windowHours: number): boolean {
  const ageHours = (now.getTime() - new Date(firstSeenAt).getTime()) / HOUR_MS;
  return ageHours <= windowHours;
}

export type PipelineStatus = "running" | "failed" | "warn" | "stale" | "ok";

export const RUNNING_GRACE_HOURS = 3;
export const POLLER_FAILURE_WARN_RATE = 0.6;

export function derivePipelineStatus(args: {
  latest:
    | {
        started_at: string;
        finished_at: string | null;
        status?: string | null; // discovery only: 'running'|'completed'|'halted_no_credits'|'error'
        companies_ok?: number | null; // poller only
        companies_failed?: number | null; // poller only
      }
    | null;
  lastSuccess: { finished_at: string | null } | null;
  now: Date;
  intervalHours: number;
}): PipelineStatus {
  const { latest, lastSuccess, now, intervalHours } = args;
  const ageHours = (iso: string) =>
    (now.getTime() - new Date(iso).getTime()) / HOUR_MS;

  // 1. running / crash-failed — unfinished run
  if (latest !== null && latest.finished_at === null) {
    return ageHours(latest.started_at) < RUNNING_GRACE_HOURS ? "running" : "failed";
  }

  // 2. discovery error states (finished but terminal failure status)
  if (
    latest !== null &&
    (latest.status === "error" || latest.status === "halted_no_credits")
  ) {
    return "failed";
  }

  // 3. stale — no successful run, or last success too old
  if (
    lastSuccess === null ||
    lastSuccess.finished_at === null ||
    ageHours(lastSuccess.finished_at) > 2 * intervalHours
  ) {
    return "stale";
  }

  // 4. warn — poller only, high failure rate
  if (
    latest !== null &&
    latest.companies_ok != null &&
    latest.companies_failed != null
  ) {
    const total = latest.companies_ok + latest.companies_failed;
    if (total > 0 && latest.companies_failed / total > POLLER_FAILURE_WARN_RATE) {
      return "warn";
    }
  }

  // 5. ok
  return "ok";
}
