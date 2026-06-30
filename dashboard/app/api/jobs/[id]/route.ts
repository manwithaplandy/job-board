import { getJobReviewDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

const EMPTY = {
  reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
  description: null, url: null,
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
  const detail = await getJobReviewDetail(id);
  return Response.json(detail ?? EMPTY);
}
