"use client";

import type { Distributions } from "@/lib/metrics";
import { SimpleBarCard } from "@/components/analytics/Chart";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "12px", fontWeight: 800, color: "#8a93a3", letterSpacing: ".4px", margin: "4px 0 10px" }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

export function BreakdownsSection({ distributions: d }: { distributions: Distributions }) {
  return (
    <div>
      <Group label="JOBS">
        <SimpleBarCard title="Open jobs by location" data={d.jobsByLocation} />
        <SimpleBarCard title="Open jobs by department" data={d.jobsByDepartment} />
        <SimpleBarCard title="Remote vs on-site/hybrid" data={d.jobsRemote} />
        <SimpleBarCard title="Top companies by open roles" data={d.jobsByCompany} />
        <SimpleBarCard title="Job lifespan (closed roles)" data={d.jobLifespan} />
      </Group>
      <Group label="REVIEWS">
        <SimpleBarCard title="Fit-score distribution" data={d.fitScore} color="#22a06b" />
        <SimpleBarCard title="Approvals by industry" data={d.approvalsByIndustry} color="#22a06b" />
        <SimpleBarCard title="Approvals by role category" data={d.approvalsByRole} color="#22a06b" />
        <SimpleBarCard title="Approvals by seniority" data={d.approvalsBySeniority} color="#22a06b" />
        <SimpleBarCard title="Experience match" data={d.experienceMatch} color="#7c6cd4" />
        <SimpleBarCard title="Work arrangement" data={d.workArrangement} color="#7c6cd4" />
      </Group>
      <Group label="COMPANIES">
        <SimpleBarCard title="Companies by ATS" data={d.companiesByAts} />
        <SimpleBarCard title="Companies by discovery source" data={d.companiesBySource} />
        <SimpleBarCard title="Included companies by industry" data={d.includedByIndustry} />
        <SimpleBarCard title="Top tech tags" data={d.topTechTags} color="#7a8699" />
        <SimpleBarCard title="Top red flags" data={d.topRedFlags} color="#e0607e" />
      </Group>
    </div>
  );
}
