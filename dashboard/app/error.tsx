"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6fa",
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
            color: "#161d29",
            marginBottom: "8px",
          }}
        >
          Something went wrong
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#6b7480",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          An unexpected error occurred. Please try again.
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={reset}
          style={{ padding: "10px 20px", boxShadow: "0 3px 10px rgba(59,111,212,.26)" }}
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
