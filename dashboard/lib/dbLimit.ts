// Bounded concurrency for DB batches. Pool max is 3 (lib/db.ts); postgres.js
// queues excess queries, but Supavisor has wedged under unbounded fan-out —
// cap concurrent queries at 2 and reuse this everywhere instead of seq().
export function dbLimit<T>(tasks: Array<() => Promise<T>>, limit = 2): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }
  return Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker)).then(() => results);
}
