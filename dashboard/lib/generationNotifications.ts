import type { GenerationJobView } from "@/lib/generationJobCodec";

// Pure client-side logic for the generation completion toasts: which settled
// generations still need a toast (localStorage-backed de-dupe, so a reload or a
// second tab never re-toasts a completion the user already saw) and the toast
// copy per kind/outcome. Kept out of the React provider so it tests in node.

// localStorage key → { [generationJobId]: notifiedAtMs }. Versioned so a future
// shape change can just bump the suffix instead of migrating.
export const NOTIFIED_STORAGE_KEY = "rolefit:generation-toasts:v1";

// Entries older than this are pruned on write. Needs only to outlast the server's
// recently-settled window (10 min) with margin; a day keeps the record tiny.
const NOTIFIED_TTL_MS = 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Total parse of the notified-ids record; malformed storage yields {} (fetch/storage boundary rule). */
export function readNotifiedIds(storage: StorageLike | null): Record<string, number> {
  if (!storage) return {};
  let raw: string | null = null;
  try {
    raw = storage.getItem(NOTIFIED_STORAGE_KEY);
  } catch {
    return {}; // storage access can throw (privacy modes) — degrade to "nothing notified"
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(parsed)) {
    if (typeof at === "number" && Number.isFinite(at)) out[id] = at;
  }
  return out;
}

/** Record a fired toast (pruning expired entries). Best-effort: a full/blocked storage is ignored. */
export function recordNotified(
  storage: StorageLike | null,
  notified: Record<string, number>,
  id: string,
  now: number,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, at] of Object.entries(notified)) {
    if (now - at < NOTIFIED_TTL_MS) next[k] = at;
  }
  next[id] = now;
  try {
    storage?.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort — in-memory de-dupe still holds for this tab's lifetime
  }
  return next;
}

/** Settled generations that have not been toasted yet (in server order). */
export function settledUnnotified(
  jobs: GenerationJobView[],
  notified: Record<string, number>,
): GenerationJobView[] {
  return jobs.filter((j) => j.status !== "pending" && !(j.id in notified));
}

export interface GenerationToastCopy {
  tone: "success" | "warning" | "error";
  title: string;
  /** Secondary line (user-safe failure / partial note); null = title only. */
  description: string | null;
}

const READY_TITLE: Record<GenerationJobView["kind"], string> = {
  resume: "Résumé ready",
  cover: "Cover letter ready",
  prepare: "Application prefilled",
};
const FAILED_TITLE: Record<GenerationJobView["kind"], string> = {
  resume: "Résumé generation failed",
  cover: "Cover letter generation failed",
  prepare: "Prefill failed",
};

/** Toast copy for a settled generation. `· {company}` identifies the job at a glance. */
export function toastCopyFor(job: GenerationJobView): GenerationToastCopy {
  const suffix = job.company ? ` · ${job.company}` : "";
  if (job.status === "ready") {
    // A ready prepare can carry a user-safe partial note (one LLM leg failed but
    // the package persisted) — surface it as a warning rather than a clean success.
    if (job.error) {
      return { tone: "warning", title: `${READY_TITLE[job.kind]}${suffix}`, description: job.error };
    }
    return { tone: "success", title: `${READY_TITLE[job.kind]}${suffix}`, description: null };
  }
  return { tone: "error", title: `${FAILED_TITLE[job.kind]}${suffix}`, description: job.error };
}
