"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the server-rendered job list in place (the page is force-dynamic, so router.refresh()
// re-runs the queries) without dropping the current filters from the URL.
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="text-blue-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
