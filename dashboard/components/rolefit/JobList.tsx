"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { JobRow } from "@/lib/types";
import { JobCard } from "./JobCard";
import { Button } from "@/components/ui/Button";

export interface JobListProps {
  jobs: JobRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
  view?: "all" | "applied" | "rejected";
  onBackToAll?: () => void;
  // Whether the board's "all" pool has any jobs before search/facet filtering. Lets the
  // empty state distinguish a pipeline with zero roles from a filter that matched none.
  hasUnfilteredJobs: boolean;
  // The active view's pool size BEFORE search/facet filtering (the board's totalInView).
  // For the "all" view this is the untriaged count: 0 with jobs present means every role
  // has been rejected/applied ("all caught up"), which is distinct from filters narrowing.
  viewPoolCount: number;
  // The board's scroll container. When provided the list virtualizes against it; when
  // absent (narrow single-pane layout uses natural page scroll) it renders in full.
  scrollParentRef?: RefObject<HTMLDivElement | null>;
  // When this changes, the virtualized list scrolls that id into view — backs keyboard
  // nav's scroll-into-view (#3) and the deep-linked ?job= seed (#5). No-op in the
  // non-virtualized narrow list (page scroll is handled separately).
  scrollToId?: string | null;
  // Hover-revealed reject × on each card (#14). Threaded to every JobCard; absent → no ×.
  onReject?: (id: string) => void;
}

const pillBtnStyle = {
  marginTop: "14px",
  fontWeight: 700,
  fontSize: "13px",
  color: "#3b6fd4",
  background: "#eef3fc",
  border: "1px solid #d8e2f6",
  borderRadius: "9px",
  padding: "8px 14px",
  cursor: "pointer",
} as const;

// Windowed list: only the cards near the viewport are mounted, so filtering a ~100k-row
// board stays cheap. The full (filtered) array stays in memory — virtualization is purely
// a render optimization. Row heights vary slightly (chips wrap), so measureElement refines
// the estimate as rows mount.
function VirtualJobList({
  jobs,
  selectedId,
  onSelect,
  scrollParentRef,
  scrollToId,
  onReject,
}: {
  jobs: JobRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  scrollParentRef: RefObject<HTMLDivElement | null>;
  scrollToId?: string | null;
  onReject?: (id: string) => void;
}) {
  // The scroll element is an ancestor (the board's list pane), whose ref attaches after
  // this child's layout effect — so getScrollElement() is null on the first commit. Force
  // one re-render after mount so the virtualizer picks up the now-attached element instead
  // of rendering an empty list until the first scroll/resize.
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 116,
    overscan: 6,
    getItemKey: (index) => jobs[index].id,
  });

  // Keyboard nav / deep-link seed sets scrollToId; bring that card into view. Only scroll
  // when the TARGET actually changes (or first appears): any OTHER list-identity change —
  // rejecting a non-selected card via its hover-×, a search keystroke, a facet toggle —
  // would otherwise re-run scrollToIndex on the unchanged selection and yank the pane back
  // to the card the user deliberately scrolled away from. `lastScrolledRef` gates that; the
  // `jobs` dep then only serves the deep-link case where the id wasn't in the list yet
  // (scroll once its row appears).
  const lastScrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (scrollToId == null) {
      lastScrolledRef.current = null;
      return;
    }
    if (scrollToId === lastScrolledRef.current) return;
    const i = jobs.findIndex((j) => j.id === scrollToId);
    if (i >= 0) {
      virtualizer.scrollToIndex(i, { align: "auto" });
      lastScrolledRef.current = scrollToId;
    }
  }, [scrollToId, jobs, virtualizer]);

  return (
    <div role="list" style={{ position: "relative", height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const job = jobs[vi.index];
        return (
          <div
            role="listitem"
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <JobCard job={job} selected={job.id === selectedId} onSelect={onSelect} onReject={onReject} />
          </div>
        );
      })}
    </div>
  );
}

export function JobList({
  jobs,
  selectedId,
  onSelect,
  onClearFilters,
  view = "all",
  onBackToAll,
  hasUnfilteredJobs,
  viewPoolCount,
  scrollParentRef,
  scrollToId,
  onReject,
}: JobListProps) {
  if (jobs.length === 0) {
    if (view !== "all") {
      // The bucket is non-empty (viewPoolCount > 0) but an active search/facet filter
      // matched none — show the same "No roles match your filters" + Clear-filters state as
      // the all-view. Telling a user with e.g. 5 applied roles that they've applied to none,
      // with only a "Back to all roles" escape, hides that their filter is the cause.
      if (viewPoolCount > 0) {
        return (
          <div style={{ padding: "60px 30px", textAlign: "center", color: "#5b6472" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
              No roles match your filters
            </div>
            <Button variant="ghost" onClick={onClearFilters} style={pillBtnStyle}>
              Clear filters
            </Button>
          </div>
        );
      }
      // Empty bucket (viewPoolCount === 0): it isn't "filtered out", it's genuinely empty.
      // Say so, and offer a route back to the full board instead of a no-op "Clear filters".
      const msg =
        view === "applied"
          ? "You haven't marked any roles as applied yet."
          : "You haven't rejected any roles yet.";
      return (
        <div style={{ padding: "60px 30px", textAlign: "center", color: "#5b6472" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>{msg}</div>
          {onBackToAll && (
            <Button variant="ghost" onClick={onBackToAll} style={pillBtnStyle}>
              Back to all roles
            </Button>
          )}
        </div>
      );
    }
    if (!hasUnfilteredJobs) {
      return (
        <div style={{ padding: "60px 30px", textAlign: "center", color: "#5b6472" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
            No roles yet
          </div>
          <div style={{ fontSize: "13px", marginTop: "6px" }}>
            The poller runs every couple of hours. Check{" "}
            <a href="/analytics" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
              pipeline health
            </a>{" "}
            if this persists.
          </div>
        </div>
      );
    }
    // Jobs exist but every one has been rejected/applied — the "all" pool is empty for a
    // reason filters can't fix, so offer no (no-op) Clear-filters CTA.
    if (viewPoolCount === 0) {
      return (
        <div style={{ padding: "60px 30px", textAlign: "center", color: "#5b6472" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
            All caught up
          </div>
          <div style={{ fontSize: "13px", marginTop: "6px" }}>
            You&apos;ve triaged every role.
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: "60px 30px", textAlign: "center", color: "#5b6472" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
          No roles match your filters
        </div>
        <Button variant="ghost" onClick={onClearFilters} style={pillBtnStyle}>
          Clear filters
        </Button>
      </div>
    );
  }

  if (scrollParentRef) {
    return (
      <VirtualJobList
        jobs={jobs}
        selectedId={selectedId}
        onSelect={onSelect}
        scrollParentRef={scrollParentRef}
        scrollToId={scrollToId}
        onReject={onReject}
      />
    );
  }

  return (
    <div role="list">
      {jobs.map((job) => (
        <div role="listitem" key={job.id}>
          <JobCard
            job={job}
            selected={job.id === selectedId}
            onSelect={onSelect}
            onReject={onReject}
          />
        </div>
      ))}
    </div>
  );
}
