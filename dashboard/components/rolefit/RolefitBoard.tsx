"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition, useDeferredValue } from "react";
import type { ApplicationPackage, JobRow, JobReviewDetail, OperatorSignals } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { applyFilters, facetCounts, filterByView, mergeRejectedPool, sortJobs } from "@/lib/rolefit/filter";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { formToCorrection } from "@/lib/rolefit/correction";
import { selectionAfterRemoval, stepSelection } from "@/lib/rolefit/selection";
import { Header } from "./Header";
import { FilterBar } from "./FilterBar";
import { JobList } from "./JobList";
import { JobDetail } from "./JobDetail";
import { ProfileModal } from "./ProfileModal";
import { composeResumeText, legacyCopy } from "./ResumePanel";
import { DetailErrorBoundary } from "./DetailErrorBoundary";

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; detail: JobReviewDetail };

// D7's /api/application/prepare reports each leg independently so a partial failure
// (e.g. cover letter timed out) still persists what succeeded and offers a per-leg retry.
type LegStatus = "ok" | "failed";
export interface PrepareLegStatus {
  resume: LegStatus;
  coverLetter: LegStatus;
  answers: LegStatus;
}

const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

export interface RolefitBoardProps {
  jobs: JobRow[];
  nowIso: string;
  isOperator: boolean;
  isAuthed: boolean;
  initialFilters: BoardFilterState;
  saveResume: (fd: FormData) => Promise<void>;
  rejectJob: (jobId: string) => Promise<void>;
  unrejectJob: (jobId: string, priorVerdict: string | null) => Promise<void>;
  markApplied: (jobId: string) => Promise<void>;
  unmarkApplied: (jobId: string) => Promise<void>;
  operator?: OperatorSignals;
  hasProfile: boolean;
  resumeText: string;
  // Saved application packages (Phase 3) — the board seeds résumé/cover-letter +
  // Greenhouse Q/A state from these so reopening a role loads instead of regenerating.
  initialPackages: ApplicationPackage[];
  // The operator's server-loaded rejects (verdict='deny' + human_override). The default
  // board loads only approves, so these seed the Rejected view for cross-session recovery
  // of a mis-clicked reject. Empty on the anon path.
  initialRejected: JobRow[];
}

function useIsNarrow() {
  // Seed a stable `false` so the first client render matches the SSR HTML (the board is
  // server-rendered), then resolve the real value in the effect below. Reading matchMedia
  // in the initializer would make mobile's hydration pass diverge from the server render —
  // a structural mismatch (the detail-pane branch differs) that forces a full client
  // re-render, reintroducing the very flash it aimed to avoid.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    setNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return narrow;
}

