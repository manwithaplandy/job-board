"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
import type { ApplicationAnswers, ApplicationPackage, JobRow, OperatorSignals } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { applyFilters, sortJobs } from "@/lib/rolefit/filter";
import { Header } from "./Header";
import { FilterBar } from "./FilterBar";
import { JobList } from "./JobList";
import { JobDetail } from "./JobDetail";
import { ProfileModal } from "./ProfileModal";
import { composeResumeText, legacyCopy } from "./ResumePanel";

export interface RolefitBoardProps {
  jobs: JobRow[];
  nowIso: string;
  isOperator: boolean;
  isAuthed: boolean;
  saveResume: (fd: FormData) => Promise<void>;
  rejectJob: (jobId: string) => Promise<void>;
  unrejectJob: (jobId: string, priorVerdict: string | null) => Promise<void>;
  markApplied: (jobId: string) => Promise<void>;
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
  saveResume,
  rejectJob,
  unrejectJob,
  markApplied,
  persistResume,
  persistCover,
  operator,
  hasProfile,
  resumeText,
  applicationAnswers,
  initialPackages,
}: RolefitBoardProps) {
  // Filter state
  const [search, setSearch] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [locs, setLocs] = useState<string[]>([]);
  const [remote, setRemote] = useState<BoardFilterState["remote"]>("all");
  const [minFit, setMinFit] = useState(0);
  const [payMin, setPayMin] = useState(0);
  const [sort, setSort] = useState<BoardFilterState["sort"]>("match");

  // UI state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Manual-rejection state: optimistically hidden ids + the pending Undo toast.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ jobId: string; priorVerdict: string | null } | null>(null);
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
    () => ({ search, cats, locs, remote, minFit, payMin, sort }),
    [search, cats, locs, remote, minFit, payMin, sort],
  );

  const visible = useMemo(
    () => sortJobs(applyFilters(jobs, filterState), filterState.sort)
      .filter((j) => !rejectedIds.has(j.id)),
    [jobs, filterState, rejectedIds],
  );

  // Resolve selected job
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? null,
    [jobs, selectedId],
  );

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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  const handleReject = useCallback((job: JobRow) => {
    const priorVerdict = job.verdict;
    setRejectedIds((prev) => new Set(prev).add(job.id));
    setSelectedId((prev) => (prev === job.id ? null : prev));
    startReject(() => { void rejectJob(job.id); });
    setToast({ jobId: job.id, priorVerdict });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, [rejectJob]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    const { jobId, priorVerdict } = toast;
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    startReject(() => { void unrejectJob(jobId, priorVerdict); });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [toast, unrejectJob]);

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

  // "Mark as applied" — optimistic flip + persist (status='applied', applied_at set).
  const handleMarkApplied = useCallback((job: JobRow) => {
    const prior = packages[job.id];
    if (!prior) return;
    setPackages((p) => ({
      ...p,
      [job.id]: {
        ...prior,
        status: "applied",
        appliedAt: prior.appliedAt ?? new Date().toISOString(),
      },
    }));
    // Await the action: if the server rejects (auth/network) the DB stays "prepared",
    // so roll the optimistic flip back and tell the user instead of showing a false
    // "Applied".
    startApply(() => {
      void markApplied(job.id).catch(() => {
        setPackages((p) => ({ ...p, [job.id]: prior }));
        showActionError("Couldn’t mark as applied. Please try again.");
      });
    });
  }, [packages, markApplied, showActionError]);

  // Copy résumé text to clipboard
  const handleCopy = useCallback((job: JobRow, data: TailoredResume) => {
    const text = composeResumeText(job, data);
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
            jobs={visible}
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
          {selectedJob ? (
            <JobDetail
              job={selectedJob}
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
              pkg={packages[selectedJob.id]}
              onMarkApplied={handleMarkApplied}
              onOpenProfile={() => setProfileOpen(true)}
              onReject={handleReject}
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

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
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
            zIndex: 50,
          }}
        >
          <span>Rejected</span>
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
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
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
            zIndex: 50,
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
