import type { Health } from "@/lib/status";
import type { PollRunRow, ReviewRunRow, ReviewStats } from "@/lib/types";
import { RefreshButton } from "@/components/RefreshButton";

const DOT: Record<Health, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-500",
  stale: "bg-red-500",
};

const LABEL: Record<Health, string> = {
  ok: "Healthy",
  warn: "Last run had failures",
  stale: "Stale / no recent run",
};

export function Header({
  lastRun,
  health,
  lastReview,
  reviewStats,
  isAuthed,
}: {
  lastRun: PollRunRow | null;
  health: Health;
  lastReview: ReviewRunRow | null;
  reviewStats: ReviewStats | null;
  isAuthed: boolean;
}) {
  const finished = lastRun?.finished_at
    ? new Date(lastRun.finished_at).toLocaleString()
    : "never";
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <h1 className="text-lg font-semibold">Remote Job Tracker</h1>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>Last poll: {finished}</span>
        <span className={`inline-block h-3 w-3 rounded-full ${DOT[health]}`}
          title={LABEL[health]} aria-label={LABEL[health]} />
        {lastReview && (
          <span className="text-gray-500">
            Reviews: {lastReview.approved ?? 0}✓ / {lastReview.denied ?? 0}✗
            {(lastReview.errors ?? 0) > 0 ? ` / ${lastReview.errors}⚠` : ""}
          </span>
        )}
        {reviewStats && (
          <span className="text-gray-500">
            {reviewStats.unreviewed} unreviewed
            {reviewStats.errors > 0 ? (
              <span className="text-amber-600"> · {reviewStats.errors} errored</span>
            ) : null}
          </span>
        )}
        <RefreshButton />
        {isAuthed ? (
          <>
            <a href="/profile" className="text-blue-700 hover:underline">Profile</a>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-blue-700 hover:underline">Sign out</button>
            </form>
          </>
        ) : (
          <a href="/login" className="text-blue-700 hover:underline">Sign in</a>
        )}
      </div>
    </header>
  );
}
