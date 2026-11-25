"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { refreshSuggestedAction } from "@/app/actions/shortlist";

/** How often a running review is polled. */
export const REVIEW_POLL_MS = 5_000;

const reviewStatusSchema = z.object({
  status: z.enum(["pending", "running", "done", "failed"]).nullable(),
  reviewedToday: z.number().optional(),
});

type Phase = { kind: "idle" } | { kind: "running"; reviewed: number | null } | { kind: "done" } | { kind: "failed" };

/**
 * The review-progress indicator (spec 6.1, plan Task 1.20). It reads the existing
 * review request route (GET /api/review/request) on load and whenever `watch` changes
 * (the page bumps it when a request_review result arrives), and polls while a review is
 * pending or running. When a review it watched finishes, it fills the shortlist's
 * suggestions through refreshSuggestedAction (the page render itself writes nothing).
 */
export function ReviewProgress({ watch = 0 }: { watch?: number }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const sawRunning = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      let body: z.infer<typeof reviewStatusSchema> | null = null;
      try {
        const res = await fetch("/api/review/request", { cache: "no-store" });
        if (res.ok) {
          const parsed = reviewStatusSchema.safeParse(await res.json());
          body = parsed.success ? parsed.data : null;
        }
      } catch {
        body = null;
      }
      if (stopped || body === null) return;
      if (body.status === "pending" || body.status === "running") {
        sawRunning.current = true;
        setPhase({ kind: "running", reviewed: body.reviewedToday ?? null });
        timer = setTimeout(() => void poll(), REVIEW_POLL_MS);
        return;
      }
      if (!sawRunning.current) return;
      sawRunning.current = false;
      if (body.status === "done") {
        setPhase({ kind: "done" });
        void refreshSuggestedAction().catch(() => {});
      } else if (body.status === "failed") setPhase({ kind: "failed" });
      else setPhase({ kind: "idle" });
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [watch]);

  if (phase.kind === "idle") return null;
  const text =
    phase.kind === "running"
      ? phase.reviewed !== null && phase.reviewed > 0
        ? `Reviewing jobs: ${phase.reviewed} scored today so far.`
        : "Reviewing jobs."
      : phase.kind === "done"
        ? "Review finished. New suggestions are on your shortlist."
        : "The review could not finish. Try again later.";
  return (
    <p className="rf-agent-review" role="status" aria-live="polite">
      {text}
    </p>
  );
}
