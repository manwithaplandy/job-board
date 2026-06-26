import { parseFilters } from "@/lib/filters";
import {
  getBoardOwnerId, getBoardOwnerLocations, getJobs, getLatestPollRun, getReviewStats,
} from "@/lib/queries";
import { DEFAULT_INCLUDE_KEYWORDS, STALE_HEALTH_HOURS } from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
import type { OperatorSignals } from "@/lib/types";

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
  let operator: OperatorSignals | undefined;
  if (viewerId) {
    const [pollRun, reviewStats] = await Promise.all([
      getLatestPollRun(),
      getReviewStats(viewerId),
    ]);
    operator = {
      health: computeHealth(pollRun, new Date(), STALE_HEALTH_HOURS),
      unreviewed: reviewStats.unreviewed,
    };
  }

  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isOperator={!!ownerId}
      isAuthed={!!viewerId}
      saveResume={saveProfileResume}
      operator={operator}
    />
  );
}
