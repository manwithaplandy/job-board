import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverBoardFilters } from "@/lib/filters";
import {
  getApplicationPackages, getJobs, getJobQuestions, getLatestPollRun,
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
    // Data-dependency flip: the viewer's OWN profile drives their location
    // pre-filter, so it must be fetched before the jobs query. A brand-new account
    // has no profile row yet — send them through onboarding before any board render.
    const profile = await getProfile(viewerId);
    if (profile == null) redirect("/onboarding");
    const viewerLocations = profile.preferred_locations ?? [];
    // Authed board: the reviewer's approve join already curates it, so no title
    // prefilter (include: []). See lib/filters.ts serverBoardFilters.
    const filters = serverBoardFilters("authed");
    const jobsP = getJobs(filters, viewerId, viewerLocations);

    // The jobs query runs alongside a bounded-2 batch of the remaining authed
    // queries (dbLimit), keeping at most 3 queries in flight — the pool max.
    const [jobs, authed] = await Promise.all([
      jobsP,
      dbLimit<unknown>([
        () => getLatestPollRun(viewerId),
        () => getReviewStats(viewerId),
        () => getApplicationPackages(viewerId),
        () => getRejectedJobs(viewerId, viewerLocations),
      ]),
    ]);
    const [pollRun, reviewStats, packages, rejectedJobs] = authed as [
      Awaited<ReturnType<typeof getLatestPollRun>>,
      Awaited<ReturnType<typeof getReviewStats>>,
      Awaited<ReturnType<typeof getApplicationPackages>>,
      Awaited<ReturnType<typeof getRejectedJobs>>,
    ];
    const operator: OperatorSignals = {
      health: computeHealth(
        pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
        new Date(),
        STALE_HEALTH_HOURS,
      ),
      unreviewed: reviewStats.unreviewed,
      reviewed: reviewStats.reviewed,
    };
    // Job-level Greenhouse question schema (shared job_questions table), keyed by job id.
    // Static server data — threaded to the board and on to the application panel. Include
    // rejectedJobs: they're also selectable on the board, so their Greenhouse questions
    // panel must resolve too (querying only `jobs` left rejected postings with null).
    const jobQuestions = await getJobQuestions(
      viewerId,
      [...jobs, ...rejectedJobs].map((j) => j.id),
    );
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
        initialJobQuestions={jobQuestions}
      />
    );
  }

  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  // The public board keeps the deliberate engineer-only editorial curation.
  const filters = serverBoardFilters("anon");
  const jobs = await getJobs(filters, null, []);
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
      initialJobQuestions={{}}
    />
  );
}
