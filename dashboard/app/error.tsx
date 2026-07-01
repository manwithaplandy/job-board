"use client";

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
            color: "#8a93a3",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          An unexpected error occurred. Please try again.
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            fontWeight: 700,
            fontSize: "13.5px",
            color: "#fff",
            background: "#3b6fd4",
            border: "none",
            borderRadius: "10px",
            padding: "10px 20px",
            cursor: "pointer",
            boxShadow: "0 3px 10px rgba(59,111,212,.26)",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
