import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/Navigation";
import { Alert } from "@/components/ui/SystemStates";
import { ThreadList, type ThreadSummary } from "@/components/agent/ThreadList";
import { ActivityPanel } from "@/components/workspaces/ActivityPanel";
import type { ActivityItem } from "@/lib/workspaces/activity";

/**
 * The agent page's layout inside the app shell, shared by the route (app/agent/page.tsx)
 * and the gallery's agent page fixtures (AgentPageFixture), so the fixtures render the
 * page the user sees. It reads nothing: the route passes what it loaded, a fixture passes
 * fixed data.
 */
export function AgentPageView({
  badge,
  threads,
  currentId,
  notFound,
  activity,
  children,
}: {
  /** The test-data badge (TestDataBadge), or null. */
  badge: ReactNode;
  threads: ThreadSummary[];
  currentId: string | null;
  /** A ?t= id that named no conversation of this user. */
  notFound: boolean;
  activity: ActivityItem[] | null;
  /** The conversation, the empty state or a notice. */
  children: ReactNode;
}) {
  return (
    <main className="rf-secondary-page">
      <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
        <PageHeader title="Agent" description="Ask about your reviewed jobs, companies and profile." actions={badge} />
        <div className="rf-agent-layout">
          <ThreadList threads={threads} currentId={currentId} />
          <div className="rf-agent-main">
            {notFound && <Alert tone="warning">This conversation was not found. Pick one from the list or start a new one.</Alert>}
            {children}
          </div>
        </div>
        <ActivityPanel items={activity} />
      </div>
    </main>
  );
}
