"use client";

import { useEffect, useState } from "react";
import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { FunnelSection } from "@/components/analytics/FunnelSection";
import { HealthCards } from "@/components/analytics/HealthCards";
import { TrendCharts } from "@/components/analytics/TrendCharts";
import { BreakdownsSection } from "@/components/analytics/BreakdownsSection";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "funnel", label: "Funnel" },
  { id: "health", label: "Health" },
  { id: "trends", label: "Trends" },
  { id: "breakdowns", label: "Breakdowns" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ scrollMarginTop: "70px", fontSize: "16px", fontWeight: 800, color: "#161d29", margin: "28px 0 14px" }}>
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
    <main style={{ minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Pipeline analytics
        </h1>
        <div style={{ fontSize: "13px", color: "#6b7480", marginBottom: "18px" }}>
          Company Discovery, Job Discovery, and reviewer pipelines — totals, throughput, and trends.
          {" "}
          <span style={{ fontWeight: 600 }}>Aggregates refresh at least every 10 minutes.</span>
        </div>

        <KpiStrip snapshot={snapshot} series={series} nowIso={nowIso} />

        <nav
          aria-label="Sections"
          style={{
            position: "sticky", top: 0, zIndex: 10, display: "flex", gap: "8px", alignItems: "center",
            padding: "10px 0", background: "#f4f6fa", borderBottom: "1px solid #e7eaf0", margin: "24px 0 8px",
            flexWrap: "wrap",
          }}
        >
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={(e) => go(e, s.id)}
                onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px #3b6fd4"; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                style={{
                  fontSize: "12.5px", fontWeight: 700, textDecoration: "none",
                  padding: "6px 12px", borderRadius: "8px", outline: "none",
                  color: isActive ? "#1b2330" : "#3b6fd4",
                  background: isActive ? "#eef3fc" : "transparent",
                }}
              >{s.label}</a>
            );
          })}
          <a
            href="#"
            onClick={goTop}
            onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px #3b6fd4"; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              marginLeft: "auto", fontSize: "12.5px", fontWeight: 700, textDecoration: "none",
              padding: "6px 12px", borderRadius: "8px", outline: "none", color: "#5b6472",
            }}
          >↑ Top</a>
        </nav>

        {noReviewRuns && (
          <div style={{
            background: "#fff", border: "1px solid #e7eaf0", borderRadius: "12px",
            padding: "16px 18px", marginTop: "8px", display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#3b6fd4", flexShrink: 0 }} />
            <div style={{ fontSize: "13px", color: "#5b6472", lineHeight: 1.5 }}>
              <strong style={{ color: "#161d29" }}>No reviews yet.</strong>{" "}
              Once your board is reviewed, the funnel, throughput trends, and breakdowns below
              fill in. Trigger a first pass with “Review my board now” on your board.
            </div>
          </div>
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