export function RolefitBoard({
  jobs,
  nowIso,
  isOperator: _isOperator,
  isAuthed,
  initialFilters,
  saveResume,
  rejectJob,
  unrejectJob,
  markApplied,
  unmarkApplied,
  operator,
  hasProfile,
  resumeText,
  initialPackages,
  initialRejected,
}: RolefitBoardProps) {
  const isNarrow = useIsNarrow();
  // Filter state — seeded from persisted filters (cookie/DB) resolved on the server.
  const [search, setSearch] = useState(initialFilters.search);
  const deferredSearch = useDeferredValue(search);
  const [cats, setCats] = useState<string[]>(initialFilters.cats);
  const [locs, setLocs] = useState<string[]>(initialFilters.locs);
  const [sources, setSources] = useState<string[]>(initialFilters.sources);
  const [remote, setRemote] = useState<BoardFilterState["remote"]>(initialFilters.remote);
  const [minFit, setMinFit] = useState(initialFilters.minFit);
  const [payMin, setPayMin] = useState(initialFilters.payMin);
  const [sort, setSort] = useState<BoardFilterState["sort"]>(initialFilters.sort);

  // UI state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<"all" | "applied" | "rejected">("all");
  // True while the inline ReviewPanel correction editor is open with in-progress edits.
  // Lifted here (mirroring profileOpen) and fed to the keydown guard so the global j/k/
  // Arrow/Esc nav can't remount/unmount the detail pane — and silently discard the
  // unsaved correction — out from under the editor. ReviewPanel signals it.
  const [correctionEditing, setCorrectionEditing] = useState(false);

  // Manual-rejection state: hidden ids + the pending Undo toast. Seeded from the server's
  // rejected jobs (prior-session rejects) so the Rejected view survives a reload; live
  // rejects add to it and un-rejects remove from it.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(
    () => new Set(initialRejected.map((j) => j.id)),
  );
  // Ids of the server-loaded rejects (stable from the initial load). Used to resolve the
  // un-reject's prior verdict: a server reject was an approve before the reject (the board
  // only ever shows approves), so restore it to 'approve' rather than its stored 'deny'.
  const serverRejectedIds = useMemo(
    () => new Set(initialRejected.map((j) => j.id)),
    [initialRejected],
  );

  // Optimistic correction overlay (keyed by job id) — a saved reviewer correction is
  // applied on top of both the board row and the cached detail so the card + detail
  // pane reflect it immediately. `revalidatePath` alone can't reach this client state.
  const [corrections, setCorrections] = useState<Record<string, Partial<JobRow>>>({});
  const [toast, setToast] = useState<
    | { kind: "reject"; jobId: string; priorVerdict: string | null }
    | { kind: "apply"; jobId: string; prior: ApplicationPackage | undefined }
    | null
  >(null);
  const [, startReject] = useTransition();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persisted application packages (keyed by job id), seeded from the server load.
  const [packages, setPackages] = useState<Record<string, ApplicationPackage>>(() => {
    const m: Record<string, ApplicationPackage> = {};
    for (const p of initialPackages) m[p.jobId] = p;
    return m;
  });
  const [, startApply] = useTransition();

  // Résumé generation state (keyed by job id) — seeded "done" for saved packages so a
  // reopened role shows the persisted résumé instead of regenerating it.
  const [gen, setGen] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) if (p.resume) m[p.jobId] = "done";
    return m;
  });
  const [genData, setGenData] = useState<Record<string, TailoredResume>>(() => {
    const m: Record<string, TailoredResume> = {};
    for (const p of initialPackages) if (p.resume) m[p.jobId] = p.resume;
    return m;
  });
  const [genError, setGenError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Cover-letter generation state (keyed by job id) — mirrors the résumé state
  const [coverGen, setCoverGen] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) if (p.coverLetter) m[p.jobId] = "done";
    return m;
  });
  const [coverData, setCoverData] = useState<Record<string, TailoredCoverLetter>>(() => {
    const m: Record<string, TailoredCoverLetter> = {};
    for (const p of initialPackages) if (p.coverLetter) m[p.jobId] = p.coverLetter;
    return m;
  });
  const [coverError, setCoverError] = useState<Record<string, string>>({});

  // Single in-flight generation lock (résumé / cover / prepare all share one slot per
  // job). While set to a job id, that job's generate/cover/prepare buttons disable and a
  // Cancel button shows; the AbortController backs the cancel. Per-leg prepare results
  // land in prepareStatus so a partially-failed prepare can retry just the failed legs.
  const [generationInFlight, setGenerationInFlight] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [prepareStatus, setPrepareStatus] = useState<Record<string, PrepareLegStatus>>({});

  // Transient bottom-of-screen error notice for failed actions (mark-applied rollback,
  // non-destructive re-prepare/regenerate failures) — mirrors the reject toast styling.
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const detailRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
  }, []);

  const showActionError = useCallback((msg: string) => {
    setActionError(msg);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    actionErrorTimerRef.current = setTimeout(() => setActionError(null), 5000);
  }, []);

  // Outside-click closes open dropdown — port of reference componentDidMount doc listener
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-menuroot]")) {
        setOpenMenu((prev) => (prev !== null ? null : prev));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const filterState: BoardFilterState = useMemo(
    () => ({ search: deferredSearch, cats, locs, sources, remote, minFit, payMin, sort }),
    [deferredSearch, cats, locs, sources, remote, minFit, payMin, sort],
  );

  // Persist filter changes (debounced) so they survive navigation/visits.
  // Skips the initial mount so the just-loaded initialFilters aren't re-saved.
  // Best-effort: failures are swallowed and never block filtering.
  const firstFilterSave = useRef(true);
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    if (firstFilterSave.current) {
      firstFilterSave.current = false;
      return;
    }
    const serialized = JSON.stringify(filterState);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = serialized;
      void fetch("/api/board-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        keepalive: true,
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [filterState]);

  // Flush filter state on page unload via sendBeacon (no timer needed)
  useEffect(() => {
    const handlePageHide = () => {
      const serialized = JSON.stringify(filterState);
      if (serialized === lastSavedRef.current) return;
      navigator.sendBeacon("/api/board-filters", serialized);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [filterState]);

  // Deep-linkable selection + view. Seed from the query string once on mount (read from
  // window rather than a useState initializer so SSR and the client agree), then mirror
  // selectedId + view back into the URL via replaceState (no navigation, no history spam).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "applied" || v === "rejected") setView(v);
    const job = params.get("job");
    if (job) setSelectedId(job);
  }, []);
  const firstUrlMirror = useRef(true);
  useEffect(() => {
    // Skip the mount pass so it can't erase deep-linked params before the seed applies;
    // the seed's state change re-runs this with the resolved selection/view.
    if (firstUrlMirror.current) {
      firstUrlMirror.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (selectedId) params.set("job", selectedId);
    else params.delete("job");
    if (view !== "all") params.set("view", view);
    else params.delete("view");
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, [selectedId, view]);

  const appliedSet = useMemo(
    () => new Set(jobs.filter((j) => packages[j.id]?.status === "applied").map((j) => j.id)),
    [jobs, packages],
  );

  // Facet counts scan every job; memoize on `jobs` so they aren't recomputed on every
  // keystroke/render (FilterBar used to recompute them internally each render).
  const facets = useMemo(() => facetCounts(jobs), [jobs]);

  // The Rejected view draws from the approve list plus the server rejects (the latter
  // aren't in `jobs`); every other view draws from `jobs` alone so server rejects can't
  // leak into "all"/"applied".
  const rejectedPool = useMemo(
    () => mergeRejectedPool(jobs, initialRejected),
    [jobs, initialRejected],
  );

  const visible = useMemo(
    () => filterByView(
      sortJobs(applyFilters(view === "rejected" ? rejectedPool : jobs, filterState), filterState.sort),
      view,
      rejectedIds,
      appliedSet,
    ),
    [jobs, rejectedPool, filterState, rejectedIds, appliedSet, view],
  );

  // Visible ids in render order — the input to selectionAfterRemoval so reject/apply can
  // auto-advance to the next card instead of dumping to the placeholder (#2).
  const visibleIds = useMemo(() => visible.map((j) => j.id), [visible]);

  // Board keyboard nav — navigation + search only, no action keys (#3). `/` focuses the
  // search input; j/↓ and k/↑ step the selection (which JobList scrolls into view via
  // scrollToId, #5); Esc clears it. Inert while typing or when the profile modal / a
  // filter menu is open. Declared after `visibleIds` so the deps read the current list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el != null &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      // `/` focuses search — but stay inert while typing OR while the profile modal / a
      // filter menu is open, so it can't steal focus out of an aria-modal dialog. Ignore
      // modified presses (Cmd+/ / Ctrl+/ / Alt+/) so browser/OS shortcuts aren't hijacked.
      if (e.key === "/" && !typing && !profileOpen && !openMenu
          && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // A FilterMenu owns its own Arrow/Home/End/Escape keys (open, roving focus, dismiss).
      // When the keystroke starts inside one, stay out of its way — otherwise Arrow-to-open
      // on a trigger ALSO fires board j/k nav on the same press, because this handler's
      // `openMenu` closure is still the stale pre-open `null` (the menu opens on the state
      // update this same event schedules). Read the DOM target, not the async state.
      if (el?.closest("[data-menuroot]")) return;
      // Suppress while a modal / filter menu / inline-correction editor is open so their own
      // keys and focus win — and so nav/deselect can't remount the detail pane out from under
      // an unsaved correction.
      if (profileOpen || openMenu || correctionEditing) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId((id) => stepSelection(visibleIds, id, 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId((id) => stepSelection(visibleIds, id, -1));
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visibleIds, profileOpen, openMenu, correctionEditing]);

  // The active view's pool size BEFORE search/facet filtering — same view partition as
  // `visible`, minus `applyFilters`. This is the "N of M" counter's denominator so the
  // Rejected/Applied views read against their own totals, not the all-jobs total (#13).
  const totalInView = useMemo(
    () => filterByView(view === "rejected" ? rejectedPool : jobs, view, rejectedIds, appliedSet).length,
    [jobs, rejectedPool, view, rejectedIds, appliedSet],
  );

  // Display-only overlay of `corrections` on top of the filtered/sorted/bucketed
  // `visible` rows — a corrected job keeps its current position until reload (same
  // tradeoff as rejectedIds); this only refreshes what the card renders.
  const visibleWithCorrections = useMemo(
    () => visible.map((j) => (corrections[j.id] ? { ...j, ...corrections[j.id] } : j)),
    [visible, corrections],
  );

  // Resolve selected job from the rejected pool (a superset of `jobs`) so opening a
  // server-sourced rejected job — which isn't in the approve list — still renders its
  // detail pane, and with it the un-reject action.
  const selectedJob = useMemo(
    () => rejectedPool.find((j) => j.id === selectedId) ?? null,
    [rejectedPool, selectedId],
  );

  // Heavy, detail-only review fields (reasoning/about/requirements/benefits/
  // red_flags) are not in the list payload — fetch them on job-open and cache by
  // id. JobDetail renders them as they arrive (its sections are already guarded
  // for absent fields), so the lightweight detail view shows instantly.
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  // Ids with an in-flight /api/jobs/[id] request. This — not the effect's cleanup — is
  // how we dedup: the previous version put `details` in the effect deps AND set the
  // loading state inside it, so writing "loading" re-ran the effect, whose cleanup set
  // `cancelled=true` and dropped the still-in-flight result (detail stuck on the skeleton
  // forever). The ref lets the effect depend on `selectedId` alone.
  const detailInFlightRef = useRef<Set<string>>(new Set());
  const loadDetail = useCallback((id: string) => {
    if (detailInFlightRef.current.has(id)) return;
    detailInFlightRef.current.add(id);
    setDetails((prev) => ({ ...prev, [id]: { status: "loading" } }));
    fetch(`/api/jobs/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: JobReviewDetail) => {
        setDetails((prev) => ({ ...prev, [id]: { status: "done", detail: d } }));
      })
      .catch((e) => {
        console.error("job detail fetch failed", e);
        setDetails((prev) => ({ ...prev, [id]: { status: "error" } }));
      })
      .finally(() => {
        detailInFlightRef.current.delete(id);
      });
  }, []);
  useEffect(() => {
    // Fetch on open. `details` is read for the cache check but deliberately NOT a dep —
    // see detailInFlightRef above. Retry refetches by clearing the cache entry + ref and
    // calling loadDetail directly (removing `details` from deps means a cache-clear alone
    // no longer re-runs this effect).
    if (!selectedId || details[selectedId] != null || detailInFlightRef.current.has(selectedId)) return;
    loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadDetail]);

  const selectedJobWithDetail = useMemo(() => {
    if (!selectedJob) return null;
    const ds = details[selectedJob.id];
    const d = ds?.status === "done" ? ds.detail : {};
    const c = corrections[selectedJob.id];
    return { ...selectedJob, ...(d ?? {}), ...(c ?? {}) };
  }, [selectedJob, details, corrections]);

  // Handlers
  const toggleCat = (cat: string) =>
    setCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  const toggleLoc = (loc: string) =>
    setLocs((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  const toggleSource = (ats: string) =>
    setSources((prev) =>
      prev.includes(ats) ? prev.filter((s) => s !== ats) : [...prev, ats],
    );
  const toggleMenu = (name: string) =>
    setOpenMenu((prev) => (prev === name ? null : name));

  const clearFilters = () => {
    setSearch("");
    setCats([]);
    setLocs([]);
    setSources([]);
    setRemote("all");
    setMinFit(0);
    setPayMin(0);
  };

  // Radio-style dropdown handlers close the menu on selection
  const handleSetPayMin = (v: number) => {
    setPayMin(v);
    setOpenMenu(null);
  };
  const handleSetMinFit = (v: number) => {
    setMinFit(v);
    setOpenMenu(null);
  };
  const handleSetSort = (s: BoardFilterState["sort"]) => {
    setSort(s);
    setOpenMenu(null);
  };

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Reset the detail pane (and, on the narrow single-pane layout, the window) to the top
  // whenever the selection changes. Keyed on the selection — not folded into handleSelect —
  // so keyboard nav (j/k/arrows) and the reject/apply auto-advance also open the next role
  // at the top, not at the previous role's scroll offset (e.g. after a bottom-of-pane "Mark
  // as applied" or a deep-scrolled reject). `isNarrow` is read but intentionally NOT a dep:
  // a viewport resize shouldn't scroll the pane — only a selection change should.
  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
    if (isNarrow && selectedId) window.scrollTo(0, 0);
    // Keyboard reject/mark-applied auto-advance remounts JobDetail (its DetailErrorBoundary
    // key changes) and unmounts the card hover-×, so focus can silently drop to <body> and
    // the next Tab restarts at the top of the page. Return it to the detail container —
    // mirroring FilterBar's selection-close focus-return. Only when focus actually fell to
    // <body>, so we never steal it from an input/menu the user is interacting with.
    if (selectedId && document.activeElement === document.body) {
      detailRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleReject = useCallback(async (job: JobRow) => {
    const priorVerdict = job.verdict;
    setRejectedIds((prev) => new Set(prev).add(job.id));
    setSelectedId((prev) => (prev === job.id ? selectionAfterRemoval(visibleIds, job.id) : prev));
    setToast({ kind: "reject", jobId: job.id, priorVerdict });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
    try {
      await rejectJob(job.id);
    } catch {
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      setToast(null);
      showActionError("Couldn't save rejection — try again.");
    }
  }, [rejectJob, showActionError, visibleIds]);

  // The hover-× on a card (#14) hands back only the id; resolve the row from the rejected
  // pool (a superset of `jobs`) and route through handleReject so it shares the same
  // optimistic-update + Undo-toast + auto-advance path as the detail-pane reject.
  const handleRejectById = useCallback((id: string) => {
    const job = rejectedPool.find((j) => j.id === id);
    if (job) void handleReject(job);
  }, [rejectedPool, handleReject]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    if (toast.kind === "reject") {
      const { jobId, priorVerdict } = toast;
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      startReject(() => {
        void unrejectJob(jobId, priorVerdict).catch(() => {
          // Server still has the rejection — re-hide the card and say so.
          setRejectedIds((prev) => new Set(prev).add(jobId));
          showActionError("Couldn’t undo the rejection. Please try again.");
        });
      });
    } else {
      const { jobId, prior } = toast;
      setPackages((p) => {
        const next = { ...p };
        if (prior) next[jobId] = prior;
        else delete next[jobId];
        return next;
      });
      startApply(() => {
        void unmarkApplied(jobId).catch(() => {
          showActionError("Couldn’t undo. Please try again.");
        });
      });
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [toast, unrejectJob, unmarkApplied, showActionError]);

  // Un-reject from the card/detail (the Rejected view) after the Undo toast has expired.
  // Optimistically un-hides the job, then persists via unrejectJob; rolls back on failure.
  const handleUnreject = useCallback((job: JobRow) => {
    // A server-sourced reject carries its stored verdict='deny'; restore it to 'approve'
    // (its state before the reject — the board only ever surfaces approves). An in-session
    // reject's row is still the loaded approve, so its own verdict is the right restore.
    const priorVerdict = serverRejectedIds.has(job.id) ? "approve" : job.verdict;
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(job.id);
      return next;
    });
    startReject(() => {
      void unrejectJob(job.id, priorVerdict).catch(() => {
        setRejectedIds((prev) => new Set(prev).add(job.id));
        showActionError("Couldn’t un-reject — try again.");
      });
    });
  }, [unrejectJob, showActionError, serverRejectedIds]);

  // Optimistically apply a saved reviewer correction to the board card + detail pane —
  // formToCorrection(form) already returns snake_case JobRow field names, so spreading
  // it plus note/corrected yields a valid Partial<JobRow>.
  const handleCorrected = useCallback((jobId: string, form: CorrectionForm) => {
    const row = formToCorrection(form);
    setCorrections((prev) => ({
      ...prev,
      [jobId]: { ...row, note: form.note, corrected: true },
    }));
  }, []);

  // Retry a failed detail fetch: clear the cache entry + in-flight guard, then refetch
  // directly (the effect no longer depends on `details`, so clearing it won't re-run it).
  const handleRetryDetail = useCallback(() => {
    if (!selectedId) return;
    const id = selectedId;
    detailInFlightRef.current.delete(id);
    setDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    loadDetail(id);
  }, [selectedId, loadDetail]);

  // Begin a generation: claim the single lock + a fresh AbortController. Returns the
  // controller (or null if a generation for this job is already running — the buttons
  // are disabled in that case, so this is just a guard).
  const beginGeneration = useCallback((jobId: string): AbortController | null => {
    if (generationInFlight === jobId) return null;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerationInFlight(jobId);
    return controller;
  }, [generationInFlight]);

  // Release the lock only if this controller still owns it (a newer generation may have
  // replaced it).
  const endGeneration = useCallback((controller: AbortController) => {
    if (abortRef.current === controller) {
      abortRef.current = null;
      setGenerationInFlight(null);
    }
  }, []);

  const handleCancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerationInFlight(null);
  }, []);

  // Résumé generation. D7 contract: /api/resume persists server-side and returns the full
  // { package }. Standalone Generate always persists now (no client persist call, no
  // "only if a package exists" gate — the server creates/updates the row).
  const handleGenerate = useCallback(async (job: JobRow) => {
    const controller = beginGeneration(job.id);
    if (!controller) return;
    const hadResume = Boolean(genData[job.id]);
    setGen((g) => ({ ...g, [job.id]: "busy" }));
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const { package: pkg } = (await res.json()) as { package: ApplicationPackage };
      setPackages((p) => ({ ...p, [job.id]: pkg }));
      if (pkg.resume) setGenData((d) => ({ ...d, [job.id]: pkg.resume as TailoredResume }));
      setGen((g) => ({ ...g, [job.id]: "done" }));
      // A successful standalone résumé clears a prior prepare's failed résumé leg.
      setPrepareStatus((s) => (s[job.id] ? { ...s, [job.id]: { ...s[job.id], resume: "ok" } } : s));
    } catch (e) {
      if (isAbort(e)) {
        setGen((g) => ({ ...g, [job.id]: hadResume ? "done" : "idle" }));
      } else {
        setGen((g) => ({ ...g, [job.id]: "error" }));
        setGenError((m) => ({ ...m, [job.id]: (e as Error).message }));
      }
    } finally {
      endGeneration(controller);
    }
  }, [beginGeneration, endGeneration, genData]);

  // Cover-letter generation — mirrors handleGenerate against /api/cover-letter (D7).
  const handleGenerateCover = useCallback(async (job: JobRow) => {
    const controller = beginGeneration(job.id);
    if (!controller) return;
    const hadCover = Boolean(coverData[job.id]);
    setCoverGen((g) => ({ ...g, [job.id]: "busy" }));
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const { package: pkg } = (await res.json()) as { package: ApplicationPackage };
      setPackages((p) => ({ ...p, [job.id]: pkg }));
      if (pkg.coverLetter) setCoverData((d) => ({ ...d, [job.id]: pkg.coverLetter as TailoredCoverLetter }));
      setCoverGen((g) => ({ ...g, [job.id]: "done" }));
      setPrepareStatus((s) => (s[job.id] ? { ...s, [job.id]: { ...s[job.id], coverLetter: "ok" } } : s));
    } catch (e) {
      if (isAbort(e)) {
        setCoverGen((g) => ({ ...g, [job.id]: hadCover ? "done" : "idle" }));
      } else {
        setCoverGen((g) => ({ ...g, [job.id]: "error" }));
        setCoverError((m) => ({ ...m, [job.id]: (e as Error).message }));
      }
    } finally {
      endGeneration(controller);
    }
  }, [beginGeneration, endGeneration, coverData]);

  // "Prepare application" — build + PERSIST the package in one call. D7 returns
  // { package, status } where status reports each leg (resume / coverLetter / answers)
  // independently, so a partial failure keeps what succeeded and offers a per-leg retry.
  const handlePrepare = useCallback(async (job: JobRow) => {
    const controller = beginGeneration(job.id);
    if (!controller) return;
    // Snapshot whether we already have successful content to fall back to, so a failed
    // re-prepare doesn't blank out the still-valid résumé/cover the user can see.
    const hadResume = Boolean(genData[job.id]);
    const hadCover = Boolean(coverData[job.id]);
    setGen((g) => ({ ...g, [job.id]: "busy" }));
    setCoverGen((g) => ({ ...g, [job.id]: "busy" }));
    try {
      const res = await fetch("/api/application/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const { package: pkg, status } = (await res.json()) as {
        package: ApplicationPackage;
        status: PrepareLegStatus;
      };
      setPackages((p) => ({ ...p, [job.id]: pkg }));
      setPrepareStatus((s) => ({ ...s, [job.id]: status }));
      // Résumé leg
      if (status.resume === "ok" && pkg.resume) {
        setGenData((d) => ({ ...d, [job.id]: pkg.resume as TailoredResume }));
        setGen((g) => ({ ...g, [job.id]: "done" }));
      } else {
        setGen((g) => ({ ...g, [job.id]: hadResume ? "done" : "error" }));
        if (!hadResume) setGenError((m) => ({ ...m, [job.id]: "Couldn’t generate the résumé." }));
      }
      // Cover-letter leg
      if (status.coverLetter === "ok" && pkg.coverLetter) {
        setCoverData((d) => ({ ...d, [job.id]: pkg.coverLetter as TailoredCoverLetter }));
        setCoverGen((g) => ({ ...g, [job.id]: "done" }));
      } else {
        setCoverGen((g) => ({ ...g, [job.id]: hadCover ? "done" : "error" }));
        if (!hadCover) setCoverError((m) => ({ ...m, [job.id]: "Couldn’t generate the cover letter." }));
      }
    } catch (e) {
      if (isAbort(e)) {
        setGen((g) => ({ ...g, [job.id]: hadResume ? "done" : "idle" }));
        setCoverGen((g) => ({ ...g, [job.id]: hadCover ? "done" : "idle" }));
      } else {
        const msg = (e as Error).message;
        // Only fall to the full "error" state when there was nothing to preserve. When
        // prior content exists, keep it visible (state stays "done") and surface the
        // failure non-destructively via the toast instead of blanking the panels.
        setGen((g) => ({ ...g, [job.id]: hadResume ? "done" : "error" }));
        setCoverGen((g) => ({ ...g, [job.id]: hadCover ? "done" : "error" }));
        if (!hadResume) setGenError((m) => ({ ...m, [job.id]: msg }));
        if (!hadCover) setCoverError((m) => ({ ...m, [job.id]: msg }));
        if (hadResume || hadCover) showActionError(`Re-prepare failed: ${msg}`);
      }
    } finally {
      endGeneration(controller);
    }
  }, [beginGeneration, endGeneration, genData, coverData, showActionError]);

  // "Mark as applied" — works with OR without a prepared package. Optimistically
  // flips/creates the package to status='applied' (hiding the job from the default
  // board via appliedSet), shows an Undo toast (mirrors reject), and persists via the
  // upsert action. On failure, roll the optimistic change back and surface an error.
  const handleMarkApplied = useCallback((job: JobRow) => {
    const prior = packages[job.id];
    const appliedAt = new Date().toISOString();
    const optimistic: ApplicationPackage = prior
      ? { ...prior, status: "applied", appliedAt: prior.appliedAt ?? appliedAt }
      : {
          jobId: job.id,
          status: "applied",
          resume: null,
          coverLetter: null,
          answersSnapshot: null,
          greenhouseQuestions: null,
          prefilledAnswers: null,
          applyUrl: null,
          preparedAt: appliedAt,
          appliedAt,
        };
    setPackages((p) => ({ ...p, [job.id]: optimistic }));
    setSelectedId((prev) => (prev === job.id ? selectionAfterRemoval(visibleIds, job.id) : prev));
    startApply(() => {
      void markApplied(job.id).catch(() => {
        setPackages((p) => {
          const next = { ...p };
          if (prior) next[job.id] = prior;
          else delete next[job.id];
          return next;
        });
        // Clear the optimistic "Applied" Undo toast for this job — the mark didn't
        // persist, so its Undo would fire unmarkApplied on a never-applied job. Leave
        // any other job's toast intact. The error banner below is the only signal.
        setToast((t) => (t?.kind === "apply" && t.jobId === job.id ? null : t));
        showActionError("Couldn’t mark as applied. Please try again.");
      });
    });
    setToast({ kind: "apply", jobId: job.id, prior });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, [packages, markApplied, showActionError, visibleIds]);

  // Un-mark applied from the Applied view (no toast — immediate). Deletes a bare
  // marker; reverts a real prepared package to status='prepared'. Rolls back on error.
  const handleUnapply = useCallback((job: JobRow) => {
    const prior = packages[job.id];
    const hasContent = Boolean(
      prior && (prior.resume || prior.coverLetter || prior.answersSnapshot
        || prior.greenhouseQuestions || prior.prefilledAnswers),
    );
    setPackages((p) => {
      const next = { ...p };
      if (prior && hasContent) next[job.id] = { ...prior, status: "prepared", appliedAt: null };
      else delete next[job.id];
      return next;
    });
    startApply(() => {
      void unmarkApplied(job.id).catch(() => {
        if (prior) setPackages((p) => ({ ...p, [job.id]: prior }));
        showActionError("Couldn’t undo. Please try again.");
      });
    });
  }, [packages, unmarkApplied, showActionError]);

  // Copy résumé text to clipboard
  const handleCopy = useCallback((job: JobRow, data: TailoredResume) => {
    const text = composeResumeText(data);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
      } else {
        legacyCopy(text);
      }
    } catch {
      legacyCopy(text);
    }
    setCopiedId(job.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedId((prev) => (prev === job.id ? null : prev));
    }, 1600);
  }, []);

  return (
    <div
      style={{
        height: isNarrow ? undefined : "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f4f6fa",
        color: "#1f2430",
        overflow: isNarrow ? undefined : "hidden",
      }}
    >
      <Header
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        isAuthed={isAuthed}
        hasProfile={hasProfile}
        operator={operator}
        onOpenProfile={() => {
          if (isAuthed) {
            setProfileOpen(true);
          } else {
            window.location.href = "/login";
          }
        }}
      />
      <FilterBar
        totalInView={totalInView}
        facets={facets}
        cats={cats}
        locs={locs}
        sources={sources}
        remote={remote}
        minFit={minFit}
        payMin={payMin}
        sort={sort}
        openMenu={openMenu}
        visibleCount={visible.length}
        view={view}
        appliedCount={appliedSet.size}
        rejectedCount={rejectedIds.size}
        onToggleView={setView}
        onToggleMenu={toggleMenu}
        onToggleCat={toggleCat}
        onToggleLoc={toggleLoc}
        onToggleSource={toggleSource}
        onSetRemote={setRemote}
        onSetMinFit={handleSetMinFit}
        onSetPayMin={handleSetPayMin}
        onSetSort={handleSetSort}
      />

      {/* Split pane — left: job list; right: detail */}
      <div style={{ flex: 1, display: "flex", minHeight: isNarrow ? undefined : 0 }}>
        {/* List pane */}
        {(!isNarrow || !selectedId) && (
          <div
            ref={listScrollRef}
            className={isNarrow ? undefined : "rf-scroll"}
            style={{
              flex: isNarrow ? undefined : "0 0 426px",
              width: isNarrow ? "100%" : undefined,
              overflowY: isNarrow ? undefined : "auto",
              background: "#f4f6fa",
              borderRight: isNarrow ? "none" : "1px solid #e7eaf0",
              padding: "13px 2px 24px",
            }}
          >
            <JobList
              jobs={visibleWithCorrections}
              selectedId={selectedId}
              onSelect={handleSelect}
              onClearFilters={clearFilters}
              view={view}
              onBackToAll={() => setView("all")}
              hasUnfilteredJobs={jobs.length > 0}
              viewPoolCount={totalInView}
              scrollParentRef={isNarrow ? undefined : listScrollRef}
              scrollToId={selectedId}
              // The hover-× is a triage affordance — only the "all" view is the triage
              // queue. Withholding it in Applied/Rejected prevents rejecting an
              // already-applied job (leaving it applied+rejected) or re-rejecting a
              // rejected one; those views carry their own detail-pane actions instead.
              onReject={view === "all" ? handleRejectById : undefined}
            />
          </div>
        )}

        {/* Detail pane */}
        {(!isNarrow || selectedId) && (
          <div
            ref={detailRef}
            // Programmatically focusable (not in the Tab order) so the selection-change
            // effect can return focus here after an auto-advance remount (see above).
            tabIndex={-1}
            className={isNarrow ? undefined : "rf-scroll"}
            style={{ flex: 1, overflowY: isNarrow ? undefined : "auto", background: "#fff", minWidth: 0, outline: "none" }}
          >
            {selectedJobWithDetail ? (
              <>
                {isNarrow && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      margin: "16px 16px 0",
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#3b6fd4",
                      background: "#eef3fc",
                      border: "1px solid #d8e2f6",
                      borderRadius: "9px",
                      padding: "8px 14px",
                      cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                )}
                <DetailErrorBoundary key={selectedJobWithDetail.id}>
                  <JobDetail
                    job={selectedJobWithDetail}
                    nowIso={nowIso}
                    isAuthed={isAuthed}
                    gen={gen}
                    genData={genData}
                    genError={genError}
                    onGenerate={handleGenerate}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                    coverGen={coverGen}
                    coverData={coverData}
                    coverError={coverError}
                    onGenerateCover={handleGenerateCover}
                    onPrepare={handlePrepare}
                    generating={generationInFlight === selectedJobWithDetail.id}
                    onCancelGeneration={handleCancelGeneration}
                    prepareStatus={prepareStatus[selectedJobWithDetail.id] ?? null}
                    pkg={packages[selectedJobWithDetail.id]}
                    onMarkApplied={handleMarkApplied}
                    onOpenProfile={() => setProfileOpen(true)}
                    onReject={handleReject}
                    onUnapply={handleUnapply}
                    isRejected={rejectedIds.has(selectedJobWithDetail.id)}
                    onUnreject={handleUnreject}
                    onCorrected={handleCorrected}
                    onCorrectionEditingChange={setCorrectionEditing}
                    detailState={details[selectedJobWithDetail.id]}
                    onRetryDetail={handleRetryDetail}
                  />
                </DetailErrorBoundary>
              </>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7480",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Select a role
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live regions are ALWAYS mounted (empty when idle) so a screen reader observes them
          before their content changes — a region added to the DOM together with its content
          is not reliably announced. Only the inner pill toggles. The outer wrapper collapses
          to 0×0 when both are empty, so it never intercepts pointer events. */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          alignItems: "center",
        }}
      >
        <div role="status">
          {toast ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: "#1b2330",
                color: "#fff",
                borderRadius: "12px",
                padding: "11px 18px",
                boxShadow: "0 8px 22px rgba(20,28,40,.22)",
                fontSize: "13.5px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span>{toast.kind === "apply" ? "Applied" : "Rejected"}</span>
              <button
                type="button"
                onClick={handleUndo}
                style={{
                  fontWeight: 800,
                  fontSize: "13px",
                  color: "#9ec1ff",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Undo
              </button>
            </div>
          ) : null}
        </div>
        <div role="alert">
          {actionError ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                // Keep the 8px gap from the toast above only when both are showing.
                marginTop: toast ? "8px" : 0,
                background: "#7a2e22",
                color: "#fff",
                borderRadius: "12px",
                padding: "11px 18px",
                boxShadow: "0 8px 22px rgba(20,28,40,.22)",
                fontSize: "13.5px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                style={{
                  fontWeight: 800,
                  fontSize: "13px",
                  color: "#ffd2c8",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ProfileModal
        open={profileOpen}
        isAuthed={isAuthed}
        hasProfile={hasProfile}
        resumeText={resumeText}
        onClose={() => setProfileOpen(false)}
        saveResume={saveResume}
      />
    </div>
  );
}
