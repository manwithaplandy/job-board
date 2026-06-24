import type { Health } from "@/lib/status";
import type { PollRunRow } from "@/lib/types";

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
}: {
  lastRun: PollRunRow | null;
  health: Health;
}) {
  const finished = lastRun?.finished_at
    ? new Date(lastRun.finished_at).toLocaleString()
    : "never";
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <h1 className="text-lg font-semibold">Remote Job Tracker</h1>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Last poll: {finished}</span>
        <span
          className={`inline-block h-3 w-3 rounded-full ${DOT[health]}`}
          title={LABEL[health]}
          aria-label={LABEL[health]}
        />
      </div>
    </header>
  );
}
