"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition, useDeferredValue } from "react";
import type { ApplicationAnswers, ApplicationPackage, JobRow, JobReviewDetail, OperatorSignals } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { applyFilters, filterByApplied, sortJobs } from "@/lib/rolefit/filter";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { formToCorrection } from "@/lib/rolefit/correction";
import { Header } from "./Header";
import { FilterBar } from "./FilterBar";
import { JobList } from "./JobList";
import { JobDetail } from "./JobDetail";
import { ProfileModal } from "./ProfileModal";
import { composeResumeText, legacyCopy } from "./ResumePanel";

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; detail: JobReviewDetail };

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
  // Persist a regenerated résumé/cover back into an existing application_packages row
  // (so regenerating after Prepare survives a reload). No-op server-side when unprepared.
  persistResume: (jobId: string, resume: TailoredResume) => Promise<void>;
  persistCover: (jobId: string, coverLetter: TailoredCoverLetter) => Promise<void>;
  operator?: OperatorSignals;
  hasProfile: boolean;
  resumeText: string;
  applicationAnswers: ApplicationAnswers | null;
  // Saved application packages (Phase 3) — the board seeds résumé/cover-letter +
  // Greenhouse Q/A state from these so reopening a role loads instead of regenerating.
  initialPackages: ApplicationPackage[];
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
  persistResume,
  persistCover,
  operator,
  hasProfile,
  resumeText,
  applicationAnswers,
  initialPackages,
}: RolefitBoardProps) {
  // Filter state — seeded from persisted filters (cookie/DB) resolved on the server.
  const [search, setSearch] = useState(initialFilters.search);
  const deferredSearch = useDeferredValue(search);
  const [cats, setCats] = useState<string[]>(initialFilters.cats);
  const [locs, setLocs] = useState<string[]>(initialFilters.locs);
  const [remote, setRemote] = useState<BoardFilterState["remote"]>(initialFilters.remote);
  const [minFit, setMinFit] = useState(initialFilters.minFit);
  const [payMin, setPayMin] = useState(initialFilters.payMin);
  const [sort, setSort] = useState<BoardFilterState["sort"]>(initialFilters.sort);

  // UI state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appliedView, setAppliedView] = useState(false);

  // Manual-rejection state: optimistically hidden ids + the pending Undo toast.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

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

  // Transient bottom-of-screen error notice for failed actions (mark-applied rollback,
  // non-destructive re-prepare/regenerate failures) — mirrors the reject toast styling.
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const detailRef = useRef<HTMLDivElement>(null);
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
    () => ({ search: deferredSearch, cats, locs, remote, minFit, payMin, sort }),
    [deferredSearch, cats, locs, remote, minFit, payMin, sort],
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

  const appliedSet = useMemo(
    () => new Set(jobs.filter((j) => packages[j.id]?.status === "applied").map((j) => j.id)),
    [jobs, packages],
  );

  const visible = useMemo(
    () => filterByApplied(
      sortJobs(applyFilters(jobs, filterState), filterState.sort)
        .filter((j) => !rejectedIds.has(j.id)),
      appliedSet,
      appliedView,
    ),
    [jobs, filterState, rejectedIds, appliedSet, appliedView],
  );

  // Display-only overlay of `corrections` on top of the filtered/sorted/bucketed
  // `visible` rows — a corrected job keeps its current position until reload (same
  // tradeoff as rejectedIds); this only refreshes what the card renders.
  const visibleWithCorrections = useMemo(
    () => visible.map((j) => (corrections[j.id] ? { ...j, ...corrections[j.id] } : j)),
    [visible, corrections],
  );

  // Resolve selected job
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  // Heavy, detail-only review fields (reasoning/about/requirements/benefits/
  // red_flags) are not in the list payload — fetch them on job-open and cache by
  // id. JobDetail renders them as they arrive (its sections are already guarded
  // for absent fields), so the lightweight detail view shows instantly.
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  useEffect(() => {
    // Fetch only when no cached state exists for the job — "loading"/"done"/"error"
    // all short-circuit, so errors never auto-loop; Retry deletes the entry to refetch.
    if (!selectedId || details[selectedId] != null) return;
    let cancelled = false;
    setDetails((prev) => ({ ...prev, [selectedId]: { status: "loading" } }));
    fetch(`/api/jobs/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: JobReviewDetail) => {
        if (!cancelled) {
          setDetails((prev) => ({ ...prev, [selectedId]: { status: "done", detail: d } }));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("job detail fetch failed", e);
          setDetails((prev) => ({ ...prev, [selectedId]: { status: "error" } }));
        }
      });
    return () => { cancelled = true; };
  }, [selectedId, details]);

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
  const toggleMenu = (name: string) =>
    setOpenMenu((prev) => (prev === name ? null : name));

  const clearFilters = () => {
    setSearch("");
    setCats([]);
    setLocs([]);
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
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, []);

  const handleReject = useCallback((job: JobRow) => {
    const priorVerdict = job.verdict;
    setRejectedIds((prev) => new Set(prev).add(job.id));
    setSelectedId((prev) => (prev === job.id ? null : prev));
    startReject(() => { void rejectJob(job.id); });
    setToast({ kind: "reject", jobId: job.id, priorVerdict });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, [rejectJob]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    if (toast.kind === "reject") {
      const { jobId, priorVerdict } = toast;
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      startReject(() => { void unrejectJob(jobId, priorVerdict); });
    } else {
      const { jobId, prior } = toast;
      setPackages((p) => {
        const next = { ...p };
        if (prior) next[jobId] = prior;
        else delete next[jobId];
        return next;
      });
      startApply(() => { void unmarkApplied(jobId); });
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [toast, unrejectJob, unmarkApplied]);

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

  // Clear a failed detail fetch so the effect retries it.
  const handleRetryDetail = useCallback(() => {
    if (!selectedId) return;
    setDetails((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  }, [selectedId]);

  // Résumé generation
  const handleGenerate = useCallback(async (job: JobRow) => {
    setGen((g) => ({ ...g, [job.id]: "busy" }));
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const data = (await res.json()) as TailoredResume;
      setGenData((d) => ({ ...d, [job.id]: data }));
      setGen((g) => ({ ...g, [job.id]: "done" }));
      // If a package already exists, regenerating must persist the new résumé back into
      // it — otherwise the stale saved version reseeds on reload and the work is lost.
      if (packages[job.id]) {
        setPackages((p) => (p[job.id] ? { ...p, [job.id]: { ...p[job.id], resume: data } } : p));
        startApply(() => {
          void persistResume(job.id, data).catch(() =>
            showActionError("Couldn’t save the regenerated résumé. Re-prepare to retry."),
          );
        });
      }
    } catch (e) {
      setGen((g) => ({ ...g, [job.id]: "error" }));
      setGenError((m) => ({ ...m, [job.id]: (e as Error).message }));
    }
  }, [packages, persistResume, showActionError]);

  // Cover-letter generation — mirrors handleGenerate against /api/cover-letter
  const handleGenerateCover = useCallback(async (job: JobRow) => {
    setCoverGen((g) => ({ ...g, [job.id]: "busy" }));
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const data = (await res.json()) as TailoredCoverLetter;
      setCoverData((d) => ({ ...d, [job.id]: data }));
      setCoverGen((g) => ({ ...g, [job.id]: "done" }));
      // Persist the regenerated cover letter into an existing package (see handleGenerate).
      if (packages[job.id]) {
        setPackages((p) => (p[job.id] ? { ...p, [job.id]: { ...p[job.id], coverLetter: data } } : p));
        startApply(() => {
          void persistCover(job.id, data).catch(() =>
            showActionError("Couldn’t save the regenerated cover letter. Re-prepare to retry."),
          );
        });
      }
    } catch (e) {
      setCoverGen((g) => ({ ...g, [job.id]: "error" }));
      setCoverError((m) => ({ ...m, [job.id]: (e as Error).message }));
    }
  }, [packages, persistCover, showActionError]);

  // "Prepare application" — build + PERSIST the package in one call (résumé + cover
  // letter + answers snapshot, plus Greenhouse Q/A when available). The résumé and
  // cover-letter panels reflect progress via their existing busy/done/error states.
  const handlePrepare = useCallback(async (job: JobRow) => {
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
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "failed");
      }
      const pkg = (await res.json()) as ApplicationPackage;
      setPackages((p) => ({ ...p, [job.id]: pkg }));
      const resume = pkg.resume;
      if (resume) {
        setGenData((d) => ({ ...d, [job.id]: resume }));
        setGen((g) => ({ ...g, [job.id]: "done" }));
      } else {
        setGen((g) => ({ ...g, [job.id]: "idle" }));
      }
      const cover = pkg.coverLetter;
      if (cover) {
        setCoverData((d) => ({ ...d, [job.id]: cover }));
        setCoverGen((g) => ({ ...g, [job.id]: "done" }));
      } else {
        setCoverGen((g) => ({ ...g, [job.id]: "idle" }));
      }
    } catch (e) {
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
  }, [genData, coverData, showActionError]);

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
    setSelectedId((prev) => (prev === job.id ? null : prev));
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
  }, [packages, markApplied, showActionError]);

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
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f4f6fa",
        color: "#1f2430",
        overflow: "hidden",
      }}
    >
      <Header
        search={search}
        onSearch={setSearch}
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
        jobs={jobs}
        cats={cats}
        locs={locs}
        remote={remote}
        minFit={minFit}
        payMin={payMin}
        sort={sort}
        openMenu={openMenu}
        visibleCount={visible.length}
        appliedView={appliedView}
        appliedCount={appliedSet.size}
        onToggleApplied={() => setAppliedView((v) => !v)}
        onToggleMenu={toggleMenu}
        onToggleCat={toggleCat}
        onToggleLoc={toggleLoc}
        onSetRemote={setRemote}
        onSetMinFit={handleSetMinFit}
        onSetPayMin={handleSetPayMin}
        onSetSort={handleSetSort}
      />

      {/* Split pane — left: job list; right: detail */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* List pane */}
        <div
          className="rf-scroll"
          style={{
            flex: "0 0 426px",
            overflowY: "auto",
            background: "#f4f6fa",
            borderRight: "1px solid #e7eaf0",
            padding: "13px 2px 24px",
          }}
        >
          <JobList
            jobs={visibleWithCorrections}
            selectedId={selectedId}
            onSelect={handleSelect}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Detail pane */}
        <div
          ref={detailRef}
          className="rf-scroll"
          style={{ flex: 1, overflowY: "auto", background: "#fff", minWidth: 0 }}
        >
          {selectedJobWithDetail ? (
            <JobDetail
              key={selectedJobWithDetail.id}
              job={selectedJobWithDetail}
              nowIso={nowIso}
              isAuthed={isAuthed}
              answers={applicationAnswers}
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
              pkg={packages[selectedJobWithDetail.id]}
              onMarkApplied={handleMarkApplied}
              onOpenProfile={() => setProfileOpen(true)}
              onReject={handleReject}
              onUnapply={handleUnapply}
              onCorrected={handleCorrected}
              detailState={details[selectedJobWithDetail.id]}
              onRetryDetail={handleRetryDetail}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8a93a3",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Select a role
            </div>
          )}
        </div>
      </div>

      {(toast || actionError) && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 50,
            alignItems: "center",
          }}
        >
          {toast && (
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
          )}
          {actionError && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
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
          )}
        </div>
      )}
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
