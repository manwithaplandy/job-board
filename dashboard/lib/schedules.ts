export type Schedule =
  | { kind: "interval"; everyHours: number; atMinute: number } // anchored at hour 0 (UTC)
  | { kind: "weekly"; weekday: number; atHour: number; atMinute: number }; // weekday 0=Sun..6=Sat (UTC)

// These mirror the Railway crons (poller & reviewer = Railway service settings,
// `0 */2 * * *`; discovery = railway.discovery.json `0 6 * * 1`). Keep in sync
// manually if the Railway schedules change.
export const SCHEDULES = {
  poller:    { kind: "interval", everyHours: 2, atMinute: 0 },
  reviewer:  { kind: "interval", everyHours: 2, atMinute: 0 },
  discovery: { kind: "weekly", weekday: 1, atHour: 6, atMinute: 0 }, // Mon 06:00 UTC
} as const;

/** Returns the next fire time strictly after `now`. All time math in UTC. */
export function nextRun(schedule: Schedule, now: Date): Date {
  const nowMs = now.getTime();

  if (schedule.kind === "interval") {
    const { everyHours, atMinute } = schedule;
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const dayStartMs = Date.UTC(y, m, d, 0, 0, 0, 0);

    for (let h = 0; h < 24; h += everyHours) {
      const candidateMs = dayStartMs + h * 3_600_000 + atMinute * 60_000;
      if (candidateMs > nowMs) return new Date(candidateMs);
    }

    // No candidate remains today — first slot of next day
    return new Date(Date.UTC(y, m, d + 1, 0, atMinute, 0, 0));
  }

  // weekly
  const { weekday, atHour, atMinute } = schedule;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const currentDay = now.getUTCDay();

  const daysUntil = (weekday - currentDay + 7) % 7;
  const candidateMs = Date.UTC(y, m, d + daysUntil, atHour, atMinute, 0, 0);

  if (candidateMs > nowMs) return new Date(candidateMs);

  // Same weekday but at or past the fire time — advance one week
  return new Date(Date.UTC(y, m, d + daysUntil + 7, atHour, atMinute, 0, 0));
}
