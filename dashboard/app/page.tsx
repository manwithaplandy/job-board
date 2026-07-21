import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverBoardFilters } from "@/lib/filters";
import {
  getApplicationPackages, getJobs, getLatestPollRun,
  getProfile, getRejectedJobs, getReviewStats,
} from "@/lib/queries";
import { STALE_HEALTH_HOURS } from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import {
  markApplicationApplied, unmarkApplicationApplied,
} from "@/app/actions/applications";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { dbLimit } from "@/lib/dbLimit";
import type { OperatorSignals } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const claims = await getUserClaims();
  const viewerId = claims?.id ?? null;
  await searchParams; // filters now client-side; keep the param contract

  if (viewerId) {
    // Authed board: the reviewer's approve join already curates it, so no title
    // prefilter (include: []). See lib/filters.ts serverBoardFilters.
    const filters = serverBoardFilters("authed");
    // Single wave. getJobs/getRejectedJobs self-serve the viewer's preferred_locations via
    // a correlated subquery, so getProfile no longer gates them — all six board queries run
    // through ONE dbLimit(3). Pool max is 3 (lib/db.ts), so exactly three execute at a time
    // and postgres.js never queues (preserving the "fired ≤ pool max" invariant the old
    // jobs+dbLimit(2) split held). The render-critical trio (profile, jobs, rejected) leads
    // the array so it starts first; the secondary trio drains as those slots free.
    const [profile, jobs, rejectedJobs, pollRun, reviewStats, packages] = await dbLimit<unknown>([
      () => getProfile(viewerId),
      () => getJobs(filters, viewerId),
      () => getRejectedJobs(viewerId),
      () => getLatestPollRun(viewerId),
      () => getReviewStats(viewerId),
      () => getApplicationPackages(viewerId),
    ], 3) as [
      Awaited<ReturnType<typeof getProfile>>,
      Awaited<ReturnType<typeof getJobs>>,
      Awaited<ReturnType<typeof getRejectedJobs>>,
      Awaited<ReturnType<typeof getLatestPollRun>>,
      Awaited<ReturnType<typeof getReviewStats>>,
      Awaited<ReturnType<typeof getApplicationPackages>>,
    ];
    // A brand-new account has no profile row yet — send them through onboarding before any
    // board render (the concurrently-fetched jobs are simply discarded on this rare path).
    if (profile == null) redirect("/onboarding");
    const operator: OperatorSignals = {
      health: computeHealth(
        pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
        new Date(),
        STALE_HEALTH_HOURS,
      ),
      unreviewed: reviewStats.unreviewed,
      reviewed: reviewStats.reviewed,
    };
    const initialFilters = parseBoardFilters(profile.board_filters);
    return (
      <RolefitBoard
        jobs={jobs}
        nowIso={new Date().toISOString()}
        isAuthed
        initialFilters={initialFilters}
        saveResume={saveProfileResume}
        rejectJob={rejectJob}
        unrejectJob={unrejectJob}
        markApplied={markApplicationApplied}
        unmarkApplied={unmarkApplicationApplied}
        operator={operator}
        hasProfile
        viewerEmail={claims!.email}
        isAdmin={isAdmin(claims)}
        resumeText={profile.resume_text ?? ""}
        currentProfileVersion={profile.profile_version}
        initialPackages={packages}
        initialRejected={rejectedJobs}
      />
    );
  }

  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  // The public board keeps the deliberate engineer-only editorial curation.
  const filters = serverBoardFilters("anon");
  const jobs = await getJobs(filters, null);
  const store = await cookies();
  const initialFilters = parseBoardFilters(store.get("board_filters")?.value);
  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isAuthed={false}
      initialFilters={initialFilters}
      saveResume={saveProfileResume}
      rejectJob={rejectJob}
      unrejectJob={unrejectJob}
      markApplied={markApplicationApplied}
      unmarkApplied={unmarkApplicationApplied}
      operator={undefined}
      hasProfile={false}
      viewerEmail={null}
      isAdmin={false}
      resumeText=""
      currentProfileVersion={null}
      initialPackages={[]}
      initialRejected={[]}
    />
  );
}
