import { getJobReviewDetail } from "@/lib/queries";
import { JOB_ID_RE } from "@/lib/jobIdValidator";

export const dynamic = "force-dynamic";

export { JOB_ID_RE };

const EMPTY = {
  reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
  description: null, url: null,
  experience_match: null, industry: null, industry_subcategory: null,
  confidence: null, note: null, corrected: false,
};

// Detail-only review fields for one job (board owner's review), fetched lazily
// when a job is opened so the board list payload stays lean. Public: the board
// itself is public, so anonymous visitors opening a job hit this too (see the
// /api/jobs allowlist in lib/paths.ts). Returns empty fields when there's no
// owner/review rather than erroring.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!JOB_ID_RE.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  const detail = await getJobReviewDetail(id);
  return Response.json(detail ?? EMPTY, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
