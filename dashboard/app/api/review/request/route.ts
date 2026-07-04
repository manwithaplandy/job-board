import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import {
  enqueueReviewRequest, getLatestReviewRequest, remainingDailyBudget,
} from "@/lib/reviewRequests";

export const dynamic = "force-dynamic";

// On-demand "review my board now" (spec F core). Authed only — NOT in PUBLIC_PREFIXES.
// The reviewer worker (reviewer/worker.py) consumes the enqueued row and runs the
// SAME _review_user path, so the cap + location filter (T8) bound it for free.

// POST → enqueue (idempotent). 402 if no plan, 409 if the daily budget is spent.
export async function POST() {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const userId = claims.id;

  const plan = await getViewerPlan(userId, claims.email);
  if (!plan) {
    return Response.json({ error: "Subscribe to have your board reviewed." }, { status: 402 });
  }
  const remaining = await remainingDailyBudget(userId, plan);
  if (remaining <= 0) {
    return Response.json(
      { error: "Daily review budget used — resumes tomorrow.", remaining: 0 },
      { status: 409 },
    );
  }
  const { status } = await enqueueReviewRequest(userId);
  return Response.json({ status, remaining });
}

// GET → latest request status + remaining budget (client polls this while active).
export async function GET() {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const userId = claims.id;

  const plan = await getViewerPlan(userId, claims.email);
  const [latest, remaining] = await Promise.all([
    getLatestReviewRequest(userId),
    remainingDailyBudget(userId, plan),
  ]);
  return Response.json(
    { status: latest?.status ?? null, remaining, plan },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
