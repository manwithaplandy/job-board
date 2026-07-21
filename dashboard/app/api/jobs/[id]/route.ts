import { getJobReviewDetail, getJobQuestion } from "@/lib/queries";
import { getUserId } from "@/lib/auth";
import { JOB_ID_RE } from "@/lib/jobIdValidator";

export const dynamic = "force-dynamic";

const EMPTY = {
  reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
  description: null, url: null,
  experience_match: null, industry: null, industry_subcategory: null,
  confidence: null, note: null, corrected: false,
};

// Detail-only fields for one job, scoped to the VIEWER's own review, fetched lazily
// when a job is opened so the board list payload stays lean. Public: the board is
// public, so an anonymous visitor opening a job hits this too (userId=null → the JD
// + apply url still return, but every review field is null). See the /api/jobs
// allowlist in lib/paths.ts.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!JOB_ID_RE.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  const viewerId = await getUserId();
  // Detail + the opened job's Greenhouse question schema, resolved together on job-open so
  // the board list payload stays lean (the client only ever reads the ONE open job's
  // schema). `questions` is authed-only — the application panel it feeds is authed, so an
  // anon viewer gets null, exactly as the old eager board passed {} for anon. getJobQuestion
  // is keyed on job_id alone (shared_read RLS), so it resolves even for a job the viewer
  // rejected — the eager path included rejected ids for the same reason.
  const [detail, questions] = await Promise.all([
    getJobReviewDetail(id, viewerId),
    viewerId ? getJobQuestion(viewerId, id) : Promise.resolve(null),
  ]);
  // The body is viewer-scoped (their own review). It MUST NOT be cached in a shared
  // CDN cache — a `public` cache would leak one tenant's review to another. Keep it
  // private and uncached.
  return Response.json({ ...(detail ?? EMPTY), questions }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
