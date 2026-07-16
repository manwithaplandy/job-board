"use client";

import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/SystemStates";

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
        <ErrorState
          className="rf-detail-error-state"
          title="This role couldn't be displayed"
          description="Something in this job’s saved data is malformed. The rest of the board is unaffected — pick another role, or reload the page to try again."
        />
      );
    }
    return this.props.children;
  }
}
