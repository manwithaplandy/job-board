import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverBoardFilters } from "@/lib/filters";
import {
  getApplicationPackages, getJobsPage, getLatestPollRun,
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
  const params = await searchParams;
  const includeOlderLive=params.older === "1";
  const pageNumber=(value:unknown) => typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 0;
  const page=pageNumber(params.page), historyPage=pageNumber(params.historyPage);

  if (viewerId) {
    // Authed board: the reviewer's approve join already curates it, so no title
    // prefilter (include: []). See lib/filters.ts serverBoardFilters.
    const filters = {...serverBoardFilters("authed"),includeOlderLive};
    // Single wave. Discovery/rejected queries self-serve the viewer's preferred_locations via
    // a correlated subquery, so getProfile no longer gates them — all seven board queries run
    // through ONE dbLimit(3). Pool max is 3 (lib/db.ts), so exactly three execute at a time
    // and postgres.js never queues (preserving the "fired ≤ pool max" invariant the old
    // jobs+dbLimit(2) split held). The render-critical trio (profile, jobs, rejected) leads
    // the array so it starts first; the remaining queries drain as those slots free.
    const [profile, jobsPage, rejectedJobs, pollRun, reviewStats, packages, savedPage] = await dbLimit<unknown>([
      () => getProfile(viewerId),
      () => getJobsPage(filters, viewerId,page),
      () => getRejectedJobs(viewerId),
      () => getLatestPollRun(viewerId),
      () => getReviewStats(viewerId),
      () => getApplicationPackages(viewerId),
      () => getJobsPage(filters,viewerId,historyPage,true),
    ], 3) as [
      Awaited<ReturnType<typeof getProfile>>,
      Awaited<ReturnType<typeof getJobsPage>>,
      Awaited<ReturnType<typeof getRejectedJobs>>,
      Awaited<ReturnType<typeof getLatestPollRun>>,
      Awaited<ReturnType<typeof getReviewStats>>,
      Awaited<ReturnType<typeof getApplicationPackages>>,
      Awaited<ReturnType<typeof getJobsPage>>,
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
    const initialFilters = {...parseBoardFilters(profile.board_filters),includeOlderLive};
    return (
      <RolefitBoard
        key={`${includeOlderLive}:${page}:${historyPage}`}
        jobs={jobsPage.rows}
        initialHistory={savedPage.rows}
        discoveryTotal={jobsPage.total}
        historyTotal={savedPage.total}
        discoveryPage={page}
        historyPage={historyPage}
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
  const filters = {...serverBoardFilters("anon"),includeOlderLive};
  const jobsPage = await getJobsPage(filters, null,page);
  const store = await cookies();
  const initialFilters = {...parseBoardFilters(store.get("board_filters")?.value),includeOlderLive};
  return (
    <RolefitBoard
      key={`${includeOlderLive}:${page}`}
      jobs={jobsPage.rows}
      discoveryTotal={jobsPage.total}
      discoveryPage={page}
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
