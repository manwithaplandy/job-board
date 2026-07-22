"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cancelClassificationJob } from "@/app/actions/classification";
import {
  parseClassificationJob,
  type ClassificationJobRow,
  type ClassificationJobStatus,
} from "@/lib/classificationJobCodec";
import { Badge, type BadgeTone } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/SystemStates";

// Server-seeded monitor for the classification_jobs queue. Polls the admin route
// (GET /api/admin/classification-jobs, cache:"no-store") every 4s ONLY while some
// row is pending/running — the same hasPending gating GenerationToastProvider uses,
// plus a visibilitychange catch-up — so a settled board goes quiet. The poll body is
// total-parsed through the SAME codec the server data layer uses (never `as`-cast).

const POLL_INTERVAL_MS = 4_000;

const STATUS_TONE: Record<ClassificationJobStatus, BadgeTone> = {
  pending: "neutral",
  running: "accent",
  done: "success",
  canceled: "warning",
  error: "danger",
};

const MODE_LABEL: Record<ClassificationJobRow["selectionMode"], string> = {
  unclassified: "Unclassified",
  unknown_repass: "Re-pass unknown",
};

const usd = (n: number | null): string => (n == null ? "—" : `$${n.toFixed(2)}`);

const isLive = (status: ClassificationJobStatus): boolean =>
  status === "pending" || status === "running";

function Row({
  job,
  onCancel,
  canceling,
}: {
  job: ClassificationJobRow;
  onCancel: (id: number) => void;
  canceling: boolean;
}) {
  return (
    <tr>
      <td>{MODE_LABEL[job.selectionMode]}</td>
      <td>{job.model}</td>
      <td>{job.useSerp ? "Yes" : "—"}</td>
      <td style={{ textAlign: "right" }}>
        {job.processed.toLocaleString()} / {job.companyCap.toLocaleString()}
        {job.errored > 0 && (
          <span style={{ color: "var(--danger)" }}> · {job.errored.toLocaleString()} err</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>{usd(job.estCost)}</td>
      <td style={{ textAlign: "right" }}>{usd(job.actualCost)}</td>
      <td>
        <Badge tone={STATUS_TONE[job.status]}>{job.status}</Badge>
        {job.error && (
          <div style={{ color: "var(--danger)", fontSize: "var(--font-size-small)" }}>
            {job.error}
          </div>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        {isLive(job.status) ? (
          <Button
            variant="destructive"
            size="sm"
            loading={canceling}
            loadingLabel="Canceling"
            onClick={() => onCancel(job.id)}
          >
            Cancel
          </Button>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

export function ClassificationJobsPanel({ initial }: { initial: ClassificationJobRow[] }) {
  const [jobs, setJobs] = useState<ClassificationJobRow[]>(initial);
  const [canceling, startCancel] = useTransition();
  const inFlight = useRef(false);

  // A router.refresh() after a launch hands down a fresh `initial` array — adopt it
  // so a newly enqueued pending row appears (and restarts the poll below).
  useEffect(() => {
    setJobs(initial);
  }, [initial]);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/classification-jobs", { cache: "no-store" });
      if (!res.ok) return; // transient hiccup / 404 for a de-admined session — retry next tick
      const body: unknown = await res.json().catch(() => null);
      const raw = (body as { jobs?: unknown })?.jobs;
      if (!Array.isArray(raw)) return;
      const parsed = raw
        .map(parseClassificationJob)
        .filter((j): j is ClassificationJobRow => j !== null);
      setJobs(parsed);
    } catch {
      // network hiccup — the next tick retries while anything is live
    } finally {
      inFlight.current = false;
    }
  }, []);

  const hasLive = useMemo(() => jobs.some((j) => isLive(j.status)), [jobs]);

  // Poll every 4s while a run is live; go quiet otherwise.
  useEffect(() => {
    if (!hasLive) return;
    const t = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasLive, poll]);

  // Returning to a backgrounded tab: catch up immediately instead of on the tick.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && hasLive) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hasLive, poll]);

  const cancel = (id: number) => {
    startCancel(async () => {
      await cancelClassificationJob(id);
      await poll(); // reflect the flip immediately rather than waiting for the tick
    });
  };

  if (jobs.length === 0) {
    return <EmptyState compact title="No classification runs yet." />;
  }

  return (
    <div
      className="rf-secondary-table-scroll rf-focusable"
      tabIndex={0}
      aria-label="Classification jobs table, horizontally scrollable"
    >
      <table
        className="rf-secondary-table"
        style={{ minWidth: "900px" }}
        data-ui-contract-geometry="wide multi-column job monitor scrolls within its own container"
      >
        <thead>
          <tr>
            <th>Mode</th>
            <th>Model</th>
            <th>SERP</th>
            <th>Progress</th>
            <th>Est $</th>
            <th>Actual $</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <Row key={job.id} job={job} onCancel={cancel} canceling={canceling} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
