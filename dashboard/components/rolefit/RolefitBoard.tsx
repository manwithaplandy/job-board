"use client";

import { useState, useEffect, useMemo } from "react";
import type { JobRow } from "@/lib/types";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { applyFilters, sortJobs } from "@/lib/rolefit/filter";
import { Header } from "./Header";
import { FilterBar } from "./FilterBar";
import { JobList } from "./JobList";

export interface RolefitBoardProps {
  jobs: JobRow[];
  nowIso: string;
  isOperator: boolean;
  isAuthed: boolean;
  saveResume: (fd: FormData) => Promise<void>;
}

export function RolefitBoard({
  jobs,
  nowIso: _nowIso,
  isOperator: _isOperator,
  isAuthed,
  saveResume: _saveResume,
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
    () => sortJobs(applyFilters(jobs, filterState), filterState.sort),
    [jobs, filterState],
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
        onOpenProfile={() => setProfileOpen(true)}
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

      {/* Split pane — left: job list; right: detail (Task 13) */}
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
            onSelect={setSelectedId}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Detail pane — placeholder until Task 13 */}
        <div
          className="rf-scroll"
          style={{ flex: 1, overflowY: "auto", background: "#fff", minWidth: 0 }}
        >
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
        </div>
      </div>

      {/* Profile modal — Task 14; profileOpen state threaded for wiring */}
      {profileOpen && null}
    </div>
  );
}
