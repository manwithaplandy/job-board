import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getViewerPlan } from "@/lib/subscriptions";
import { getProfile } from "@/lib/queries";
import { catalogNow } from "@/lib/catalogClock";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { checkBudget, type BudgetState } from "@/lib/agent/budget";
import { loadThreadSurfaces, type HostChain } from "@/lib/agent/surfaces/host";
import { getThread, listThreads, loadMessages } from "@/lib/agent/threads";
import { DEFAULT_THREAD_TITLE } from "@/lib/agent/titles";
import { readActivity } from "@/lib/workspaces/activity";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { Alert } from "@/components/ui/SystemStates";
import { AgentChat, CompareStarter } from "@/components/agent/AgentChat";
import { AgentNotice, type AgentBlockingNotice } from "@/components/agent/AgentNotice";
import { TestDataBadge } from "@/components/agent/TestDataBadge";
import { ThreadList } from "@/components/agent/ThreadList";
import { ActivityPanel } from "@/components/workspaces/ActivityPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent · Rolefit" };

// The agent page (plan Tasks 0.14 and 1.20). Everything is read as the signed-in user; a
// thread id in ?t= is only ever read together with that user's id, so another user's
// thread reads as not found. The plan, kill-switch and budget checks here only pick a
// notice: POST /api/agent enforces them again on every send. The render writes nothing
// (previews read the production database): surfaces, their rows and the activity panel
// are reads, and ?compare with no thread open starts one from the browser.

async function readBudget(userId: string): Promise<BudgetState> {
  try {
    return await checkBudget(userId);
  } catch {
    // A failed spend read fails closed, like the route.
    return { ok: false, reason: "agent_disabled" };
  }
}

async function readSurfaces(userId: string, threadId: string): Promise<HostChain[]> {
  try {
    return await loadThreadSurfaces(userId, threadId);
  } catch (e) {
    // The conversation still shows; its surfaces are missing until a reload works.
    console.error("agent page: surface read failed", e instanceof Error ? e.name : typeof e);
    return [];
  }
}

/** ?compare=a,b: two different well-formed job ids, else null. */
function parseCompare(raw: string | string[] | undefined): readonly [string, string] | null {
  if (typeof raw !== "string") return null;
  const ids = raw.split(",");
  if (ids.length !== 2) return null;
  const [a, b] = ids.map((id) => id.trim());
  if (!JOB_ID_RE.test(a) || !JOB_ID_RE.test(b) || a.length > 300 || b.length > 300 || a === b) return null;
  return [a, b];
}

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const sp = await searchParams;
  const requested = typeof sp.t === "string" ? sp.t : null;
  const compare = parseCompare(sp.compare);
  const admin = isAdmin(claims);

  const [plan, budget, threads, thread, profile, clock, activity] = await Promise.all([
    getViewerPlan(userId, claims?.email ?? null),
    readBudget(userId),
    listThreads(userId),
    requested ? getThread(userId, requested) : Promise.resolve(null),
    getProfile(userId).catch(() => null),
    catalogNow(),
    readActivity(userId),
  ]);
  const [messages, surfaces] = thread
    ? await Promise.all([loadMessages(userId, thread.id), readSurfaces(userId, thread.id)])
    : [[], []];
  const notice: AgentBlockingNotice | null = !plan ? "no_plan" : budget.ok ? null : budget.reason;

  return (
    <AppShell header={<AppHeader current="agent" email={claims?.email ?? null} isAdmin={admin} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader
            title="Agent"
            description="Ask about your reviewed jobs, companies and profile."
            actions={<TestDataBadge admin={admin} clock={clock} />}
          />
          <div className="rf-agent-layout">
            <ThreadList threads={threads.map((t) => ({ id: t.id, title: t.title }))} currentId={thread?.id ?? null} />
            <div className="rf-agent-main">
              {requested && !thread && <Alert tone="warning">This conversation was not found. Pick one from the list or start a new one.</Alert>}
              {thread ? (
                <AgentChat
                  key={thread.id}
                  threadId={thread.id}
                  initialMessages={messages}
                  notice={notice}
                  autoTitle={messages.length === 0 && thread.title === DEFAULT_THREAD_TITLE}
                  surfaces={surfaces}
                  approvalsEnabled={approvalSecret() !== null}
                  compare={compare}
                  hasProfile={profile !== null}
                />
              ) : compare && notice === null ? (
                <CompareStarter compare={compare} />
              ) : (
                <>
                  {notice && <AgentNotice kind={notice} />}
                  <p className="rf-agent-chat__empty">Start a new conversation, or pick one from the list.</p>
                </>
              )}
            </div>
          </div>
          <ActivityPanel items={activity} />
        </div>
      </main>
    </AppShell>
  );
}
