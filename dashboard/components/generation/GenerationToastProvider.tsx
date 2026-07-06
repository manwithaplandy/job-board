"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import {
  OPEN_JOB_EVENT,
  parseGenerationJobList,
  type GenerationJobView,
} from "@/lib/generationJobCodec";
import {
  readNotifiedIds, recordNotified, settledUnnotified, toastCopyFor,
} from "@/lib/generationNotifications";

// Global async-generation tracker (mounted once in the root layout). Polls
// GET /api/generations while any generation is pending and:
//   - fires ONE completion toast per settled generation ("Résumé ready · Acme"
//     with a View deep-link), de-duped across reloads/tabs via localStorage;
//   - exposes the pending set so the board's per-job "generating…" indicator is
//     server-backed (correct across navigation, reload, and tab-close — the old
//     per-component boolean died on unmount);
//   - exposes a settled feed the board consumes to reload the persisted package.
//
// Anonymous visitors: /api/generations is not in PUBLIC_PREFIXES, so the auth
// proxy 307s the poll to /login — detected via res.redirected/401 and polling
// disables until a notifyStarted() (which only ever follows an authed 202).

const POLL_INTERVAL_MS = 4_000;
// An optimistic notifyStarted() row survives merges for this long even if a poll
// response predating the 202 doesn't include it yet.
const OPTIMISTIC_TTL_MS = 30_000;

export interface GenerationSettledFeed {
  /** Monotonic per-provider sequence so consumers can skip already-handled batches. */
  seq: number;
  /** pending→settled transitions observed by THIS tab (not historical settles). */
  jobs: GenerationJobView[];
}

export interface GenerationTracker {
  /** Every generation currently known pending (server truth + fresh 202s). */
  pending: GenerationJobView[];
  settledFeed: GenerationSettledFeed | null;
  /** Register a 202-accepted generation: shows as pending immediately + starts polling. */
  notifyStarted: (job: GenerationJobView) => void;
  /** Re-poll now (e.g. after a 202 whose body couldn't be parsed). */
  refresh: () => void;
}

const GenerationTrackerContext = createContext<GenerationTracker | null>(null);

/** Null outside the provider (e.g. isolated component tests) — callers must degrade. */
export function useGenerationTracker(): GenerationTracker | null {
  return useContext(GenerationTrackerContext);
}

const storage = (): Storage | null => (typeof window === "undefined" ? null : window.localStorage);

// Semantic equality for the tracked-jobs map (status/error/updatedAt are the only
// fields that move on a live row) — lets the poller skip no-op state publishes.
function sameJobs(
  a: Record<string, GenerationJobView>,
  b: Record<string, GenerationJobView>,
): boolean {
  const aIds = Object.keys(a);
  if (aIds.length !== Object.keys(b).length) return false;
  return aIds.every((id) => {
    const x = a[id];
    const y = b[id];
    return y !== undefined && x.status === y.status && x.error === y.error && x.updatedAt === y.updatedAt;
  });
}

