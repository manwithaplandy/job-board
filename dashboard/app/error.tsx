"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SupportLink } from "@/components/SupportLink";

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
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Something went wrong
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          An unexpected error occurred. Please try again.
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={retry}
          disabled={isPending}
          style={{ padding: "10px 20px", boxShadow: "var(--shadow-accent-md)" }}
        >
          {isPending ? "Retrying..." : "Try again"}
        </Button>
        {digest && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "18px", fontWeight: 500 }}>
            Reference: <code>{digest}</code>
          </div>
        )}
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px", fontWeight: 500 }}>
          <SupportLink
            label="Contact support"
            subject={digest ? `Error report (ref ${digest})` : "Error report"}
          />
        </div>
      </div>
    </main>
  );
}
