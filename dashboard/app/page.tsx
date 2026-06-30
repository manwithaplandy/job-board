import { parseFilters } from "@/lib/filters";
import {
  getBoardOwnerId, getBoardOwnerLocations, getJobs, getLatestPollRun, getProfile, getReviewStats,
} from "@/lib/queries";
import { DEFAULT_INCLUDE_KEYWORDS, STALE_HEALTH_HOURS } from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
import type { ApplicationAnswers, OperatorSignals } from "@/lib/types";

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
  if (viewerId) {
    const [pollRun, reviewStats, profile] = await Promise.all([
      getLatestPollRun(),
      getReviewStats(viewerId),
      getProfile(viewerId),
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
    applicationAnswers = profile
      ? {
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          links: profile.links,
          work_authorized: profile.work_authorized,
          needs_sponsorship: profile.needs_sponsorship,
          eeo_gender: profile.eeo_gender,
          eeo_race: profile.eeo_race,
          eeo_veteran: profile.eeo_veteran,
          eeo_disability: profile.eeo_disability,
          screening_answers: profile.screening_answers,
        }
      : null;
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
      operator={operator}
      hasProfile={hasProfile}
      resumeText={resumeText}
      applicationAnswers={applicationAnswers}
    />
  );
}
