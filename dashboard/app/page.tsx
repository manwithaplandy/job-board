import { parseFilters } from "@/lib/filters";
import { getBoardOwnerId, getJobs } from "@/lib/queries";
import { DEFAULT_INCLUDE_KEYWORDS } from "@/lib/config";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, ownerId] = await Promise.all([getUserId(), getBoardOwnerId()]);
  await searchParams; // filters now client-side; keep the param contract
  const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });
  const jobs = await getJobs(filters, ownerId);
  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isOperator={!!ownerId}
      isAuthed={!!viewerId}
      saveResume={saveProfileResume}
    />
  );
}
