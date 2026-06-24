export type Health = "ok" | "warn" | "stale";

const HOUR_MS = 3_600_000;

export function computeHealth(
  run: { finished_at: string | null; companies_failed: number | null } | null,
  now: Date,
  staleHours: number,
): Health {
  if (!run || !run.finished_at) return "stale";
  const ageHours = (now.getTime() - new Date(run.finished_at).getTime()) / HOUR_MS;
  if (ageHours > staleHours) return "stale";
  if ((run.companies_failed ?? 0) > 0) return "warn";
  return "ok";
}

export function isNew(firstSeenAt: string, now: Date, windowHours: number): boolean {
  const ageHours = (now.getTime() - new Date(firstSeenAt).getTime()) / HOUR_MS;
  return ageHours <= windowHours;
}
