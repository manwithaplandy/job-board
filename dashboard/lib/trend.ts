// ── Pure trend helpers (DB-free; unit-tested in trend.test.ts) ───────────────

// Permissive row shape for tests; the helpers below are generic and keep the
// caller's concrete type (e.g. JobDiscoveryDay), so numeric fields stay typed `number`.
export type Point = { day: string; [metric: string]: number | string };

const DAY_MS = 86_400_000;

/** UTC date portion (YYYY-MM-DD) of an ISO timestamp or date string. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Monday (UTC) of the ISO week containing `dayISO`, as YYYY-MM-DD. */
export function weekStart(dayISO: string): string {
  const d = new Date(dayOf(dayISO) + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const deltaToMonday = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - deltaToMonday);
  return d.toISOString().slice(0, 10);
}

/** Dense ascending series of `days` points ending on nowISO's UTC date. */
export function fillDays<T extends { day: string }>(
  rows: T[], days: number, nowISO: string, numericKeys: (keyof T)[],
): T[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const end = new Date(dayOf(nowISO) + "T00:00:00Z").getTime();
  const out: T[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    const existing = byDay.get(day);
    if (existing) {
      out.push(existing);
    } else {
      const zero = { day } as T;
      for (const k of numericKeys) (zero as Record<string, unknown>)[k as string] = 0;
      out.push(zero);
    }
  }
  return out;
}

/** Re-aggregate daily points into ISO-week points. */
export function toWeekly<T extends { day: string }>(
  rows: T[], sumKeys: (keyof T)[], lastKeys: (keyof T)[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const wk = weekStart(r.day);
    const g = groups.get(wk);
    if (g) g.push(r);
    else groups.set(wk, [r]);
  }
  const out: T[] = [];
  for (const [wk, members] of groups) {
    const sorted = [...members].sort((a, b) => (a.day < b.day ? -1 : 1));
    const acc = { day: wk } as T;
    for (const k of sumKeys) {
      (acc as Record<string, unknown>)[k as string] =
        sorted.reduce((s, m) => s + ((m[k] as unknown as number) ?? 0), 0);
    }
    for (const k of lastKeys) {
      (acc as Record<string, unknown>)[k as string] = (sorted[sorted.length - 1][k] as unknown as number) ?? 0;
    }
    out.push(acc);
  }
  out.sort((a, b) => (a.day < b.day ? -1 : 1));
  return out;
}

/** Keep points whose day is within the last `days` of nowISO's UTC date. */
export function sliceWindow<T extends { day: string }>(rows: T[], days: number, nowISO: string): T[] {
  const end = new Date(dayOf(nowISO) + "T00:00:00Z").getTime();
  const cutoff = end - (days - 1) * DAY_MS;
  return rows.filter((r) => new Date(r.day + "T00:00:00Z").getTime() >= cutoff);
}

/** Safe division: null (not NaN) when the denominator is zero. */
export function rate(numer: number, denom: number): number | null {
  return denom === 0 ? null : numer / denom;
}
