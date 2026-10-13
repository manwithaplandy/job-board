import { serverBoardFilters } from "@/lib/filters";
import { getJobsPage } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { saveProfileResume } from "@/app/actions/profile";
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
import {
  markApplicationApplied, unmarkApplicationApplied,
} from "@/app/actions/applications";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";

// Anonymous / rewrites here. Discovery expiry/count/page are evaluated per request;
// caching the complete page would retain rows across the exact expiry boundary.
// The older-live choice is explicit in the query string; other saved client filters
// still hydrate from the existing cookie API.
export const dynamic = "force-dynamic";

export default async function PublicBoardPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const includeOlderLive=params.older === "1";
  const page=typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Number(params.page) : 0;
  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  // The public board keeps the deliberate engineer-only editorial curation.
  // Production failures remain visible to the route error boundary. The existing
  // infra-less development visual harness can render an empty shell.
  const jobsPage = await getJobsPage({...serverBoardFilters("anon"),includeOlderLive}, null,page).catch((error: unknown) => {
    if (process.env.NODE_ENV === "production") throw error;
    return {rows:[],total:0,page};
  });
  return (
    <RolefitBoard
      key={`${includeOlderLive}:${page}`}
      jobs={jobsPage.rows}
      discoveryTotal={jobsPage.total}
      discoveryPage={page}
      nowIso={new Date().toISOString()}
      isAuthed={false}
      initialFilters={{...parseBoardFilters(undefined),includeOlderLive}}
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
