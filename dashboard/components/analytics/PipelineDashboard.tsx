"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { FunnelSection } from "@/components/analytics/FunnelSection";
import { HealthCards } from "@/components/analytics/HealthCards";
import { ChartSkeleton } from "@/components/analytics/ChartSkeleton";
import { PageHeader } from "@/components/ui/Navigation";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/SystemStates";

// Trends and Breakdowns are the only recharts consumers, and both sit below the fold.
// Load them client-side on demand (ssr:false) so recharts stays out of the analytics
// first-paint bundle; a footprint-matching skeleton holds their space until they stream in.
const TrendCharts = dynamic(() => import("@/components/analytics/TrendCharts").then((m) => m.TrendCharts), {
  ssr: false,
  loading: () => <ChartSkeleton cards={8} />,
});
const BreakdownsSection = dynamic(() => import("@/components/analytics/BreakdownsSection").then((m) => m.BreakdownsSection), {
  ssr: false,
  loading: () => <ChartSkeleton cards={6} />,
});

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "funnel", label: "Funnel" },
  { id: "health", label: "Health" },
  { id: "trends", label: "Trends" },
  { id: "breakdowns", label: "Breakdowns" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ scrollMarginTop: "70px", fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: "28px 0 14px" }}>
      {children}
    </h2>
  );
}

export function PipelineDashboard({ snapshot, series, nowIso }: { snapshot: PipelineSnapshot; series: RunSeries; nowIso: string }) {
  const [active, setActive] = useState("overview");

  // Scroll-spy: on every (rAF-throttled) scroll, pick the LAST section whose top has
  // crossed a fixed scanline just below the sticky nav. Computing this statelessly per
  // event means a fast trackpad flick can't "teleport" a heading past a thin observed
  // band and miss the update — the failure IntersectionObserver had (audit R2-3).
  useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    const SCANLINE = 140; // sticky-nav height + a little slack
    const compute = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SCANLINE) current = id;
      }
      setActive(current);
    };
    // Leading + trailing time throttle (not rAF, which is paused in background tabs):
    // recompute at most every ~100ms, with a trailing run so the final resting
    // position always lands. Stateless per event, so fast flicks can't be missed.
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const now = Date.now();
      if (now - last >= 100) {
        last = now;
        compute();
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => { last = Date.now(); compute(); }, 100);
      }
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(timer);
    };
  }, []);

  // Smooth-scroll for short hops; jump instantly for long cross-page jumps or when the
  // user prefers reduced motion — a 2-3s animation across ~7,000px flashes blank and
  // disorients (audit P4).
  function scrollBehaviorFor(distancePx: number): ScrollBehavior {
    const reduce = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduce || distancePx > window.innerHeight * 2 ? "auto" : "smooth";
  }

  function go(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: scrollBehaviorFor(Math.abs(el.getBoundingClientRect().top)) });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  function goTop(e: React.MouseEvent) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: scrollBehaviorFor(window.scrollY) });
    history.replaceState(null, "", " ");
    // A long instant jump fires no scroll event in Chrome, so the scroll-spy won't
    // recompute — set the top section active explicitly, mirroring go() (audit R5-P1).
    setActive(SECTIONS[0].id);
  }

  // A brand-new account has no review runs yet — surface an empty-state note above the
  // reviewer panels instead of blank/zero-domain charts (T6; guards the recharts-3
  // empty-domain gotcha by telling the user rather than rendering degenerate axes).
  const noReviewRuns = snapshot.health.reviewer.totals.runs === 0;
  return (
    <main className="rf-secondary-page rf-secondary-density--compact">
      <div className="rf-secondary-wrap rf-secondary-wrap--wide">
        <PageHeader className="rf-secondary-header" title="Pipeline analytics" description={<>
          Company Discovery, Job Discovery, and reviewer pipelines — totals, throughput, and trends.
          {" "}
          <span style={{ fontWeight: 600 }}>Aggregates refresh at least every 10 minutes.</span>
        </>} />

        <KpiStrip snapshot={snapshot} series={series} nowIso={nowIso} />

        <nav
          aria-label="Sections"
          className="rf-analytics-nav rf-tabs"
        >
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => go(e, s.id)}
                className="rf-tabs__item rf-focusable"
              >{s.label}</a>
            );
          })}
          <a
            href="#"
            onClick={goTop}
            className="rf-tabs__item rf-focusable"
          ><Icon name="chevron-up" size={16} />Top</a>
        </nav>

        {noReviewRuns && (
          <Alert tone="info" title="No reviews yet." className="rf-analytics-empty-alert">
              Once your board is reviewed, the funnel, throughput trends, and breakdowns below
              fill in. Trigger a first pass with “Review my board now” on your board.
          </Alert>
        )}

        <SectionHeading id="funnel">Funnel</SectionHeading>
        <FunnelSection funnel={snapshot.funnel} />

        <SectionHeading id="health">Pipeline health</SectionHeading>
        <HealthCards health={snapshot.health} nowIso={nowIso} />

        <SectionHeading id="trends">Trends</SectionHeading>
        <TrendCharts series={series} nowIso={nowIso} />

        <SectionHeading id="breakdowns">Breakdowns</SectionHeading>
        <BreakdownsSection distributions={snapshot.distributions} />
      </div>
    </main>
  );
}
