"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
import type { JobRow, OperatorSignals } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
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
  initialFilters: BoardFilterState;
  saveResume: (fd: FormData) => Promise<void>;
  rejectJob: (jobId: string) => Promise<void>;
  unrejectJob: (jobId: string, priorVerdict: string | null) => Promise<void>;
  operator?: OperatorSignals;
  hasProfile: boolean;
  resumeText: string;
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
  operator,
  hasProfile,
  resumeText,
}: RolefitBoardProps) {
  // Filter state — seeded from persisted filters (cookie/DB) resolved on the server.
  const [search, setSearch] = useState(initialFilters.search);
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

  // Manual-rejection state: optimistically hidden ids + the pending Undo toast.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ jobId: string; priorVerdict: string | null } | null>(null);
  const [, startReject] = useTransition();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Résumé generation state (keyed by job id)
  const [gen, setGen] = useState<Record<string, string>>({});
  const [genData, setGenData] = useState<Record<string, TailoredResume>>({});
  const [genError, setGenError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs
  const detailRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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
    } catch (e) {
      setGen((g) => ({ ...g, [job.id]: "error" }));
      setGenError((m) => ({ ...m, [job.id]: (e as Error).message }));
    }
  }, []);

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
              gen={gen}
              genData={genData}
              genError={genError}
              onGenerate={handleGenerate}
              onCopy={handleCopy}
              copiedId={copiedId}
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