export function GenerationToastProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Record<string, GenerationJobView>>({});
  const [settledFeed, setSettledFeed] = useState<GenerationSettledFeed | null>(null);
  // Mirror of `jobs` for the poll path (transition diffing without effect churn).
  const jobsRef = useRef<Record<string, GenerationJobView>>({});
  const optimisticRef = useRef<Map<string, number>>(new Map());
  const enabledRef = useRef(true);
  const pollInFlightRef = useRef(false);
  const seqRef = useRef(0);

  // Toast "View" → select the job in place when a board is mounted (it claims the
  // event via preventDefault), else deep-link to the board's ?job= seed.
  const openJob = useCallback((jobId: string) => {
    const ev = new CustomEvent(OPEN_JOB_EVENT, { detail: { jobId }, cancelable: true });
    const unclaimed = window.dispatchEvent(ev);
    if (unclaimed) router.push(`/?job=${encodeURIComponent(jobId)}`);
  }, [router]);

  const fireToast = useCallback((job: GenerationJobView) => {
    const copy = toastCopyFor(job);
    const options = {
      description: copy.description ?? undefined,
      action: { label: "View", onClick: () => openJob(job.jobId) },
      duration: 10_000,
    };
    if (copy.tone === "success") toast.success(copy.title, options);
    else if (copy.tone === "warning") toast.warning(copy.title, options);
    else toast.error(copy.title, options);
  }, [openJob]);

  const applyServer = useCallback((list: GenerationJobView[]) => {
    const prev = jobsRef.current;
    const now = Date.now();

    // Toasts: any settled row not yet toasted anywhere (localStorage de-dupe), so
    // a client that was closed mid-generation still hears about it once.
    let notified = readNotifiedIds(storage());
    for (const j of settledUnnotified(list, notified)) {
      fireToast(j);
      notified = recordNotified(storage(), notified, j.id, now);
    }

    // Settled feed: only transitions THIS tab watched go to the board (historical
    // settles are already baked into its server-loaded packages).
    const transitions = list.filter((j) => j.status !== "pending" && prev[j.id]?.status === "pending");

    // Merge: server list wins; keep young optimistic rows a racing poll predates.
    const next: Record<string, GenerationJobView> = {};
    for (const j of list) next[j.id] = j;
    for (const [id, addedAt] of optimisticRef.current) {
      if (next[id] || now - addedAt > OPTIMISTIC_TTL_MS) {
        optimisticRef.current.delete(id);
      } else if (prev[id]?.status === "pending") {
        next[id] = prev[id];
      }
    }

    // Only publish a real change — the poll ticks every 4s and re-parsed rows are
    // fresh objects, so an identity swap here would re-render the whole tree each tick.
    if (!sameJobs(prev, next)) {
      jobsRef.current = next;
      setJobs(next);
    }
    if (transitions.length > 0) {
      seqRef.current += 1;
      setSettledFeed({ seq: seqRef.current, jobs: transitions });
    }
  }, [fireToast]);

  const poll = useCallback(async () => {
    if (!enabledRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const res = await fetch("/api/generations", { cache: "no-store" });
      // Anonymous: the auth proxy 307s to /login (fetch follows → res.redirected).
      if (res.redirected || res.status === 401) {
        enabledRef.current = false;
        return;
      }
      if (!res.ok) return; // transient server hiccup — the next tick retries
      const body: unknown = await res.json().catch(() => null);
      if (body === null) return;
      applyServer(parseGenerationJobList(body));
    } catch {
      // network hiccup — keep polling while something is pending
    } finally {
      pollInFlightRef.current = false;
    }
  }, [applyServer]);

  const notifyStarted = useCallback((job: GenerationJobView) => {
    enabledRef.current = true; // a 202 proves the viewer is authed
    optimisticRef.current.set(job.id, Date.now());
    jobsRef.current = { ...jobsRef.current, [job.id]: job };
    setJobs(jobsRef.current);
    void poll(); // pull server truth promptly (row committed before the 202)
  }, [poll]);

  const refresh = useCallback(() => {
    enabledRef.current = true;
    void poll();
  }, [poll]);

  // Mount: one poll to resume tracking after a reload/tab-close mid-generation.
  useEffect(() => { void poll(); }, [poll]);

  // Poll every 4s while anything is pending; go quiet when nothing is (the tick
  // that reports zero pending also carries the settles, so nothing is missed).
  const hasPending = useMemo(
    () => Object.values(jobs).some((j) => j.status === "pending"),
    [jobs],
  );
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasPending, poll]);

  // Returning to a backgrounded tab: catch up immediately instead of on the tick.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [poll]);

  const pending = useMemo(
    () => Object.values(jobs).filter((j) => j.status === "pending"),
    [jobs],
  );
  const value = useMemo<GenerationTracker>(
    () => ({ pending, settledFeed, notifyStarted, refresh }),
    [pending, settledFeed, notifyStarted, refresh],
  );

  return (
    <GenerationTrackerContext.Provider value={value}>
      {children}
      {/* Bottom-right, clear of the board's own bottom-center toast/upsell stack.
          Styled as the board's dark action pill (see RolefitBoard's Undo toast);
          the description tint lives in globals.css ([data-sonner-toast]). */}
      <Toaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          style: {
            background: "#1b2330",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 8px 22px rgba(20,28,40,.22)",
            fontSize: "13.5px",
            fontWeight: 600,
            fontFamily: "inherit",
          },
          actionButtonStyle: {
            background: "#3b6fd4",
            color: "#fff",
            fontWeight: 700,
          },
        }}
      />
    </GenerationTrackerContext.Provider>
  );
}
