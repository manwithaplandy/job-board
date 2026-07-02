import { cookies } from "next/headers";
import { parseFilters } from "@/lib/filters";
import {
  getApplicationPackages, getBoardOwner, getJobs, getLatestPollRun,
  getProfile, getRejectedJobs, getReviewStats,
} from "@/lib/queries";
import { DEFAULT_INCLUDE_KEYWORDS, STALE_HEALTH_HOURS } from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import {
  markApplicationApplied, unmarkApplicationApplied,
} from "@/app/actions/applications";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { dbLimit } from "@/lib/dbLimit";
import type { ApplicationPackage, OperatorSignals } from "@/lib/types";
import type { BoardFilterState } from "@/lib/rolefit/filter";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, owner] = await Promise.all([
    getUserId(), getBoardOwner(),
  ]);
  const ownerId = owner.id;
  const ownerLocations = owner.locations;
  await searchParams; // filters now client-side; keep the param contract
  const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });
  const jobsP = getJobs(filters, ownerId, ownerLocations);

  // Operator-only telemetry — not fetched or exposed to anonymous visitors.
  // Profile drives the header button label + modal prefill; anon path keeps the defaults.
  let operator: OperatorSignals | undefined;
  let hasProfile = false;
  let resumeText = "";
  let applicationPackages: ApplicationPackage[] = [];
  let initialFilters: BoardFilterState;
  if (viewerId) {
    // The jobs query runs alongside a bounded-2 batch of the five authed
    // queries (dbLimit), keeping at most 3 queries in flight — the pool max.
    const [jobs, authed] = await Promise.all([
      jobsP,
      dbLimit<unknown>([
        () => getLatestPollRun(),
        () => getReviewStats(viewerId),
        () => getProfile(viewerId),
        () => getApplicationPackages(viewerId),
        () => getRejectedJobs(viewerId, ownerLocations),
      ]),
    ]);
    const [pollRun, reviewStats, profile, packages, rejectedJobs] = authed as [
      Awaited<ReturnType<typeof getLatestPollRun>>,
      Awaited<ReturnType<typeof getReviewStats>>,
      Awaited<ReturnType<typeof getProfile>>,
      Awaited<ReturnType<typeof getApplicationPackages>>,
      Awaited<ReturnType<typeof getRejectedJobs>>,
    ];
    operator = {
      health: computeHealth(
        pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
        new Date(),
        STALE_HEALTH_HOURS,
      ),
      unreviewed: reviewStats.unreviewed,
    };
    hasProfile = profile != null; // a saved profile row exists
    resumeText = profile?.resume_text ?? "";
    applicationPackages = packages;
    initialFilters = parseBoardFilters(profile?.board_filters);
    return (
      <RolefitBoard
        jobs={jobs}
        nowIso={new Date().toISOString()}
        isOperator={!!ownerId}
        isAuthed={!!viewerId}
        initialFilters={initialFilters}
        saveResume={saveProfileResume}
        rejectJob={rejectJob}
        unrejectJob={unrejectJob}
        markApplied={markApplicationApplied}
        unmarkApplied={unmarkApplicationApplied}
        operator={operator}
        hasProfile={hasProfile}
        resumeText={resumeText}
        initialPackages={applicationPackages}
        initialRejected={rejectedJobs}
      />
    );
  } else {
    const jobs = await jobsP;
    const store = await cookies();
    initialFilters = parseBoardFilters(store.get("board_filters")?.value);
    return (
      <RolefitBoard
        jobs={jobs}
        nowIso={new Date().toISOString()}
        isOperator={!!ownerId}
        isAuthed={false}
        initialFilters={initialFilters}
        saveResume={saveProfileResume}
        rejectJob={rejectJob}
        unrejectJob={unrejectJob}
        markApplied={markApplicationApplied}
        unmarkApplied={unmarkApplicationApplied}
        operator={undefined}
        hasProfile={false}
        resumeText=""
        initialPackages={[]}
        initialRejected={[]}
      />
    );
  }
}
