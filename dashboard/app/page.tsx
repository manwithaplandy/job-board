import { parseFilters } from "@/lib/filters";
import {
  getApplicationPackages, getBoardOwnerId, getBoardOwnerLocations, getJobs,
  getLatestPollRun, getProfile, getReviewStats,
} from "@/lib/queries";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import { DEFAULT_INCLUDE_KEYWORDS, STALE_HEALTH_HOURS } from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import {
  markApplicationApplied, persistRegeneratedResume, persistRegeneratedCover,
} from "@/app/actions/applications";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
import type { ApplicationAnswers, ApplicationPackage, OperatorSignals } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, ownerId, ownerLocations] = await Promise.all([
    getUserId(), getBoardOwnerId(), getBoardOwnerLocations(),
  ]);
  await searchParams; // filters now client-side; keep the param contract
  const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });
  const jobs = await getJobs(filters, ownerId, ownerLocations);

  // Operator-only telemetry — not fetched or exposed to anonymous visitors.
  // Profile drives the header button label + modal prefill; anon path keeps the defaults.
  let operator: OperatorSignals | undefined;
  let hasProfile = false;
  let resumeText = "";
  let applicationAnswers: ApplicationAnswers | null = null;
  let applicationPackages: ApplicationPackage[] = [];
  if (viewerId) {
    const [pollRun, reviewStats, profile, packages] = await Promise.all([
      getLatestPollRun(),
      getReviewStats(viewerId),
      getProfile(viewerId),
      getApplicationPackages(viewerId),
    ]);
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
    applicationAnswers = profile ? applicationAnswersFromProfile(profile) : null;
    applicationPackages = packages;
  }

  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isOperator={!!ownerId}
      isAuthed={!!viewerId}
      saveResume={saveProfileResume}
      rejectJob={rejectJob}
      unrejectJob={unrejectJob}
      markApplied={markApplicationApplied}
      persistResume={persistRegeneratedResume}
      persistCover={persistRegeneratedCover}
      operator={operator}
      hasProfile={hasProfile}
      resumeText={resumeText}
      applicationAnswers={applicationAnswers}
      initialPackages={applicationPackages}
    />
  );
}
