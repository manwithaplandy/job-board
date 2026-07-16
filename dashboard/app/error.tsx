"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SupportLink } from "@/components/SupportLink";
import { EntryShell, ErrorState } from "@/components/ui/SystemStates";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // NEVER render error.message — it can carry internals (T5). Next provides a `digest`
  // (a hash of the server error) that correlates to the full server-side log, so the
  // user can report an incident without us leaking anything.
  const digest = error.digest;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // reset() alone only re-renders THIS client error boundary — it does NOT re-run the
  // server component whose render threw, so for a server-side error (the common case,
  // e.g. the authed-500 that motivated this) the boundary just re-throws and the button
  // appears to do nothing. router.refresh() re-runs the server render with fresh data;
  // reset() then clears the boundary so the refreshed tree can mount. Both go in one
  // transition so React can keep the current UI (and show pending) until the retry
  // resolves. If the underlying error persists, the boundary simply re-renders — no worse
  // than before, but a transient failure now genuinely recovers.
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <EntryShell title="Something went wrong">
      <ErrorState
        title="An unexpected error occurred"
        description="Please try again. If the problem continues, contact support and include the reference below."
        action={<>
          <Button variant="primary" onClick={retry} disabled={isPending}>
            {isPending ? "Retrying..." : "Try again"}
          </Button>
          <SupportLink label="Contact support" subject={digest ? `Error report (ref ${digest})` : "Error report"} />
        </>}
        reference={digest && <>Reference: <code>{digest}</code></>}
      />
    </EntryShell>
  );
}
