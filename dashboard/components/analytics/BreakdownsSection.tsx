"use client";

import type { Distributions } from "@/lib/metrics";
import type { Bar } from "@/lib/metrics";
import { SimpleBarCard, SimpleTableCard, HBarCard } from "@/components/analytics/Chart";
import { redFlagCategoryLabel } from "@/lib/redFlags";
import { humanizeLabel, companyLabel, techTagLabel } from "@/lib/analyticsLabels";

function Group({ label, intro, children }: { label: string; intro: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h3 style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-secondary)", letterSpacing: ".4px", margin: "4px 0 2px" }}>
        {label}
      </h3>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 12px" }}>{intro}</div>
      {/* alignItems:start keeps a short card (e.g. "Remote vs on-site", 2 rows) at its own
          height instead of stretching to a 10-row neighbour, removing the dead zones (audit R4-P5). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", alignItems: "start" }}>
        {children}
      </div>
    </div>
  );
}

// Humanize raw enum labels (software_internet → "Software / Internet"), preserving counts.
const hz = (bars: Bar[]): Bar[] => bars.map((b) => ({ ...b, label: humanizeLabel(b.label) }));

// Company rows come through as raw slugs (boxlunch, openai, blueskytelepsych). Show a
// display label via companyLabel (known-brand overrides + title-case fallback) but keep
// the raw slug as the hover title (audit P3 / R3-P3).
const prettyCompanies = (bars: Bar[]): Array<Bar & { title?: string }> =>
  bars.map((b) => ({ label: companyLabel(b.label), title: b.label, count: b.count }));

// Merge tech tags that differ only by case / separators ("machine learning" vs
// "machine_learning"), summing their counts, then re-rank (audit P3).
function mergeTags(bars: Bar[]): Bar[] {
  const map = new Map<string, Bar>();
  for (const b of bars) {
    const norm = b.label.toLowerCase().replace(/[_\-\s]+/g, " ").trim();
    const existing = map.get(norm);
    if (existing) existing.count += b.count;
    else map.set(norm, { label: techTagLabel(norm), count: b.count });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function BreakdownsSection({ distributions: d }: { distributions: Distributions }) {
  const redFlagBars = d.topRedFlags.map((b) => ({ ...b, label: redFlagCategoryLabel(b.label) }));
  return (
    <div>
      <Group label="JOBS" intro="What kinds of roles are open right now.">
        <HBarCard title="Open jobs by location" data={hz(d.jobsByLocation)} />
        <HBarCard title="Open jobs by department" data={hz(d.jobsByDepartment)} />
        <HBarCard title="Remote vs on-site / hybrid" data={hz(d.jobsRemote)} />
        <HBarCard title="Top companies by open roles" data={prettyCompanies(d.jobsByCompany)} />
        <HBarCard title="Open jobs by ATS" subtitle="ATS = the job-posting software each company uses." data={hz(d.jobsByAts)} />
        <SimpleBarCard title="Job lifespan (closed roles)" data={d.jobLifespan} allTicks />
      </Group>
      <Group label="REVIEWS" intro="How the reviewer scored open jobs against your profile.">
        <SimpleBarCard title="Fit-score distribution" data={d.fitScore} color="var(--chart-good)" allTicks />
        <HBarCard title="Approvals by industry" data={hz(d.approvalsByIndustry)} color="var(--chart-good)" />
        <HBarCard title="Approvals by role category" data={hz(d.approvalsByRole)} color="var(--chart-good)" />
        <HBarCard title="Approvals by seniority" data={hz(d.approvalsBySeniority)} color="var(--chart-good)" />
        <HBarCard title="Experience match" data={hz(d.experienceMatch)} color="var(--chart-violet)" />
        <HBarCard title="Work arrangement" data={hz(d.workArrangement)} color="var(--chart-violet)" />
      </Group>
      <Group label="COMPANIES" intro="Who is being tracked and why some were flagged.">
        <HBarCard title="Companies by ATS" data={hz(d.companiesByAts)} />
        <HBarCard title="Companies by discovery source" subtitle="How each tracked company first entered the system." data={hz(d.companiesBySource)} />
        <HBarCard title="Included companies by industry" data={hz(d.includedByIndustry)} />
        <HBarCard title="Top tech tags" data={mergeTags(d.topTechTags)} color="var(--chart-muted)" />
        <HBarCard title="Top red flags" subtitle="Reasons companies were flagged during classification." data={redFlagBars} color="var(--chart-bad)" />
        <SimpleTableCard title="Uncategorized red flags (other)" subtitle="Free-text flags awaiting a category — hover to read the full note." data={d.otherRedFlags} />
      </Group>
    </div>
  );
}
