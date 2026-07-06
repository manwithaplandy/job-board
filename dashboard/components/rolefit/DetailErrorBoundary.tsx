"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Contains a render crash in the job-detail subtree. Without this, a single malformed
// job (e.g. a persisted package with a bad shape) unwinds to the app-wide app/error.tsx
// and replaces the whole board. Callers pass key={jobId}, so selecting another job
// remounts the boundary and clears the error.
export class DetailErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("job detail render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 880, margin: "40px auto", padding: "24px 36px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--danger)" }}>
            This role couldn&apos;t be displayed
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, fontWeight: 500, lineHeight: 1.6 }}>
            Something in this job&apos;s saved data is malformed. The rest of the board is
            unaffected — pick another role, or reload the page to try again.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
