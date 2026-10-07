import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import {
  resumeMatching, getMatchingPaused, getLatestReviewRequest, remainingDailyBudget, reviewsChargedToday,
} from "@/lib/reviewRequests";
import { getReviewFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

// On-demand "review my board now" (spec F core). Authed only — NOT in PUBLIC_PREFIXES.
// The reviewer worker (reviewer/worker.py) consumes the enqueued row and runs the
// SAME _review_user path: entitlement/location/company filters precede demand
// hydration, and only durable description versions reach either model stage.

// POST → enqueue (idempotent). 402 if no plan, 409 if the daily budget is spent.
export async function POST() {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const userId = claims.id;

  // Rejections carry a machine-readable `code` (and the plan, once known) so the client
  // can key its /billing upsell CTA off structured fields, mirroring lib/usage.ts's
  // AllowanceGateRejection shape.
  const plan = await getViewerPlan(userId, claims.email);
  if (!plan) {
    return Response.json(
      { error: "Subscribe to have your board reviewed.", code: "subscription_required" },
      { status: 402 },
    );
  }
  const remaining = await remainingDailyBudget(userId, plan);
  // Resuming restores future scheduled matching even if today's cap is spent.
  // The worker still enforces the unchanged daily budget at execution.
  const paused = await getMatchingPaused(userId);
  if (remaining <= 0 && !paused) {
    return Response.json(
      {
        error: "Daily review budget used — resumes tomorrow.",
        code: "review_budget_exhausted",
        plan,
        remaining: 0,
      },
      { status: 409 },
    );
  }
  const { status } = await resumeMatching(userId);
  return Response.json({ status, remaining });
}

// GET → latest request status + remaining budget (client polls this while active).
// With ?since=<cursor>: also the viewer's approved matches reviewed after the cursor
// (live board population) plus a fresh server-issued cursor — the client echoes it
// back, so no client clock is ever trusted. `since` values are only ever cursors this
// endpoint issued; anything unparseable is treated as absent (cursor re-established,
// no delta) — safe because the settle-time board refresh reconciles authoritatively.
export async function GET(request: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const userId = claims.id;

  const sinceRaw = new URL(request.url).searchParams.get("since");
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : null;

  const plan = await getViewerPlan(userId, claims.email);
  const [latest, remaining, reviewedToday, feed, matchingPaused] = await Promise.all([
    getLatestReviewRequest(userId),
    remainingDailyBudget(userId, plan),
    reviewsChargedToday(userId),
    getReviewFeed(userId, since),
    getMatchingPaused(userId),
  ]);
  return Response.json(
    // reviewedToday = the first-run progress figure ("N roles scored so far").
    {
      status: latest?.status ?? null, remaining, plan, reviewedToday, matchingPaused,
      cursor: feed.cursor, newMatches: feed.newMatches,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
