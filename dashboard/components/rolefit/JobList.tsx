import type { JobRow } from "@/lib/types";
import { JobCard } from "./JobCard";

export interface JobListProps {
  jobs: JobRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}

export function JobList({ jobs, selectedId, onSelect, onClearFilters }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div style={{ padding: "60px 30px", textAlign: "center", color: "#8a93a3" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
          No roles match your filters
        </div>
        <button
          onClick={onClearFilters}
          style={{
            marginTop: "14px",
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
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          selected={job.id === selectedId}
          onSelect={() => onSelect(job.id)}
        />
      ))}
    </>
  );
}
