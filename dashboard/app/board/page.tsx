import { serverBoardFilters } from "@/lib/filters";
import { getJobs } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import {
  markApplicationApplied, unmarkApplicationApplied,
} from "@/app/actions/applications";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";

// The public board, edge-cached (ISR): identical for every anonymous visitor, so
// anon hits stop paying the ~400ms 500-row dynamic SSR on every request. The auth
// proxy REWRITES anon GET / here (the URL stays "/"); authed / renders dynamically
// in app/page.tsx, and an authed visitor navigating here directly is redirected
// back to / by the proxy. Per-visitor state (the board_filters cookie — httpOnly)
// cannot vary a cached render, so RolefitBoard hydrates it client-side after mount
// (hydrateFiltersFromApi). nowIso freshness labels tolerate the staleness window.
export const revalidate = 120;

export default async function PublicBoardPage() {
  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  // The public board keeps the deliberate engineer-only editorial curation.
  const jobs = await getJobs(serverBoardFilters("anon"), null);
  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isAuthed={false}
      initialFilters={parseBoardFilters(undefined)}
      hydrateFiltersFromApi
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
